-- =============================================================================
-- 0012 — Guard organizatie suspendata: a doua linie de aparare in RLS (Task T2.1)
-- =============================================================================
-- Problema (semnalata la livrarea Task I): `organizations.status = 'suspended'` era
-- salvat, dar nimic nu-l verifica in scriere/citire prin Data API — un admin/operator/
-- client al unui tenant suspendat pastra acces complet la randurile organizatiei lui.
-- Guard-ul de nivel aplicatie (middleware + `getCurrentUser`/`requireUser`, vezi
-- src/lib/supabase/middleware.ts si src/features/auth/session.ts) e prima linie:
-- redirectioneaza userii unei organizatii suspendate la `/organizatie-suspendata`.
-- Aceasta migrare adauga A DOUA linie, in DB, pentru cazul in care cineva loveste
-- Data API direct (fara sa treaca prin aplicatie).
--
-- Migrare ADITIVA (nu se editeaza 0001/0003): redefinim (CREATE OR REPLACE, aceeasi
-- semnatura) helper-ele `app.is_staff_of`/`app.is_admin_of` din 0001, si redefinim
-- (DROP + CREATE, acelasi pattern folosit de 0003 peste politicile din 0001) cateva
-- politici de scriere ale clientului, ca sa ceara suplimentar ca organizatia sa fie
-- `active`. Super_admin trece peste tenant, NEAFECTAT (verificat explicit mai jos).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Helper nou: app.org_is_active(org) — organizatia exista si e `active`.
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER (ca toate helper-ele de tenant din 0001) => citeste direct
-- `organizations`, fara sa depinda de RLS (evita orice recursivitate/interactiune cu
-- politica `organizations_select`).
create or replace function app.org_is_active(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select status = 'active' from public.organizations where id = org),
    false
  )
$$;

-- -----------------------------------------------------------------------------
-- 2. Staff (admin/operator): app.is_staff_of / app.is_admin_of cer organizatie activa.
-- -----------------------------------------------------------------------------
-- Aceste doua helper-e alimenteaza aproape toate politicile `FOR ALL` de staff din
-- 0001/0003 (clients, client_addresses, items, recipes, lots, processes, orders,
-- order_items, order_links, certificates, documents, profiles admin ops,
-- organizations update). Adaugand `app.org_is_active(org)` pe ramura de tenant (NU pe
-- ramura super_admin), blocam automat SELECT/INSERT/UPDATE/DELETE pentru staff-ul unei
-- organizatii suspendate pe toate aceste tabele, fara sa mai atingem fiecare politica
-- individual. Super-adminul (`app.is_super_admin()`, prima ramura a OR-ului) ramane
-- neafectat — poate in continuare vedea/reactiva o organizatie suspendata (ex.
-- `organizations_update` foloseste `app.is_admin_of(id)`).
create or replace function app.is_staff_of(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app.is_super_admin()
    or (org = app.org_id() and app.role() in ('admin', 'operator') and app.org_is_active(org))
$$;

create or replace function app.is_admin_of(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app.is_super_admin()
    or (org = app.org_id() and app.role() = 'admin' and app.org_is_active(org))
$$;

-- -----------------------------------------------------------------------------
-- 3. Client: acelasi guard pe caile de SCRIERE (INSERT/UPDATE/DELETE).
-- -----------------------------------------------------------------------------
-- Politicile client NU trec prin `app.is_staff_of`/`app.is_admin_of` (folosesc direct
-- `app.role() = 'client'` + `client_id`/`organization_id`), deci helper-ele de mai sus
-- nu le ating automat. Redefinim explicit politicile de SCRIERE pe `orders`/
-- `order_items`/`documents` (introduse per-operatie in 0003) ca sa ceara suplimentar
-- `app.org_is_active(organization_id)` — echivalentul cerintei de business "scrierile
-- rolului client trec prin server actions, iar RLS trebuie sa impuna acelasi lucru"
-- (AGENTS.md §4), extinsa acum si la statusul organizatiei.
--
-- Politicile de SELECT ale clientului (clients_self_select, items_client_catalog,
-- orders_client_select, order_items_client_select, order_links_client_select,
-- certificates_client_select, documents_client_select) si `client_addresses_self_all`
-- (inca `FOR ALL`, neseparata pe operatii) NU sunt modificate aici: citirea nu produce
-- efecte, iar clientul unei organizatii suspendate e deja scos din portalul lui la
-- nivel de aplicatie (middleware + requireUser -> redirect `/organizatie-suspendata`),
-- deci suprafata reala de risc e scrierea directa prin Data API, acoperita mai jos.
-- Extinderea completa (inclusiv SELECT si `client_addresses`) ar cere spargerea unei
-- politici `FOR ALL` in 4 politici per-operatie — lasata deliberat in afara acestei
-- migrari, ca sa pastram schimbarea minima si usor de revizuit; poate fi adaugata
-- separat daca se decide ca e necesara.

-- --- orders: insert/update/delete (select ramane neschimbat) -----------------
drop policy orders_client_insert on public.orders;
create policy orders_client_insert on public.orders
  for insert with check (
    app.role() = 'client'
    and client_id = app.client_id()
    and organization_id = app.org_id()
    and status in ('draft', 'sent')
    and app.org_is_active(organization_id)
  );

drop policy orders_client_update on public.orders;
create policy orders_client_update on public.orders
  for update using (
    app.role() = 'client'
    and client_id = app.client_id()
    and status in ('draft', 'sent')
    and app.org_is_active(organization_id)
  )
  with check (
    app.role() = 'client'
    and client_id = app.client_id()
    and organization_id = app.org_id()
    and status in ('draft', 'sent', 'cancelled')
    and app.org_is_active(organization_id)
  );

drop policy orders_client_delete on public.orders;
create policy orders_client_delete on public.orders
  for delete using (
    app.role() = 'client'
    and client_id = app.client_id()
    and status = 'draft'
    and app.org_is_active(organization_id)
  );

-- --- order_items: insert/update/delete (select ramane neschimbat) -----------
drop policy order_items_client_insert on public.order_items;
create policy order_items_client_insert on public.order_items
  for insert with check (
    app.role() = 'client'
    and organization_id = app.org_id()
    and app.org_is_active(organization_id)
    and exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.client_id = app.client_id()
        and o.status in ('draft', 'sent')
    )
  );

drop policy order_items_client_update on public.order_items;
create policy order_items_client_update on public.order_items
  for update using (
    app.role() = 'client'
    and app.org_is_active(organization_id)
    and exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.client_id = app.client_id()
        and o.status in ('draft', 'sent')
    )
  )
  with check (
    app.role() = 'client'
    and organization_id = app.org_id()
    and app.org_is_active(organization_id)
    and exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.client_id = app.client_id()
        and o.status in ('draft', 'sent')
    )
  );

drop policy order_items_client_delete on public.order_items;
create policy order_items_client_delete on public.order_items
  for delete using (
    app.role() = 'client'
    and app.org_is_active(organization_id)
    and exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.client_id = app.client_id()
        and o.status in ('draft', 'sent')
    )
  );

-- --- documents: insert (select ramane neschimbat) ---------------------------
drop policy documents_client_insert on public.documents;
create policy documents_client_insert on public.documents
  for insert with check (
    app.role() = 'client'
    and organization_id = app.org_id()
    and app.org_is_active(organization_id)
    and owner_type = 'order'
    and exists (
      select 1 from public.orders o
      where o.id = documents.owner_id
      and o.client_id = app.client_id()
    )
  );
