-- =============================================================================
-- 0050 - Emailuri white-label per domeniu: domeniul de trimitere al organizatiei
-- (plan: docs/plans/email-white-label-per-domeniu.md).
--
-- 1. Domeniul de trimitere (`email_domain`) + starea verificarii lui la providerul de
--    email (Resend): id-ul domeniului la provider, statusul, inregistrarile DNS de pus
--    in zona domeniului si momentul ultimei verificari. Aplicatia trimite de pe
--    `email_from_address` DOAR cand statusul e `verified` si adresa e pe acest domeniu
--    (`src/features/notifications/sender.ts`) - altfel de pe adresa platformei, cu
--    numele organizatiei.
-- 2. `email_reply_to`: adresa la care ajung raspunsurile clientilor (o gestioneaza
--    adminul organizatiei).
-- 3. Domeniul, adresa expeditorului si starea verificarii le schimba DOAR super-adminul
--    (garda din 0045/0046 extinsa): o adresa pe un domeniu neverificat face trimiterea
--    sa esueze. Numele expeditorului si reply-to raman la adminul organizatiei.
-- =============================================================================

alter table public.organizations
  add column email_domain text,
  add column email_domain_provider_id text,
  add column email_domain_status text not null default 'not_configured'
    constraint organizations_email_domain_status_check
    check (email_domain_status in ('not_configured', 'pending', 'verified', 'failed')),
  add column email_domain_records jsonb not null default '[]'::jsonb,
  add column email_domain_checked_at timestamptz,
  add column email_reply_to text;

comment on column public.organizations.email_domain is
  'Domeniul de pe care se trimit emailurile organizatiei (ex. etora.ro). Doar super-admin.';
comment on column public.organizations.email_domain_status is
  'Verificarea domeniului la providerul de email (Resend). Doar super-admin.';
comment on column public.organizations.email_domain_records is
  'Inregistrarile DNS cerute de provider: [{type, name, value, priority, status}]. Doar super-admin.';
comment on column public.organizations.email_from_address is
  'Adresa expeditorului; folosita doar cand email_domain e verificat. Doar super-admin (0050).';
comment on column public.organizations.email_reply_to is
  'Adresa de raspuns (reply-to) a emailurilor organizatiei. Adminul organizatiei.';

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
     or new.email_domain_checked_at is distinct from old.email_domain_checked_at then
    raise exception
      'tema, organizarea, domeniul propriu si domeniul de email pot fi modificate doar de super-admin'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;
