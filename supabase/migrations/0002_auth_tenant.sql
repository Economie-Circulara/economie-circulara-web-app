-- =============================================================================
-- T1.2 — Auth & tenant context
-- =============================================================================
-- Lookup public, sigur, al brandingului unei organizatii (pentru ecranul de login,
-- inainte ca utilizatorul sa fie autentificat). Expune DOAR campuri de prezentare
-- (nume, logo, culori) - nu setarile de email sau alte date sensibile.
--
-- SECURITY DEFINER (ocoleste RLS) + grant catre anon/authenticated, expus ca RPC.
-- Returneaza cel mult o organizatie ACTIVA potrivita pe custom_domain SAU slug.

create or replace function public.org_branding(
  p_slug   text default null,
  p_domain text default null
)
returns table (
  id              uuid,
  name            text,
  slug            text,
  custom_domain   text,
  logo_url        text,
  primary_color   text,
  secondary_color text
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.name, o.slug, o.custom_domain, o.logo_url, o.primary_color, o.secondary_color
  from public.organizations o
  where o.status = 'active'
    and (
      (p_domain is not null and o.custom_domain = p_domain)
      or (p_slug is not null and o.slug = p_slug)
    )
  -- custom domain are precedenta peste slug daca ambele s-ar potrivi
  order by (o.custom_domain is not null and o.custom_domain = p_domain) desc
  limit 1
$$;

revoke all on function public.org_branding(text, text) from public;
grant execute on function public.org_branding(text, text) to anon, authenticated, service_role;
