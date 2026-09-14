-- =============================================================================
-- Task X7 - Planificare optimizata a rutelor de livrare + confirmarea receptiei
-- =============================================================================
-- Context (docs/plans/rute-optimizate-livrari.md): raspunsul la scrisoarea de
-- clarificari AM nr. 1/31905/AM/07.09.2026 (SMIS 350456) a amanat detalierea a 5
-- caracteristici minime in etapele de dezvoltare - trebuie sa existe ceva
-- demonstrabil in aplicatie. Caracteristicile #1-#3 (productie/colectare/procesare
-- deseuri) sunt deja acoperite de modulele existente (procese, loturi cu sursa,
-- recondiționare) ca monitorizare MANUALA - nu cer schimbari de schema. Aceasta
-- migrare acopera:
--
--   #4 - confirmarea receptiei de catre client (camp nou pe `deliveries`)
--   #5 - planificare inteligenta cu optimizarea rutelor (tabel nou
--        `organization_sites` + geocodare pe `client_addresses` + rezultatul
--        calculului de rute pe `deliveries`)
--
-- Migrare ADITIVA peste schema inghetata din 0001_core_schema.sql si peste
-- 0013_deliveries.sql (NU modifica nicio coloana/politica existenta - doar
-- adauga tabele/coloane noi si politici noi).
--
-- Adrese structurate (nu doar text liber): motivul e dublu - (a) geocodarea catre
-- Google Routes/Geocoding API e mult mai fiabila pe componente separate decat pe
-- un text liber, si (b) o viitoare declaratie RO e-Transport (prin Socrate.io,
-- spike S4 - vezi src/features/deliveries/e-transport.ts) cere adresa de
-- incarcare/descarcare structurata (judet/localitate/strada), NU text liber.
-- Codul de judet (`county_code`) e pastrat generic (text) - maparea exacta pe
-- nomenclatorul ANAF folosit de Socrate.io e INCA necunoscuta (S4 nerezolvat),
-- se valideaza cand vin credentialele. `address` (text liber) ramane sursa de
-- adevar pt. afisare/aviz PDF pana la completarea componentelor structurate -
-- coloanele noi sunt NULLABILE, adresele existente nu se strica.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Adrese de livrare (`client_addresses`): componente structurate + geocodare.
-- -----------------------------------------------------------------------------
-- Nicio schimbare de politica RLS necesara - politicile existente (0001/0014/0016)
-- sunt pe intregul rand, nu pe coloane individuale.
alter table public.client_addresses
  add column county_code   text,                 -- cod judet (uz intern - de aliniat cu ANAF/Socrate.io la S4)
  add column county         text,                 -- nume judet (ex. "Iași")
  add column locality       text,                 -- localitate/oras
  add column street         text,
  add column street_number  text,
  add column postal_code    text,
  add column lat            numeric(9, 6),        -- geocodare (WGS84)
  add column lng            numeric(9, 6),
  add column geocoded_at    timestamptz;          -- null = adresa inca negeocodata (calculul de rute o geocodeaza on-demand)

