-- =============================================================================
-- Task G — Certificate de trasabilitate: numar unic + bucket de storage
-- =============================================================================
-- Migrare aditiva peste schema inghetata din 0001_core_schema.sql (tabelul
-- `certificates` exista deja, cu RLS proprie). Adauga:
--
--   public.certificate_counters             -> tabel contor, un rand per (organizatie, an)
--   public.generate_certificate_number(uuid) -> numar de certificat secvential
--   bucket privat `certificates` in Supabase Storage
--
-- Stil identic cu 0007_orders_ops.sql (order_counters/generate_order_number) si
-- 0006_documents_storage.sql (bucket privat fara politici pe storage.objects).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. certificate_counters — contor de numerotare, un rand per (organizatie, an)
-- -----------------------------------------------------------------------------
-- Aceeasi alegere si motivatie ca `order_counters` (0007_orders_ops.sql): tabel
-- contor + `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` da siguranta la
-- concurenta (lock de rand pe (organization_id, year), fara `LOCK TABLE`/advisory
-- lock explicit) si numar lizibil cu reset anual natural. Format: "CRT-<an>-<seq>"
-- (analog "CMD-<an>-<seq>" de la comenzi), distinct de varianta ilustrativa din
-- mockup ("CRT-2043-0617", care combina numarul comenzii cu un cod arbitrar).
create table public.certificate_counters (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  year            integer not null,
  seq             integer not null default 0,
  updated_at      timestamptz not null default now(),
  primary key (organization_id, year)
);

alter table public.certificate_counters enable row level security;

-- Certificatele se genereaza DOAR de staff (la inchiderea comenzii, actiune
-- rezervata admin/operator — vezi src/features/orders/actions.ts#closeOrderAction),
-- spre deosebire de `order_counters`, unde si clientul poate trimite propria
-- comanda. Politica ramane consistenta cu restul RLS-ului: `app.is_staff_of`.
create policy certificate_counters_staff_all on public.certificate_counters
  for all using (app.is_staff_of(organization_id))
  with check (app.is_staff_of(organization_id));

grant select, insert, update on public.certificate_counters to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. generate_certificate_number — numar de certificat secvential per (organizatie, an)
-- -----------------------------------------------------------------------------
create or replace function public.generate_certificate_number(p_org uuid)
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
    raise exception 'Organizatia este obligatorie pentru generarea numarului de certificat.'
      using errcode = 'CT001';
  end if;

  -- RLS (`certificate_counters_staff_all`) impune `app.is_staff_of(p_org)`: un
  -- apelant fara drept de staff in organizatia respectiva primeste o violare de
  -- politica (insufficient_privilege), nu un numar strain.
  insert into public.certificate_counters (organization_id, year, seq, updated_at)
  values (p_org, v_year, 1, now())
  on conflict (organization_id, year)
  do update set seq = public.certificate_counters.seq + 1, updated_at = now()
  returning seq into v_seq;

  return format('CRT-%s-%s', v_year, lpad(v_seq::text, 4, '0'));
end;
$$;

revoke all on function public.generate_certificate_number(uuid) from public;
grant execute on function public.generate_certificate_number(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Bucket privat `certificates` — acces DOAR prin server actions (client admin)
-- -----------------------------------------------------------------------------
-- Acelasi model ca bucket-ul `documents` (0006_documents_storage.sql): FARA
-- politici pe `storage.objects` (deny implicit pentru orice rol autentificat).
-- Tot accesul (upload la generare, download) trece prin
-- src/features/certificates/service.ts, care foloseste clientul administrativ
-- (service-role) pentru upload/semnare URL, dupa ce a verificat accesul la randul
-- `certificates` prin clientul utilizatorului curent (RLS).
insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', false)
on conflict (id) do nothing;
