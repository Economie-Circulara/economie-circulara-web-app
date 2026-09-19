-- =============================================================================
-- Task X9 - Cod de lot lizibil (identificare umana a loturilor de stoc)
-- =============================================================================
-- Migrare aditiva peste schema inghetata din 0001_core_schema.sql. Azi
-- `lots.id` e un UUID intern, niciodata afisat utilizatorului - tabelul de stoc
-- (`src/features/stock/stock-table.tsx`) il foloseste doar ca React key si in
-- campuri ascunse de formular (blocare/deblocare). Un utilizator a cerut explicit
-- un id de identificare pentru loturi ("loturile nu au id-uri... ar trebui sa fie
-- un id pentru identificare").
--
-- Contine, in stilul EXACT al `order_counters`/`generate_order_number`
-- (0007_orders_ops.sql) si `certificate_counters`/`generate_certificate_number`
-- (0009_certificates_storage.sql) - tabel contor + secventa per
-- (organizatie, an), NU un `sequence` Postgres global (ar fi comun tuturor
-- organizatiilor si nu s-ar putea reseta anual):
--
--   1. `public.lot_counters`            -> tabel contor, un rand per (organizatie, an)
--   2. `public.generate_lot_code(uuid)` -> cod de lot secvential, format
--                                           "LOT-<an>-<secventa pe 6 cifre>"
--                                           (ex. LOT-2026-000123)
--   3. `public.lots.lot_code`           -> coloana noua, backfill pentru loturile
--                                           existente (ordine determinista:
--                                           entry_date, apoi created_at, per
--                                           organizatie/an), apoi NOT NULL + UNIQUE
--   4. `public.create_lot` re-creata sa genereze codul la insert
--
-- Coduri de eroare (in stilul LT00x din 0004_stock_service.sql):
--   LT006 - organizatia lipseste la generarea codului
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. lot_counters - contor de numerotare, un rand per (organizatie, an)
-- -----------------------------------------------------------------------------
-- Aceeasi alegere si motivatie ca `order_counters`/`certificate_counters`:
-- `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` da siguranta la concurenta
-- (lock de rand pe (organization_id, year), fara `LOCK TABLE`/advisory lock
-- explicit) si un cod lizibil cu reset anual natural.
create table public.lot_counters (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  year            integer not null,
  seq             integer not null default 0,
  updated_at      timestamptz not null default now(),
  primary key (organization_id, year)
);

alter table public.lot_counters enable row level security;

-- Loturile se creeaza DOAR de staff (`create_lot`, verificare `app.is_staff_of` -
-- vezi 0004_stock_service.sql), deci politica e analoaga `certificate_counters`
-- (staff-only), nu `order_counters` (unde si clientul poate declansa generarea).
create policy lot_counters_staff_all on public.lot_counters
  for all using (app.is_staff_of(organization_id))
  with check (app.is_staff_of(organization_id));

grant select, insert, update on public.lot_counters to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. generate_lot_code - cod de lot secvential per (organizatie, an)
-- -----------------------------------------------------------------------------
create or replace function public.generate_lot_code(p_org uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_year integer := extract(year from now())::integer;
  v_seq  integer;
begin
  if p_org is null then
    raise exception 'Organizatia este obligatorie pentru generarea codului de lot.'
      using errcode = 'LT006';
  end if;

  -- RLS (`lot_counters_staff_all`) impune `app.is_staff_of(p_org)`: un apelant
  -- fara drept de staff in organizatia respectiva primeste o violare de politica
  -- (insufficient_privilege), nu un cod strain.
  insert into public.lot_counters (organization_id, year, seq, updated_at)
  values (p_org, v_year, 1, now())
  on conflict (organization_id, year)
  do update set seq = public.lot_counters.seq + 1, updated_at = now()
  returning seq into v_seq;

  -- 6 cifre (spre deosebire de 4 la CMD-/CRT-): un depozit poate acumula multe
  -- mai multe loturi pe an decat comenzi/certificate (fiecare livrare de la un
  -- furnizor sau iesire de la un proces e un lot nou).
  return format('LOT-%s-%s', v_year, lpad(v_seq::text, 6, '0'));
end;
$$;

revoke all on function public.generate_lot_code(uuid) from public;
grant execute on function public.generate_lot_code(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. lots.lot_code - coloana noua + backfill + NOT NULL/UNIQUE
-- -----------------------------------------------------------------------------
alter table public.lots add column lot_code text;

comment on column public.lots.lot_code is
  'Cod uman de identificare a lotului (format "LOT-<an>-<secventa>", generat de '
  'public.generate_lot_code la creare - vezi migrarea 0033). Distinct de `id` '
  '(UUID intern, neschimbat): `lot_code` e ceea ce vede/cauta utilizatorul.';

-- Backfill SET-BASED (stilul din 0028_recipe_direction_and_um_conversion.sql),
-- nu un loop rand-cu-rand: `row_number()` peste (organization_id, an calculat din
-- entry_date), ordonat dupa entry_date apoi created_at (aceeasi ordine
-- determinista ca tie-break-ul FIFO din `consume_fifo`, 0004_stock_service.sql).
with backfill as (
  select
    id,
    organization_id,
    extract(year from entry_date)::integer as year,
    row_number() over (
      partition by organization_id, extract(year from entry_date)::integer
      order by entry_date asc, created_at asc
    ) as seq
  from public.lots
)
update public.lots l
set lot_code = format('LOT-%s-%s', b.year, lpad(b.seq::text, 6, '0'))
from backfill b
where l.id = b.id;

-- Seed pentru `lot_counters`, ca urmatorul `generate_lot_code` sa continue
-- secventa de unde a ramas backfill-ul (nu de la 1 - ar duplica coduri).
insert into public.lot_counters (organization_id, year, seq, updated_at)
select organization_id, extract(year from entry_date)::integer as year, count(*) as seq, now()
from public.lots
group by organization_id, extract(year from entry_date)::integer
on conflict (organization_id, year) do update
  set seq = excluded.seq, updated_at = now();

alter table public.lots alter column lot_code set not null;
alter table public.lots add constraint lots_lot_code_unique unique (organization_id, lot_code);

-- -----------------------------------------------------------------------------
-- 4. create_lot - genereaza lot_code la insert
-- -----------------------------------------------------------------------------
-- `create or replace` (nu DROP+CREATE): semnatura (parametrii) neschimbata fata
-- de 0031_aport_intake.sql - doar corpul si tipul de retur (coloana noua) difera.
create or replace function public.create_lot(
  p_item_id        uuid,
  p_quantity       numeric,
  p_provenance     public.lot_provenance,
  p_source         text default null,
  p_entry_date     date default null,
  p_location       text default null,
  p_quality_status public.quality_status default null,
  p_reason         text default null,
  p_client_id      uuid default null
)
returns public.lots
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org  uuid;
  v_lot  public.lots;
  v_code text;
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

  v_code := public.generate_lot_code(v_org);

  insert into public.lots (
    organization_id, item_id, entry_date, source, provenance, location,
    initial_qty, remaining_qty, quality_status, client_id, lot_code
  )
  values (
    v_org, p_item_id, coalesce(p_entry_date, current_date), p_source, p_provenance, p_location,
    p_quantity, p_quantity, coalesce(p_quality_status, 'unchecked'), p_client_id, v_code
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

-- Semnatura neschimbata -> revoke/grant pe aceeasi lista de tipuri ca 0031.
revoke all on function public.create_lot(
  uuid, numeric, public.lot_provenance, text, date, text, public.quality_status, text, uuid
) from public;
grant execute on function public.create_lot(
  uuid, numeric, public.lot_provenance, text, date, text, public.quality_status, text, uuid
) to authenticated, service_role;
