-- =============================================================================
-- T1.1 — Schema de baza consolidata + RLS (CONTRACTUL COMUN)
-- =============================================================================
-- O singura migrare care defineste toate entitatile MVP si politicile RLS.
-- Multi-tenant: baza de date comuna, izolare logica prin RLS pe `organization_id`.
-- Fiecare tenant (organizatie) este rezolvat din custom_domain / subdomeniu /
-- segment de path pe baza coloanelor `slug` + `custom_domain` (rutarea efectiva = T1.2).
--
-- Roluri (vezi handoff.md):
--   super_admin - administreaza platforma, trece peste tenant
--   admin       - acces total in organizatia proprie + configurare/white-label/useri
--   operator    - operatiuni (stoc, productie, comenzi) in organizatia proprie
--   client      - vede doar catalogul + propriile comenzi/documente/certificate
--
-- Conventii: engleza in cod/schema, romana doar in UI. Coloane comune:
--   id uuid pk, created_at, updated_at. Migrari aditive, numerotate (nu se editeaza).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Tipuri enumerate (vocabularul de stare al domeniului)
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('super_admin', 'admin', 'operator', 'client');

create type public.org_status as enum ('active', 'suspended');

create type public.unit_of_measure as enum ('kg', 'tona', 'mc', 'litru', 'bucata', 'sac', 'palet');

-- Provenienta unui lot la intrarea in stoc.
create type public.lot_provenance as enum (
  'purchase',             -- achizitie
  'internal_production',  -- productie interna
  'recycling',            -- reciclare
  'return',               -- retur de la client
  'inventory_adjustment'  -- ajustare inventar
);

-- Status de calitate al lotului (blocarea efectiva e separata: is_blocked + reason).
create type public.quality_status as enum ('unchecked', 'passed', 'failed');

-- Tipuri de miscare in audit-trail-ul de stoc.
create type public.stock_event_type as enum (
  'intake',       -- intrare (lot nou)
  'consumption',  -- consum (productie / acceptare comanda)
  'adjustment',   -- ajustare manuala
  'block',        -- lot blocat
  'unblock',      -- lot deblocat
  'reversal'      -- stornare (ex. anulare comanda reface stocul)
);

-- Tipul procesului de transformare.
create type public.process_type as enum (
  'output_fixed', -- output fix: introduci cantitatea de output -> consum FIFO calculat
  'input_fixed'   -- input fix, output variabil: introduci inputul -> output ajustat manual
);

create type public.process_status as enum (
  'planned',                -- planificat
  'in_progress',            -- in lucru
  'awaiting_confirmation',  -- asteapta confirmare
  'completed',              -- finalizat
  'cancelled'               -- anulat
);

create type public.order_status as enum (
  'draft',      -- draft
  'sent',       -- trimisa
  'accepted',   -- acceptata (stoc scazut)
  'delivered',  -- livrata
  'closed',     -- inchisa (certificat generat)
  'cancelled'   -- anulata (stoc refacut)
);

-- Legatura intre o comanda noua si comanda originala.
create type public.order_link_type as enum (
  'return',      -- retur
  'warranty',    -- garantie (retur + comanda de inlocuire)
  'replacement'  -- comanda de inlocuire generata automat dintr-o garantie
);

create type public.document_owner_type as enum ('client', 'order', 'item');

-- -----------------------------------------------------------------------------
-- 1. Schema interna + trigger comun pentru updated_at
-- -----------------------------------------------------------------------------
-- Functiile helper de tenant (folosite in RLS) refera `public.profiles`, deci se
-- definesc mai jos (sectiunea 4.5), dupa crearea tabelelor.
create schema if not exists app;
grant usage on schema app to authenticated, service_role;

create or replace function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =============================================================================
-- 3. TABELE
-- =============================================================================

-- --- 3.1 Organizatii (tenant + white-label) ---------------------------------
create table public.organizations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,          -- subdomeniu + segment de path (ex. "acme")
  custom_domain   text unique,                   -- domeniu white-label (ex. "trace.acme.ro")
  logo_url        text,
  primary_color   text,                          -- token tema (CSS variable)
  secondary_color text,
  email_from_name text,
  email_from_address text,
  status          public.org_status not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint organizations_slug_format check (slug ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$')
);