-- -----------------------------------------------------------------------------
-- 2. Puncte de plecare ale organizatiei (statii de betoane / depozite).
-- -----------------------------------------------------------------------------
-- Acelasi pattern structural ca `client_addresses` (0001_core_schema.sql §3.4),
-- dar FARA `client_id` (apartine organizatiei, nu unui client) si cu `name` in
-- loc de `label` (obligatoriu - identifica statia in selectorul de planificare).
create table public.organization_sites (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null,                 -- ex. "Stație centrală Iași"
  address         text not null,                 -- adresa completa (afisare + fallback text pt. ruta)
  county_code     text,
  county          text,
  locality        text,
  street          text,
  street_number   text,
  postal_code     text,
  lat             numeric(9, 6),
  lng             numeric(9, 6),
  geocoded_at     timestamptz,
  is_default      boolean not null default false,  -- unicitatea "un singur implicit" e impusa in service.ts (ca la client_addresses)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index organization_sites_organization_id_idx on public.organization_sites (organization_id);

create trigger organization_sites_touch_updated_at before update on public.organization_sites
  for each row execute function app.touch_updated_at();

alter table public.organization_sites enable row level security;

-- Doar staff (admin/operator al organizatiei, sau super-admin) - punctele de
-- plecare sunt date operationale interne, fara vizibilitate client (acelasi
-- rationament ca `deliveries_staff_all`, 0013_deliveries.sql). `app.is_staff_of`
-- include deja guard-ul de organizatie suspendata (0012/0016), deci FOR ALL e
-- suficient aici (spre deosebire de `client_addresses`, care are politici
-- separate de client - vezi nota F1a din 0014_suspended_guard_completion.sql -
-- `organization_sites` nu are nicio politica de client de coexistat cu ea).
create policy organization_sites_staff_all on public.organization_sites
  for all using (app.is_staff_of(organization_id))
  with check (app.is_staff_of(organization_id));

grant select, insert, update, delete on public.organization_sites to authenticated;
grant select, insert, update, delete on public.organization_sites to service_role;

-- -----------------------------------------------------------------------------
-- 3. Rezultatul planificarii rutei + confirmarea receptiei, pe `deliveries`.
-- -----------------------------------------------------------------------------
create type public.route_selection_mode as enum (
  'auto',   -- s-a pastrat ruta recomandata automat (cea mai rapida la ora de plecare)
  'manual'  -- operatorul a ales explicit o alta varianta din alternativele calculate
);

alter table public.deliveries
  -- Punctul de plecare (statie/depozit) folosit la calculul rutei - nullable:
  -- livrarile planificate INAINTE de aceasta migrare, sau planificate manual
  -- fara calcul de ruta, nu au un site asociat. `on delete set null` (NU
  -- restrict): stergerea unei statii nu trebuie sa blocheze/sterga livrari
  -- istorice - doar pierde referinta la punctul de plecare folosit atunci.
  add column origin_site_id      uuid references public.organization_sites (id) on delete set null,
  add column route_distance_m    integer,          -- distanta rutei alese (metri)
  add column route_duration_s    integer,          -- durata estimata a rutei alese (secunde, cu trafic la ora planificata)
  add column route_polyline      text,             -- geometria rutei alese (encoded polyline, Google)
  -- Toate variantele calculate (distanta/durata/polilinie/eticheta per varianta) -
  -- dovada auditabila a planificarii "optimizate" ceruta de clarificarea AM (#5).
  -- Stocate ca JSONB (nu tabel separat): sunt un instantaneu al unui calcul extern
  -- la un moment dat, niciodata interogate individual - un tabel normalizat ar fi
  -- supra-inginerie pt. date needitabile, needitate dupa creare.
  add column route_alternatives  jsonb,
  add column route_selected_index smallint,        -- indexul variantei alese in route_alternatives
  add column route_selection     public.route_selection_mode,
  add column route_computed_at   timestamptz,       -- cand s-a facut ultimul calcul (permite "Recalculează")
  -- Confirmarea receptiei (#4 din clarificare) - inregistrare MANUALA (aviz semnat
  -- la fata locului / apel client), nu o integrare noua. `received_by_name` e text
  -- liber (nu FK la `clients`/`profiles`): persoana care semneaza la receptie nu e
  -- neaparat un cont din platforma (sofer, gestionar de santier etc.).
  add column received_at         timestamptz,
  add column received_by_name    text,
  add column receipt_notes       text;

comment on column public.deliveries.route_alternatives is
  'Instantaneu al variantelor de ruta calculate (RoutingProvider#computeRoutes) la route_computed_at: [{ "distanceMeters": int, "durationSeconds": int, "polyline": text, "label": text }, ...]. Needitat dupa creare - se inlocuieste integral la recalculare.';
