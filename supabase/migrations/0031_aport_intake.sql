-- =============================================================================
-- Task X8 - Aport: intrare in stoc din comanda clientului (accept_intake_order)
-- =============================================================================
-- Migrare aditiva, aplicata DUPA 0030 (care adauga enum-ul `order_type`, coloana
-- `lots.client_id` si valoarea `lot_provenance = 'aport_client'`). Trebuie sa fie
-- un fisier SEPARAT: aici se FOLOSESTE literalul 'aport_client', ceea ce Postgres
-- interzice in aceeasi tranzactie cu `alter type ... add value` (vezi nota din
-- 0008_reconditioning.sql si din 0030_order_types.sql).
--
-- Contine:
--   1. `create_lot` re-creata cu un parametru nou `p_client_id` (default null),
--      pasat mai departe in `lots.client_id`. NU se duplica logica - toate
--      apelurile existente (confirm_process, accept_return_order, stock service)
--      raman valide, cu `client_id` null.
--   2. `accept_intake_order(p_order_id)` - accepta ATOMIC o comanda `aport`:
--      creeaza cate un lot per linie (provenance 'aport_client', client_id =
--      clientul comenzii) + seteaza `status='accepted'`. Analogul lui
--      `accept_return_order` (0010_returns.sql) pentru noul sens de flux.
--   3. `accept_order` re-creata cu o garda: o comanda `aport` NU poate fi
--      acceptata pe fluxul de vanzare (acela CONSUMA stoc - exact invers).
--
-- Coduri de eroare (in stilul OR00x/RT00x):
--   AP001 - tranzitie de status invalida (comanda-aport nu e in "draft")
--   AP002 - comanda inexistenta sau fara acces (RLS)
--   AP003 - comanda nu e de tip `aport`
--   AP004 - permisiune insuficienta (operatiune rezervata staff-ului)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. create_lot + p_client_id
-- -----------------------------------------------------------------------------
-- DROP + CREATE (nu `create or replace`): un parametru in plus, chiar si cu
-- default, inseamna o SEMNATURA noua - `create or replace` ar lasa in baza DOUA
-- suprascrieri ale functiei, iar apelurile cu 8 argumente ar deveni ambigue
-- ("function is not unique"). Corpul e identic cu cel din 0004_stock_service.sql,
-- plus `client_id`. Functiile care o apeleaza (confirm_process, accept_return_order)
-- nu se rup: plpgsql rezolva apelul la RUNTIME, nu la definire.
drop function if exists public.create_lot(
  uuid, numeric, public.lot_provenance, text, date, text, public.quality_status, text
);

create or replace function public.create_lot(
  p_item_id        uuid,
  p_quantity       numeric,
  p_provenance     public.lot_provenance,
  p_source         text default null,
  p_entry_date     date default null,
  p_location       text default null,
  p_quality_status public.quality_status default null,
  p_reason         text default null,
  -- Clientul care a adus materialul. Populat DOAR de `accept_intake_order`
  -- (aport); orice alt apelant il lasa null - vezi comentariul coloanei (0030).
  p_client_id      uuid default null
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
    initial_qty, remaining_qty, quality_status, client_id
  )
  values (
    v_org, p_item_id, coalesce(p_entry_date, current_date), p_source, p_provenance, p_location,
    p_quantity, p_quantity, coalesce(p_quality_status, 'unchecked'), p_client_id
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
  uuid, numeric, public.lot_provenance, text, date, text, public.quality_status, text, uuid
) from public;
grant execute on function public.create_lot(
  uuid, numeric, public.lot_provenance, text, date, text, public.quality_status, text, uuid
) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. accept_intake_order - draft -> accepted, creeaza loturi ('aport_client')
-- -----------------------------------------------------------------------------
-- SECURITY INVOKER (ca toate RPC-urile din 0004/0007/0008/0010): ruleaza in
-- tranzactia apelului -> orice eroare face ROLLBACK complet, niciun lot creat
-- partial.
--
-- Diferente fata de `accept_return_order` (0010), toate intentionate:
--   * validarea e pe `order_type = 'aport'`, nu pe existenta unui `order_links`:
--     aportul e un tip de comanda de SINE STATATOR, nu o comanda derivata dintr-o
--     alta comanda (nu exista o "comanda originala" de care sa fie legat).
--   * `quality_status => 'unchecked'` (NU 'passed' ca la retur): materialul adus
--     de un client extern NU a trecut prin niciun control al organizatiei in
--     momentul acceptarii - acceptarea inseamna doar "l-am primit fizic". QC-ul
--     se face ulterior, din ecranul de stoc (blocare/deblocare lot, marcare
--     calitate). La retur, comentariul din 0010 explica situatia inversa:
--     inspectia s-a facut INAINTE ca staff-ul sa apese "Accepta retur".
create or replace function public.accept_intake_order(p_order_id uuid)
returns public.orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders;
  v_item  record;
