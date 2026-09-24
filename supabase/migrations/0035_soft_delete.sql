-- =============================================================================
-- 0035 - Arhivare / stergere logica (soft-delete) - docs/plans/soft-delete.md
-- =============================================================================
-- Problema: utilizatorii nu puteau "sterge" nimic creat din greseala. O stergere
-- fizica ar rupe trasabilitatea (loturi, comenzi, retete si certificate refera
-- itemii/clientii), deci fiecare entitate primeste comportamentul potrivit:
--
--   items / recipes / clients -> ARHIVARE reversibila (`archived_at`, `archived_by`).
--       Ascunse din liste si din TOATE selecturile (filtru `archived_at is null` in
--       aplicatie), dar randurile raman - paginile de istoric le afiseaza in
--       continuare. Restaurarea = `archived_at = null`.
--   clients arhivati -> blocheaza si LOGAREA utilizatorului-client legat (profil
--       `status = 'suspended'` + `app.role()` intoarce null, vezi sectiunea 7).
--   orders `draft` -> STERGERE LOGICA (`deleted_at`) prin RPC `delete_draft_order`;
--       ascunse PRIN RLS peste tot (nu au istoric: o ciorna n-a miscat stoc).
--   lots introduse din greseala -> ANULARE prin RPC `cancel_lot`: doar daca nimic
--       nu s-a consumat; scrie un eveniment de corectie in `stock_events`
--       (audit append-only, NICIODATA sters), aduce `remaining_qty` la 0.
--   deliveries -> ANULARE inainte de plecare (fara UIT e-Transport, fara receptie)
--       prin RPC `cancel_delivery`; ascunse prin RLS, comanda poate fi replanificata.
--   profiles (staff) -> DEZACTIVARE: refolosim `profiles.status` (existenta din 0001,
--       `org_status`: active | suspended). Adminul nu se poate dezactiva singur.
--
-- NICIODATA stergibile: stock_events, certificates, procese confirmate/finalizate,
-- comenzi livrate/inchise - nu se adauga nicio cale noua de stergere pentru ele.
--
-- Migrare ADITIVA (pattern 0012/0014: create or replace pe helper-e cu aceeasi
-- semnatura, drop + create pe politici). NOTA: PR-uri paralele pot adauga si ele o
-- migrare 0035 - la merge poate fi nevoie de renumerotare.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Coloane de arhivare: items / recipes / clients
-- -----------------------------------------------------------------------------
alter table public.items
  add column archived_at timestamptz,
  add column archived_by uuid references public.profiles (id) on delete set null;
alter table public.recipes
  add column archived_at timestamptz,
  add column archived_by uuid references public.profiles (id) on delete set null;
alter table public.clients
  add column archived_at timestamptz,
  add column archived_by uuid references public.profiles (id) on delete set null;

comment on column public.items.archived_at is
  'Arhivat (soft-delete reversibil, 0035). Ascuns din liste si selecturi; istoricul il afiseaza in continuare.';
comment on column public.recipes.archived_at is
  'Arhivata (0035). O reteta arhivata nu mai poate fi folosita in productie.';
comment on column public.clients.archived_at is
  'Arhivat (0035). Blocheaza si logarea utilizatorului-client legat; comenzile/certificatele raman.';

-- Majoritatea citirilor cer DOAR randurile active - index partial pe organizatie.
create index items_active_idx   on public.items (organization_id)   where archived_at is null;
create index recipes_active_idx on public.recipes (organization_id) where archived_at is null;
create index clients_active_idx on public.clients (organization_id) where archived_at is null;

-- `archived_by` nu se ia din input extern: il stampila triggerul cu auth.uid(),
-- iar `archived_at` e normalizat (null <-> null pe ambele coloane).
create or replace function app.stamp_archive()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.archived_at is distinct from old.archived_at then
    if new.archived_at is null then
      new.archived_by := null;
    else
      new.archived_by := auth.uid();
    end if;
  else
    new.archived_by := old.archived_by;
  end if;
  return new;