-- --- 3.2 Profiles (extinde auth.users cu rol + tenant) -----------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade, -- null doar pt. super_admin
  role            public.user_role not null,
  client_id       uuid,                          -- setat doar pt. rol `client` (FK adaugat dupa clients)
  full_name       text,
  email           text,
  status          public.org_status not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- super_admin nu apartine unui tenant; restul rolurilor trebuie sa aiba organizatie.
  constraint profiles_org_required check (role = 'super_admin' or organization_id is not null),
  -- doar rolul client este legat de o firma-client.
  constraint profiles_client_link check (role = 'client' or client_id is null)
);

create index profiles_organization_id_idx on public.profiles (organization_id);
create index profiles_client_id_idx on public.profiles (client_id);

-- --- 3.3 Clienti (firme juridice cumparatoare) ------------------------------
create table public.clients (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  cui             text not null,                 -- cod unic de identificare fiscala (RO)
  name            text not null,
  reg_com         text,                          -- numar registrul comertului
  is_vat_payer    boolean not null default false,
  hq_address      text,                          -- adresa sediu
  email           text,
  phone           text,
  contact_person  text,
  is_supplier     boolean not null default false, -- poate fi si furnizor de deseuri/materiale
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, cui)
);

create index clients_organization_id_idx on public.clients (organization_id);

-- FK intarziat: profiles.client_id -> clients.id
alter table public.profiles
  add constraint profiles_client_id_fkey
  foreign key (client_id) references public.clients (id) on delete set null;

-- --- 3.4 Adrese de livrare (multiple per client) ----------------------------
create table public.client_addresses (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id       uuid not null references public.clients (id) on delete cascade,
  label           text,                          -- ex. "Depozit Otopeni"
  address         text not null,
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index client_addresses_client_id_idx on public.client_addresses (client_id);
create index client_addresses_organization_id_idx on public.client_addresses (organization_id);

-- --- 3.5 Itemi (stoc + catalog daca sellable) -------------------------------
create table public.items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title           text not null,
  description     text,
  unit            public.unit_of_measure not null,  -- un singur UM per produs
  sellable        boolean not null default false,   -- apare in catalogul clientului
  image_url       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index items_organization_id_idx on public.items (organization_id);
create index items_sellable_idx on public.items (organization_id, sellable);

-- --- 3.6 Retete (procente; fara versionare) ---------------------------------
create table public.recipes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  item_id         uuid not null references public.items (id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (item_id)                                -- o reteta per item
);

create index recipes_organization_id_idx on public.recipes (organization_id);

create table public.recipe_components (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  recipe_id         uuid not null references public.recipes (id) on delete cascade,
  component_item_id uuid not null references public.items (id) on delete restrict,
  percentage        numeric(6, 3) not null check (percentage > 0 and percentage <= 100),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (recipe_id, component_item_id)
);

create index recipe_components_recipe_id_idx on public.recipe_components (recipe_id);
create index recipe_components_organization_id_idx on public.recipe_components (organization_id);

-- --- 3.7 Loturi (fiecare intrare in stoc) -----------------------------------
create table public.lots (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  item_id         uuid not null references public.items (id) on delete restrict,
  entry_date      date not null default current_date,
  source          text,                          -- sursa libera (furnizor / proces)
  provenance      public.lot_provenance not null,
  location        text,                          -- un singur depozit in MVP, dar camp liber
  initial_qty     numeric(14, 3) not null check (initial_qty >= 0),
  remaining_qty   numeric(14, 3) not null check (remaining_qty >= 0),
  quality_status  public.quality_status not null default 'unchecked',
  is_blocked      boolean not null default false,
  block_reason    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint lots_remaining_lte_initial check (remaining_qty <= initial_qty),
  constraint lots_block_reason check (not is_blocked or block_reason is not null)
);

create index lots_item_id_idx on public.lots (item_id);
create index lots_organization_id_idx on public.lots (organization_id);
-- FIFO + disponibilitate: loturi nelocate cu stoc, ordonate dupa data intrarii.
create index lots_fifo_idx on public.lots (item_id, entry_date)
  where is_blocked = false and remaining_qty > 0;

-- --- 3.8 Procese (transformare: productie / reciclare) ----------------------
create table public.processes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  type            public.process_type not null,
  status          public.process_status not null default 'planned',
  output_item_id  uuid references public.items (id) on delete restrict, -- itemul produs principal
  recipe_id       uuid references public.recipes (id) on delete set null,
  notes           text,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index processes_organization_id_idx on public.processes (organization_id);

-- Loturi consumate de proces (trasabilitate: input).
create table public.process_inputs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  process_id      uuid not null references public.processes (id) on delete cascade,
  lot_id          uuid not null references public.lots (id) on delete restrict,
  item_id         uuid not null references public.items (id) on delete restrict,
  quantity        numeric(14, 3) not null check (quantity > 0),
  created_at      timestamptz not null default now()
);

