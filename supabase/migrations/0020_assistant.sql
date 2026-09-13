-- =============================================================================
-- Asistent AI - conversatii, propuneri de actiune si quota
-- =============================================================================
-- Migrare aditiva (nu modifica nimic existent). Adauga:
--
--   public.assistant_conversations -> o conversatie a unui utilizator
--   public.assistant_messages      -> mesajele ei (user / assistant / tool)
--   public.assistant_tool_calls    -> propunerile de ACTIUNE si soarta lor
--   public.assistant_usage         -> consumul zilnic, baza pentru quota
--   organizations.ai_*             -> limitele si comutatorul per organizatie
--
-- Model de securitate (vezi docs/plans/task-asistent-ai.md):
--  - asistentul NU are privilegii proprii: tool-urile ruleaza pe clientul Supabase
--    al sesiunii utilizatorului, deci RLS-ul multi-tenant existent se aplica
--    neschimbat pe clienti/comenzi/stoc;
--  - orice ACTIUNE (scriere) e mai intai propusa (`status = 'proposed'`) si executata
--    doar dupa confirmare umana explicita (`confirmed` / `rejected`);
--  - `assistant_tool_calls` e jurnalul: raspunde la "cine a creat comanda asta si de ce".
--
-- Quota: numaram MESAJE (usor de explicat clientului si de pus pe un card de pret),
-- nu tokeni. Tokenii se contorizeaza in paralel, doar pentru costul intern.
-- Doua limite: una lunara per organizatie si una zilnica per utilizator - a doua
-- impiedica un singur om sa consume tot bugetul echipei intr-o dupa-amiaza.
-- =============================================================================

alter table public.organizations
  add column if not exists ai_enabled boolean not null default true,
  -- 0 = nelimitat (rezervat pentru un eventual plan platit)
  add column if not exists ai_monthly_message_limit integer not null default 200,
  add column if not exists ai_daily_user_message_limit integer not null default 20;

comment on column public.organizations.ai_monthly_message_limit is
  'Mesaje de asistent incluse pe luna, per organizatie. 0 = nelimitat.';
comment on column public.organizations.ai_daily_user_message_limit is
  'Plafon zilnic per utilizator, ca un singur om sa nu consume tot bugetul lunar. 0 = nelimitat.';

-- -----------------------------------------------------------------------------
-- Conversatii
-- -----------------------------------------------------------------------------
create table public.assistant_conversations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  title           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index assistant_conversations_user_idx
  on public.assistant_conversations (user_id, updated_at desc);

create trigger assistant_conversations_touch
  before update on public.assistant_conversations
  for each row execute function app.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Mesaje
