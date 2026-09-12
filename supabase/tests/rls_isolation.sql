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
-- Verificam pe cele DOUA organizatii de test (prin id), nu pe un count global: la
-- `supabase db reset` ruleaza si `seed.sql` (o organizatie demo), deci numarul total
-- de organizatii nu e deterministic. Ce conteaza e ca super_admin trece peste tenant
-- si le vede pe amandoua.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555"}';
  select pg_temp.assert('T9 super_admin vede ambele organizatii de test', count(*), 2)
    from public.organizations
    where id in (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    );
rollback;

-- ===== TEST 10: Clientul A NU poate muta comanda proprie 'sent' in alt tenant (0003) =====
-- WITH CHECK-ul politicii orders_client_update cere organization_id = app.org_id();
-- mutarea in Org B pica cu violare RLS (check_violation). Verificam si ca randul
-- ramane in Org A.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
  do $$
  begin
    begin
      update public.orders set organization_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
        where id = '0d0d0d0d-0000-0000-0000-00000000000a';
      raise exception 'FAIL: T10 client A a putut muta comanda in alt tenant';
    exception when insufficient_privilege or check_violation then
      raise notice 'PASS: T10 mutarea comenzii in alt tenant blocata (with check)';
    end;
  end $$;
  select pg_temp.assert('T10 comanda ramane in Org A', count(*), 1)
    from public.orders
    where id = '0d0d0d0d-0000-0000-0000-00000000000a'
      and organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
rollback;

-- =============================================================================
-- Guard organizatie suspendata (Task T2.1, migrarea 0012) — a treia organizatie,
-- SUSPENDATA de la inceput. Adaugata DUPA testele existente (id-uri noi, `cccc...`/
-- `6666...`) ca sa nu deranjeze numerotarea/assert-urile de mai sus — in special T9,
-- care numara organizatiile de test explicit prin id (`aaaa...`/`bbbb...`), deci
-- ramane neschimbat.
-- =============================================================================
insert into public.organizations (id, name, slug, status) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc','Org C (suspendata)','org-c','suspended');

insert into auth.users (id, instance_id, aud, role, email) values
  ('66666666-6666-6666-6666-666666666666','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-c@test.ro');

insert into public.profiles (id, organization_id, role, client_id) values
  ('66666666-6666-6666-6666-666666666666','cccccccc-cccc-cccc-cccc-cccccccccccc','admin',null);

-- item preexistent in Org C (inserat ca postgres, bypass RLS) — tinta pentru T12.
insert into public.items (id, organization_id, title, unit, sellable) values
  ('66666666-0000-0000-0000-000000000001','cccccccc-cccc-cccc-cccc-cccccccccccc','Item Org C','bucata',true);

-- ===== TEST 11: Admin Org C (SUSPENDATA) NU poate insera un item nou (0012) =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666"}';
  do $$
  begin
    begin
      insert into public.items (organization_id, title, unit, sellable)
      values ('cccccccc-cccc-cccc-cccc-cccccccccccc','Item nou (blocat)','bucata',true);
      raise exception 'FAIL: T11 admin Org C (suspendata) a putut insera un item';
    exception when insufficient_privilege or check_violation then
      raise notice 'PASS: T11 insert blocat pentru staff dintr-o organizatie suspendata (0012)';
    end;
  end $$;
rollback;

-- ===== TEST 12: Admin Org C (SUSPENDATA) NU poate actualiza un item existent (0012) =====
-- USING-ul din app.is_staff_of (0012) cere organizatie activa => 0 randuri afectate,
-- fara exceptie (acelasi tipar ca T7 pentru comanda acceptata).
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666"}';
  update public.items set title = 'hacked' where id = '66666666-0000-0000-0000-000000000001';
  select pg_temp.assert('T12 update blocat pt staff org suspendata -> titlu neschimbat', count(*), 0)
    from public.items where id = '66666666-0000-0000-0000-000000000001' and title = 'hacked';
rollback;

-- ===== TEST 13: Super-admin RAMANE neafectat de suspendare (vede Org C si itemii ei) =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555"}';
  select pg_temp.assert('T13 super_admin vede organizatia suspendata', count(*), 1)
    from public.organizations where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  select pg_temp.assert('T13 super_admin vede itemii din Org C (suspendata)', count(*), 1)
    from public.items where organization_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
rollback;

-- ===== Reactivare Org C (ca postgres, bypass RLS) — pregateste TEST 14 ==============
update public.organizations set status = 'active'
  where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

-- ===== TEST 14: Dupa reactivare, admin Org C poate insera/actualiza din nou (0012) =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666"}';
  insert into public.items (organization_id, title, unit, sellable)
    values ('cccccccc-cccc-cccc-cccc-cccccccccccc','Item nou (dupa reactivare)','bucata',true);
  select pg_temp.assert('T14 insert reusit dupa reactivare', count(*), 1)
    from public.items
    where organization_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
      and title = 'Item nou (dupa reactivare)';

  update public.items set title = 'actualizat dupa reactivare'
    where id = '66666666-0000-0000-0000-000000000001';
  select pg_temp.assert('T14 update reusit dupa reactivare', count(*), 1)
    from public.items
    where id = '66666666-0000-0000-0000-000000000001' and title = 'actualizat dupa reactivare';
rollback;