create index process_inputs_process_id_idx on public.process_inputs (process_id);
create index process_inputs_organization_id_idx on public.process_inputs (organization_id);

-- Loturi create de proces (trasabilitate: output).
create table public.process_outputs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  process_id      uuid not null references public.processes (id) on delete cascade,
  lot_id          uuid not null references public.lots (id) on delete restrict,
  item_id         uuid not null references public.items (id) on delete restrict,
  quantity        numeric(14, 3) not null check (quantity > 0),
  created_at      timestamptz not null default now()
);

create index process_outputs_process_id_idx on public.process_outputs (process_id);
create index process_outputs_organization_id_idx on public.process_outputs (organization_id);

-- --- 3.9 Audit-trail stoc (toate miscarile) ---------------------------------
create table public.stock_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  item_id         uuid not null references public.items (id) on delete restrict,
  lot_id          uuid references public.lots (id) on delete set null,
  event_type      public.stock_event_type not null,
  quantity        numeric(14, 3) not null,       -- semnat: + intrare, - consum
  reason          text,
  order_id        uuid,                          -- FK adaugat dupa orders
  process_id      uuid references public.processes (id) on delete set null,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index stock_events_item_id_idx on public.stock_events (item_id);
create index stock_events_lot_id_idx on public.stock_events (lot_id);
create index stock_events_organization_id_idx on public.stock_events (organization_id, created_at);

-- --- 3.10 Comenzi ------------------------------------------------------------
create table public.orders (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  client_id           uuid not null references public.clients (id) on delete restrict,
  order_number        text,                      -- atribuit de aplicatie la trimitere
  status              public.order_status not null default 'draft',
  created_by_admin    boolean not null default false,
  delivery_address_id uuid references public.client_addresses (id) on delete set null,
  delivery_date       date,
  expected_return_date date,                     -- inchiriere (product-as-a-service)
  notes               text,
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (organization_id, order_number)
);

create index orders_organization_id_idx on public.orders (organization_id);
create index orders_client_id_idx on public.orders (client_id);
create index orders_status_idx on public.orders (organization_id, status);

-- Acum putem lega stock_events.order_id
alter table public.stock_events
  add constraint stock_events_order_id_fkey
  foreign key (order_id) references public.orders (id) on delete set null;

create table public.order_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  order_id        uuid not null references public.orders (id) on delete cascade,
  item_id         uuid not null references public.items (id) on delete restrict,
  quantity        numeric(14, 3) not null check (quantity > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (order_id, item_id)
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_organization_id_idx on public.order_items (organization_id);

-- --- 3.11 Legaturi intre comenzi (retur / garantie / inlocuire) -------------
create table public.order_links (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  link_type         public.order_link_type not null,
  original_order_id uuid not null references public.orders (id) on delete cascade,
  linked_order_id   uuid not null references public.orders (id) on delete cascade,
  created_at        timestamptz not null default now(),
  constraint order_links_distinct check (original_order_id <> linked_order_id)
);

create index order_links_original_idx on public.order_links (original_order_id);
create index order_links_linked_idx on public.order_links (linked_order_id);
create index order_links_organization_id_idx on public.order_links (organization_id);

-- --- 3.12 Certificate de trasabilitate --------------------------------------
create table public.certificates (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  order_id              uuid not null references public.orders (id) on delete cascade,
  number                text not null,           -- numar unic
  issued_at             timestamptz not null default now(),
  traceability_snapshot jsonb not null default '{}'::jsonb, -- graful inghetat la inchidere
  pdf_path              text,                    -- cale in Supabase Storage
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (organization_id, number),
  unique (order_id)                              -- un certificat per comanda
);

create index certificates_organization_id_idx on public.certificates (organization_id);

-- --- 3.13 Documente (client / comanda / item) -------------------------------
create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  owner_type      public.document_owner_type not null,
  owner_id        uuid not null,                 -- id-ul entitatii (client/order/item)
  file_path       text not null,                 -- cale in Supabase Storage
  file_name       text not null,
  mime_type       text,
  size_bytes      bigint,
  description     text,
  uploaded_by     uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index documents_owner_idx on public.documents (owner_type, owner_id);
create index documents_organization_id_idx on public.documents (organization_id);

-- -----------------------------------------------------------------------------
-- 4. Triggere updated_at
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations', 'profiles', 'clients', 'client_addresses', 'items', 'recipes',
    'recipe_components', 'lots', 'processes', 'orders', 'order_items', 'certificates'
  ]
  loop
    execute format(
      'create trigger %1$s_touch_updated_at before update on public.%1$s
         for each row execute function app.touch_updated_at();', t
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4.5 Functii helper de tenant (folosite in politicile RLS)
-- -----------------------------------------------------------------------------
-- Toate sunt SECURITY DEFINER => ocolesc RLS pe `profiles` (fara recursivitate) si
-- citesc identitatea apelantului curent (auth.uid()) din profilul lui.
create or replace function app.role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function app.org_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

-- Pentru utilizatorii cu rol `client`: id-ul firmei-client de care sunt legati.
create or replace function app.client_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select client_id from public.profiles where id = auth.uid()
$$;

create or replace function app.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'super_admin', false)
$$;