end;
$$;

create trigger items_stamp_archive before update on public.items
  for each row execute function app.stamp_archive();
create trigger recipes_stamp_archive before update on public.recipes
  for each row execute function app.stamp_archive();
create trigger clients_stamp_archive before update on public.clients
  for each row execute function app.stamp_archive();

-- Scrierea coloanelor de arhivare: items/recipes/clients au DOAR politici de
-- scriere pentru staff (`*_staff_all` -> `app.is_staff_of`, 0001/0012); clientul
-- are doar SELECT pe ele, deci nu poate arhiva/restaura nimic prin Data API.

-- -----------------------------------------------------------------------------
-- 2. A doua linie de aparare: nu se construiesc lucruri NOI peste arhivate
-- -----------------------------------------------------------------------------
-- Aplicatia ascunde arhivatele din selecturi; triggerele de mai jos refuza la DB
-- insert-urile care le-ar folosi totusi (Data API direct, formular vechi deschis).
-- Deliberat NU pe `lots`/`order_items` de staff: returul/garantia unui item deja
-- arhivat trebuie sa poata intra in continuare in stoc (fluxurile de retur).
create or replace function app.reject_archived_references()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item uuid;
begin
  if tg_table_name = 'recipe_components' then
    v_item := new.component_item_id;
  elsif tg_table_name = 'recipes' then
    v_item := new.item_id;
  elsif tg_table_name = 'order_items' then
    -- Doar pentru rolul client (catalogul lui): staff-ul poate avea nevoie de
    -- itemi arhivati in fluxurile de retur/garantie.
    if app.role() is distinct from 'client' then
      return new;
    end if;
    v_item := new.item_id;
  elsif tg_table_name = 'processes' then
    if new.recipe_id is not null and exists (
      select 1 from public.recipes r
      join public.items i on i.id = r.item_id
      where r.id = new.recipe_id
        and (r.archived_at is not null or i.archived_at is not null)
    ) then
      raise exception 'Rețeta este arhivată și nu mai poate fi folosită în producție.'
        using errcode = 'AR002';
    end if;
    return new;
  end if;

  if v_item is not null and exists (
    select 1 from public.items where id = v_item and archived_at is not null
  ) then
    raise exception 'Materialul sau serviciul este arhivat și nu mai poate fi folosit.'
      using errcode = 'AR001';
  end if;
  return new;
end;
$$;

create trigger recipe_components_reject_archived before insert on public.recipe_components
  for each row execute function app.reject_archived_references();
create trigger recipes_reject_archived before insert on public.recipes
  for each row execute function app.reject_archived_references();
create trigger order_items_reject_archived before insert on public.order_items
  for each row execute function app.reject_archived_references();
create trigger processes_reject_archived before insert on public.processes
  for each row execute function app.reject_archived_references();

-- -----------------------------------------------------------------------------
-- 3. Comenzi `draft`: stergere logica (deleted_at) - ascunse prin RLS
-- -----------------------------------------------------------------------------
alter table public.orders
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles (id) on delete set null;

comment on column public.orders.deleted_at is
  'Ciorna stearsa logic (0035, RPC delete_draft_order). Ascunsa prin RLS peste tot.';

-- Politica staff FOR ALL (0001) se sparge pe operatii: SELECT/UPDATE vad doar
-- comenzile nesterse, iar WITH CHECK pe UPDATE cere `deleted_at is null` - deci
-- NIMENI nu poate seta `deleted_at` printr-un UPDATE simplu (Data API); singura
-- cale e RPC-ul `delete_draft_order` (security definer, verifica explicit staff +
-- status draft). DELETE fizic ramane ca inainte (compensarile best-effort din
-- `createOrderWithItems` / retur).
drop policy orders_staff_all on public.orders;

