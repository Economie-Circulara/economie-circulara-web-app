-- RLS isolation smoke test (T1.1 acceptance): 2 organizatii + 2 clienti.
-- Seed ca postgres (autocommit), apoi fiecare test ruleaza intr-o TRANZACTIE
-- cu `set local role authenticated` + JWT claims (sub = user id) => RLS se aplica.
\set ON_ERROR_STOP on
set client_min_messages = warning;

insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-a@test.ro'),
  ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','client-a@test.ro'),
  ('33333333-3333-3333-3333-333333333333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','client-b@test.ro'),
  -- rand orfan (fara profil) folosit la testul de escaladare prin INSERT
  ('44444444-4444-4444-4444-444444444444','00000000-0000-0000-0000-000000000000','authenticated','authenticated','orphan@test.ro'),
  -- super_admin al platformei (fara tenant)
  ('55555555-5555-5555-5555-555555555555','00000000-0000-0000-0000-000000000000','authenticated','authenticated','super@test.ro');

insert into public.organizations (id, name, slug) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Org A','org-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Org B','org-b');

insert into public.clients (id, organization_id, cui, name) values
  ('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','RO111','Client A1'),
  ('c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','RO222','Client B1');

insert into public.profiles (id, organization_id, role, client_id) values
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','admin',null),
  ('22222222-2222-2222-2222-222222222222','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','client','c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1'),
  ('33333333-3333-3333-3333-333333333333','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','client','c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2'),
  -- super_admin: fara organizatie (trece peste tenant). Seed ca postgres
  -- (auth.uid() null) => triggerul anti-escaladare din 0003 lasa insert-ul sa treaca.
  ('55555555-5555-5555-5555-555555555555',null,'super_admin',null);

insert into public.items (id, organization_id, title, unit, sellable) values
  ('11111111-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Caramida eco A','bucata',true),
  ('11111111-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Lot intern A (nevandabil)','kg',false),
  ('22222222-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Beton B','mc',true);

insert into public.orders (id, organization_id, client_id, status) values
  ('0d0d0d0d-0000-0000-0000-00000000000a','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1','sent'),
  ('0d0d0d0d-0000-0000-0000-00000000000b','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2','sent'),
  -- comanda ACCEPTATA a clientului A (stoc deja scazut) — clientul nu o mai poate
  -- modifica/sterge (testele T7).
  ('0d0d0d0d-0000-0000-0000-00000000000c','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1','accepted');

-- assert(label, actual, expected) -> raise daca difera.
create or replace function pg_temp.assert(label text, actual bigint, expected bigint)
returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL: % (got %, expected %)', label, actual, expected;
  else
    raise notice 'PASS: % (=%)', label, actual;
  end if;
end $$;

-- ===== TEST 1: Admin Org A vede DOAR Org A (izolare tenant) =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  select pg_temp.assert('T1 admin A orgs', count(*), 1) from public.organizations;
  select pg_temp.assert('T1 admin A clients', count(*), 1) from public.clients;
  select pg_temp.assert('T1 admin A items (ambii Org A)', count(*), 2) from public.items;
  select pg_temp.assert('T1 admin A orders (sent + accepted)', count(*), 2) from public.orders;
rollback;

-- ===== TEST 2: Client A1 vede propriile date + catalog (sellable) =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
  select pg_temp.assert('T2 client A own client', count(*), 1) from public.clients;
  select pg_temp.assert('T2 client A catalog (sellable only)', count(*), 1) from public.items;
  select pg_temp.assert('T2 client A own orders (sent + accepted)', count(*), 2) from public.orders;
  select pg_temp.assert('T2 client A NU vede loturi', count(*), 0) from public.lots;
rollback;

-- ===== TEST 3: Client B1 NU vede datele clientului A (izolare client) =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';
  select pg_temp.assert('T3 client B own orders', count(*), 1) from public.orders;
  select pg_temp.assert('T3 client B NU vede comanda A', count(*), 0)
    from public.orders where id = '0d0d0d0d-0000-0000-0000-00000000000a';
  select pg_temp.assert('T3 client B NU vede clientul A', count(*), 0)
    from public.clients where id = 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1';
rollback;

-- ===== TEST 4: Client A1 NU poate insera comanda pt alt client (with check) =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
  do $$
  begin
    begin
      insert into public.orders (organization_id, client_id, status)
      values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2','draft');
      raise exception 'FAIL: T4 client A a putut insera comanda pt client B';
    exception when insufficient_privilege or check_violation then
      raise notice 'PASS: T4 insert blocat de RLS (with check)';
    end;
  end $$;
rollback;

-- ===== TEST 5: Admin Org A NU isi poate escalada rolul la super_admin (0003) =====
-- Triggerul app.enforce_profile_security ridica errcode insufficient_privilege;
-- sentinela FAIL ramane raise_exception (P0001) si nu e prinsa de handler.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  do $$
  begin
    begin
      update public.profiles set role = 'super_admin'
        where id = '11111111-1111-1111-1111-111111111111';
      raise exception 'FAIL: T5 admin A a putut escalada propriul rol la super_admin';
    exception when insufficient_privilege or check_violation then
      raise notice 'PASS: T5 escaladare rol pe profil propriu blocata de trigger';
    end;
  end $$;
rollback;

-- ===== TEST 6: Admin Org A NU poate crea un profil super_admin (0003) =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  do $$
  begin
    begin
      insert into public.profiles (id, organization_id, role)
      values ('44444444-4444-4444-4444-444444444444','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','super_admin');
      raise exception 'FAIL: T6 admin A a putut crea un profil super_admin';
    exception when insufficient_privilege or check_violation then
      raise notice 'PASS: T6 insert profil super_admin blocat de trigger';
    end;
  end $$;
rollback;

-- ===== TEST 7: Clientul A NU poate modifica/sterge o comanda ACCEPTATA (0003) =====
-- USING-ul politicilor client exclude statusul 'accepted' => 0 randuri afectate,
-- fara exceptie; verificam ca randul ramane neschimbat.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
  update public.orders set notes = 'hacked'
    where id = '0d0d0d0d-0000-0000-0000-00000000000c';
  select pg_temp.assert('T7 update comanda acceptata -> notes neschimbat', count(*), 0)
    from public.orders
    where id = '0d0d0d0d-0000-0000-0000-00000000000c' and notes = 'hacked';
  delete from public.orders where id = '0d0d0d0d-0000-0000-0000-00000000000c';
  select pg_temp.assert('T7 delete comanda acceptata -> comanda inca exista', count(*), 1)
    from public.orders where id = '0d0d0d0d-0000-0000-0000-00000000000c';
rollback;

-- ===== TEST 8: Clientul A POATE anula (cancelled) o comanda proprie 'sent' (0003) =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
  update public.orders set status = 'cancelled'
    where id = '0d0d0d0d-0000-0000-0000-00000000000a';
  select pg_temp.assert('T8 client a anulat comanda sent', count(*), 1)
    from public.orders
    where id = '0d0d0d0d-0000-0000-0000-00000000000a' and status = 'cancelled';
rollback;

-- ===== TEST 9: Super-admin vede organizatiile ambelor tenant (peste tenant) =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555"}';
  select pg_temp.assert('T9 super_admin vede ambele organizatii', count(*), 2)
    from public.organizations;
rollback;

select '*** TOATE TESTELE RLS AU TRECUT ***' as result;