-- Staff (admin/operator) al unei organizatii, SAU super-admin (peste tenant).
create or replace function app.is_staff_of(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app.is_super_admin()
    or (org = app.org_id() and app.role() in ('admin', 'operator'))
$$;

-- Admin al unei organizatii, SAU super-admin (pentru configurare / user management).
create or replace function app.is_admin_of(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app.is_super_admin()
    or (org = app.org_id() and app.role() = 'admin')
$$;

-- =============================================================================
-- 5. ROW LEVEL SECURITY
-- =============================================================================
-- Model:
--   * Staff (admin/operator) au acces complet in organizatia proprie.
--   * Super-admin trece peste tenant (toate randurile).
--   * Clientul vede DOAR: catalogul (items sellable), propria firma + adrese +
--     documente, propriile comenzi (+ order_items, documente) si certificate.
--   * Tabele pur interne (loturi, stoc, procese, retete) NU sunt vizibile clientului.
-- GRANT-uri explicite pentru ca tabelele noi din `public` nu sunt auto-expuse Data API.

alter table public.organizations    enable row level security;
alter table public.profiles          enable row level security;
alter table public.clients           enable row level security;
alter table public.client_addresses  enable row level security;
alter table public.items             enable row level security;
alter table public.recipes           enable row level security;
alter table public.recipe_components enable row level security;
alter table public.lots              enable row level security;
alter table public.processes         enable row level security;
alter table public.process_inputs    enable row level security;
alter table public.process_outputs   enable row level security;
alter table public.stock_events      enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.order_links       enable row level security;
alter table public.certificates      enable row level security;
alter table public.documents         enable row level security;

-- --- 5.1 organizations -------------------------------------------------------
create policy organizations_select on public.organizations
  for select using (app.is_super_admin() or id = app.org_id());
create policy organizations_update on public.organizations
  for update using (app.is_admin_of(id)) with check (app.is_admin_of(id));
create policy organizations_insert on public.organizations
  for insert with check (app.is_super_admin());
create policy organizations_delete on public.organizations
  for delete using (app.is_super_admin());

-- --- 5.2 profiles ------------------------------------------------------------
-- Fiecare isi vede propriul profil; adminul gestioneaza profilele din organizatie.
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid() or app.is_admin_of(organization_id)
  );
create policy profiles_insert on public.profiles
  for insert with check (app.is_admin_of(organization_id));
create policy profiles_update on public.profiles
  for update using (app.is_admin_of(organization_id))
  with check (app.is_admin_of(organization_id));
create policy profiles_delete on public.profiles
  for delete using (app.is_admin_of(organization_id));

-- --- 5.3 clients -------------------------------------------------------------
-- Staff: tot din organizatie. Client: doar propria firma (read-only).
create policy clients_staff_all on public.clients
  for all using (app.is_staff_of(organization_id))
  with check (app.is_staff_of(organization_id));
create policy clients_self_select on public.clients
  for select using (app.role() = 'client' and id = app.client_id());

-- --- 5.4 client_addresses ----------------------------------------------------
create policy client_addresses_staff_all on public.client_addresses
  for all using (app.is_staff_of(organization_id))
  with check (app.is_staff_of(organization_id));
create policy client_addresses_self_all on public.client_addresses
  for all using (app.role() = 'client' and client_id = app.client_id())
  with check (app.role() = 'client' and client_id = app.client_id());

-- --- 5.5 items (catalog) -----------------------------------------------------
create policy items_staff_all on public.items
  for all using (app.is_staff_of(organization_id))
  with check (app.is_staff_of(organization_id));
-- Clientul vede doar itemii vandabili din organizatia lui (catalog, fara preturi).
create policy items_client_catalog on public.items
  for select using (
    app.role() = 'client' and sellable = true and organization_id = app.org_id()
  );

-- --- 5.6 Tabele pur interne (doar staff) ------------------------------------
create policy recipes_staff_all on public.recipes
  for all using (app.is_staff_of(organization_id))
  with check (app.is_staff_of(organization_id));
create policy recipe_components_staff_all on public.recipe_components
  for all using (app.is_staff_of(organization_id))
  with check (app.is_staff_of(organization_id));
create policy lots_staff_all on public.lots
  for all using (app.is_staff_of(organization_id))
  with check (app.is_staff_of(organization_id));
create policy processes_staff_all on public.processes
  for all using (app.is_staff_of(organization_id))
  with check (app.is_staff_of(organization_id));
create policy process_inputs_staff_all on public.process_inputs
  for all using (app.is_staff_of(organization_id))
  with check (app.is_staff_of(organization_id));
create policy process_outputs_staff_all on public.process_outputs
  for all using (app.is_staff_of(organization_id))
  with check (app.is_staff_of(organization_id));

-- stock_events e audit-trail: staff poate citi si insera, dar nu modifica/sterge.
create policy stock_events_staff_select on public.stock_events
  for select using (app.is_staff_of(organization_id));
create policy stock_events_staff_insert on public.stock_events
  for insert with check (app.is_staff_of(organization_id));

-- --- 5.7 orders --------------------------------------------------------------
create policy orders_staff_all on public.orders
  for all using (app.is_staff_of(organization_id))
  with check (app.is_staff_of(organization_id));
-- Clientul isi gestioneaza propriile comenzi (creare/modificare/anulare prin server
-- actions care impun masina de stari - Task E/H).
create policy orders_client_all on public.orders
  for all using (app.role() = 'client' and client_id = app.client_id())
  with check (app.role() = 'client' and client_id = app.client_id());

-- --- 5.8 order_items ---------------------------------------------------------
create policy order_items_staff_all on public.order_items
  for all using (app.is_staff_of(organization_id))
  with check (app.is_staff_of(organization_id));
create policy order_items_client_all on public.order_items
  for all using (
    app.role() = 'client'
    and exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.client_id = app.client_id()
    )
  )
  with check (
    app.role() = 'client'
    and exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.client_id = app.client_id()
    )
  );

