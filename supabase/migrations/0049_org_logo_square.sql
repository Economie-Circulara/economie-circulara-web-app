-- =============================================================================
-- Doua variante de logo per organizatie: orizontala (inline) + patrata
-- =============================================================================
-- `logo_url` ramane varianta ORIZONTALA (simbol + nume pe un rand) - folosita in
-- sidebar, pe login si pe pagina de start. Coloana noua `logo_square_url` = varianta
-- PATRATA (simbol / nume dedesubt) - folosita pentru favicon. Oricare poate lipsi;
-- aplicatia foloseste cealalta ca rezerva (`src/features/branding/logos.ts`).
--
-- Fara politici noi: adminul organizatiei scrie deja `organizations` (0001), iar
-- logo-ul nu e camp gestionat de platforma (0045/0046).
-- =============================================================================

alter table public.organizations
  add column logo_square_url text;

comment on column public.organizations.logo_url is
  'Logo orizontal (simbol + nume pe un rand): sidebar, login, pagina de start.';
comment on column public.organizations.logo_square_url is
  'Logo patrat (simbol): favicon; rezerva pentru logo-ul orizontal.';

-- Tipul returnat se schimba (coloana noua) -> `create or replace` nu e suficient.
drop function public.org_branding(text, text);

create function public.org_branding(
  p_slug   text default null,
  p_domain text default null
)
returns table (
  id              uuid,
  name            text,
  slug            text,
  custom_domain   text,
  logo_url        text,
  logo_square_url text,
  primary_color   text,
  secondary_color text,
  theme           text
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.name, o.slug, o.custom_domain, o.logo_url, o.logo_square_url,
         o.primary_color, o.secondary_color, o.theme
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
