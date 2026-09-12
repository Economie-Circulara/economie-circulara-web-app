-- =============================================================================
-- 0018 - FIX: `cancel_order` nu refacea stocul (regula de business incalcata in
--        silentiu)
-- =============================================================================
-- BUG (descoperit 2026-09-12, prin `supabase/tests/business_flow.sql`, testul B9):
-- La anularea unei comenzi deja ACCEPTATE, `public.cancel_order`
-- (`0007_orders_ops.sql`) trebuie sa refaca stocul si sa scrie evenimente
-- `reversal`. In practica nu facea NICI UNA, fara nicio eroare: comanda trecea in
-- `cancelled`, iar cantitatile consumate rămâneau scazute definitiv.
--
-- CAUZA: bucla de refacere citea evenimentele de consum cu `FOR UPDATE`:
--
--   for v_event in
--     select id, item_id, lot_id, quantity
--     from public.stock_events
--     where order_id = p_order_id and event_type = 'consumption' and lot_id is not null
--     for update                       -- <<< aici
--   loop ...
--
-- Sub RLS, o citire cu clauza de BLOCARE (`FOR UPDATE`/`FOR SHARE`) nu e evaluata
-- doar cu politicile de SELECT: Postgres cere si politica de **UPDATE** pe tabel,
-- iar randurile care nu o satisfac sunt **filtrate silentios** (nu eroare).
-- `stock_events` e un audit trail APPEND-ONLY - are doar politici SELECT + INSERT,
-- deliberat nicio politica UPDATE. Deci `select ... for update` returna 0 randuri,
-- bucla nu se executa niciodata, si functia mergea direct la `status = 'cancelled'`.
--
-- Verificat empiric pe aceeasi tranzactie, ca admin al organizatiei:
--   select count(*) ... where order_id = X and event_type = 'consumption'      -> 1
--   select count(*) from (select ... same ... for update) z                    -> 0
--
-- DE CE NU A FOST PRINS PANA ACUM: nu era o eroare, ci o bucla care nu rula.
-- Testele unitare mock-uiesc RPC-ul, `typecheck`/`lint`/`build` nu executa SQL, iar
-- testele de RLS verificau izolarea intre tenanti, nu invariantii de stoc. Acum e
-- acoperit de B9 in `supabase/tests/business_flow.sql`.
--
-- IMPACT: "Stocul se scade la acceptarea comenzii; la anulare stocul se reface"
-- (docs/handoff.md, secțiunea Catalog si comenzi; AGENTS.md §4) - a doua jumatate a
-- regulii nu functiona. Consecinta: stoc fantoma pierdut la fiecare anulare a unei
-- comenzi acceptate, plus audit trail incomplet (fara `reversal`).
--
-- FIX: se renunta la `FOR UPDATE` pe `stock_events`. Nu e o pierdere de siguranta:
--   * `stock_events` e append-only - randurile citite nu se modifica niciodata,
--     deci nu exista ce sa protejeze o blocare pe ele;
--   * concurenta reala e serializata deja de `select * from public.orders ...
--     FOR UPDATE` de la inceputul functiei (pe `orders` exista politica de UPDATE,
--     deci blocarea functioneaza acolo): doua anulari simultane ale aceleiasi
--     comenzi nu pot intra amandoua in ramura de refacere, a doua vede
--     `status = 'cancelled'` si cade cu OR001;
--   * `update public.lots set remaining_qty = ...` ia oricum propriul lock de rand
--     pe lotul atins.
--
-- Restul corpului e IDENTIC cu `0007_orders_ops.sql` (migrari aditive: nu se
-- editeaza migrarile existente - AGENTS.md). Semnatura neschimbata.
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
    -- Refacerea stocului e o operatiune interna (miscare de stoc) - rezervata
    -- staff-ului, la fel ca restul RPC-urilor din stock service. Clientul poate
    -- anula direct (fara aceasta functie) doar cat comanda e draft/sent, conform
    -- politicilor din 0003_rls_hardening.sql; o comanda `accepted` nu mai e in
    -- acel domeniu, deci ajunge aici doar prin actiunea explicita a staff-ului.
    if not app.is_staff_of(v_order.organization_id) then
      raise exception 'Doar personalul poate anula o comanda deja acceptata (necesita refacere stoc).'
        using errcode = 'OR004';
    end if;

    -- FARA `for update` (vezi antetul migrarii): sub RLS, o citire cu clauza de
    -- blocare ar cere si politica de UPDATE pe `stock_events`, care e append-only
    -- si nu are una => randurile ar fi filtrate silentios si bucla nu s-ar executa.
    for v_event in
      select id, item_id, lot_id, quantity
      from public.stock_events
      where order_id = p_order_id
        and event_type = 'consumption'
        and lot_id is not null
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
  end if;

  update public.orders set status = 'cancelled' where id = p_order_id returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.cancel_order(uuid) from public;
grant execute on function public.cancel_order(uuid) to authenticated, service_role;