create policy orders_staff_select on public.orders
  for select using (app.is_staff_of(organization_id) and deleted_at is null);
create policy orders_staff_insert on public.orders
  for insert with check (app.is_staff_of(organization_id) and deleted_at is null);
create policy orders_staff_update on public.orders
  for update using (app.is_staff_of(organization_id) and deleted_at is null)
  with check (app.is_staff_of(organization_id) and deleted_at is null);
create policy orders_staff_delete on public.orders
  for delete using (app.is_staff_of(organization_id));

-- Clientul: aceleasi politici ca in 0012/0014, plus `deleted_at is null` (nu isi
-- vede ciornele sterse si nu poate scrie coloanele de stergere).
drop policy orders_client_select on public.orders;
create policy orders_client_select on public.orders
  for select using (
    app.role() = 'client'
    and client_id = app.client_id()
    and app.org_is_active(organization_id)
    and deleted_at is null
  );

drop policy orders_client_insert on public.orders;
create policy orders_client_insert on public.orders
  for insert with check (
    app.role() = 'client'
    and client_id = app.client_id()
    and organization_id = app.org_id()
    and status in ('draft', 'sent')
    and app.org_is_active(organization_id)
    and deleted_at is null
    and deleted_by is null
  );

drop policy orders_client_update on public.orders;
create policy orders_client_update on public.orders
  for update using (
    app.role() = 'client'
    and client_id = app.client_id()
    and status in ('draft', 'sent')
    and app.org_is_active(organization_id)
    and deleted_at is null
  )
  with check (
    app.role() = 'client'
    and client_id = app.client_id()
    and organization_id = app.org_id()
    and status in ('draft', 'sent', 'cancelled')
    and app.org_is_active(organization_id)
    and deleted_at is null
    and deleted_by is null
  );

create or replace function public.delete_draft_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  -- security definer => fara RLS aici; autorizarea e explicita mai jos.
  select * into v_order from public.orders
  where id = p_order_id and deleted_at is null
  for update;

  if v_order.id is null or not app.is_staff_of(v_order.organization_id) then
    raise exception 'Comanda inexistenta sau fara acces: %', p_order_id
      using errcode = 'OR002';
  end if;

  if v_order.status <> 'draft' then
    raise exception 'Doar o comanda in status Ciorna poate fi stearsa (status curent: %).',
      v_order.status
      using errcode = 'OD001';
  end if;

  update public.orders
  set deleted_at = now(),
      deleted_by = auth.uid()
  where id = p_order_id;
end;
$$;

revoke all on function public.delete_draft_order(uuid) from public;
grant execute on function public.delete_draft_order(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. Loturi introduse din greseala: anulare (fara stergere de audit)
-- -----------------------------------------------------------------------------
alter table public.lots
  add column cancelled_at  timestamptz,
  add column cancelled_by  uuid references public.profiles (id) on delete set null,
  add column cancel_reason text;

comment on column public.lots.cancelled_at is
  'Lot anulat (introdus din greseala, 0035, RPC cancel_lot). remaining_qty = 0; evenimentul de corectie e in stock_events.';

-- Coloanele de anulare se scriu DOAR prin `cancel_lot` (flag de sesiune local
-- tranzactiei), iar un lot anulat nu-si mai schimba cantitatea ramasa.
create or replace function app.guard_lot_cancellation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.cancelled_at is distinct from old.cancelled_at
      or new.cancelled_by is distinct from old.cancelled_by
      or new.cancel_reason is distinct from old.cancel_reason)
     and coalesce(current_setting('app.cancel_lot', true), '') <> 'on' then
    raise exception 'Un lot se anuleaza doar prin actiunea dedicata (cancel_lot).'
      using errcode = 'LT010';
  end if;

  if old.cancelled_at is not null and new.remaining_qty is distinct from old.remaining_qty then
    raise exception 'Lotul este anulat - cantitatea lui nu mai poate fi modificata.'
      using errcode = 'LT007';
  end if;
  return new;
