-- =============================================================================
-- Itemi fara urmarire de stoc (`items.is_tracked`) - materiale "nelimitate"
-- =============================================================================
-- Context (acelasi epic ca 0028): retetele reale de beton contin componente pe
-- care nimeni nu le tine pe loturi - apa de la retea, aer antrenat, aditivi
-- dozati din rezervor. Pana acum singurul mod de a le pune intr-o reteta era sa
-- le declari itemi fizici, ceea ce le facea si consumabile din stoc: orice
-- proces esua cu "Stoc insuficient" (LT001) pentru ca nu exista si nu are sens
-- sa existe un lot de apa.
--
-- Fix, pe acelasi tipar ca `items.kind` din 0005 (migrare aditiva + regula
-- impusa la nivel de aplicatie acolo unde e vorba de UI): o coloana booleana
-- `is_tracked`, implicit `true` (nimic nu se schimba pentru itemii existenti).
-- Cand e `false`, itemul se comporta ca orice item fizic PESTE TOT (apare in
-- catalog, in retete, in trasabilitate), cu o singura exceptie: e SARIT de la
-- consumul/scaderea de stoc si de la consumul FIFO pe loturi - exact cum sunt
-- deja sarite serviciile in `accept_order` (0022_accept_order_skip_service_items.sql).
--
-- `is_tracked` are sens doar pentru `kind = 'physical'`; serviciile nu au oricum
-- concept de stoc si raman sarite pe ramura lor de `kind` (formularul de item
-- arata comutatorul doar la itemii fizici - src/features/items/item-form.tsx).
-- =============================================================================

alter table public.items
  add column is_tracked boolean not null default true;

comment on column public.items.is_tracked is
  'Doar pentru `kind = physical`: false = material generic, fara cantitate limitata '
  '(apa, aer, aditivi de la retea) - nu se consuma/scade din stoc si nu participa la '
  'consumul FIFO pe loturi, dar poate fi componenta de reteta. Implicit true. '
  'Vezi migrarea 0029.';

-- Filtrare/afisare in ecranele de stoc si productie (analog `items_kind_idx` din 0005).
create index items_is_tracked_idx on public.items (organization_id, is_tracked);

-- -----------------------------------------------------------------------------
-- 1. accept_order - sare si peste itemii fara urmarire de stoc
-- -----------------------------------------------------------------------------
-- Acelasi corp ca in 0022 (care il rescria pe cel din 0015), cu o singura
-- schimbare: conditia de `continue` acopera acum si `not i.is_tracked`. Un item
-- nelimitat vandut intr-o comanda (ex. o livrare care include apa tehnologica)
-- nu are loturi -> `consume_fifo` ar arunca LT001, exact bug-ul reparat in 0022
-- pentru servicii. Efectele colaterale sunt identice cu cele documentate acolo:
-- fara `stock_events` de consum, `cancel_order` (0018) nu are ce reface, iar
-- certificatul de trasabilitate nu il listeaza (e despre materialele cu lot).
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
  -- join-ul la `items` e doar pentru `kind`/`is_tracked`, nu intra sub blocare).
  for v_item in
    select oi.item_id, oi.quantity, i.kind, i.is_tracked
    from public.order_items oi
    join public.items i on i.id = oi.item_id
    where oi.order_id = p_order_id
    for update of oi
  loop
    -- Serviciile (abonamente etc.) nu au stoc fizic, iar itemii `is_tracked = false`
    -- (apa, aer) sunt nelimitati prin definitie - nimic de consumat in ambele cazuri.
    if v_item.kind = 'service' or not v_item.is_tracked then
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

-- -----------------------------------------------------------------------------
-- 2. confirm_process - punctul echivalent din productie/reciclare
-- -----------------------------------------------------------------------------
-- Acelasi corp ca in 0008_reconditioning.sql, cu doua verificari noi:
--
--   * INPUT: itemii `service` sau `is_tracked = false` sunt sariti - fara
--     `consume_fifo` si fara rand in `process_inputs`. Al doilea motiv, pe langa
--     LT001: `process_inputs.lot_id` e NOT NULL (0001), deci nici nu s-ar putea
--     scrie un rand de trasabilitate pentru un consum fara lot.
--   * OUTPUT: un item `is_tracked = false` nu primeste lot nou (`create_lot`) -
--     altfel un material declarat "nelimitat" ar capata brusc stoc, adica exact
--     inversul definitiei lui. Randurile de `process_outputs` urmeaza loturile,
--     deci nici acolo nu apare. Itemii `service` pe ramura de output raman
--     NESCHIMBATI fata de 0008 (comportament preexistent, in afara acestui fix).
--
-- Restul functiei e neatins: acelasi SECURITY INVOKER, aceleasi coduri de
-- eroare (LT003/LT004/LT005), aceeasi atomicitate (un singur apel = o singura
-- tranzactie; orice esec face rollback complet - "fara productie partiala").
create or replace function public.confirm_process(
  p_type           public.process_type,
  p_output_item_id uuid,
  p_recipe_id      uuid default null,
  p_notes          text default null,
  p_inputs         jsonb default '[]'::jsonb,
  p_outputs        jsonb default '[]'::jsonb
)
returns public.processes
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org       uuid;
  v_process   public.processes;
  v_input     record;
  v_consumed  record;
  v_output    record;
  v_lot       public.lots;
  v_item      record;
