-- =============================================================================
-- 0056 - Modulul Flotă (etapa 3 din docs/plans/flota-combustibil.md): vehicule +
-- jurnalul de alimentari.
--
-- 1. `vehicles`: nume + consum (L/100 km) obligatorii, restul optional. ARHIVARE
--    reversibila (`archived_at`/`archived_by`, stampilat de `app.stamp_archive`,
--    ca la items/clients - 0035), fara stergere: alimentarile si (in etapa 4)
--    transporturile raman legate de vehicul.
-- 2. `fuel_entries`: o alimentare (data, litri obligatorii; suma, km la bord,
--    benzinarie, bon optionale). NU se sterg - o greseala se corecteaza prin
--    editare (decizie 2026-10-10). Vehiculul trebuie sa fie din ACEEASI organizatie
--    (FK compus `(vehicle_id, organization_id)`).
-- 3. RLS: staff-ul organizatiei (admin + operator) SI modulul `fleet` activ
--    (`app.org_has_module`, 0055). Fara politica de DELETE (si `revoke delete`):
--    nimic din flota nu se sterge prin Data API. Clientul nu vede nimic.
-- 4. Bucket PRIVAT `fleet-receipts` pentru bonuri, fara politici pe
--    `storage.objects` - acces doar prin server actions (clientul admin), dupa
--    verificarea RLS pe randul `fuel_entries` (acelasi tipar ca `documents`, 0006).
-- =============================================================================

create table public.vehicles (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  name                     text not null constraint vehicles_name_check check (btrim(name) <> ''),
  plate                    text,                     -- nr. de inmatriculare (optional)
  vehicle_type             text,                     -- ex. "Basculantă", "Autoutilitară"
  fuel_type                text,                     -- ex. "Motorină"
  consumption_l_per_100km  numeric(6, 2) not null
    constraint vehicles_consumption_check check (consumption_l_per_100km > 0 and consumption_l_per_100km <= 200),
  capacity                 numeric(12, 3)
    constraint vehicles_capacity_check check (capacity is null or capacity > 0),
  capacity_unit            text
    constraint vehicles_capacity_unit_check check (capacity_unit in ('t', 'mc', 'kg', 'l')),
  default_driver_name      text,
  notes                    text,
  archived_at              timestamptz,
  archived_by              uuid references public.profiles (id) on delete set null,
  created_by               uuid references public.profiles (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  -- Capacitatea are sens doar cu unitatea ei (si invers).
  constraint vehicles_capacity_pair_check check ((capacity is null) = (capacity_unit is null)),
  -- Tinta FK-ului compus din `fuel_entries` (vehicul din aceeasi organizatie).
  constraint vehicles_id_org_key unique (id, organization_id)
);

comment on column public.vehicles.consumption_l_per_100km is
  'Consumul mediu declarat (litri / 100 km) - baza estimarii de combustibil per transport.';

create index vehicles_organization_id_idx on public.vehicles (organization_id);
create index vehicles_active_idx on public.vehicles (organization_id) where archived_at is null;
-- Acelasi numar de inmatriculare o singura data per organizatie (ignorand spatii,
-- cratime si majuscule: "IS 12 ABC" = "is-12-abc").
create unique index vehicles_plate_unique on public.vehicles
  (organization_id, upper(regexp_replace(plate, '[\s-]', '', 'g')))
  where plate is not null;

create trigger vehicles_touch_updated_at before update on public.vehicles
  for each row execute function app.touch_updated_at();
create trigger vehicles_stamp_archive before update on public.vehicles
  for each row execute function app.stamp_archive();

create table public.fuel_entries (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  vehicle_id         uuid not null,
  filled_on          date not null,
  liters             numeric(10, 2) not null constraint fuel_entries_liters_check check (liters > 0),
  amount             numeric(12, 2) constraint fuel_entries_amount_check check (amount is null or amount >= 0),
  odometer_km        integer constraint fuel_entries_odometer_check check (odometer_km is null or odometer_km >= 0),
  station            text,
  notes              text,
  receipt_path       text,                           -- obiectul din bucketul `fleet-receipts`
  receipt_file_name  text,
  receipt_mime_type  text,
  created_by         uuid references public.profiles (id) on delete set null,
  updated_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint fuel_entries_vehicle_fkey foreign key (vehicle_id, organization_id)
    references public.vehicles (id, organization_id) on delete restrict
);

comment on column public.fuel_entries.amount is
  'Suma platita (lei), optionala - portita pentru costul combustibilului.';

create index fuel_entries_organization_id_idx on public.fuel_entries (organization_id, filled_on desc);
create index fuel_entries_vehicle_id_idx on public.fuel_entries (vehicle_id, filled_on desc);

create trigger fuel_entries_touch_updated_at before update on public.fuel_entries
  for each row execute function app.touch_updated_at();

-- `created_by` / `updated_by` nu vin din input: le stampileaza triggerul din sesiune.
create or replace function app.stamp_fuel_entry_authors()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.updated_by := null;
  else
    new.created_by := old.created_by;
    new.updated_by := coalesce(auth.uid(), new.updated_by);
  end if;
  return new;
end;
$$;

create trigger fuel_entries_stamp_authors before insert or update on public.fuel_entries
  for each row execute function app.stamp_fuel_entry_authors();

-- -----------------------------------------------------------------------------
-- RLS: staff + modulul `fleet`. Fara DELETE.
-- -----------------------------------------------------------------------------
alter table public.vehicles enable row level security;
alter table public.fuel_entries enable row level security;

create policy vehicles_staff_select on public.vehicles
  for select using (app.is_staff_of(organization_id) and app.org_has_module(organization_id, 'fleet'));
create policy vehicles_staff_insert on public.vehicles
  for insert with check (app.is_staff_of(organization_id) and app.org_has_module(organization_id, 'fleet'));
create policy vehicles_staff_update on public.vehicles
  for update using (app.is_staff_of(organization_id) and app.org_has_module(organization_id, 'fleet'))
  with check (app.is_staff_of(organization_id) and app.org_has_module(organization_id, 'fleet'));

create policy fuel_entries_staff_select on public.fuel_entries
  for select using (app.is_staff_of(organization_id) and app.org_has_module(organization_id, 'fleet'));
create policy fuel_entries_staff_insert on public.fuel_entries
  for insert with check (app.is_staff_of(organization_id) and app.org_has_module(organization_id, 'fleet'));
create policy fuel_entries_staff_update on public.fuel_entries
  for update using (app.is_staff_of(organization_id) and app.org_has_module(organization_id, 'fleet'))
  with check (app.is_staff_of(organization_id) and app.org_has_module(organization_id, 'fleet'));

-- Default privileges Supabase dau `all` lui anon/authenticated pe orice tabel nou.
revoke all on public.vehicles, public.fuel_entries from anon;
revoke delete, truncate on public.vehicles, public.fuel_entries from authenticated;
grant select, insert, update on public.vehicles, public.fuel_entries to authenticated;
grant select, insert, update on public.vehicles, public.fuel_entries to service_role;

-- -----------------------------------------------------------------------------
-- Bonuri de alimentare (imagini / PDF) - bucket privat, fara politici.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fleet-receipts',
  'fleet-receipts',
  false,
  4194304,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;