end;
$$;

create trigger lots_guard_cancellation before update on public.lots
  for each row execute function app.guard_lot_cancellation();

create or replace function public.cancel_lot(p_lot_id uuid, p_reason text)
returns public.lots
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lot public.lots;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Motivul anularii este obligatoriu.'
      using errcode = 'LT005';
  end if;

  -- RLS (`lots_staff_all`, FOR ALL => are si politica de UPDATE) filtreaza deja
  -- loturile altor organizatii; `for update` e sigur aici (vezi AGENTS.md 4.2).
  select * into v_lot from public.lots where id = p_lot_id for update;
  if v_lot.id is null then
    raise exception 'Lot inexistent sau fara acces: %', p_lot_id
      using errcode = 'LT002';
  end if;

  if v_lot.cancelled_at is not null then
    raise exception 'Lotul este deja anulat.'
      using errcode = 'LT007';
  end if;

  -- Loturi nascute dintr-un FLUX (proces, retur, aport de la client) nu se anuleaza
  -- izolat - s-ar rupe trasabilitatea fluxului; se corecteaza fluxul.
  if v_lot.provenance in ('return', 'aport_client')
     or v_lot.client_id is not null
     or exists (select 1 from public.process_outputs where lot_id = v_lot.id) then
    raise exception 'Lotul a fost creat de un proces, retur sau aport - nu poate fi anulat separat.'
      using errcode = 'LT009';
  end if;

  -- "Nimic consumat": cantitatea ramasa e intacta SI nu exista nicio miscare de
  -- cantitate in afara de intrare (blocare/deblocare au cantitate 0 - permise).
  -- FARA `for update` pe stock_events (append-only, fara politica de UPDATE).
  if v_lot.remaining_qty <> v_lot.initial_qty
     or exists (select 1 from public.process_inputs where lot_id = v_lot.id)
     or exists (
       select 1 from public.stock_events
       where lot_id = v_lot.id
         and event_type not in ('intake', 'block', 'unblock')
     ) then
    raise exception 'Din acest lot s-a consumat deja - nu mai poate fi anulat.'
      using errcode = 'LT008';
  end if;

  perform set_config('app.cancel_lot', 'on', true);

  update public.lots
  set remaining_qty = 0,
      cancelled_at  = now(),
      cancelled_by  = auth.uid(),
      cancel_reason = btrim(p_reason)
  where id = v_lot.id
  returning * into v_lot;

  perform set_config('app.cancel_lot', 'off', true);

  -- Eveniment de corectie (audit append-only): cantitatea iese integral din stoc.
  insert into public.stock_events (
    organization_id, item_id, lot_id, event_type, quantity, reason, created_by
  )
  values (
    v_lot.organization_id, v_lot.item_id, v_lot.id, 'adjustment', -v_lot.initial_qty,
    'Lot anulat (introdus din greșeală): ' || btrim(p_reason), auth.uid()
  );

  return v_lot;
end;
$$;

