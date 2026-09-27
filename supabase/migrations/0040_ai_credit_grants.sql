-- =============================================================================
-- Asistent AI: top-up de credite (luna curenta) + jurnalul modificarilor de limite
-- =============================================================================
-- Plan: docs/plans/asistent-credite-control-super-admin.md
--
--  - `ai_credit_grants`: credite EXTRA pentru o organizatie, valabile doar in luna data
--    (expira la sfarsitul ei). Append-only, motiv obligatoriu, doar super-admin.
--  - `ai_limit_changes`: jurnal scris DOAR de trigger-e - orice schimbare a limitelor AI
--    ale unei organizatii si orice top-up, cu autorul si valorile inainte/dupa.
-- =============================================================================

create table public.ai_credit_grants (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- prima zi a lunii in care creditele sunt valabile (UTC, ca `assistant_usage.day`)
  month           date not null default (date_trunc('month', timezone('utc', now())))::date
                    check (month = date_trunc('month', month)::date),
  credits         integer not null check (credits > 0 and credits <= 10000000),
  reason          text not null check (length(trim(reason)) between 3 and 500),
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index ai_credit_grants_org_month_idx on public.ai_credit_grants (organization_id, month);

alter table public.ai_credit_grants enable row level security;

-- Citire: staff-ul organizatiei (cardul de consum arata bugetul efectiv; `is_staff_of`
-- include super-adminul). Scriere: doar super-adminul. Fara update/delete (append-only).
create policy ai_credit_grants_select on public.ai_credit_grants
  for select using (app.is_staff_of(organization_id));
create policy ai_credit_grants_insert on public.ai_credit_grants
  for insert with check (app.is_super_admin());

grant select, insert on public.ai_credit_grants to authenticated;
grant select, insert, update, delete on public.ai_credit_grants to service_role;

create table public.ai_limit_changes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  change_type     text not null check (change_type in ('limits', 'grant')),
  before          jsonb,
  after           jsonb not null,
  changed_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index ai_limit_changes_org_created_idx on public.ai_limit_changes (organization_id, created_at desc);

alter table public.ai_limit_changes enable row level security;

-- Doar super-adminul citeste jurnalul; nimeni nu scrie direct (doar trigger-ele de mai jos).
create policy ai_limit_changes_select on public.ai_limit_changes
  for select using (app.is_super_admin());

grant select on public.ai_limit_changes to authenticated;
grant select, insert, update, delete on public.ai_limit_changes to service_role;

create or replace function app.log_ai_limit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after  jsonb;
begin
  v_before := jsonb_build_object(
    'ai_enabled', old.ai_enabled,
    'ai_monthly_credit_limit', old.ai_monthly_credit_limit,
    'ai_daily_user_credit_percent', old.ai_daily_user_credit_percent,
    'ai_monthly_message_limit', old.ai_monthly_message_limit,
    'ai_daily_user_message_limit', old.ai_daily_user_message_limit
  );
  v_after := jsonb_build_object(
    'ai_enabled', new.ai_enabled,
    'ai_monthly_credit_limit', new.ai_monthly_credit_limit,
    'ai_daily_user_credit_percent', new.ai_daily_user_credit_percent,
    'ai_monthly_message_limit', new.ai_monthly_message_limit,
    'ai_daily_user_message_limit', new.ai_daily_user_message_limit
  );
  if v_before is distinct from v_after then
    insert into public.ai_limit_changes (organization_id, change_type, before, after, changed_by)
    values (new.id, 'limits', v_before, v_after, auth.uid());
  end if;
  return new;
end;
$$;

create trigger organizations_ai_limits_log
  after update on public.organizations
  for each row execute function app.log_ai_limit_change();

create or replace function app.log_ai_credit_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.ai_limit_changes (organization_id, change_type, before, after, changed_by)
  values (
    new.organization_id,
    'grant',
    null,
    jsonb_build_object('credits', new.credits, 'month', new.month, 'reason', new.reason),
    coalesce(new.created_by, auth.uid())
  );
  return new;
end;
$$;

create trigger ai_credit_grants_log
  after insert on public.ai_credit_grants
  for each row execute function app.log_ai_credit_grant();
