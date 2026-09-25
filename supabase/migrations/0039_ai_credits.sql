-- =============================================================================
-- Asistent AI: quota in CREDITE calculate din costul real (etapa 2)
-- =============================================================================
-- Plan: docs/plans/asistent-consum-real.md (sectiunea 7). Costul fiecarui apel e deja
-- masurat (0037, `assistant_usage.cost_micros`); aici il transformam in credite si
-- mutam limitele pe credite. Coloanele de MESAJE din 0020 raman (statistici), dar nu mai
-- decid blocarea.
-- =============================================================================

create table public.ai_platform_settings (
  -- un singur rand
  id                 boolean primary key default true check (id),
  -- valoarea unui credit, in micro-USD (1000 = $0.001)
  credit_micros      integer not null default 1000 check (credit_micros > 0),
  -- plafon per tura (credite); 0 = fara plafon
  turn_credit_limit  integer not null default 100 check (turn_credit_limit >= 0),
  updated_at         timestamptz not null default now(),
  updated_by         uuid references public.profiles (id) on delete set null
);

insert into public.ai_platform_settings (id) values (true) on conflict (id) do nothing;

alter table public.ai_platform_settings enable row level security;

-- Citire: orice utilizator autentificat (quota se calculeaza pe sesiunea lui). Valoarea
-- nu e secreta - costurile proprii sunt oricum vizibile staff-ului in `assistant_usage`.
create policy ai_platform_settings_select on public.ai_platform_settings
  for select using (auth.uid() is not null);
create policy ai_platform_settings_update on public.ai_platform_settings
  for update using (app.is_super_admin()) with check (app.is_super_admin());

grant select, update on public.ai_platform_settings to authenticated;
grant select, insert, update, delete on public.ai_platform_settings to service_role;

alter table public.organizations
  add column ai_monthly_credit_limit      integer not null default 2000
    check (ai_monthly_credit_limit >= 0),
  add column ai_daily_user_credit_percent integer not null default 20
    check (ai_daily_user_credit_percent between 0 and 100);

-- Garda din 0020, extinsa la coloanele noi: doar super-adminul schimba limitele AI.
create or replace function app.enforce_ai_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or app.is_super_admin() then
    return new;
  end if;

  if new.ai_enabled is distinct from old.ai_enabled
     or new.ai_monthly_message_limit is distinct from old.ai_monthly_message_limit
     or new.ai_daily_user_message_limit is distinct from old.ai_daily_user_message_limit
     or new.ai_monthly_credit_limit is distinct from old.ai_monthly_credit_limit
     or new.ai_daily_user_credit_percent is distinct from old.ai_daily_user_credit_percent then
    raise exception
      'limitele asistentului AI pot fi modificate doar de super-admin'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;
