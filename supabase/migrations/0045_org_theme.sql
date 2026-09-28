-- =============================================================================
-- 0045 - Tema vizuala per organizatie + domeniul propriu doar de super-admin
-- (plan: docs/plans/multi-domain-tenant-profiles.md, T5).
--
-- 1. `organizations.theme`: cheia temei vizuale (paleta, font, colturi, pattern,
--    stil sidebar, layout login). Definitiile temelor traiesc in cod
--    (src/features/branding/themes.ts + src/app/themes.css); aici doar cheia,
--    validata de un CHECK - o cheie noua cere migrare + CSS, deliberat.
-- 2. `theme` si `custom_domain` pot fi schimbate DOAR de super-admin: un domeniu
--    propriu cere configurare in Vercel + Supabase Auth (facuta de echipa
--    platformei), iar garda de domeniu din middleware redirectioneaza toti userii
--    organizatiei pe el - un domeniu gresit setat de adminul organizatiei ar bloca
--    accesul tuturor. Acelasi model ca `app.enforce_ai_limits` (0020).
-- 3. `org_branding` intoarce si tema (ecranele publice - login, pagina de intrare -
--    se coloreaza dupa domeniu, inainte de autentificare).
-- =============================================================================

alter table public.organizations
  add column theme text not null default 'default'
    constraint organizations_theme_check
    check (theme in ('default', 'teren', 'industrial', 'ciclu'));

comment on column public.organizations.theme is
  'Tema vizuala (cheie din src/features/branding/themes.ts). Doar super-admin.';

create or replace function app.enforce_platform_managed_org_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or app.is_super_admin() then
    return new;
  end if;

  if new.theme is distinct from old.theme
     or new.custom_domain is distinct from old.custom_domain then
    raise exception
      'tema si domeniul propriu pot fi modificate doar de super-admin'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger organizations_platform_fields_guard
  before update on public.organizations
  for each row execute function app.enforce_platform_managed_org_fields();

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
  primary_color   text,
  secondary_color text,
  theme           text
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.name, o.slug, o.custom_domain, o.logo_url, o.primary_color,
         o.secondary_color, o.theme
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