begin
  select organization_id into v_org from public.items where id = p_output_item_id;
  if v_org is null then
    raise exception 'Item de output inexistent: %', p_output_item_id
      using errcode = 'LT003';
  end if;

  if not app.is_staff_of(v_org) then
    raise exception 'Nu ai permisiunea de a porni un proces pentru aceasta organizatie.'
      using errcode = 'LT004';
  end if;

  if p_inputs is null or jsonb_typeof(p_inputs) <> 'array' or jsonb_array_length(p_inputs) = 0 then
    raise exception 'Procesul trebuie sa aiba cel putin un input.'
      using errcode = 'LT005';
  end if;

  if p_outputs is null or jsonb_typeof(p_outputs) <> 'array' or jsonb_array_length(p_outputs) = 0 then
    raise exception 'Procesul trebuie sa aiba cel putin un output.'
      using errcode = 'LT005';
  end if;

  -- 2.1 Randul de proces - pornit si finalizat in aceeasi tranzactie (fara
  -- productie partiala: fie totul reuseste, fie nimic nu se persista).
  insert into public.processes (
    organization_id, type, status, output_item_id, recipe_id, notes,
    started_at, completed_at, created_by
  )
  values (
    v_org, p_type, 'completed', p_output_item_id, p_recipe_id, p_notes,
    now(), now(), auth.uid()
  )
  returning * into v_process;

  -- 2.2 Inputuri - consum FIFO/manual per item (poate implica mai multe loturi).
  for v_input in
    select * from jsonb_to_recordset(p_inputs) as x(item_id uuid, lot_ids uuid[], qty numeric)
  loop
    if v_input.item_id is null or v_input.qty is null or v_input.qty <= 0 then
      raise exception 'Input invalid in procesul %: item/cantitate lipsa.', v_process.id
        using errcode = 'LT005';
    end if;

    select kind, is_tracked into v_item from public.items where id = v_input.item_id;
    if not found then
      raise exception 'Item de input inexistent: %', v_input.item_id
        using errcode = 'LT003';
    end if;

    -- Serviciile si itemii nelimitati (apa, aer) nu se consuma din stoc - vezi
    -- nota de la inceputul migrarii si tiparul din 0022 pentru `accept_order`.
    if v_item.kind = 'service' or not v_item.is_tracked then
      continue;
    end if;

    for v_consumed in
      select * from public.consume_fifo(
        p_item_id        => v_input.item_id,
        p_qty            => v_input.qty,
        p_manual_lot_ids => v_input.lot_ids,
        p_event_type     => 'consumption',
        p_process_id     => v_process.id
      )
    loop
      insert into public.process_inputs (organization_id, process_id, lot_id, item_id, quantity)
      values (v_org, v_process.id, v_consumed.lot_id, v_input.item_id, v_consumed.qty);
    end loop;
  end loop;

  -- 2.3 Outputuri - un lot nou per rand (provenance: internal_production /
  -- recycling / reconditioning, ales de utilizator - vezi src/features/production).
  for v_output in
    select * from jsonb_to_recordset(p_outputs) as x(
      item_id uuid,
      qty numeric,
      provenance public.lot_provenance,
      source text,
      location text,
      quality_status public.quality_status
    )
  loop
    if v_output.item_id is null or v_output.qty is null or v_output.qty <= 0 then
      raise exception 'Output invalid in procesul %: item/cantitate lipsa.', v_process.id
        using errcode = 'LT005';
    end if;

    select kind, is_tracked into v_item from public.items where id = v_output.item_id;
    if not found then
      raise exception 'Item de output inexistent: %', v_output.item_id
        using errcode = 'LT003';
    end if;

    -- Un item nelimitat nu capata stoc: fara lot nou, deci nici rand de
    -- `process_outputs` (acesta refera obligatoriu un lot).
    if not v_item.is_tracked then
      continue;
    end if;

    select * into v_lot from public.create_lot(
      p_item_id        => v_output.item_id,
      p_quantity       => v_output.qty,
      p_provenance     => v_output.provenance,
      p_source         => coalesce(v_output.source, 'Proces ' || v_process.id::text),
      p_location       => v_output.location,
      p_quality_status => v_output.quality_status
    );

    insert into public.process_outputs (organization_id, process_id, lot_id, item_id, quantity)
    values (v_org, v_process.id, v_lot.id, v_output.item_id, v_output.qty);
  end loop;

  return v_process;
end;
$$;

revoke all on function public.confirm_process(
  public.process_type, uuid, uuid, text, jsonb, jsonb
) from public;
grant execute on function public.confirm_process(
  public.process_type, uuid, uuid, text, jsonb, jsonb
) to authenticated, service_role;
