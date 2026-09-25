-- =============================================================================
-- Asistent AI: masurarea consumului real (tokeni cache/nou/output + cost)
-- =============================================================================
-- Plan: docs/plans/asistent-consum-real.md (etapa 1). Quota ramane pe MESAJE in
-- aceasta etapa; aici doar masuram exact, ca sa putem trece la credite pe date reale.
--
--  - `ai_model_prices`: preturi VERSIONATE, append-only, gestionate de super-admin.
--    Randul cu `model = '*'` e pretul implicit (conservator) pentru modele fara pret.
--  - `ai_usage_events`: un rand per apel de model, cu costul calculat LA INREGISTRARE
--    (pretul valabil atunci) - istoricul nu se schimba cand se schimba preturile.
--  - `assistant_usage` (0020) primeste agregatele noi (request-uri, cache, cost).
--  - `assistant_record_usage`: SINGURUL punct de scriere. SECURITY DEFINER ca sa poata
--    citi preturile (ascunse tenantilor) - dar scrie DOAR pentru `auth.uid()` si
--    organizatia lui; apelantul raporteaza tokeni, nu costuri.
-- =============================================================================

create table public.ai_model_prices (
  id                  uuid primary key default gen_random_uuid(),
  model               text not null check (length(model) between 1 and 100),
  -- USD per 1 milion de tokeni
  input_cache_hit_per_m  numeric(12, 6) not null check (input_cache_hit_per_m >= 0),
  input_cache_miss_per_m numeric(12, 6) not null check (input_cache_miss_per_m >= 0),
  output_per_m           numeric(12, 6) not null check (output_per_m >= 0),
  valid_from          timestamptz not null default now(),
  note                text check (note is null or length(note) <= 500),
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now()
);

create index ai_model_prices_lookup_idx on public.ai_model_prices (model, valid_from desc);

alter table public.ai_model_prices enable row level security;

-- Doar super-adminul vede si adauga preturi (append-only: fara update/delete).
create policy ai_model_prices_super_admin_select on public.ai_model_prices
  for select using (app.is_super_admin());
create policy ai_model_prices_super_admin_insert on public.ai_model_prices
  for insert with check (app.is_super_admin());

grant select, insert on public.ai_model_prices to authenticated;
grant select, insert, update, delete on public.ai_model_prices to service_role;

-- Preturile din exportul DeepSeek (sept 2026) - vezi docs/plans/asistent-consum-real.md.
-- `*` = pretul celui mai scump model, ca un model nou sa nu para gratuit.
insert into public.ai_model_prices
  (model, input_cache_hit_per_m, input_cache_miss_per_m, output_per_m, valid_from, note)
values
  ('deepseek-v4-pro', 0.022, 0.66, 1.98, '2026-09-01', 'Din exportul DeepSeek, sept 2026'),
  ('deepseek-flash', 0.003, 0.15, 0.60, '2026-09-01', 'Din exportul DeepSeek, sept 2026'),
  ('*', 0.022, 0.66, 1.98, '2026-09-01', 'Implicit (conservator) pentru modele fara pret propriu');

create table public.ai_usage_events (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid references public.organizations (id) on delete cascade,
  user_id            uuid not null references public.profiles (id) on delete cascade,
  conversation_id    uuid references public.assistant_conversations (id) on delete set null,
  feature            text not null check (feature in ('assistant', 'recipe_extract')),
  model              text not null,
  input_cache_hit    integer not null default 0 check (input_cache_hit >= 0),
  input_cache_miss   integer not null default 0 check (input_cache_miss >= 0),
  output_tokens      integer not null default 0 check (output_tokens >= 0),
  reasoning_tokens   integer not null default 0 check (reasoning_tokens >= 0),
  -- USD x 1.000.000 (micro-dolari), rotunjit in sus
  cost_micros        bigint not null default 0,
  price_id           uuid references public.ai_model_prices (id) on delete set null,
  -- adevarat daca s-a folosit pretul implicit `*` (modelul n-are pret propriu)
  default_price_used boolean not null default false,
  created_at         timestamptz not null default now()
);

create index ai_usage_events_org_created_idx on public.ai_usage_events (organization_id, created_at);
create index ai_usage_events_created_idx on public.ai_usage_events (created_at);

alter table public.ai_usage_events enable row level security;

