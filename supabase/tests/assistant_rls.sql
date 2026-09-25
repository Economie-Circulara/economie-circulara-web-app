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
  -- `begin ... exception ... end` e sintaxa PL/pgSQL - are nevoie de `do $$ ... $$`
  -- (nu poate fi scrisa "bare" la nivel de psql, ca `begin;`/`rollback;` de mai sus).
  do $$
  begin
    begin
      insert into public.assistant_usage (organization_id, user_id, day, messages)
        values ('a0000000-0000-0000-0000-00000000000a','a2222222-2222-2222-2222-222222222222',current_date + 1, 99);
      raise exception 'FAIL: T4 a permis scrierea consumului altui utilizator';
    exception when insufficient_privilege then
      raise notice 'PASS: T4 scrierea consumului altui utilizator e respinsa';
    end;
  end $$;
rollback;

-- ===== TEST 5: RPC-ul de contorizare scrie doar pe utilizatorul curent =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a2222222-2222-2222-2222-222222222222"}';
  -- `perform` e tot PL/pgSQL-only (ca `begin/exception` de mai sus) - la nivel de
  -- psql, apelul RPC-ului se face cu `select`, ignorand rezultatul.
  select public.assistant_track_usage(1, 120, 30);
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

  do $$
  begin
    begin
      update public.organizations set ai_monthly_message_limit = 100000
        where id = 'a0000000-0000-0000-0000-00000000000a';
      raise exception 'FAIL: T6 adminul si-a ridicat singur quota';
    exception when insufficient_privilege then
      raise notice 'PASS: T6 ridicarea quotei de catre admin e blocata';
    end;
  end $$;
rollback;

