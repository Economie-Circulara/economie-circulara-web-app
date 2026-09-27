-- =============================================================================
-- 0046 - Organizarea aplicatiei per organizatie (meniu + panou de control)
-- (plan: docs/plans/multi-domain-tenant-profiles.md, T4).
--
-- `organizations.layout`: `standard` (meniul/panoul initiale) sau `flux` (acelasi set
-- de pagini, grupat pe activitati + panou orientat pe actiuni). Definitiile sunt in
-- cod (src/features/branding/layouts.ts); aici doar cheia, validata de CHECK.
-- Ca tema si domeniul (0045), o schimba DOAR super-adminul - garda din 0045 e
-- extinsa cu noua coloana.
-- =============================================================================

alter table public.organizations
  add column layout text not null default 'standard'
    constraint organizations_layout_check
    check (layout in ('standard', 'flux'));

comment on column public.organizations.layout is
  'Organizarea meniului + panoului (cheie din src/features/branding/layouts.ts). Doar super-admin.';

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
     or new.layout is distinct from old.layout
     or new.custom_domain is distinct from old.custom_domain then
    raise exception
      'tema, organizarea si domeniul propriu pot fi modificate doar de super-admin'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;