revoke all on function public.cancel_lot(uuid, text) from public;
grant execute on function public.cancel_lot(uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. Livrari: anulare inainte de plecare - ascunse prin RLS
-- -----------------------------------------------------------------------------
alter table public.deliveries
  add column cancelled_at  timestamptz,
  add column cancelled_by  uuid references public.profiles (id) on delete set null,
  add column cancel_reason text;

comment on column public.deliveries.cancelled_at is
  'Livrare anulata inainte de plecare (0035, RPC cancel_delivery). Comanda poate fi replanificata.';

-- "O singura livrare per comanda" ramane adevarat pentru livrarile ACTIVE: unicitatea
-- devine partiala, ca o comanda cu livrarea anulata sa poata fi replanificata.
alter table public.deliveries drop constraint deliveries_order_id_key;
create unique index deliveries_order_id_active_key
  on public.deliveries (order_id) where cancelled_at is null;

drop policy deliveries_staff_all on public.deliveries;
create policy deliveries_staff_select on public.deliveries
  for select using (app.is_staff_of(organization_id) and cancelled_at is null);
create policy deliveries_staff_insert on public.deliveries
  for insert with check (app.is_staff_of(organization_id) and cancelled_at is null);
create policy deliveries_staff_update on public.deliveries
  for update using (app.is_staff_of(organization_id) and cancelled_at is null)
  with check (app.is_staff_of(organization_id) and cancelled_at is null);

create or replace function public.cancel_delivery(p_delivery_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.deliveries;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Motivul anularii este obligatoriu.'
      using errcode = 'DL003';
  end if;

  select * into v_delivery from public.deliveries
  where id = p_delivery_id and cancelled_at is null
  for update;

  if v_delivery.id is null or not app.is_staff_of(v_delivery.organization_id) then
    raise exception 'Livrare inexistenta sau fara acces: %', p_delivery_id
      using errcode = 'DL002';
  end if;

  -- "Plecata" = declarata la e-Transport (are UIT) sau cu receptia confirmata.
  if v_delivery.declaration_status = 'declared'
     or v_delivery.uit_code is not null
     or v_delivery.received_at is not null then
    raise exception 'Livrarea a plecat deja (declarată e-Transport sau recepționată) - nu mai poate fi anulată.'
      using errcode = 'DL001';
  end if;

  update public.deliveries
  set cancelled_at  = now(),
      cancelled_by  = auth.uid(),
      cancel_reason = btrim(p_reason)
  where id = p_delivery_id;
end;
$$;

revoke all on function public.cancel_delivery(uuid, text) from public;
grant execute on function public.cancel_delivery(uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. Utilizatori: dezactivare (profiles.status) - adminul nu se dezactiveaza singur
-- -----------------------------------------------------------------------------
create or replace function app.enforce_profile_deactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and auth.uid() is not null
     and new.id = auth.uid() then
    raise exception 'Nu îți poți dezactiva propriul cont.'
      using errcode = 'US001';
  end if;
  return new;
end;
$$;

create trigger profiles_enforce_deactivation before update on public.profiles
  for each row execute function app.enforce_profile_deactivation();

-- Arhivarea unui client blocheaza (si restaurarea deblocheaza) utilizatorul-client
-- legat - "un client = un singur utilizator" (0016), dar tratam generic setul.
create or replace function app.sync_client_profile_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.archived_at is distinct from old.archived_at then
    update public.profiles
    set status = (case when new.archived_at is null then 'active' else 'suspended' end)::public.org_status
    where client_id = new.id and role = 'client';
  end if;
  return new;
end;
$$;

create trigger clients_sync_profile_status after update of archived_at on public.clients
  for each row execute function app.sync_client_profile_status();

-- -----------------------------------------------------------------------------
-- 7. app.role() - a doua linie de aparare (DB) pentru conturile blocate
-- -----------------------------------------------------------------------------
-- Aceeasi idee ca `app.org_is_active` (0012), dar la nivel de UTILIZATOR: un profil
-- dezactivat (`status = 'suspended'`) sau un utilizator-client al carui client e
-- arhivat nu mai are ROL pentru RLS => `app.role()` intoarce null, deci toate
-- politicile care cer un rol (`app.is_staff_of`, `app.is_admin_of`, `app.role() =
-- 'client'`) cad automat, fara sa atingem fiecare politica. Propriul profil ramane
-- citibil (`profiles_select`: id = auth.uid()), ca aplicatia sa poata afisa pagina
-- "cont dezactivat". Super-adminul (`app.is_super_admin`, citeste rolul direct)
-- ramane neafectat, ca si la suspendarea organizatiei.
create or replace function app.role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.status = 'active'
    and not exists (
      select 1 from public.clients c
      where c.id = p.client_id and c.archived_at is not null
    )
$$;
