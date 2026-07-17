-- =============================================================================
-- Task C — Stock service (RPC-uri pentru miscari de stoc atomice)
-- =============================================================================
-- Migrare aditiva peste schema inghetata din 0001_core_schema.sql. Nu modifica
-- tabele/enum-uri existente — adauga trei functii RPC folosite de
-- `src/features/stock/service.ts` (contractul consumat si de Task D si Task E):
--
--   public.create_lot(...)     -> creeaza un lot + stock_event 'intake'
--   public.consume_fifo(...)   -> consuma FIFO (sau selectie manuala) din loturile
--                                  disponibile ale unui item + stock_events 'consumption'
--   public.set_lot_block(...)  -> blocheaza/deblocheaza un lot + stock_event 'block'/'unblock'
--
-- Alegere SECURITY INVOKER (nu DEFINER) pentru toate trei:
--   * Fiecare functie ruleaza in tranzactia (implicita) a apelului ei -> orice
--     exceptie (ex. stoc insuficient) face rollback complet -> atomicitate fara
--     nevoie de cod special.
--   * Cu SECURITY INVOKER, RLS ramane in vigoare pe fiecare SELECT/INSERT/UPDATE
--     din corpul functiei, evaluata cu identitatea (auth.uid()) a apelantului.
--     Politicile existente (`lots_staff_all`, `stock_events_staff_insert`) impun deja
--     exact regula de care avem nevoie (doar staff din organizatia proprie), deci nu
--     trebuie duplicata logica de autorizare si nu se ocoleste RLS inutil
--     (principiul minimului privilegiu — spre deosebire de `app.*`/`org_branding`,
--     care sunt SECURITY DEFINER pentru ca trebuie sa ruleze INAINTE de a avea
--     context RLS, resp. pentru un apelant anonim).
--   * Verificarea explicita `app.is_staff_of(v_org)` din functii e doar pentru un
--     mesaj de eroare clar (RLS ar respinge oricum insert/update-ul cu o eroare
--     mai generica de "permission denied" / 0 randuri afectate).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. create_lot — intrare in stoc (lot nou) + eveniment 'intake'
-- -----------------------------------------------------------------------------
create or replace function public.create_lot(
  p_item_id        uuid,
  p_quantity       numeric,
  p_provenance     public.lot_provenance,
  p_source         text default null,
  p_entry_date     date default null,
  p_location       text default null,
  p_quality_status public.quality_status default null,
  p_reason         text default null
)
returns public.lots
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_lot public.lots;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Cantitatea lotului trebuie sa fie mai mare ca zero.'
      using errcode = 'LT005';
  end if;

  select organization_id into v_org from public.items where id = p_item_id;
  if v_org is null then
    raise exception 'Item inexistent: %', p_item_id
      using errcode = 'LT003';
  end if;

  if not app.is_staff_of(v_org) then
    raise exception 'Nu ai permisiunea de a adauga stoc pentru aceasta organizatie.'
      using errcode = 'LT004';
  end if;

  insert into public.lots (
    organization_id, item_id, entry_date, source, provenance, location,
    initial_qty, remaining_qty, quality_status
  )
  values (
    v_org, p_item_id, coalesce(p_entry_date, current_date), p_source, p_provenance, p_location,
    p_quantity, p_quantity, coalesce(p_quality_status, 'unchecked')
  )
  returning * into v_lot;

  insert into public.stock_events (
    organization_id, item_id, lot_id, event_type, quantity, reason, created_by
  )
  values (
    v_org, p_item_id, v_lot.id, 'intake', p_quantity, p_reason, auth.uid()
  );

  return v_lot;
end;
$$;