-- --- 5.9 order_links ---------------------------------------------------------
create policy order_links_staff_all on public.order_links
  for all using (app.is_staff_of(organization_id))
  with check (app.is_staff_of(organization_id));
create policy order_links_client_select on public.order_links
  for select using (
    app.role() = 'client'
    and exists (
      select 1 from public.orders o
      where o.id = order_links.original_order_id and o.client_id = app.client_id()
    )
  );

-- --- 5.10 certificates -------------------------------------------------------
create policy certificates_staff_all on public.certificates
  for all using (app.is_staff_of(organization_id))
  with check (app.is_staff_of(organization_id));
create policy certificates_client_select on public.certificates
  for select using (
    app.role() = 'client'
    and exists (
      select 1 from public.orders o
      where o.id = certificates.order_id and o.client_id = app.client_id()
    )
  );

-- --- 5.11 documents ----------------------------------------------------------
create policy documents_staff_all on public.documents
  for all using (app.is_staff_of(organization_id))
  with check (app.is_staff_of(organization_id));
-- Clientul vede documentele propriei firme, ale comenzilor proprii si descrierile
-- itemilor vandabili (catalog).
create policy documents_client_select on public.documents
  for select using (
    app.role() = 'client'
    and organization_id = app.org_id()
    and (
      (owner_type = 'client' and owner_id = app.client_id())
      or (owner_type = 'order' and exists (
            select 1 from public.orders o
            where o.id = documents.owner_id and o.client_id = app.client_id()))
      or (owner_type = 'item' and exists (
            select 1 from public.items i
            where i.id = documents.owner_id and i.sellable = true))
    )
  );
-- Clientul poate atasa documente la propriile comenzi.
create policy documents_client_insert on public.documents
  for insert with check (
    app.role() = 'client'
    and organization_id = app.org_id()
    and owner_type = 'order'
    and exists (
      select 1 from public.orders o
      where o.id = documents.owner_id and o.client_id = app.client_id()
    )
  );

-- =============================================================================
-- 6. GRANT-uri Data API (RLS ramane filtrul efectiv)
-- =============================================================================
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant execute on all functions in schema app to authenticated, service_role;