begin
  -- FOR UPDATE: blocheaza randul comenzii pana la commit (ca la accept_order).
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Comanda inexistenta sau fara acces: %', p_order_id
      using errcode = 'AP002';
  end if;

  if not app.is_staff_of(v_order.organization_id) then
    raise exception 'Doar personalul poate accepta un aport.'
      using errcode = 'AP004';
  end if;

  if v_order.order_type <> 'aport' then
    raise exception 'Comanda % nu este de tip aport (tip curent: %).',
      p_order_id, v_order.order_type
      using errcode = 'AP003';
  end if;

  if v_order.status <> 'draft' then
    raise exception 'Aportul % nu poate fi acceptat din statusul % (trebuie sa fie "draft").',
      p_order_id, v_order.status
      using errcode = 'AP001';
  end if;

  -- FOR UPDATE pe order_items: blocheaza liniile pe durata acceptarii.
  for v_item in
    select item_id, quantity
    from public.order_items
    where order_id = p_order_id
    for update
  loop
    perform public.create_lot(
      p_item_id        => v_item.item_id,
      p_quantity       => v_item.quantity,
      p_provenance     => 'aport_client'::public.lot_provenance,
      p_source         => null,
      p_entry_date     => null,
      p_location       => null,
      p_quality_status => 'unchecked'::public.quality_status,
      p_reason         => 'Acceptare aport ' || coalesce(v_order.order_number, p_order_id::text),
      p_client_id      => v_order.client_id
    );
  end loop;

  -- `accepted_at` se seteaza (ca in accept_order, 0015) - e momentul intrarii
  -- efective a materialului in stoc. Comanda-aport se opreste AICI: nu intra in
  -- traseul sent -> delivered -> closed (nu se livreaza nimic clientului), exact
  -- ca o comanda-retur acceptata prin `accept_return_order`.
  update public.orders
  set status = 'accepted', accepted_at = now()
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.accept_intake_order(uuid) from public;
grant execute on function public.accept_intake_order(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. accept_order - garda impotriva acceptarii unei comenzi `aport`
-- -----------------------------------------------------------------------------
-- Corp identic cu 0022_accept_order_skip_service_items.sql, plus verificarea de
-- tip. Fara ea, o comanda de aport ajunsa cumva in `sent` ar putea fi acceptata
-- pe fluxul de vanzare, care CONSUMA stoc (`consume_fifo`) - adica exact opusul
-- efectului dorit. UI-ul nu ofera acest drum (vezi order-status-actions), dar
-- regula de stoc trebuie sa fie aplicata si in DB, nu doar in UI.
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
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Comanda inexistenta sau fara acces: %', p_order_id
      using errcode = 'OR002';
  end if;

  if not app.is_staff_of(v_order.organization_id) then
    raise exception 'Nu ai permisiunea de a accepta aceasta comanda.'
      using errcode = 'OR004';
  end if;

  if v_order.order_type = 'aport' then
    raise exception 'Comanda % este un aport - se accepta cu accept_intake_order (creste stocul), nu pe fluxul de vanzare.',
      p_order_id
      using errcode = 'OR001';
  end if;

  if v_order.status <> 'sent' then
    raise exception 'Comanda % nu poate fi acceptata din statusul % (trebuie sa fie "sent").',
      p_order_id, v_order.status
      using errcode = 'OR001';
  end if;

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