revoke all on function public.create_lot(
  uuid, numeric, public.lot_provenance, text, date, text, public.quality_status, text
) from public;
grant execute on function public.create_lot(
  uuid, numeric, public.lot_provenance, text, date, text, public.quality_status, text
) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. consume_fifo — consum FIFO (implicit) sau selectie manuala de loturi
-- -----------------------------------------------------------------------------
-- Consuma `p_qty` din itemul `p_item_id` din loturile nelocate cu remaining_qty > 0,
-- in ordinea entry_date (FIFO). Daca `p_manual_lot_ids` e dat, restrange consumul
-- STRICT la acele loturi (tot nelocate / cu stoc), in ordinea specificata in array
-- (selectie manuala la productie — vezi handoff: "FIFO implicit, cu optiune de
-- selectie manuala"). Scrie cate un stock_event per lot consumat (semnat negativ).
-- Arunca eroare (errcode LT001) daca stocul disponibil e insuficient — intreaga
-- functie face rollback (nu se aplica niciun consum partial).
create or replace function public.consume_fifo(
  p_item_id        uuid,
  p_qty            numeric,
  p_manual_lot_ids uuid[] default null,
  p_event_type     public.stock_event_type default null,
  p_order_id       uuid default null,
  p_process_id     uuid default null,
  p_reason         text default null
)
returns table (lot_id uuid, qty numeric)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org         uuid;
  v_remaining   numeric;
  v_take        numeric;
  v_event_type  public.stock_event_type := coalesce(p_event_type, 'consumption');
  v_lot_ids     uuid[] := '{}';
  v_qtys        numeric[] := '{}';
  r             record;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Cantitatea de consumat trebuie sa fie mai mare ca zero.'
      using errcode = 'LT005';
  end if;
  v_remaining := p_qty;

  select organization_id into v_org from public.items where id = p_item_id;
  if v_org is null then
    raise exception 'Item inexistent: %', p_item_id
      using errcode = 'LT003';
  end if;

  if not app.is_staff_of(v_org) then
    raise exception 'Nu ai permisiunea de a consuma stoc pentru aceasta organizatie.'
      using errcode = 'LT004';
  end if;

  -- Loturile candidate (nelocate, cu stoc) folosesc `lots_fifo_idx`. Cand se cere
  -- selectie manuala, ordinea e data de pozitia in `p_manual_lot_ids`; altfel FIFO
  -- strict pe `entry_date` (tie-break pe `created_at`).
  for r in
    select l.id, l.remaining_qty
    from public.lots l
    where l.item_id = p_item_id
      and l.organization_id = v_org
      and l.is_blocked = false
      and l.remaining_qty > 0
      and (p_manual_lot_ids is null or l.id = any (p_manual_lot_ids))
    order by
      case when p_manual_lot_ids is not null then array_position(p_manual_lot_ids, l.id) end asc nulls last,
      l.entry_date asc,
      l.created_at asc
    for update
  loop
    exit when v_remaining <= 0;

    v_take := least(r.remaining_qty, v_remaining);

    update public.lots set remaining_qty = remaining_qty - v_take where id = r.id;

    insert into public.stock_events (
      organization_id, item_id, lot_id, event_type, quantity, reason, order_id, process_id, created_by
    )
    values (
      v_org, p_item_id, r.id, v_event_type, -v_take, p_reason, p_order_id, p_process_id, auth.uid()
    );

    v_lot_ids := array_append(v_lot_ids, r.id);
    v_qtys := array_append(v_qtys, v_take);
    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then
    raise exception 'Stoc insuficient pentru itemul %: lipsesc % unitati din % cerute.',
      p_item_id, v_remaining, p_qty
      using errcode = 'LT001';
  end if;

  return query select unnest(v_lot_ids), unnest(v_qtys);
end;
$$;

revoke all on function public.consume_fifo(
  uuid, numeric, uuid[], public.stock_event_type, uuid, uuid, text
) from public;
grant execute on function public.consume_fifo(
  uuid, numeric, uuid[], public.stock_event_type, uuid, uuid, text
) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. set_lot_block — blocare / deblocare lot cu motiv + eveniment 'block'/'unblock'
-- -----------------------------------------------------------------------------
create or replace function public.set_lot_block(
  p_lot_id  uuid,
  p_blocked boolean,
  p_reason  text default null
)
returns public.lots
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lot public.lots;
begin
  if p_blocked and (p_reason is null or btrim(p_reason) = '') then
    raise exception 'Motivul blocarii este obligatoriu.'
      using errcode = 'LT005';
  end if;

  -- RLS (`lots_staff_all`) filtreaza deja randul in afara organizatiei apelantului;
  -- daca update-ul nu afecteaza niciun rand, tratam ca "lot inexistent / fara acces".
  update public.lots
  set is_blocked    = p_blocked,
      block_reason  = case when p_blocked then p_reason else null end
  where id = p_lot_id
  returning * into v_lot;

  if v_lot.id is null then
    raise exception 'Lot inexistent sau fara acces: %', p_lot_id
      using errcode = 'LT002';
  end if;

  insert into public.stock_events (
    organization_id, item_id, lot_id, event_type, quantity, reason, created_by
  )
  values (
    v_lot.organization_id, v_lot.item_id, v_lot.id,
    case when p_blocked then 'block' else 'unblock' end,
    0, p_reason, auth.uid()
  );

  return v_lot;
end;
$$;

revoke all on function public.set_lot_block(uuid, boolean, text) from public;
grant execute on function public.set_lot_block(uuid, boolean, text)
  to authenticated, service_role;