-- =============================================================================
-- Guard organizatie suspendata — completare (migrarea 0014): client_addresses
-- (F1a) si SELECT-urile clientului (F1b). Refolosim Org C (deja ACTIVA la acest
-- punct, dupa reactivarea din TEST 14). Adaugam un client nou in Org C (id-uri
-- noi, `7777.../d1d1...`) ca sa nu deranjam testele 1-14 de mai sus, apoi
-- resuspendam/reactivam Org C punctual, DOAR pentru aceasta sectiune.
-- =============================================================================
insert into public.clients (id, organization_id, cui, name) values
  ('d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1','cccccccc-cccc-cccc-cccc-cccccccccccc','RO333','Client C1');

insert into auth.users (id, instance_id, aud, role, email) values
  ('77777777-7777-7777-7777-777777777777','00000000-0000-0000-0000-000000000000','authenticated','authenticated','client-c@test.ro');

insert into public.profiles (id, organization_id, role, client_id) values
  ('77777777-7777-7777-7777-777777777777','cccccccc-cccc-cccc-cccc-cccccccccccc','client','d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1');

-- Comanda + adresa preexistente ale Client C1 (inserate ca postgres, bypass RLS) —
-- tinta pentru testele de SELECT (F1b) si UPDATE (F1a) de mai jos.
insert into public.orders (id, organization_id, client_id, status) values
  ('0d0d0d0d-0000-0000-0000-00000000000d','cccccccc-cccc-cccc-cccc-cccccccccccc','d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1','sent');

insert into public.client_addresses (id, organization_id, client_id, address) values
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1','cccccccc-cccc-cccc-cccc-cccccccccccc','d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1','Depozit C');

-- ===== TEST 15: Client C1 (Org C ACTIVA) poate insera/vedea normal (control) =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"77777777-7777-7777-7777-777777777777"}';
  select pg_temp.assert('T15 client C vede propria comanda (org activa)', count(*), 1)
    from public.orders where id = '0d0d0d0d-0000-0000-0000-00000000000d';
  insert into public.client_addresses (organization_id, client_id, address)
    values ('cccccccc-cccc-cccc-cccc-cccccccccccc','d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1','Depozit C2 (control)');
  select pg_temp.assert('T15 client C a putut insera adresa (org activa)', count(*), 1)
    from public.client_addresses where address = 'Depozit C2 (control)';
rollback;

-- ===== Suspendare Org C (ca postgres) — pregateste TESTELE 16-18 (0014) ===========
update public.organizations set status = 'suspended'
  where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

-- ===== TEST 16: Client C1 (Org C SUSPENDATA) NU poate insera client_addresses (F1a, 0014) =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"77777777-7777-7777-7777-777777777777"}';
  do $$
  begin
    begin
      insert into public.client_addresses (organization_id, client_id, address)
        values ('cccccccc-cccc-cccc-cccc-cccccccccccc','d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1','Depozit interzis');
      raise exception 'FAIL: T16 client C a putut insera adresa cat Org C e suspendata';
    exception when insufficient_privilege or check_violation then
      raise notice 'PASS: T16 insert client_addresses blocat pentru org suspendata (0014)';
    end;
  end $$;
rollback;

-- ===== TEST 17: Client C1 (Org C SUSPENDATA) NU poate actualiza o adresa existenta (F1a, 0014) =====
-- USING-ul politicii client_addresses_client_update (0014) cere organizatie activa
-- => 0 randuri afectate, fara exceptie (acelasi tipar ca T7/T12).
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"77777777-7777-7777-7777-777777777777"}';
  update public.client_addresses set address = 'hacked'
    where id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
  select pg_temp.assert('T17 update adresa blocat pt org suspendata -> adresa neschimbata', count(*), 0)
    from public.client_addresses
    where id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1' and address = 'hacked';
rollback;

-- ===== TEST 18: Client C1 (Org C SUSPENDATA) NU isi mai vede comanda prin SELECT (F1b, 0014) =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"77777777-7777-7777-7777-777777777777"}';
  select pg_temp.assert('T18 client C NU vede comanda proprie (org suspendata)', count(*), 0)
    from public.orders where id = '0d0d0d0d-0000-0000-0000-00000000000d';
  select pg_temp.assert('T18 client C NU vede propria adresa (org suspendata)', count(*), 0)
    from public.client_addresses where id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
rollback;

-- ===== Reactivare Org C (ca postgres) — pregateste TEST 19 =========================
update public.organizations set status = 'active'
  where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

-- ===== TEST 19: Dupa reactivare, Client C1 poate din nou insera adrese si vedea comenzi =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"77777777-7777-7777-7777-777777777777"}';
  insert into public.client_addresses (organization_id, client_id, address)
    values ('cccccccc-cccc-cccc-cccc-cccccccccccc','d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1','Depozit C3 (dupa reactivare)');
  select pg_temp.assert('T19 insert adresa reusit dupa reactivare', count(*), 1)
    from public.client_addresses where address = 'Depozit C3 (dupa reactivare)';

  update public.client_addresses set address = 'actualizat dupa reactivare'
    where id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
  select pg_temp.assert('T19 update adresa reusit dupa reactivare', count(*), 1)
    from public.client_addresses
    where id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1' and address = 'actualizat dupa reactivare';

  select pg_temp.assert('T19 client C vede din nou comanda proprie (org reactivata)', count(*), 1)
    from public.orders where id = '0d0d0d0d-0000-0000-0000-00000000000d';
rollback;

select '*** TOATE TESTELE RLS AU TRECUT ***' as result;
