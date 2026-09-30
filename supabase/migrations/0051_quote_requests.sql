-- =============================================================================
-- Cereri de oferta trimise din site-ul de prezentare al organizatiei
-- =============================================================================
-- Plan: docs/plans/site-cerere-oferta.md. Formularul „Cere o ofertă” de pe apex-ul
-- tenantului (`maconxcx.ro`) trimite la `POST /api/public/cerere-oferta` pe domeniul
-- aplicatiei (`abonamente.maconxcx.ro`). Endpoint-ul e public (fara sesiune); scrie
-- prin RPC-ul de mai jos cu clientul `service_role`, apoi trimite emailul catre firma.
--
-- - Staff-ul organizatiei vede cererile si le marcheaza rezolvate (`/cereri-oferta`).
-- - Nimeni nu insereaza direct: doar RPC-ul, care rezolva organizatia din domeniul
--   cererii si aplica limita anti-spam. RPC-ul NU e accesibil lui `anon` - altfel
--   oricine l-ar putea apela direct prin Data API, ocolind verificarile rutei.
--
-- Coduri de eroare:
--   QR001 - domeniul nu apartine unei organizatii active
--   QR002 - prea multe cereri de la acelasi IP (ultima ora)
--   QR003 - prea multe cereri pentru organizatie (ultimele 24 de ore)
--   QR004 - date invalide (camp obligatoriu lipsa / prea lung)
-- =============================================================================

create table public.quote_requests (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  service         text not null,
  name            text not null,
  phone           text not null,
  email           text,
  message         text,
  -- Hostul pe care a ajuns cererea (domeniul aplicatiei organizatiei).
  source_domain   text not null,
  -- SHA-256 (cu sare) al IP-ului - doar pentru limita anti-spam, nu IP-ul in clar.
  ip_hash         text,
  status          text not null default 'new' check (status in ('new', 'handled')),
  handled_at      timestamptz,
  handled_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

comment on table public.quote_requests is
  'Cereri de oferta din site-ul de prezentare (0051). Inserate doar de RPC-ul submit_quote_request.';

create index quote_requests_org_created_idx
  on public.quote_requests (organization_id, created_at desc);
create index quote_requests_ip_created_idx
  on public.quote_requests (ip_hash, created_at desc) where ip_hash is not null;

-- `handled_at` / `handled_by` nu vin din input: le stampileaza triggerul la schimbarea
-- statusului (acelasi tipar ca `app.stamp_archive`, 0035).
create or replace function app.stamp_quote_request_handled()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'handled' then
      new.handled_at := now();
      new.handled_by := auth.uid();
    else
      new.handled_at := null;
      new.handled_by := null;
    end if;
  else
    new.handled_at := old.handled_at;
    new.handled_by := old.handled_by;
  end if;
  return new;
end;
$$;

create trigger quote_requests_stamp_handled before update on public.quote_requests
  for each row execute function app.stamp_quote_request_handled();

alter table public.quote_requests enable row level security;

create policy quote_requests_staff_select on public.quote_requests
  for select using (app.is_staff_of(organization_id));

create policy quote_requests_staff_update on public.quote_requests
  for update using (app.is_staff_of(organization_id))
  with check (app.is_staff_of(organization_id));

-- Staff-ul schimba DOAR statusul; datele solicitantului raman cum au venit. Revocam
-- intai privilegiile implicite pe tabel (default privileges Supabase: `all` pentru
-- anon/authenticated) - altfel grant-ul pe coloana nu restrange nimic.
revoke all on public.quote_requests from anon, authenticated;
grant select on public.quote_requests to authenticated;
grant update (status) on public.quote_requests to authenticated;
grant select, insert, update, delete on public.quote_requests to service_role;

-- -----------------------------------------------------------------------------
-- RPC: inregistreaza o cerere venita din site.
-- -----------------------------------------------------------------------------
create or replace function public.submit_quote_request(
  p_domain  text,
  p_service text,
  p_name    text,
  p_phone   text,
  p_email   text default null,
  p_message text default null,
  p_ip_hash text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org     uuid;
  v_domain  text := lower(btrim(coalesce(p_domain, '')));
  v_service text := nullif(btrim(coalesce(p_service, '')), '');
  v_name    text := nullif(btrim(coalesce(p_name, '')), '');
  v_phone   text := nullif(btrim(coalesce(p_phone, '')), '');
  v_email   text := nullif(btrim(coalesce(p_email, '')), '');
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
  v_id      uuid;
begin
  select o.id into v_org
  from public.organizations o
  where lower(o.custom_domain) = v_domain;

  if v_org is null or not app.org_is_active(v_org) then
    raise exception 'Domeniul nu aparține unei organizații active.' using errcode = 'QR001';
  end if;

  if v_service is null or v_name is null or v_phone is null
     or length(v_service) > 100 or length(v_name) > 120 or length(v_phone) > 40
     or length(coalesce(v_email, '')) > 200 or length(coalesce(v_message, '')) > 2000 then
    raise exception 'Date invalide în cererea de ofertă.' using errcode = 'QR004';
  end if;

  -- Serializeaza cererile aceleiasi organizatii: numaratorile de mai jos nu pot fi
  -- ocolite de cereri simultane.
  perform pg_advisory_xact_lock(hashtext('quote_requests:' || v_org::text));

  if p_ip_hash is not null and (
    select count(*) from public.quote_requests
    where ip_hash = p_ip_hash and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'Prea multe cereri. Încercați din nou mai târziu.' using errcode = 'QR002';
  end if;

  if (
    select count(*) from public.quote_requests
    where organization_id = v_org and created_at > now() - interval '24 hours'
  ) >= 200 then
    raise exception 'Prea multe cereri. Încercați din nou mai târziu.' using errcode = 'QR003';
  end if;

  insert into public.quote_requests
    (organization_id, service, name, phone, email, message, source_domain, ip_hash)
  values
    (v_org, v_service, v_name, v_phone, v_email, v_message, v_domain, p_ip_hash)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_quote_request(text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_quote_request(text, text, text, text, text, text, text)
  to service_role;