-- -----------------------------------------------------------------------------
create table public.assistant_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations (id) on delete cascade,
  -- 'tool' = rezultatul unui tool, dat inapoi modelului
  role            text not null check (role in ('user', 'assistant', 'tool')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index assistant_messages_conversation_idx
  on public.assistant_messages (conversation_id, created_at);

-- -----------------------------------------------------------------------------
-- Propuneri de actiune (tool calls)
-- -----------------------------------------------------------------------------
create table public.assistant_tool_calls (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations (id) on delete cascade,
  tool            text not null,
  arguments       jsonb not null default '{}'::jsonb,
  -- proposed -> confirmed | rejected | failed. Tool-urile de CITIRE se executa direct
  -- si se jurnalizeaza tot aici, cu status 'confirmed' (n-au efecte de scriere).
  status          text not null default 'proposed'
                    check (status in ('proposed', 'confirmed', 'rejected', 'failed')),
  result          jsonb,
  error           text,
  confirmed_by    uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);

create index assistant_tool_calls_conversation_idx
  on public.assistant_tool_calls (conversation_id, created_at);

-- -----------------------------------------------------------------------------
-- Consum (baza pentru quota)
-- -----------------------------------------------------------------------------
-- O linie per (organizatie, utilizator, zi). Limita lunara se obtine insumand
-- zilele lunii curente; cea zilnica e chiar linia de azi.
create table public.assistant_usage (
  organization_id uuid references public.organizations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  day             date not null default current_date,
  messages        integer not null default 0,
  input_tokens    integer not null default 0,
  output_tokens   integer not null default 0,
  primary key (organization_id, user_id, day)
);

create index assistant_usage_org_day_idx on public.assistant_usage (organization_id, day);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
-- Conversatiile sunt PERSONALE: fiecare utilizator vede doar ce a discutat el, inclusiv
-- administratorul organizatiei (o conversatie poate contine notite de lucru). Auditul
-- de actiuni ramane vizibil oricum in datele reale (client/comanda create).
alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.assistant_tool_calls enable row level security;
alter table public.assistant_usage enable row level security;

create policy assistant_conversations_own on public.assistant_conversations
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy assistant_messages_own on public.assistant_messages
  for all using (
    exists (
      select 1 from public.assistant_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.assistant_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

create policy assistant_tool_calls_own on public.assistant_tool_calls
  for all using (
    exists (
      select 1 from public.assistant_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.assistant_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

-- Consumul propriu e scriibil de utilizator (contorul se incrementeaza in cererea lui),
-- dar TOATA organizatia isi vede consumul: altfel adminul n-ar putea sti de ce s-a
-- terminat quota lunara.
create policy assistant_usage_read_org on public.assistant_usage
  for select using (user_id = auth.uid() or app.is_staff_of(organization_id));

create policy assistant_usage_write_own on public.assistant_usage
  for insert with check (user_id = auth.uid());

create policy assistant_usage_update_own on public.assistant_usage
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.assistant_conversations to authenticated;
grant select, insert, update, delete on public.assistant_messages to authenticated;
grant select, insert, update, delete on public.assistant_tool_calls to authenticated;
grant select, insert, update on public.assistant_usage to authenticated;
grant select, insert, update, delete on public.assistant_conversations to service_role;
grant select, insert, update, delete on public.assistant_messages to service_role;
grant select, insert, update, delete on public.assistant_tool_calls to service_role;
grant select, insert, update on public.assistant_usage to service_role;

-- -----------------------------------------------------------------------------
-- Contorizarea consumului (atomica)
-- -----------------------------------------------------------------------------
-- Incrementarea din aplicatie ar fi read-modify-write, deci cu race intre doua
-- cereri simultane ale aceluiasi utilizator. RPC-ul face upsert-ul intr-o singura
-- instructiune. SECURITY INVOKER: ruleaza cu drepturile apelantului, deci politicile
-- de mai sus decid ce poate scrie (doar propriul consum).
create or replace function public.assistant_track_usage(
  p_messages      integer default 1,
  p_input_tokens  integer default 0,
  p_output_tokens integer default 0
)
returns void
language sql
security invoker
set search_path = public, pg_temp
as $$
  insert into public.assistant_usage (organization_id, user_id, day, messages, input_tokens, output_tokens)
  values (app.org_id(), auth.uid(), current_date, p_messages, p_input_tokens, p_output_tokens)
  on conflict (organization_id, user_id, day) do update
    set messages      = public.assistant_usage.messages + excluded.messages,
        input_tokens  = public.assistant_usage.input_tokens + excluded.input_tokens,
        output_tokens = public.assistant_usage.output_tokens + excluded.output_tokens;
$$;

grant execute on function public.assistant_track_usage(integer, integer, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Limitele nu pot fi ridicate de client
-- -----------------------------------------------------------------------------
-- `organizations_update` (0001) lasa adminul organizatiei sa-si modifice propriul rand -
-- ceea ce ar include, fara garda, propriile limite de asistent. Quota e o limita
-- COMERCIALA: doar super-adminul platformei o schimba. Acelasi tipar ca
-- `app.enforce_profile_security()` din 0003 (contextele de serviciu, cu auth.uid()
-- null - seed, migrari, service_role - trec neatinse).
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
     or new.ai_daily_user_message_limit is distinct from old.ai_daily_user_message_limit then
    raise exception
      'limitele asistentului AI pot fi modificate doar de super-admin'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger organizations_ai_limits_guard
  before update on public.organizations
  for each row execute function app.enforce_ai_limits();