-- ===== TEST 7: statusul tranzitoriu 'executing' e acceptat de constrangere =====
-- (migrarea 0024_assistant_capabilities_contract.sql - revendicare atomica inainte
-- de executie, vezi src/features/assistant/service.ts#claimProposal).
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a2222222-2222-2222-2222-222222222222"}';
  update public.assistant_tool_calls set status = 'executing'
    where id = 'a8888888-8888-8888-8888-888888888888';
  select pg_temp.assert('T7 statusul executing e acceptat', count(*), 1)
    from public.assistant_tool_calls
    where id = 'a8888888-8888-8888-8888-888888888888' and status = 'executing';
rollback;

-- ===== TEST 8: revendicarea conditionata (proxy pt. atomicitate) =====
-- Doua "cereri" secventiale in ACEEASI tranzactie, simuland cursa: a doua
-- actualizare conditionata (`where status = 'proposed'`) NU mai gaseste randul
-- (deja trecut pe `executing` de prima) - exact contractul din `claimProposal`.
-- O cursa REALA concurenta e garantata de MVCC-ul Postgres (un singur UPDATE e
-- intotdeauna atomic), nu e nevoie de doua sesiuni separate ca sa validam logica.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a2222222-2222-2222-2222-222222222222"}';

  with claim as (
    update public.assistant_tool_calls set status = 'executing'
      where id = 'a8888888-8888-8888-8888-888888888888' and status = 'proposed'
      returning id
  )
  select pg_temp.assert('T8 prima revendicare reuseste', count(*), 1) from claim;

  with claim_again as (
    update public.assistant_tool_calls set status = 'executing'
      where id = 'a8888888-8888-8888-8888-888888888888' and status = 'proposed'
      returning id
  )
  select pg_temp.assert('T8 a doua revendicare (deja executing) nu afecteaza niciun rand', count(*), 0)
    from claim_again;
rollback;

-- ===== TEST 9: tool_version implicit 1, provider_call_id nullable =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a2222222-2222-2222-2222-222222222222"}';
  select pg_temp.assert('T9 tool_version implicit', tool_version, 1)
    from public.assistant_tool_calls where id = 'a8888888-8888-8888-8888-888888888888';
  select pg_temp.assert(
      'T9 provider_call_id nullable',
      case when provider_call_id is null then 1 else 0 end,
      1
    )
    from public.assistant_tool_calls where id = 'a8888888-8888-8888-8888-888888888888';
rollback;

-- ===== TEST 10: atasamentele (0036) sunt personale si legate de organizatie =====
insert into public.assistant_attachments (id, organization_id, user_id, storage_path, file_name, mime_type, size_bytes) values
  ('a7777777-7777-7777-7777-777777777777','a0000000-0000-0000-0000-00000000000a','a2222222-2222-2222-2222-222222222222',
   'a0000000-0000-0000-0000-00000000000a/a2222222-2222-2222-2222-222222222222/a7777777-7777-7777-7777-777777777777',
   'retete.pdf','application/pdf',1024);

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a2222222-2222-2222-2222-222222222222"}';
  select pg_temp.assert('T10 operatorul isi vede atasamentul', count(*), 1)
    from public.assistant_attachments;
rollback;

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a1111111-1111-1111-1111-111111111111"}';
  select pg_temp.assert('T10 adminul NU vede atasamentul operatorului', count(*), 0)
    from public.assistant_attachments;

  -- Nu poate inregistra un atasament in numele altui utilizator / in alta organizatie.
  do $$
  begin
    begin
      insert into public.assistant_attachments (organization_id, user_id, storage_path, file_name, mime_type, size_bytes)
        values ('a0000000-0000-0000-0000-00000000000b','a1111111-1111-1111-1111-111111111111','x/y/z','a.pdf','application/pdf',10);
      raise exception 'FAIL: T10 a permis un atasament in alta organizatie';
    exception when insufficient_privilege then
      raise notice 'PASS: T10 atasamentul in alta organizatie e respins';
    end;
  end $$;
rollback;

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a3333333-3333-3333-3333-333333333333"}';
  select pg_temp.assert('T10 alt tenant nu vede atasamentul', count(*), 0)
    from public.assistant_attachments;
rollback;

-- ===== TEST 11: contorizarea consumului (0037) - costul se calculeaza in DB =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a2222222-2222-2222-2222-222222222222"}';

  -- Aceeasi zi ca exportul DeepSeek din 25.09 (v4-pro): $0.0806652880 -> 80666 micro-USD.
  select pg_temp.assert('T11 costul apelului, cu pretul v4-pro',
    public.assistant_record_usage('assistant', 'deepseek-v4-pro', null, 0, 244864, 63751, 16769, 0), 80666);
rollback;

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a2222222-2222-2222-2222-222222222222"}';
  select public.assistant_record_usage('assistant', 'model-necunoscut', null, 0, 0, 1000000, 0, 0);
  select pg_temp.assert('T11 model necunoscut -> pret implicit',
    count(*), 1) from public.ai_usage_events where model = 'model-necunoscut' and default_price_used and cost_micros = 660000;
  -- Mesajul utilizatorului (fara model) creste doar contorul de mesaje, fara eveniment.
  select public.assistant_record_usage('assistant', null, null, 1);
  select pg_temp.assert('T11 mesajul fara model nu creeaza eveniment',
    count(*), 1) from public.ai_usage_events;
  select pg_temp.assert('T11 agregatul zilnic are request-ul si costul',
    (select requests::bigint from public.assistant_usage where user_id = 'a2222222-2222-2222-2222-222222222222' and day = current_date), 1);
rollback;

-- Preturile nu sunt vizibile tenantilor si nu pot fi scrise de ei.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a1111111-1111-1111-1111-111111111111"}';
  select pg_temp.assert('T11 adminul organizatiei nu vede preturile', count(*), 0)
    from public.ai_model_prices;
  do $$
  begin
    begin
      insert into public.ai_model_prices (model, input_cache_hit_per_m, input_cache_miss_per_m, output_per_m)
        values ('deepseek-v4-pro', 0, 0, 0);
      raise exception 'FAIL: T11 adminul a putut modifica preturile';
    exception when insufficient_privilege then
      raise notice 'PASS: T11 adminul nu poate scrie preturi';
    end;
  end $$;
  -- Nici evenimente de consum direct (doar prin RPC).
  do $$
  begin
    begin
      insert into public.ai_usage_events (user_id, feature, model) values (auth.uid(), 'assistant', 'x');
      raise exception 'FAIL: T11 s-a putut scrie direct un eveniment de consum';
    exception when insufficient_privilege then
      raise notice 'PASS: T11 evenimentele se scriu doar prin RPC';
    end;
  end $$;
rollback;

-- ===== TEST 12: creditele (0039) - doar super-adminul schimba limitele si valoarea creditului =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a1111111-1111-1111-1111-111111111111"}';
  select pg_temp.assert('T12 setarile de credit sunt citibile', count(*), 1)
    from public.ai_platform_settings;
  do $$
  begin
    begin
      update public.organizations set ai_monthly_credit_limit = 1000000
        where id = 'a0000000-0000-0000-0000-00000000000a';
      raise exception 'FAIL: T12 adminul si-a ridicat singur bugetul de credite';
    exception when insufficient_privilege then
      raise notice 'PASS: T12 bugetul de credite nu poate fi ridicat de admin';
    end;
  end $$;
  with changed as (
    update public.ai_platform_settings set credit_micros = 1 returning id
  )
  select pg_temp.assert('T12 adminul nu poate schimba valoarea creditului', count(*), 0) from changed;
rollback;

select '*** TOATE TESTELE RLS DE ASISTENT AU TRECUT ***' as result;