-- Citire: propriile apeluri, adminul organizatiei (rapoartele din etapa 3), super-adminul.
-- Scriere: DOAR prin `assistant_record_usage` (nicio politica de insert/update/delete).
create policy ai_usage_events_select on public.ai_usage_events
  for select using (
    user_id = auth.uid() or app.is_admin_of(organization_id) or app.is_super_admin()
  );

grant select on public.ai_usage_events to authenticated;
grant select, insert, update, delete on public.ai_usage_events to service_role;

alter table public.assistant_usage
  add column requests         integer not null default 0,
  add column input_cache_hit  bigint  not null default 0,
  add column cost_micros      bigint  not null default 0;

-- -----------------------------------------------------------------------------
-- Punctul unic de inregistrare
-- -----------------------------------------------------------------------------
-- `p_model` null = doar contorul de MESAJE (mesajul utilizatorului), fara apel de model.
-- `input_tokens` din agregat ramane TOTALUL (cache + nou), ca inainte.
create or replace function public.assistant_record_usage(
  p_feature          text,
  p_model            text default null,
  p_conversation_id  uuid default null,
  p_messages         integer default 0,
  p_input_cache_hit  integer default 0,
  p_input_cache_miss integer default 0,
  p_output_tokens    integer default 0,
  p_reasoning_tokens integer default 0
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user  uuid := auth.uid();
  v_org   uuid := app.org_id();
  v_price public.ai_model_prices%rowtype;
  v_cost  bigint := 0;
  v_default boolean := false;
  v_conversation uuid := null;
begin
  if v_user is null then
    raise exception 'neautentificat' using errcode = 'insufficient_privilege';
  end if;
  if p_messages < 0 or p_input_cache_hit < 0 or p_input_cache_miss < 0
     or p_output_tokens < 0 or p_reasoning_tokens < 0 then
    raise exception 'valori negative de consum' using errcode = 'check_violation';
  end if;

  if p_model is not null then
    select * into v_price from public.ai_model_prices
      where model = p_model and valid_from <= now()
      order by valid_from desc limit 1;
    if not found then
      v_default := true;
      select * into v_price from public.ai_model_prices
        where model = '*' and valid_from <= now()
        order by valid_from desc limit 1;
    end if;

    if v_price.id is not null then
      v_cost := ceil(
        p_input_cache_hit  * v_price.input_cache_hit_per_m
        + p_input_cache_miss * v_price.input_cache_miss_per_m
        + p_output_tokens    * v_price.output_per_m
      )::bigint; -- (tokeni x USD/1M) = micro-USD
    end if;

    -- Conversatia doar daca e a apelantului (altfel evenimentul ramane fara ea).
    if p_conversation_id is not null then
      select id into v_conversation from public.assistant_conversations
        where id = p_conversation_id and user_id = v_user;
    end if;

    insert into public.ai_usage_events (
      organization_id, user_id, conversation_id, feature, model,
      input_cache_hit, input_cache_miss, output_tokens, reasoning_tokens,
      cost_micros, price_id, default_price_used
    ) values (
      v_org, v_user, v_conversation, p_feature, p_model,
      p_input_cache_hit, p_input_cache_miss, p_output_tokens, p_reasoning_tokens,
      v_cost, v_price.id, v_default
    );
  end if;

  -- Agregatul zilnic (quota). Super-adminul n-are organizatie - fara agregat.
  if v_org is not null then
    insert into public.assistant_usage (
      organization_id, user_id, day, messages, input_tokens, output_tokens,
      requests, input_cache_hit, cost_micros
    ) values (
      v_org, v_user, current_date, p_messages,
      p_input_cache_hit + p_input_cache_miss, p_output_tokens,
      case when p_model is null then 0 else 1 end, p_input_cache_hit, v_cost
    )
    on conflict (organization_id, user_id, day) do update
      set messages        = public.assistant_usage.messages + excluded.messages,
          input_tokens    = public.assistant_usage.input_tokens + excluded.input_tokens,
          output_tokens   = public.assistant_usage.output_tokens + excluded.output_tokens,
          requests        = public.assistant_usage.requests + excluded.requests,
          input_cache_hit = public.assistant_usage.input_cache_hit + excluded.input_cache_hit,
          cost_micros     = public.assistant_usage.cost_micros + excluded.cost_micros;
  end if;

  return v_cost;
end;
$$;

revoke all on function public.assistant_record_usage(text, text, uuid, integer, integer, integer, integer, integer) from public;
grant execute on function public.assistant_record_usage(text, text, uuid, integer, integer, integer, integer, integer) to authenticated;
