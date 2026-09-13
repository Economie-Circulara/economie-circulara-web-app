-- =============================================================================
-- Fix: accept_order esua pentru comenzi cu itemi de tip `service`
-- =============================================================================
-- Bug confirmat: o comanda care contine un item `kind = 'service'` (abonament -
-- Task B, migrarea 0005_item_kind.sql) nu putea fi ACCEPTATA. `accept_order`
-- (0007_orders_ops.sql, ultima versiune in 0015_order_status_timestamps.sql)
-- apela necondiționat `consume_fifo` pentru fiecare linie a comenzii, iar un
-- serviciu nu are niciodata loturi de stoc -> `consume_fifo` arunca 'Stoc
-- insuficient' (LT001), chiar si pentru cantitatea 1. Formularul de comanda
-- (src/features/orders/queries.ts, `getSellableItems`) permite alegerea oricarui
-- item `sellable` (fizic SAU serviciu), deci bug-ul era la indemana din UI.
--
-- Fix: bucla peste liniile comenzii sare peste itemii `kind = 'service'` - nu se
-- consuma/scade stoc pentru ei (nu au stoc). Efecte colaterale, ambele corecte:
--   * `cancel_order` (0018) reface stocul doar pe baza `stock_events` cu
--     `event_type = 'consumption'` legate de comanda - fara eveniment scris
--     pentru serviciu, nu are ce reface (comportament deja corect, NESCHIMBAT).
--   * Certificatul de trasabilitate (Task G) construieste "Produse livrate" din
--     loturile efectiv consumate (`stock_events`) - un serviciu, neavand
--     consum de stoc, nu apare acolo. E intentionat: certificatul e despre
--     trasabilitatea MATERIALELOR, nu despre servicii.
--
-- Migrare aditiva (AGENTS.md: nu se editeaza migrarile existente): `create or
-- replace function` cu ACELASI corp ca 0015, plus verificarea de mai jos si un
-- join la `items` (doar pentru `kind`), pastrand `for update` STRICT pe
-- `order_items` (`for update of oi`) - la fel ca inainte, nu se blocheaza si
-- randul din `items`.
-- =============================================================================

create or replace function public.accept_order(p_order_id uuid)
returns public.orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders;
  v_item  record;
begin
  -- FOR UPDATE: blocheaza randul comenzii pana la commit, ca sa nu se suprapuna cu
  -- o alta tranzitie concurenta (ex. o a doua acceptare sau o anulare simultana).
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Comanda inexistenta sau fara acces: %', p_order_id
      using errcode = 'OR002';
  end if;

  if not app.is_staff_of(v_order.organization_id) then
    raise exception 'Nu ai permisiunea de a accepta aceasta comanda.'
      using errcode = 'OR004';
  end if;

  if v_order.status <> 'sent' then
    raise exception 'Comanda % nu poate fi acceptata din statusul % (trebuie sa fie "sent").',
      p_order_id, v_order.status
      using errcode = 'OR001';
  end if;

  -- FOR UPDATE OF oi: blocheaza liniile comenzii pe durata acceptarii (ca inainte -
  -- join-ul la `items` e doar pentru `kind`, nu intra sub blocarea `for update`).
  for v_item in
    select oi.item_id, oi.quantity, i.kind
    from public.order_items oi
    join public.items i on i.id = oi.item_id
    where oi.order_id = p_order_id
    for update of oi
  loop
    -- Serviciile (abonamente etc.) nu au stoc fizic - nimic de consumat.
    if v_item.kind = 'service' then
      continue;
    end if;

    -- Consum FIFO atomic (vezi 0004_stock_service.sql). O eroare aici (ex. LT001 -
    -- stoc insuficient) opreste bucla si propaga exceptia -> toata functia (si
    -- consumurile deja facute in aceasta bucla) fac rollback.
    perform public.consume_fifo(
      p_item_id        => v_item.item_id,
      p_qty            => v_item.quantity,
      p_manual_lot_ids => null,
      p_event_type     => 'consumption',
      p_order_id       => p_order_id,
      p_process_id     => null,
      p_reason         => 'Acceptare comanda ' || coalesce(v_order.order_number, p_order_id::text)
    );
  end loop;

  update public.orders
  set status = 'accepted', accepted_at = now()
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.accept_order(uuid) from public;
grant execute on function public.accept_order(uuid) to authenticated, service_role;
