-- =============================================================================
-- 0055 - Module per organizatie (feature flags) - plan: docs/plans/flota-combustibil.md.
--
-- 1. `organizations.enabled_modules`: lista modulelor optionale active pentru
--    organizatie (cheile din src/features/modules/modules.ts). Implicit niciunul.
--    Primul modul: `fleet` (Flotă - vehicule, alimentari, consum estimat).
-- 2. Modulele le activeaza DOAR super-adminul (garda din 0045/0046/0050 extinsa):
--    altfel `organizations_update` (0001) ar lasa adminul organizatiei sa-si
--    activeze singur un modul comercial.
-- 3. `app.org_has_module(org, module)`: helper pentru RLS-ul tabelelor unui modul.
--    Dezactivarea unui modul ASCUNDE datele (RLS), nu le sterge.
-- =============================================================================

alter table public.organizations
  add column enabled_modules text[] not null default '{}'
    constraint organizations_enabled_modules_check
    check (enabled_modules <@ array['fleet']::text[]);

comment on column public.organizations.enabled_modules is
  'Modulele optionale active (chei din src/features/modules/modules.ts). Doar super-admin.';

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
     or new.custom_domain is distinct from old.custom_domain
     or new.email_from_address is distinct from old.email_from_address
     or new.email_domain is distinct from old.email_domain
     or new.email_domain_provider_id is distinct from old.email_domain_provider_id
     or new.email_domain_status is distinct from old.email_domain_status
     or new.email_domain_records is distinct from old.email_domain_records
     or new.email_domain_checked_at is distinct from old.email_domain_checked_at
     or new.enabled_modules is distinct from old.enabled_modules then
    raise exception
      'tema, organizarea, domeniul propriu, domeniul de email si modulele pot fi modificate doar de super-admin'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- SECURITY DEFINER, ca `app.org_is_active` (0012): citeste direct `organizations`,
-- fara sa depinda de politica `organizations_select`.
create or replace function app.org_has_module(org uuid, module text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select module = any (enabled_modules) from public.organizations where id = org),
    false
  )
$$;
