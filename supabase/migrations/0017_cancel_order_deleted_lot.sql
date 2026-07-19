-- =============================================================================
-- 0017_cancel_order_deleted_lot.sql — refacerea stocului la anulare cand lotul
-- consumat a fost STERS intre acceptare si anulare (follow-up review,
-- docs/plans/followups-review-ramase.md §2).
--
-- Context: `stock_events.lot_id` e `on delete set null` (0001). `cancel_order`
-- (0007) reface stocul parcurgand evenimentele 'consumption' cu
-- `lot_id is not null` — un lot sters intre timp isi pierde referinta, evenimentul
-- e sarit si cantitatea consumata NU se mai intoarce in stoc (dispare tacut).
--
-- Fix: pentru evenimentele 'consumption' orfane (lot_id null), anularea creeaza
-- un LOT DE AJUSTARE per articol (provenance 'inventory_adjustment', cantitatea
-- agregata a consumurilor orfane) + un stock_event 'reversal' pe lotul nou.
-- Fara eveniment 'intake' pe lotul de ajustare: 'reversal' este intrarea de audit
-- a cantitatii (suma evenimentelor lotului = remaining_qty, consistent cu loturile
-- normale: intake - consumption + reversal); un 'intake' suplimentar ar numara
-- cantitatea de doua ori.
--
-- `create or replace` — corpul de mai jos e identic cu 0007 cu exceptia buclei
-- noi pentru evenimentele orfane. Semnatura nu se schimba (nimic de actualizat
-- in database.types.ts).
-- =============================================================================

create or replace function public.cancel_order(p_order_id uuid)
returns public.orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders;
  v_event record;
  v_orphan record;
  v_adjust_lot_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Comanda inexistenta sau fara acces: %', p_order_id
      using errcode = 'OR002';
  end if;

  if v_order.status not in ('draft', 'sent', 'accepted') then
    raise exception 'Comanda % nu poate fi anulata din statusul %.', p_order_id, v_order.status
      using errcode = 'OR001';
  end if;

  if v_order.status = 'accepted' then
    -- Refacerea stocului e o operatiune interna (miscare de stoc) — rezervata
    -- staff-ului, la fel ca restul RPC-urilor din stock service. Clientul poate
    -- anula direct (fara aceasta functie) doar cat comanda e draft/sent, conform
    -- politicilor din 0003_client_write_hardening.sql; o comanda `accepted` nu mai
    -- e in acel domeniu, deci ajunge aici doar prin actiunea explicita a staff-ului.
    if not app.is_staff_of(v_order.organization_id) then
      raise exception 'Doar personalul poate anula o comanda deja acceptata (necesita refacere stoc).'
        using errcode = 'OR004';
    end if;

    for v_event in
      select id, item_id, lot_id, quantity
      from public.stock_events
      where order_id = p_order_id
        and event_type = 'consumption'
        and lot_id is not null
      for update
    loop
      update public.lots
      set remaining_qty = remaining_qty + abs(v_event.quantity)
      where id = v_event.lot_id;

      insert into public.stock_events (
        organization_id, item_id, lot_id, event_type, quantity, reason, order_id, created_by
      )
      values (
        v_order.organization_id, v_event.item_id, v_event.lot_id, 'reversal',
        abs(v_event.quantity),
        'Anulare comanda ' || coalesce(v_order.order_number, p_order_id::text),
        p_order_id, auth.uid()
      );
    end loop;

    -- Consumuri al caror lot a fost STERS intre timp (lot_id devenit null prin
    -- `on delete set null`): cantitatea nu mai poate fi readaugata in lotul
    -- original, deci se creeaza un lot de ajustare per articol, cu cantitatea
    -- agregata, + 'reversal' de audit pe lotul nou (vezi antetul migrarii).
    for v_orphan in
      select item_id, sum(abs(quantity)) as total_qty
      from public.stock_events
      where order_id = p_order_id
        and event_type = 'consumption'
        and lot_id is null
      group by item_id
    loop
      insert into public.lots (
        organization_id, item_id, entry_date, source, provenance,
        initial_qty, remaining_qty
      )
      values (
        v_order.organization_id, v_orphan.item_id, current_date,
        'Ajustare la anularea comenzii ' || coalesce(v_order.order_number, p_order_id::text)
          || ' (lotul consumat a fost sters)',
        'inventory_adjustment',
        v_orphan.total_qty, v_orphan.total_qty
      )
      returning id into v_adjust_lot_id;

      insert into public.stock_events (
        organization_id, item_id, lot_id, event_type, quantity, reason, order_id, created_by
      )
      values (
        v_order.organization_id, v_orphan.item_id, v_adjust_lot_id, 'reversal',
        v_orphan.total_qty,
        'Anulare comanda ' || coalesce(v_order.order_number, p_order_id::text)
          || ' — lot original sters, stoc refacut in lot de ajustare',
        p_order_id, auth.uid()
      );
    end loop;
  end if;

  update public.orders set status = 'cancelled' where id = p_order_id returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.cancel_order(uuid) from public;
grant execute on function public.cancel_order(uuid) to authenticated, service_role;
