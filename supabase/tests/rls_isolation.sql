-- RLS isolation smoke test (T1.1 acceptance): 2 organizatii + 2 clienti.
-- Extins in T2.0 (hardening scrieri client) cu o comanda `draft` si o comanda
-- `accepted` (+ order_items) pentru client A1, pentru testele de tranzitie de
-- status si de editare a itemilor dupa acceptare.
-- Seed ca postgres (autocommit), apoi fiecare test ruleaza intr-o TRANZACTIE
-- cu `set local role authenticated` + JWT claims (sub = user id) => RLS se aplica.
\set ON_ERROR_STOP on
set client_min_messages = warning;

insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-a@test.ro'),
  ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','client-a@test.ro'),
  ('33333333-3333-3333-3333-333333333333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','client-b@test.ro');

insert into public.organizations (id, name, slug) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Org A','org-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Org B','org-b');

insert into public.clients (id, organization_id, cui, name) values
  ('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','RO111','Client A1'),
  ('c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','RO222','Client B1');

insert into public.profiles (id, organization_id, role, client_id) values
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','admin',null),
  ('22222222-2222-2222-2222-222222222222','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','client','c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1'),
  ('33333333-3333-3333-3333-333333333333','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','client','c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2');

insert into public.items (id, organization_id, title, unit, sellable) values
  ('11111111-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Caramida eco A','bucata',true),
  ('11111111-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Lot intern A (nevandabil)','kg',false),
  ('22222222-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Beton B','mc',true);

insert into public.orders (id, organization_id, client_id, status) values
  ('0d0d0d0d-0000-0000-0000-00000000000a','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1','sent'),
  ('0d0d0d0d-0000-0000-0000-00000000000b','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2','sent'),
  -- T2.0: comanda draft (client A1) - editabila / tranzitionabila spre sent.
  ('0d0d0d0d-0000-0000-0000-00000000000c','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1','draft'),
  -- T2.0: comanda deja acceptata (client A1) - itemii ei devin read-only pt. client.
  ('0d0d0d0d-0000-0000-0000-00000000000d','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1','accepted');

insert into public.order_items (id, organization_id, order_id, item_id, quantity) values
  ('e1e10000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','0d0d0d0d-0000-0000-0000-00000000000c','11111111-0000-0000-0000-000000000001',2),
  ('e1e10000-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','0d0d0d0d-0000-0000-0000-00000000000d','11111111-0000-0000-0000-000000000001',5);

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
  select pg_temp.assert('T1 admin A orders', count(*), 3) from public.orders;
rollback;

-- ===== TEST 2: Client A1 vede propriile date + catalog (sellable) =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
  select pg_temp.assert('T2 client A own client', count(*), 1) from public.clients;
  select pg_temp.assert('T2 client A catalog (sellable only)', count(*), 1) from public.items;
  select pg_temp.assert('T2 client A own orders', count(*), 3) from public.orders;
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

-- =============================================================================
-- T2.0 — Hardening RLS scrieri client (teste noi)
-- =============================================================================

-- ===== TEST 5: Client A1 NU poate seta accepted/closed pe comanda proprie =====
-- Comanda '...000a' e a clientului A1, in status `sent`. Ambele tranzitii sunt
-- interzise (nu sunt in {draft->sent, draft->cancelled, sent->cancelled}) - fie
-- triggerul `orders_client_status_transition`, fie WITH CHECK-ul politicii de
-- UPDATE le blocheaza (ambele raporteaza insufficient_privilege).
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
  do $$
  begin
    begin
      update public.orders set status = 'accepted'
      where id = '0d0d0d0d-0000-0000-0000-00000000000a';
      raise exception 'FAIL: T5a client A a putut seta status=accepted pe comanda sent';
    exception when insufficient_privilege or check_violation then
      raise notice 'PASS: T5a update sent->accepted blocat';
    end;
    begin
      update public.orders set status = 'closed'
      where id = '0d0d0d0d-0000-0000-0000-00000000000a';
      raise exception 'FAIL: T5b client A a putut seta status=closed pe comanda sent';
    exception when insufficient_privilege or check_violation then
      raise notice 'PASS: T5b update sent->closed blocat';
    end;
  end $$;
rollback;

-- ===== TEST 6: Client A1 NU poate modifica order_items pe o comanda accepted =====
-- USING-ul politicii `order_items_client_update` cere ca statusul comenzii
-- parinte sa fie draft/sent; pe o comanda `accepted` randul pur si simplu nu se
-- potriveste => UPDATE afecteaza 0 randuri (fara exceptie), cantitatea ramane
-- neschimbata.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
  update public.order_items set quantity = 999
  where id = 'e1e10000-0000-0000-0000-000000000002';
  select pg_temp.assert(
    'T6 order_items pe comanda accepted - neschimbat',
    (select quantity::bigint from public.order_items where id = 'e1e10000-0000-0000-0000-000000000002'),
    5
  );
rollback;

-- ===== TEST 7: Client A1 POATE draft->sent si poate edita items pe draft =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
  update public.order_items set quantity = 7
  where id = 'e1e10000-0000-0000-0000-000000000001';
  select pg_temp.assert(
    'T7a client editeaza item pe comanda draft',
    (select quantity::bigint from public.order_items where id = 'e1e10000-0000-0000-0000-000000000001'),
    7
  );
  update public.orders set status = 'sent'
  where id = '0d0d0d0d-0000-0000-0000-00000000000c';
  select pg_temp.assert(
    'T7b client tranzitie draft->sent reusita',
    (select count(*) from public.orders
      where id = '0d0d0d0d-0000-0000-0000-00000000000c' and status = 'sent'),
    1
  );
rollback;

-- ===== TEST 8: Client A1 NU poate sterge o comanda sent (doar draft) =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
  -- comanda sent: DELETE blocat de RLS (0 randuri afectate, fara exceptie).
  delete from public.orders where id = '0d0d0d0d-0000-0000-0000-00000000000a';
  select pg_temp.assert(
    'T8a delete comanda sent blocat',
    (select count(*) from public.orders where id = '0d0d0d0d-0000-0000-0000-00000000000a'),
    1
  );
  -- comanda draft: DELETE permis clientului.
  delete from public.orders where id = '0d0d0d0d-0000-0000-0000-00000000000c';
  select pg_temp.assert(
    'T8b delete comanda draft permis',
    (select count(*) from public.orders where id = '0d0d0d0d-0000-0000-0000-00000000000c'),
    0
  );
rollback;

-- ===== TEST 9: Staff-ul poate in continuare accepta comanda (sent->accepted) =====
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  update public.orders set status = 'accepted'
  where id = '0d0d0d0d-0000-0000-0000-00000000000a';
  select pg_temp.assert(
    'T9 admin (staff) accepta comanda sent->accepted',
    (select count(*) from public.orders
      where id = '0d0d0d0d-0000-0000-0000-00000000000a' and status = 'accepted'),
    1
  );
rollback;

select '*** TOATE TESTELE RLS AU TRECUT ***' as result;
