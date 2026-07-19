-- =============================================================================
-- Fix F3 (review) — Timestamp-uri per tranzitie de status pe comenzi
-- =============================================================================
-- Migrare aditiva peste schema inghetata din 0001_core_schema.sql (NU modifica
-- niciun tabel/enum/RPC existent, in afara de `accept_order` de mai jos). Adauga:
--
--   public.orders.accepted_at  timestamptz  -- momentul tranzitiei sent -> accepted
--   public.orders.delivered_at timestamptz  -- momentul tranzitiei accepted -> delivered
--   public.orders.closed_at    timestamptz  -- momentul tranzitiei delivered -> closed
--
-- Context: rapoartele (src/features/reports/calculations.ts) aproximau "livrat in
-- perioada" cu `delivery_date ?? updated_at` (delivery_date e o data PLANIFICATA,
-- introdusa manual la creare; updated_at se schimba la orice tranzitie ulterioara,
-- inclusiv delivered -> closed) — imprecis. Coloanele noi permit rapoartelor sa
-- foloseasca momentul REAL al tranzitiei.
--
-- Toate 3 coloane sunt NULLABLE: istoricul existent (comenzi deja acceptate/livrate/
-- inchise inainte de aceasta migrare) ramane cu valoarea null — rapoartele cad pe
-- vechea aproximare pentru acele randuri (vezi
-- `calculations.ts#resolveDeliveryReferenceDate`, fallback pastrat explicit).
--
-- Cine seteaza fiecare coloana:
--   * accepted_at  -> RPC `public.accept_order` (recreat mai jos: corp IDENTIC cu
--     0007_orders_ops.sql#accept_order, DOAR UPDATE-ul final schimbat sa includa
--     `accepted_at = now()` — nicio alta linie de logica atinsa).
--   * delivered_at / closed_at -> NU au RPC dedicat (delivered/closed sunt tranzitii
--     "plain", fara efecte de stoc) — se seteaza la nivel de aplicatie, in
--     `src/features/orders/service.ts#setOrderStatus` (UPDATE simplu din server
--     action), nu in aceasta migrare.
--   * `cancel_order` (0007_orders_ops.sql) ramane NESCHIMBAT — anularea nu e o
--     tranzitie de timeline pozitiva (nu are coloana proprie de timestamp).
-- =============================================================================

alter table public.orders
  add column accepted_at timestamptz,
  add column delivered_at timestamptz,
  add column closed_at timestamptz;

-- -----------------------------------------------------------------------------
-- accept_order — sent -> accepted, consuma stocul FIFO pentru fiecare linie
-- -----------------------------------------------------------------------------
-- Corp IDENTIC cu 0007_orders_ops.sql#accept_order (aceleasi verificari, acelasi
-- FOR UPDATE, aceeasi bucla FIFO/consume_fifo, aceleasi coduri de eroare OR001/
-- OR002/OR004) — SINGURA schimbare e in UPDATE-ul final, care acum seteaza si
-- `accepted_at = now()`.
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

  -- FOR UPDATE pe order_items: blocheaza liniile comenzii pe durata acceptarii, ca
  -- sa nu poata fi editate concurent (RLS le-ar permite editarea clientului cat timp
  -- statusul e inca 'sent', pana la UPDATE-ul final de mai jos).
  for v_item in
    select item_id, quantity
    from public.order_items
    where order_id = p_order_id
    for update
  loop
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
