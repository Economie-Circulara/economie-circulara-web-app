-- RLS pentru asistentul AI (migrarea 0020): conversatiile sunt PERSONALE, iar
-- consumul e vizibil intregii organizatii (adminul trebuie sa stie de ce s-a
-- terminat quota), dar scriibil doar de proprietar.
--
-- Acelasi tipar ca `rls_isolation.sql`: seed ca postgres, apoi fiecare test intr-o
-- tranzactie cu `set local role authenticated` + JWT claims.
\set ON_ERROR_STOP on
set client_min_messages = warning;

insert into auth.users (id, instance_id, aud, role, email) values
  ('a1111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ai-admin-a@test.ro'),
  ('a2222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ai-operator-a@test.ro'),
  ('a3333333-3333-3333-3333-333333333333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ai-admin-b@test.ro');

insert into public.organizations (id, name, slug) values
  ('a0000000-0000-0000-0000-00000000000a','AI Org A','ai-org-a'),
  ('a0000000-0000-0000-0000-00000000000b','AI Org B','ai-org-b');

insert into public.profiles (id, organization_id, role, client_id) values
  ('a1111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-00000000000a','admin',null),
  ('a2222222-2222-2222-2222-222222222222','a0000000-0000-0000-0000-00000000000a','operator',null),
  ('a3333333-3333-3333-3333-333333333333','a0000000-0000-0000-0000-00000000000b','admin',null);

-- Conversatie + propunere ale OPERATORULUI din Org A.
insert into public.assistant_conversations (id, organization_id, user_id, title) values
  ('a9999999-9999-9999-9999-999999999999','a0000000-0000-0000-0000-00000000000a','a2222222-2222-2222-2222-222222222222','Adauga client');

insert into public.assistant_messages (conversation_id, role, content) values
  ('a9999999-9999-9999-9999-999999999999','user','adauga clientul ACME');

insert into public.assistant_tool_calls (id, conversation_id, tool, arguments, status) values
  ('a8888888-8888-8888-8888-888888888888','a9999999-9999-9999-9999-999999999999','creeaza_client','{"cui":"12345678"}','proposed');

insert into public.assistant_usage (organization_id, user_id, day, messages) values
  ('a0000000-0000-0000-0000-00000000000a','a2222222-2222-2222-2222-222222222222',current_date,7),
  ('a0000000-0000-0000-0000-00000000000b','a3333333-3333-3333-3333-333333333333',current_date,4);

create or replace function pg_temp.assert(label text, actual bigint, expected bigint)
returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL: % (got %, expected %)', label, actual, expected;
  else
    raise notice 'PASS: % (=%)', label, actual;
  end if;
end $$;

-- ===== TEST 1: operatorul isi vede propria conversatie, cu mesaje si propuneri =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a2222222-2222-2222-2222-222222222222"}';
  select pg_temp.assert('T1 conversatie proprie', count(*), 1) from public.assistant_conversations;
  select pg_temp.assert('T1 mesaje proprii', count(*), 1) from public.assistant_messages;
  select pg_temp.assert('T1 propuneri proprii', count(*), 1) from public.assistant_tool_calls;
rollback;

-- ===== TEST 2: ADMINUL aceleiasi organizatii NU vede conversatia altui utilizator =====
-- Conversatiile sunt personale; auditul actiunilor ramane vizibil in datele reale.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a1111111-1111-1111-1111-111111111111"}';
  select pg_temp.assert('T2 admin nu vede conversatia operatorului', count(*), 0)
    from public.assistant_conversations;
  select pg_temp.assert('T2 admin nu vede mesajele lui', count(*), 0) from public.assistant_messages;
  select pg_temp.assert('T2 admin nu vede propunerile lui', count(*), 0)
    from public.assistant_tool_calls;
rollback;

-- ===== TEST 3: alt TENANT nu vede nimic =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a3333333-3333-3333-3333-333333333333"}';
  select pg_temp.assert('T3 alt tenant, 0 conversatii', count(*), 0)
    from public.assistant_conversations;
  select pg_temp.assert('T3 alt tenant vede doar consumul propriei organizatii', count(*), 1)
    from public.assistant_usage;
rollback;

-- ===== TEST 4: consumul e vizibil intregii organizatii (staff), dar scriibil doar de proprietar =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a1111111-1111-1111-1111-111111111111"}';
  select pg_temp.assert('T4 adminul vede consumul organizatiei', count(*), 1)
    from public.assistant_usage;

  -- Incercare de a scrie consum in numele altui utilizator: respinsa de `with check`.
  begin
    insert into public.assistant_usage (organization_id, user_id, day, messages)
      values ('a0000000-0000-0000-0000-00000000000a','a2222222-2222-2222-2222-222222222222',current_date + 1, 99);
    raise exception 'FAIL: T4 a permis scrierea consumului altui utilizator';
  exception when insufficient_privilege then
    raise notice 'PASS: T4 scrierea consumului altui utilizator e respinsa';
  end;
rollback;

-- ===== TEST 5: RPC-ul de contorizare scrie doar pe utilizatorul curent =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a2222222-2222-2222-2222-222222222222"}';
  perform public.assistant_track_usage(1, 120, 30);
  select pg_temp.assert('T5 contorul propriu a crescut', messages, 8)
    from public.assistant_usage
    where user_id = 'a2222222-2222-2222-2222-222222222222' and day = current_date;
rollback;

-- ===== TEST 6: adminul organizatiei NU isi poate ridica singur quota =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a1111111-1111-1111-1111-111111111111"}';

  -- Modificarile obisnuite de organizatie raman permise.
  update public.organizations set name = 'AI Org A (redenumit)'
    where id = 'a0000000-0000-0000-0000-00000000000a';
  select pg_temp.assert('T6 adminul poate redenumi organizatia', count(*), 1)
    from public.organizations
    where id = 'a0000000-0000-0000-0000-00000000000a' and name = 'AI Org A (redenumit)';

  begin
    update public.organizations set ai_monthly_message_limit = 100000
      where id = 'a0000000-0000-0000-0000-00000000000a';
    raise exception 'FAIL: T6 adminul si-a ridicat singur quota';
  exception when insufficient_privilege then
    raise notice 'PASS: T6 ridicarea quotei de catre admin e blocata';
  end;
rollback;

select '*** TOATE TESTELE RLS DE ASISTENT AU TRECUT ***' as result;
