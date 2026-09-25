-- =============================================================================
-- Teste FUNCTIONALE pe regulile de business (nu pe izolarea RLS - aceea e in
-- `rls_isolation.sql`). Verifica INVARIANTII fluxului MVP direct pe RPC-urile
-- Postgres, acolo unde trăiește logica: scaderea stocului la acceptarea comenzii,
-- ordinea FIFO, sarirea loturilor blocate, atomicitatea la stoc insuficient,
-- refacerea stocului la anulare, crearea loturilor de output la procese si
-- reintrarea in stoc la acceptarea unui retur.
--
-- De ce la nivel de SQL si nu doar prin UI: acestea sunt regulile pe care un bug
-- de UI le-ar putea masca, iar un test de UI (Playwright) le-ar verifica indirect
-- si lent. Aici sunt verificate la sursa, deterministic.
--
-- RULARE (psql nu e instalat local - se ruleaza prin containerul Supabase):
--   docker exec -i supabase_db_<proiect> psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/business_flow.sql
--
-- PRECONDITIE: `supabase db reset` rulat (toate migrarile + `supabase/seed.sql`).
-- Testele presupun datele demo din seed (organizatia "Lateris Demo").
--
-- IMPORTANT - fiecare test ruleaza in `begin; ... rollback;` cu
-- `set local role authenticated` + JWT claims, deci:
--   (a) RLS se aplica cu identitatea unui user real (nu ca `postgres`);
--   (b) NU lasa nicio urma in baza de date (spre deosebire de `rls_isolation.sql`,
--       care isi insereaza datele in autocommit).
-- =============================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

-- Identitati din seed (toate cu parola `password123` pe partea de auth).
\set admin_user    '''b0000000-0000-0000-0000-0000000000b1'''
\set org           '''a0000000-0000-0000-0000-0000000000a1'''

-- Itemi din seed - CAUTATI DINAMIC (nu hardcodati): `items.id` e generat cu
-- `gen_random_uuid()` in seed.sql, deci un UUID literal in acest fisier ar fi
-- corect DOAR intamplator, o singura data (la reset-ul din care a fost copiat),
-- si ar rupe testul la fiecare `db reset` ulterior - exact ce se intampla aici
-- pana la acest fix (era mereu rosu in CI, niciodata prins pentru ca `db.yml`
-- ruleaza doar pe PR-uri care ating `supabase/**`). `quote_literal()` produce
-- direct un literal SQL gata cotat (ex. `'a1b2...'`), la fel cum `\set` de mai
-- jos il scria de mana - restul fisierului foloseste `:item_moloz` neschimbat.
select quote_literal(id) as item_moloz    from public.items where organization_id = :org and title = 'Moloz'            \gset
select quote_literal(id) as item_pietris  from public.items where organization_id = :org and title = 'Pietriș reciclat' \gset
select quote_literal(id) as item_beton    from public.items where organization_id = :org and title = 'Beton reciclat'  \gset
select quote_literal(id) as item_nisip    from public.items where organization_id = :org and title = 'Nisip reciclat'  \gset
select quote_literal(id) as item_caramizi from public.items where organization_id = :org and title = 'Cărămizi eco'    \gset
select quote_literal(id) as item_abonament from public.items
  where organization_id = :org and kind = 'service' \gset

-- Loturi din seed - cautate dupa (item, provenienta/stare), nu dupa UUID, din
-- acelasi motiv ca mai sus. Fiecare combinatie e unica in seed.sql:
--   lot_pietris_old: lotul initial de reciclare (5 ramase dupa recondiționare +
--     2 productii - vezi seed.sql comentariile liniilor 298-332/348/377)
--   lot_pietris_new: outputul recondiționarii (38 ramase, neconsumat)
--   lot_beton_ok:    output de productie, NEblocat (15 ramase)
--   lot_beton_blk:   lot de test, BLOCAT (3 ramase)
--   lot_nisip:       singurul lot de nisip (54 ramase)
select quote_literal(id) as lot_pietris_old from public.lots
  where organization_id = :org and item_id = :item_pietris and provenance = 'recycling'      \gset
select quote_literal(id) as lot_pietris_new from public.lots
  where organization_id = :org and item_id = :item_pietris and provenance = 'reconditioning'  \gset
select quote_literal(id) as lot_beton_ok    from public.lots
  where organization_id = :org and item_id = :item_beton and is_blocked = false               \gset
select quote_literal(id) as lot_beton_blk   from public.lots
  where organization_id = :org and item_id = :item_beton and is_blocked = true                \gset
select quote_literal(id) as lot_nisip       from public.lots
  where organization_id = :org and item_id = :item_nisip                                      \gset
-- filtrat pe provenance = 'purchase': dupa migrarea 0031 (Task X8) seed.sql
-- adauga si un al doilea lot de moloz, cu provenance = 'aport_client' (linia
-- 572+, demonstreaza fluxul de aport) - fara filtru, query-ul de mai jos
-- intoarce 2 randuri si pica la \gset ("more than one row returned").
select quote_literal(id) as lot_moloz       from public.lots
  where organization_id = :org and item_id = :item_moloz and provenance = 'purchase'           \gset

-- Comenzi din seed - cautate dupa `order_number` (stabil), nu dupa UUID.
--   order_sent   = CMD-2026-0002, status 'sent', o linie de 10 Nisip reciclat
--   order_closed = CMD-2026-0001, status 'closed' (are certificat)
select quote_literal(id) as order_sent   from public.orders
  where organization_id = :org and order_number = 'CMD-2026-0002' \gset
select quote_literal(id) as order_closed from public.orders
  where organization_id = :org and order_number = 'CMD-2026-0001' \gset
\set client_demo     '''c0000000-0000-0000-0000-0000000000c1'''

-- assert pe text (acopera si numeric: comparam reprezentarea normalizata).
create or replace function pg_temp.assert_eq(label text, actual text, expected text)
returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL: % (got %, expected %)', label, coalesce(actual,'<null>'), coalesce(expected,'<null>');
  else
    raise notice 'PASS: % (=%)', label, coalesce(actual,'<null>');
  end if;
end $$;

create or replace function pg_temp.assert_num(label text, actual numeric, expected numeric)
returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL: % (got %, expected %)', label, coalesce(actual::text,'<null>'), coalesce(expected::text,'<null>');
  else
    raise notice 'PASS: % (=%)', label, coalesce(actual::text,'<null>');
  end if;
end $$;

-- ===========================================================================
-- B1: consume_fifo respecta ordinea FIFO (entry_date crescator)
-- Pietris reciclat are 2 loturi: 5 (2026-08-25) si 38 (2026-08-28).
-- Consumand 10 => 5 din lotul VECHI (golit) + 5 din lotul nou.
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  select count(*) as consumat from public.consume_fifo(
    p_item_id => :item_pietris, p_qty => 10,
    p_manual_lot_ids => null, p_event_type => 'consumption',
    p_order_id => null, p_process_id => null, p_reason => 'test B1 FIFO'
  );

  select pg_temp.assert_num('B1 lot vechi golit complet', remaining_qty, 0)
  from public.lots where id = :lot_pietris_old;

  select pg_temp.assert_num('B1 lot nou scazut cu restul (38-5)', remaining_qty, 33)
  from public.lots where id = :lot_pietris_new;

  -- Doua evenimente de consum (unul per lot atins), ambele negative.
  select pg_temp.assert_num('B1 evenimente de consum scrise', count(*), 2)
  from public.stock_events
  where item_id = :item_pietris and event_type = 'consumption' and reason = 'test B1 FIFO';

  select pg_temp.assert_num('B1 cantitate totala consumata', sum(quantity), -10)
  from public.stock_events
  where item_id = :item_pietris and event_type = 'consumption' and reason = 'test B1 FIFO';
rollback;

-- ===========================================================================
-- B2: consume_fifo SARE loturile blocate
-- Beton reciclat: 15 neblocat + 3 BLOCAT = 18 fizic, dar doar 15 disponibil.
-- Consumul de 15 trebuie sa reuseasca folosind DOAR lotul neblocat.
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  select count(*) as consumat from public.consume_fifo(
    p_item_id => :item_beton, p_qty => 15,
    p_manual_lot_ids => null, p_event_type => 'consumption',
    p_order_id => null, p_process_id => null, p_reason => 'test B2 blocat'
  );

  select pg_temp.assert_num('B2 lotul neblocat golit', remaining_qty, 0)
  from public.lots where id = :lot_beton_ok;

  select pg_temp.assert_num('B2 lotul BLOCAT neatins', remaining_qty, 3)
  from public.lots where id = :lot_beton_blk;
rollback;

-- ===========================================================================
-- B3: stoc insuficient => eroare LT001 si ZERO efecte (atomicitate, fara
-- consum partial). Beton reciclat: 18 fizic, 15 disponibil => 16 trebuie sa cada.
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  do $$
  declare
    v_item_beton uuid;
  begin
    select id into v_item_beton from public.items
      where organization_id = 'a0000000-0000-0000-0000-0000000000a1' and title = 'Beton reciclat';
    begin
      perform public.consume_fifo(
        p_item_id => v_item_beton, p_qty => 16,
        p_manual_lot_ids => null, p_event_type => 'consumption',
        p_order_id => null, p_process_id => null, p_reason => 'test B3 insuficient'
      );
      raise exception 'FAIL: B3 consume_fifo(16) ar fi trebuit sa arunce stoc insuficient';
    exception
      when sqlstate 'LT001' then
        raise notice 'PASS: B3 stoc insuficient semnalat cu LT001';
    end;
  end $$;

  -- Dupa eroarea prinsa, NIMIC nu s-a schimbat (rollback la subtranzactie).
  select pg_temp.assert_num('B3 lot neblocat neatins', remaining_qty, 15)
  from public.lots where id = :lot_beton_ok;
  select pg_temp.assert_num('B3 lot blocat neatins', remaining_qty, 3)
  from public.lots where id = :lot_beton_blk;
  select pg_temp.assert_num('B3 niciun eveniment scris', count(*), 0)
  from public.stock_events where reason = 'test B3 insuficient';
rollback;

-- ===========================================================================
-- B4: selectia MANUALA de loturi respecta ordinea data (nu FIFO)
-- Cerem explicit lotul NOU inainte de cel vechi.
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  select count(*) as consumat from public.consume_fifo(
    p_item_id => :item_pietris, p_qty => 10,
    p_manual_lot_ids => array[:lot_pietris_new::uuid, :lot_pietris_old::uuid],
    p_event_type => 'consumption',
    p_order_id => null, p_process_id => null, p_reason => 'test B4 manual'
  );

  -- Tot consumul (10) iese din lotul NOU, care avea 38 => 28. Vechiul rămâne intact.
  select pg_temp.assert_num('B4 lotul ales primul e consumat (38-10)', remaining_qty, 28)
  from public.lots where id = :lot_pietris_new;
  select pg_temp.assert_num('B4 lotul vechi neatins (ordine manuala respectata)', remaining_qty, 5)
  from public.lots where id = :lot_pietris_old;
rollback;

-- ===========================================================================
-- B5: create_lot creeaza lotul + scrie evenimentul de tip `intake`
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  do $$
  declare
    v_lot public.lots;
    v_item_moloz uuid;
  begin
    select id into v_item_moloz from public.items
      where organization_id = 'a0000000-0000-0000-0000-0000000000a1' and title = 'Moloz';
    v_lot := public.create_lot(
      p_item_id => v_item_moloz,
      p_quantity => 75, p_provenance => 'purchase'::public.lot_provenance,
      p_source => 'Test B5', p_entry_date => null, p_location => null,
      p_quality_status => null, p_reason => 'test B5 intake'
    );
    perform pg_temp.assert_num('B5 cantitate initiala', v_lot.initial_qty, 75);
    perform pg_temp.assert_num('B5 cantitate ramasa = initiala', v_lot.remaining_qty, 75);
    perform pg_temp.assert_eq('B5 provenienta', v_lot.provenance::text, 'purchase');
    perform pg_temp.assert_eq('B5 lot nou nu e blocat', v_lot.is_blocked::text, 'false');
  end $$;

  select pg_temp.assert_num('B5 eveniment intake scris (+75)', sum(quantity), 75)
  from public.stock_events where event_type = 'intake' and reason = 'test B5 intake';

  -- Evenimentul e atribuit userului care a facut operatiunea (audit: "cine").
  select pg_temp.assert_eq('B5 eveniment atribuit adminului',
    created_by::text, 'b0000000-0000-0000-0000-0000000000b1')
  from public.stock_events where event_type = 'intake' and reason = 'test B5 intake';
rollback;

-- ===========================================================================
-- B6: set_lot_block - blocarea cere motiv, scoate lotul din disponibil,
--     deblocarea il readuce
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  -- Blocare fara motiv => respinsa.
  do $$
  declare
    v_lot_nisip uuid;
  begin
    select l.id into v_lot_nisip from public.lots l
      join public.items i on i.id = l.item_id
      where l.organization_id = 'a0000000-0000-0000-0000-0000000000a1' and i.title = 'Nisip reciclat';
    begin
      perform public.set_lot_block(
        p_lot_id => v_lot_nisip,
        p_blocked => true, p_reason => null);
      raise exception 'FAIL: B6 blocarea fara motiv ar fi trebuit respinsa';
    exception
      when sqlstate 'LT005' then raise notice 'PASS: B6 blocare fara motiv respinsa (LT005)';
    end;
  end $$;

  -- Blocare cu motiv => lotul iese din stocul disponibil.
  select id from public.set_lot_block(
    p_lot_id => :lot_nisip, p_blocked => true, p_reason => 'test B6 calitate');

  select pg_temp.assert_eq('B6 lot blocat', is_blocked::text, 'true')
  from public.lots where id = :lot_nisip;

  -- Nisip are UN singur lot (54). Blocat => orice consum cade, chiar si de 1.
  do $$
  declare
    v_item_nisip uuid;
  begin
    select id into v_item_nisip from public.items
      where organization_id = 'a0000000-0000-0000-0000-0000000000a1' and title = 'Nisip reciclat';
    begin
      perform public.consume_fifo(
        p_item_id => v_item_nisip, p_qty => 1,
        p_manual_lot_ids => null, p_event_type => 'consumption',
        p_order_id => null, p_process_id => null, p_reason => 'test B6 consum blocat');
      raise exception 'FAIL: B6 consumul dintr-un lot blocat ar fi trebuit sa cada';
    exception
      when sqlstate 'LT001' then raise notice 'PASS: B6 lotul blocat nu e disponibil pentru consum';
    end;
  end $$;

  -- Deblocare => redevine consumabil.
  select id from public.set_lot_block(p_lot_id => :lot_nisip, p_blocked => false, p_reason => null);
  select count(*) as consumat from public.consume_fifo(
    p_item_id => :item_nisip, p_qty => 1,
    p_manual_lot_ids => null, p_event_type => 'consumption',
    p_order_id => null, p_process_id => null, p_reason => 'test B6 dupa deblocare');

  select pg_temp.assert_num('B6 consum posibil dupa deblocare (54-1)', remaining_qty, 53)
  from public.lots where id = :lot_nisip;
rollback;

-- ===========================================================================
-- B7: accept_order - REGULA CENTRALA: stocul se scade la ACCEPTARE
-- CMD-2026-0002 e 'sent' cu 10 Nisip; lotul de nisip are 54 => 44.
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  select id from public.accept_order(:order_sent);

  select pg_temp.assert_eq('B7 status devine accepted', status::text, 'accepted')
  from public.orders where id = :order_sent;

  select pg_temp.assert_eq('B7 accepted_at populat (mig. 0015)',
    (accepted_at is not null)::text, 'true')
  from public.orders where id = :order_sent;

  select pg_temp.assert_num('B7 stoc scazut la acceptare (54-10)', remaining_qty, 44)
  from public.lots where id = :lot_nisip;

  -- Evenimentul de audit e legat de comanda (trasabilitate "de ce s-a scazut").
  select pg_temp.assert_num('B7 eveniment de consum legat de comanda', sum(quantity), -10)
  from public.stock_events
  where order_id = :order_sent and event_type = 'consumption';

  -- A doua acceptare e respinsa (masina de stari, nu doar UI).
  do $$
  declare
    v_order_sent uuid;
  begin
    select id into v_order_sent from public.orders
      where organization_id = 'a0000000-0000-0000-0000-0000000000a1' and order_number = 'CMD-2026-0002';
    begin
      perform public.accept_order(v_order_sent);
      raise exception 'FAIL: B7 a doua acceptare ar fi trebuit respinsa';
    exception
      when sqlstate 'OR001' then raise notice 'PASS: B7 acceptarea repetata respinsa (OR001)';
    end;
  end $$;
rollback;

-- ===========================================================================
-- B8: accept_order cu stoc insuficient => comanda NU avanseaza (atomicitate)
-- Cerem 9999 Nisip pe o comanda noua 'sent'.
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  insert into public.orders (id, organization_id, client_id, status, created_by)
  values ('eeee0000-0000-0000-0000-00000000ee01', :org, :client_demo, 'sent',
          'b0000000-0000-0000-0000-0000000000b1');
  insert into public.order_items (organization_id, order_id, item_id, quantity)
  values (:org, 'eeee0000-0000-0000-0000-00000000ee01', :item_nisip, 9999);

  do $$
  begin
    begin
      perform public.accept_order('eeee0000-0000-0000-0000-00000000ee01'::uuid);
      raise exception 'FAIL: B8 acceptarea cu stoc insuficient ar fi trebuit sa cada';
    exception
      when sqlstate 'LT001' then raise notice 'PASS: B8 acceptarea blocata de stoc insuficient (LT001)';
    end;
  end $$;

  select pg_temp.assert_eq('B8 comanda RAMANE sent (nu accepted)', status::text, 'sent')
  from public.orders where id = 'eeee0000-0000-0000-0000-00000000ee01';

  select pg_temp.assert_num('B8 stocul de nisip neatins', remaining_qty, 54)
  from public.lots where id = :lot_nisip;
rollback;

-- ===========================================================================
-- B9: cancel_order pe o comanda ACCEPTATA reface stocul + scrie `reversal`
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  select id from public.accept_order(:order_sent);
  select pg_temp.assert_num('B9 precondiție: stoc scazut', remaining_qty, 44)
  from public.lots where id = :lot_nisip;

  select id from public.cancel_order(:order_sent);

  select pg_temp.assert_eq('B9 status devine cancelled', status::text, 'cancelled')
  from public.orders where id = :order_sent;

  select pg_temp.assert_num('B9 stocul refacut integral (44+10)', remaining_qty, 54)
  from public.lots where id = :lot_nisip;

  select pg_temp.assert_num('B9 eveniment reversal scris (+10)', sum(quantity), 10)
  from public.stock_events where order_id = :order_sent and event_type = 'reversal';
rollback;

-- ===========================================================================
-- B10: confirm_process - consuma inputuri si creeaza loturi de output, cu
--      trasabilitate (process_inputs / process_outputs)
-- Reciclare: 20 Moloz => 12 Nisip + 6 Pietris (pierdere 2 doar inregistrata).
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  do $$
  declare
    v_proc public.processes;
    v_in_qty numeric;
    v_out_count int;
    v_item_nisip uuid;
    v_item_moloz uuid;
    v_item_pietris uuid;
    v_lot_moloz uuid;
  begin
    select id into v_item_nisip from public.items
      where organization_id = 'a0000000-0000-0000-0000-0000000000a1' and title = 'Nisip reciclat';
    select id into v_item_moloz from public.items
      where organization_id = 'a0000000-0000-0000-0000-0000000000a1' and title = 'Moloz';
    select id into v_item_pietris from public.items
      where organization_id = 'a0000000-0000-0000-0000-0000000000a1' and title = 'Pietriș reciclat';
    -- provenance = 'purchase': dupa migrarea 0031 (Task X8), seed.sql adauga si
    -- un al doilea lot de moloz (provenance = 'aport_client', 80 ramase) - fara
    -- filtru, "select into" cu mai multe randuri nu da eroare in PL/pgSQL (spre
    -- deosebire de \gset), dar ar putea alege nedeterminist lotul gresit si ar
    -- rupe asertarea de mai jos (200 -> 180, valabila doar pt. lotul original).
    select id into v_lot_moloz from public.lots
      where organization_id = 'a0000000-0000-0000-0000-0000000000a1' and item_id = v_item_moloz
        and provenance = 'purchase';

    v_proc := public.confirm_process(
      p_type => 'input_fixed'::public.process_type,
      p_output_item_id => v_item_nisip,  -- Nisip reciclat
      p_recipe_id => null,
      p_notes => 'test B10 reciclare',
      p_inputs => jsonb_build_array(jsonb_build_object(
        'item_id', v_item_moloz,               -- Moloz
        'lot_ids', jsonb_build_array(v_lot_moloz),
        'qty', 20)),
      p_outputs => jsonb_build_array(
        jsonb_build_object('item_id',v_item_nisip,
                           'qty',12,'provenance','recycling'),
        jsonb_build_object('item_id',v_item_pietris,
                           'qty',6,'provenance','recycling'))
    );

    perform pg_temp.assert_eq('B10 proces finalizat', v_proc.status::text, 'completed');

    -- Inputul: Moloz avea 200 => 180.
    select remaining_qty into v_in_qty from public.lots
    where id = v_lot_moloz;
    perform pg_temp.assert_num('B10 lotul de input consumat (200-20)', v_in_qty, 180);

    -- Doua loturi noi de output, ambele cu provenienta `recycling`.
    select count(*) into v_out_count from public.process_outputs where process_id = v_proc.id;
    perform pg_temp.assert_num('B10 doua loturi de output inregistrate', v_out_count, 2);

    select count(*) into v_out_count from public.process_inputs where process_id = v_proc.id;
    perform pg_temp.assert_num('B10 un input inregistrat (trasabilitate)', v_out_count, 1);

    select count(*) into v_out_count
    from public.process_outputs po join public.lots l on l.id = po.lot_id
    where po.process_id = v_proc.id and l.provenance = 'recycling';
    perform pg_temp.assert_num('B10 loturile de output au provenienta recycling', v_out_count, 2);
  end $$;
rollback;

-- ===========================================================================
-- B11: recondiționare - `reconditioning` e o provenienta VALIDA si distincta
--      (cerinta d din Anexa 1: recondiționarea trebuie sa apara distinct)
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  do $$
  declare
    v_lot public.lots;
    v_item_pietris uuid;
  begin
    select id into v_item_pietris from public.items
      where organization_id = 'a0000000-0000-0000-0000-0000000000a1' and title = 'Pietriș reciclat';
    v_lot := public.create_lot(
      p_item_id => v_item_pietris,
      p_quantity => 10, p_provenance => 'reconditioning'::public.lot_provenance,
      p_source => 'Test B11', p_entry_date => null, p_location => null,
      p_quality_status => null, p_reason => 'test B11 recondiționare'
    );
    perform pg_temp.assert_eq('B11 provenienta reconditioning acceptata',
      v_lot.provenance::text, 'reconditioning');
  end $$;
rollback;

-- ===========================================================================
-- B12: accept_return_order - materialele returnate REINTRA in stoc ca lot nou
--      cu provenienta `return`, si doar pentru o comanda legata ca retur
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  -- Comanda-retur (draft) legata de comanda inchisa CMD-2026-0001.
  insert into public.orders (id, organization_id, client_id, status, created_by)
  values ('eeee0000-0000-0000-0000-00000000ee02', :org,
          :client_demo, 'draft',
          'b0000000-0000-0000-0000-0000000000b1');
  insert into public.order_items (organization_id, order_id, item_id, quantity)
  values (:org, 'eeee0000-0000-0000-0000-00000000ee02', :item_caramizi, 7);

  -- Fara legatura de retur => respins (nu orice draft poate "intra in stoc").
  do $$
  begin
    begin
      perform public.accept_return_order('eeee0000-0000-0000-0000-00000000ee02'::uuid);
      raise exception 'FAIL: B12 o comanda fara legatura de retur ar fi trebuit respinsa';
    exception
      when sqlstate 'RT003' then raise notice 'PASS: B12 comanda fara legatura retur respinsa (RT003)';
    end;
  end $$;

  insert into public.order_links (organization_id, original_order_id, linked_order_id, link_type)
  values (:org, :order_closed, 'eeee0000-0000-0000-0000-00000000ee02', 'return');

  select id from public.accept_return_order('eeee0000-0000-0000-0000-00000000ee02');

  select pg_temp.assert_eq('B12 comanda-retur devine accepted', status::text, 'accepted')
  from public.orders where id = 'eeee0000-0000-0000-0000-00000000ee02';

  select pg_temp.assert_num('B12 lot nou de retur creat (7 buc)', count(*), 1)
  from public.lots
  where item_id = :item_caramizi and provenance = 'return' and initial_qty = 7;

  select pg_temp.assert_eq('B12 materialul returnat e marcat inspectat (passed)',
    quality_status::text, 'passed')
  from public.lots
  where item_id = :item_caramizi and provenance = 'return' and initial_qty = 7;
rollback;

-- ===========================================================================
-- B13: accept_order NU consuma stoc pentru itemi `kind = 'service'` (fix
--      migrarea 0022) - o comanda doar cu un abonament trebuie sa poata fi
--      acceptata, fara "stoc insuficient" (serviciile nu au loturi).
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  insert into public.orders (id, organization_id, client_id, status, created_by)
  values ('eeee0000-0000-0000-0000-00000000ee03', :org, :client_demo, 'sent',
          'b0000000-0000-0000-0000-0000000000b1');
  insert into public.order_items (organization_id, order_id, item_id, quantity)
  values (:org, 'eeee0000-0000-0000-0000-00000000ee03', :item_abonament, 2);

  select id from public.accept_order('eeee0000-0000-0000-0000-00000000ee03');

  select pg_temp.assert_eq('B13 comanda cu serviciu devine accepted', status::text, 'accepted')
  from public.orders where id = 'eeee0000-0000-0000-0000-00000000ee03';

  select pg_temp.assert_num('B13 niciun eveniment de stoc pentru serviciu', count(*), 0)
  from public.stock_events where order_id = 'eeee0000-0000-0000-0000-00000000ee03';
rollback;

-- ===========================================================================
-- B14: accept_intake_order (migrarile 0030/0031) - APORT: materialul adus de
--      client INTRA in stoc ca lot nou cu provenienta `aport_client`,
--      `client_id` completat si calitate `unchecked`; doar pentru comenzi de
--      tip `aport` aflate in `draft`. In plus, `accept_order` (fluxul de
--      vanzare, care CONSUMA stoc) refuza o comanda de aport.
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  -- Comanda obisnuita (material) - NU poate fi acceptata ca aport.
  insert into public.orders (id, organization_id, client_id, order_type, status, created_by)
  values ('eeee0000-0000-0000-0000-00000000ee04', :org, :client_demo, 'material', 'draft',
          'b0000000-0000-0000-0000-0000000000b1');

  do $$
  begin
    begin
      perform public.accept_intake_order('eeee0000-0000-0000-0000-00000000ee04'::uuid);
      raise exception 'FAIL: B14 o comanda `material` ar fi trebuit respinsa ca aport';
    exception
      when sqlstate 'AP003' then raise notice 'PASS: B14 comanda non-aport respinsa (AP003)';
    end;
  end $$;

  insert into public.orders (id, organization_id, client_id, order_type, status, created_by)
  values ('eeee0000-0000-0000-0000-00000000ee05', :org, :client_demo, 'aport', 'draft',
          'b0000000-0000-0000-0000-0000000000b1');
  insert into public.order_items (organization_id, order_id, item_id, quantity)
  values (:org, 'eeee0000-0000-0000-0000-00000000ee05', :item_caramizi, 12);

  select id from public.accept_intake_order('eeee0000-0000-0000-0000-00000000ee05');

  select pg_temp.assert_eq('B14 comanda-aport devine accepted', status::text, 'accepted')
  from public.orders where id = 'eeee0000-0000-0000-0000-00000000ee05';

  select pg_temp.assert_num('B14 lot nou de aport creat (12 buc)', count(*), 1)
  from public.lots
  where item_id = :item_caramizi and provenance = 'aport_client' and initial_qty = 12;

  select pg_temp.assert_eq('B14 lotul de aport pastreaza clientul care l-a adus',
    client_id::text, :client_demo)
  from public.lots
  where item_id = :item_caramizi and provenance = 'aport_client' and initial_qty = 12;

  select pg_temp.assert_eq('B14 materialul adus asteapta QC (unchecked)',
    quality_status::text, 'unchecked')
  from public.lots
  where item_id = :item_caramizi and provenance = 'aport_client' and initial_qty = 12;

  -- A doua acceptare (comanda nu mai e `draft`) -> AP001.
  do $$
  begin
    begin
      perform public.accept_intake_order('eeee0000-0000-0000-0000-00000000ee05'::uuid);
      raise exception 'FAIL: B14 a doua acceptare ar fi trebuit respinsa';
    exception
      when sqlstate 'AP001' then raise notice 'PASS: B14 aport deja acceptat respins (AP001)';
    end;
  end $$;

  -- Fluxul de vanzare refuza o comanda de aport (ar CONSUMA stoc, invers).
  update public.orders set status = 'sent' where id = 'eeee0000-0000-0000-0000-00000000ee05';
  do $$
  begin
    begin
      perform public.accept_order('eeee0000-0000-0000-0000-00000000ee05'::uuid);
      raise exception 'FAIL: B14 accept_order ar fi trebuit sa refuze o comanda de aport';
    exception
      when sqlstate 'OR001' then raise notice 'PASS: B14 accept_order refuza aportul (OR001)';
    end;
  end $$;
rollback;

-- ===========================================================================
-- B15: ARHIVARE item (migrarea 0035) - `archived_by` stampilat de trigger,
--      un item arhivat nu mai poate intra intr-o reteta NOUA (AR001), iar
--      restaurarea curata ambele coloane.
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  update public.items set archived_at = now() where id = :item_caramizi;

  select pg_temp.assert_eq('B15 archived_by = utilizatorul curent (nu input extern)',
    archived_by::text, 'b0000000-0000-0000-0000-0000000000b1')
  from public.items where id = :item_caramizi;

  do $$
  declare
    v_recipe uuid;
    v_item   uuid;
  begin
    select id into v_item from public.items
      where organization_id = 'a0000000-0000-0000-0000-0000000000a1' and title = 'Cărămizi eco';
    select id into v_recipe from public.recipes
      where organization_id = 'a0000000-0000-0000-0000-0000000000a1' and item_id <> v_item
      limit 1;
    begin
      insert into public.recipe_components (organization_id, recipe_id, component_item_id, percentage)
      values ('a0000000-0000-0000-0000-0000000000a1', v_recipe, v_item, 5);
      raise exception 'FAIL: B15 un item arhivat nu trebuia acceptat ca si componenta';
    exception
      when sqlstate 'AR001' then raise notice 'PASS: B15 item arhivat respins in reteta (AR001)';
    end;
  end $$;

  update public.items set archived_at = null where id = :item_caramizi;
  select pg_temp.assert_eq('B15 restaurare curata archived_by', archived_by::text, null)
  from public.items where id = :item_caramizi;
rollback;

-- ===========================================================================
-- B16: o RETETA arhivata nu mai poate porni un proces (AR002)
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  do $$
  declare
    v_recipe uuid;
  begin
    select id into v_recipe from public.recipes
      where organization_id = 'a0000000-0000-0000-0000-0000000000a1' limit 1;
    update public.recipes set archived_at = now() where id = v_recipe;
    begin
      insert into public.processes (organization_id, type, status, recipe_id)
      values ('a0000000-0000-0000-0000-0000000000a1', 'output_fixed', 'planned', v_recipe);
      raise exception 'FAIL: B16 o reteta arhivata nu trebuia folosita intr-un proces';
    exception
      when sqlstate 'AR002' then raise notice 'PASS: B16 reteta arhivata respinsa (AR002)';
    end;
  end $$;
rollback;

-- ===========================================================================
-- B17: delete_draft_order - doar CIORNE; ascunse prin RLS; `deleted_at` nu se
--      poate seta printr-un UPDATE simplu (Data API).
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  insert into public.orders (id, organization_id, client_id, order_type, status, created_by)
  values ('eeee0000-0000-0000-0000-00000000ee06', :org, :client_demo, 'material', 'draft',
          'b0000000-0000-0000-0000-0000000000b1');

  do $$
  begin
    begin
      update public.orders set deleted_at = now()
      where id = 'eeee0000-0000-0000-0000-00000000ee06';
      raise exception 'FAIL: B17 UPDATE direct pe deleted_at ar fi trebuit respins de RLS';
    exception
      when insufficient_privilege then raise notice 'PASS: B17 UPDATE direct pe deleted_at respins';
    end;
  end $$;

  select public.delete_draft_order('eeee0000-0000-0000-0000-00000000ee06');

  select pg_temp.assert_num('B17 ciorna stearsa nu mai e vizibila', count(*), 0)
  from public.orders where id = 'eeee0000-0000-0000-0000-00000000ee06';

  do $$
  begin
    begin
      perform public.delete_draft_order(
        (select id from public.orders
         where organization_id = 'a0000000-0000-0000-0000-0000000000a1'
           and order_number = 'CMD-2026-0002'));
      raise exception 'FAIL: B17 o comanda trimisa nu trebuia stearsa';
    exception
      when sqlstate 'OD001' then raise notice 'PASS: B17 comanda non-ciorna respinsa (OD001)';
    end;
  end $$;
rollback;

-- ===========================================================================
-- B18: cancel_lot - doar loturi manuale, NECONSUMATE; eveniment de corectie in
--      audit (nu se sterge nimic), lotul ramane cu 0.
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  select id as lot_gresit from public.create_lot(
    p_item_id => :item_caramizi, p_quantity => 7, p_provenance => 'purchase',
    p_reason => 'test B18 intrare gresita'
  ) \gset

  select id from public.cancel_lot(:'lot_gresit', 'cantitate introdusa gresit');

  select pg_temp.assert_num('B18 lot anulat -> ramas 0', remaining_qty, 0)
  from public.lots where id = :'lot_gresit';
  select pg_temp.assert_eq('B18 lot marcat anulat', (cancelled_at is not null)::text, 'true')
  from public.lots where id = :'lot_gresit';
  select pg_temp.assert_num('B18 eveniment de corectie -7 in audit', sum(quantity), -7)
  from public.stock_events where lot_id = :'lot_gresit' and event_type = 'adjustment';
  select pg_temp.assert_num('B18 evenimentul de intrare NU a fost sters', count(*), 1)
  from public.stock_events where lot_id = :'lot_gresit' and event_type = 'intake';

  do $$
  declare
    v_item_moloz uuid;
    v_lot_moloz  uuid;
    v_lot_proc   uuid;
    v_lot_new    uuid;
  begin
    -- a doua anulare -> LT007
    select id into v_lot_new from public.lots
      where cancelled_at is not null
        and organization_id = 'a0000000-0000-0000-0000-0000000000a1'
      limit 1;
    begin
      perform public.cancel_lot(v_lot_new, 'din nou');
      raise exception 'FAIL: B18 un lot anulat nu trebuia anulat din nou';
    exception
      when sqlstate 'LT007' then raise notice 'PASS: B18 lot deja anulat (LT007)';
    end;

    -- lot consumat partial (moloz achizitie: 500 intrat, 300 consumat) -> LT008
    select id into v_item_moloz from public.items
      where organization_id = 'a0000000-0000-0000-0000-0000000000a1' and title = 'Moloz';
    select id into v_lot_moloz from public.lots
      where item_id = v_item_moloz and provenance = 'purchase';
    begin
      perform public.cancel_lot(v_lot_moloz, 'test');
      raise exception 'FAIL: B18 un lot consumat nu trebuia anulat';
    exception
      when sqlstate 'LT008' then raise notice 'PASS: B18 lot consumat respins (LT008)';
    end;

    -- lot creat de un proces (output reciclare) -> LT009
    select l.id into v_lot_proc from public.lots l
      join public.process_outputs po on po.lot_id = l.id
      where l.organization_id = 'a0000000-0000-0000-0000-0000000000a1'
      limit 1;
    begin
      perform public.cancel_lot(v_lot_proc, 'test');
      raise exception 'FAIL: B18 un lot de output de proces nu trebuia anulat';
    exception
      when sqlstate 'LT009' then raise notice 'PASS: B18 lot de proces respins (LT009)';
    end;

    -- anulare "pe ocolite" (UPDATE direct) -> LT010
    begin
      update public.lots set cancelled_at = now() where id = v_lot_moloz;
      raise exception 'FAIL: B18 UPDATE direct pe cancelled_at ar fi trebuit respins';
    exception
      when sqlstate 'LT010' then raise notice 'PASS: B18 UPDATE direct respins (LT010)';
    end;
  end $$;
rollback;

-- ===========================================================================
-- B19: cancel_delivery - doar INAINTE de plecare; livrarea anulata dispare si
--      comanda poate fi replanificata (unicitate partiala).
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  insert into public.orders (id, organization_id, client_id, order_type, status, created_by)
  values ('eeee0000-0000-0000-0000-00000000ee07', :org, :client_demo, 'material', 'accepted',
          'b0000000-0000-0000-0000-0000000000b1');
  insert into public.deliveries (id, organization_id, order_id, scheduled_date, carrier_name,
    vehicle_plate, driver_name, route_origin, route_destination)
  values ('dddd0000-0000-0000-0000-00000000dd01', :org, 'eeee0000-0000-0000-0000-00000000ee07',
    current_date, 'Transport SRL', 'B-01-ABC', 'Ion', 'Depozit', 'Santier');

  select public.cancel_delivery('dddd0000-0000-0000-0000-00000000dd01', 'camion indisponibil');

  select pg_temp.assert_num('B19 livrarea anulata nu mai e vizibila', count(*), 0)
  from public.deliveries where id = 'dddd0000-0000-0000-0000-00000000dd01';

  -- replanificare pe aceeasi comanda: permisa (unicitatea e doar pe livrari active)
  insert into public.deliveries (id, organization_id, order_id, scheduled_date, carrier_name,
    vehicle_plate, driver_name, route_origin, route_destination, uit_code, declaration_status)
  values ('dddd0000-0000-0000-0000-00000000dd02', :org, 'eeee0000-0000-0000-0000-00000000ee07',
    current_date, 'Transport SRL', 'B-01-ABC', 'Ion', 'Depozit', 'Santier', 'UIT123', 'declared');

  do $$
  begin
    begin
      perform public.cancel_delivery('dddd0000-0000-0000-0000-00000000dd02', 'test');
      raise exception 'FAIL: B19 o livrare declarata (plecata) nu trebuia anulata';
    exception
      when sqlstate 'DL001' then raise notice 'PASS: B19 livrare plecata respinsa (DL001)';
    end;
  end $$;
rollback;

-- ===========================================================================
-- B20: dezactivare utilizator - adminul nu se poate dezactiva singur (US001);
--      un operator dezactivat pierde accesul la datele organizatiei (RLS).
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  do $$
  begin
    begin
      update public.profiles set status = 'suspended'
      where id = 'b0000000-0000-0000-0000-0000000000b1';
      raise exception 'FAIL: B20 adminul nu trebuia sa se poata dezactiva singur';
    exception
      when sqlstate 'US001' then raise notice 'PASS: B20 auto-dezactivare respinsa (US001)';
    end;
  end $$;

  update public.profiles set status = 'suspended'
  where id = 'b0000000-0000-0000-0000-0000000000b2';

  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b2"}';
  select pg_temp.assert_num('B20 operatorul dezactivat nu mai vede itemi', count(*), 0)
  from public.items;
  select pg_temp.assert_num('B20 operatorul dezactivat isi vede propriul profil', count(*), 1)
  from public.profiles where id = 'b0000000-0000-0000-0000-0000000000b2';
rollback;

-- ===========================================================================
-- B21: arhivarea unui CLIENT blocheaza utilizatorul-client legat; restaurarea
--      il deblocheaza. Comenzile clientului raman (doar ascunse de el).
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  update public.clients set archived_at = now() where id = :client_demo;
  select pg_temp.assert_eq('B21 profilul clientului devine suspended', status::text, 'suspended')
  from public.profiles where id = 'b0000000-0000-0000-0000-0000000000b3';
  select pg_temp.assert_eq('B21 comenzile clientului arhivat raman (staff)',
    (count(*) > 0)::text, 'true')
  from public.orders where client_id = :client_demo;

  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b3"}';
  select pg_temp.assert_num('B21 clientul arhivat nu mai vede comenzi', count(*), 0)
  from public.orders;

  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';
  update public.clients set archived_at = null where id = :client_demo;
  select pg_temp.assert_eq('B21 restaurare -> profil activ', status::text, 'active')
  from public.profiles where id = 'b0000000-0000-0000-0000-0000000000b3';
rollback;

-- ===========================================================================
-- B22: CLIENTUL isi poate sterge (logic) propriile CIORNE din portal
--      (delete_draft_order, 0035) - dar NU ciorna altui client (OR002, fara sa
--      dezvaluie existenta ei) si NU o comanda care nu mai e ciorna (OD001).
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  -- Fixture-uri create de admin: o ciorna a clientului demo + o ciorna a altui client.
  insert into public.orders (id, organization_id, client_id, order_type, status, created_by)
  values ('eeee0000-0000-0000-0000-00000000ee08', :org, :client_demo, 'material', 'draft',
          'b0000000-0000-0000-0000-0000000000b3');
  insert into public.orders (id, organization_id, client_id, order_type, status, created_by)
  select 'eeee0000-0000-0000-0000-00000000ee09', :org, c.id, 'material', 'draft',
         'b0000000-0000-0000-0000-0000000000b1'
  from public.clients c
  where c.organization_id = :org and c.name = 'Bravo Construct SRL';

  -- Acum ca utilizatorul-client al clientului demo.
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b3"}';

  select public.delete_draft_order('eeee0000-0000-0000-0000-00000000ee08');
  select pg_temp.assert_num('B22 clientul nu-si mai vede ciorna stearsa', count(*), 0)
  from public.orders where id = 'eeee0000-0000-0000-0000-00000000ee08';

  do $$
  begin
    begin
      perform public.delete_draft_order('eeee0000-0000-0000-0000-00000000ee09'::uuid);
      raise exception 'FAIL: B22 clientul a putut sterge ciorna ALTUI client';
    exception
      when sqlstate 'OR002' then raise notice 'PASS: B22 ciorna altui client respinsa (OR002)';
    end;

    begin
      perform public.delete_draft_order(
        (select id from public.orders
         where organization_id = 'a0000000-0000-0000-0000-0000000000a1'
           and order_number = 'CMD-2026-0002'));
      raise exception 'FAIL: B22 clientul a putut sterge o comanda trimisa';
    exception
      when sqlstate 'OD001' then raise notice 'PASS: B22 comanda proprie non-ciorna respinsa (OD001)';
    end;
  end $$;

  -- Verificare ca admin: ciorna clientului e marcata stearsa de EL, cealalta e intacta.
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';
  select pg_temp.assert_num('B22 ciorna altui client ramane nestearsa', count(*), 1)
  from public.orders where id = 'eeee0000-0000-0000-0000-00000000ee09';
rollback;

-- ===========================================================================
-- B23: un item ARHIVAT poate reveni prin retur/garantie initiate de CLIENT
--      (decizie 2026-09): clientul poate pune pe o comanda (cererea de retur) un
--      item arhivat pe care l-a primit deja (comanda proprie livrata/inchisa), dar
--      NU un item arhivat pe care nu l-a primit niciodata (AR001).
--      Fixture: o comanda LIVRATA a clientului demo cu Cărămizi eco; Nisip
--      reciclat apare doar pe CMD-2026-0002 (trimisa, nelivrata).
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';
  insert into public.orders (id, organization_id, client_id, order_type, status, created_by)
  values ('eeee0000-0000-0000-0000-00000000ee11', :org, :client_demo, 'material', 'delivered',
          'b0000000-0000-0000-0000-0000000000b1');
  insert into public.order_items (organization_id, order_id, item_id, quantity)
  values (:org, 'eeee0000-0000-0000-0000-00000000ee11', :item_caramizi, 5);

  update public.items set archived_at = now() where id in (:item_caramizi, :item_nisip);

  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b3"}';
  insert into public.orders (id, organization_id, client_id, order_type, status, created_by)
  values ('eeee0000-0000-0000-0000-00000000ee10', :org, :client_demo, 'material', 'draft',
          'b0000000-0000-0000-0000-0000000000b3');

  insert into public.order_items (organization_id, order_id, item_id, quantity)
  values (:org, 'eeee0000-0000-0000-0000-00000000ee10', :item_caramizi, 1);
  select pg_temp.assert_num('B23 retur client: item arhivat deja livrat acceptat', count(*), 1)
  from public.order_items where order_id = 'eeee0000-0000-0000-0000-00000000ee10';

  do $$
  declare
    v_nisip uuid;
  begin
    select id into v_nisip from public.items
      where organization_id = 'a0000000-0000-0000-0000-0000000000a1' and title = 'Nisip reciclat';
    begin
      insert into public.order_items (organization_id, order_id, item_id, quantity)
      values ('a0000000-0000-0000-0000-0000000000a1', 'eeee0000-0000-0000-0000-00000000ee10',
              v_nisip, 1);
      raise exception 'FAIL: B23 clientul a comandat un item arhivat nelivrat';
    exception
      when sqlstate 'AR001' then raise notice 'PASS: B23 item arhivat nelivrat respins (AR001)';
    end;
  end $$;
rollback;

-- ===========================================================================
-- B24: client_order_delivery (0041) - clientul vede livrarea ACTIVA a comenzii
--      PROPRII (subset de campuri), nu si pe a altui client, nici una anulata.
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  insert into public.clients (id, organization_id, cui, name)
  values ('cccc0000-0000-0000-0000-0000000000c9', :org, 'RO999', 'Alt client');
  insert into public.orders (id, organization_id, client_id, order_type, status, created_by)
  values
    ('eeee0000-0000-0000-0000-00000000ee12', :org, :client_demo, 'material', 'accepted',
     'b0000000-0000-0000-0000-0000000000b1'),
    ('eeee0000-0000-0000-0000-00000000ee13', :org, 'cccc0000-0000-0000-0000-0000000000c9',
     'material', 'accepted', 'b0000000-0000-0000-0000-0000000000b1'),
    ('eeee0000-0000-0000-0000-00000000ee14', :org, :client_demo, 'material', 'accepted',
     'b0000000-0000-0000-0000-0000000000b1');
  insert into public.deliveries (id, organization_id, order_id, scheduled_date, carrier_name,
    vehicle_plate, driver_name, route_origin, route_destination)
  values
    ('dddd0000-0000-0000-0000-00000000dd03', :org, 'eeee0000-0000-0000-0000-00000000ee12',
     current_date, 'Fan Courier', 'B-33-GRD', 'Ionel', 'Depozit', 'Santier client'),
    ('dddd0000-0000-0000-0000-00000000dd04', :org, 'eeee0000-0000-0000-0000-00000000ee13',
     current_date, 'Alt transportator', 'B-44-XYZ', 'Vasile', 'Depozit', 'Alt santier'),
    ('dddd0000-0000-0000-0000-00000000dd05', :org, 'eeee0000-0000-0000-0000-00000000ee14',
     current_date, 'Anulat SRL', 'B-55-ANU', 'Gheorghe', 'Depozit', 'Santier');
  select public.cancel_delivery('dddd0000-0000-0000-0000-00000000dd05', 'test');

  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b3"}';
  select pg_temp.assert_num('B24 clientul nu citeste direct deliveries (RLS staff)', count(*), 0)
  from public.deliveries;
  select pg_temp.assert_eq('B24 clientul vede livrarea comenzii proprii', carrier_name,
    'Fan Courier')
  from public.client_order_delivery('eeee0000-0000-0000-0000-00000000ee12');
  select pg_temp.assert_num('B24 livrarea comenzii altui client: 0 randuri', count(*), 0)
  from public.client_order_delivery('eeee0000-0000-0000-0000-00000000ee13');
  select pg_temp.assert_num('B24 livrarea anulata nu apare', count(*), 0)
  from public.client_order_delivery('eeee0000-0000-0000-0000-00000000ee14');

  -- staff-ul are ecranul /livrari; RPC-ul e doar pentru portalul clientului
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';
  select pg_temp.assert_num('B24 RPC-ul nu intoarce nimic pt. staff', count(*), 0)
  from public.client_order_delivery('eeee0000-0000-0000-0000-00000000ee12');
rollback;

-- ===========================================================================
-- B25: aport trimis din portal (0042) - clientul trimite (draft -> sent),
--      staff-ul accepta din `sent` (loturi aport_client); un aport acceptat NU se
--      mai poate anula (AP005); unul `sent` se poate anula (respingere).
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b3"}';

  insert into public.orders (id, organization_id, client_id, order_type, status, created_by)
  values
    ('eeee0000-0000-0000-0000-00000000ee15', :org, :client_demo, 'aport', 'draft',
     'b0000000-0000-0000-0000-0000000000b3'),
    ('eeee0000-0000-0000-0000-00000000ee16', :org, :client_demo, 'aport', 'draft',
     'b0000000-0000-0000-0000-0000000000b3');
  insert into public.order_items (organization_id, order_id, item_id, quantity)
  values
    (:org, 'eeee0000-0000-0000-0000-00000000ee15', :item_moloz, 7),
    (:org, 'eeee0000-0000-0000-0000-00000000ee16', :item_moloz, 3);
  update public.orders set status = 'sent'
  where id in ('eeee0000-0000-0000-0000-00000000ee15', 'eeee0000-0000-0000-0000-00000000ee16');
  select pg_temp.assert_num('B25 clientul isi trimite aportul (sent)', count(*), 2)
  from public.orders
  where id in ('eeee0000-0000-0000-0000-00000000ee15', 'eeee0000-0000-0000-0000-00000000ee16')
    and status = 'sent';

  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';
  select public.accept_intake_order('eeee0000-0000-0000-0000-00000000ee15');
  select pg_temp.assert_eq('B25 aport acceptat din sent', status::text, 'accepted')
  from public.orders where id = 'eeee0000-0000-0000-0000-00000000ee15';
  select pg_temp.assert_num('B25 lot aport_client creat cu cantitatea liniei',
    sum(initial_qty), 7)
  from public.lots
  where item_id = :item_moloz and provenance = 'aport_client' and client_id = :client_demo
    and created_at = now();

  do $$
  begin
    begin
      perform public.cancel_order('eeee0000-0000-0000-0000-00000000ee15'::uuid);
      raise exception 'FAIL: B25 un aport acceptat nu trebuia anulat';
    exception
      when sqlstate 'AP005' then raise notice 'PASS: B25 anularea aportului acceptat respinsa (AP005)';
    end;
  end $$;

  select public.cancel_order('eeee0000-0000-0000-0000-00000000ee16');
  select pg_temp.assert_eq('B25 aportul trimis se poate respinge (anula)', status::text,
    'cancelled')
  from public.orders where id = 'eeee0000-0000-0000-0000-00000000ee16';
rollback;

-- ===========================================================================
-- B26: aport cu item ARHIVAT (0043) - respins (AR001) pentru client, chiar daca
--      itemul i-a fost livrat (exceptia de retur nu se aplica aportului), si pentru
--      staff. Returul clientului pe acelasi item ramane permis (vezi B23).
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';
  insert into public.orders (id, organization_id, client_id, order_type, status, created_by)
  values
    ('eeee0000-0000-0000-0000-00000000ee17', :org, :client_demo, 'material', 'delivered',
     'b0000000-0000-0000-0000-0000000000b1'),
    ('eeee0000-0000-0000-0000-00000000ee18', :org, :client_demo, 'aport', 'draft',
     'b0000000-0000-0000-0000-0000000000b1');
  insert into public.order_items (organization_id, order_id, item_id, quantity)
  values (:org, 'eeee0000-0000-0000-0000-00000000ee17', :item_caramizi, 5);
  update public.items set archived_at = now() where id = :item_caramizi;

  do $$
  declare v_item uuid;
  begin
    select id into v_item from public.items
      where organization_id = 'a0000000-0000-0000-0000-0000000000a1' and title = 'Cărămizi eco';
    begin
      insert into public.order_items (organization_id, order_id, item_id, quantity)
      values ('a0000000-0000-0000-0000-0000000000a1', 'eeee0000-0000-0000-0000-00000000ee18',
              v_item, 1);
      raise exception 'FAIL: B26 staff-ul a pus un item arhivat pe un aport';
    exception
      when sqlstate 'AR001' then raise notice 'PASS: B26 aport staff cu item arhivat respins (AR001)';
    end;
  end $$;

  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b3"}';
  insert into public.orders (id, organization_id, client_id, order_type, status, created_by)
  values ('eeee0000-0000-0000-0000-00000000ee19', :org, :client_demo, 'aport', 'draft',
          'b0000000-0000-0000-0000-0000000000b3');
  do $$
  declare v_item uuid;
  begin
    select id into v_item from public.items
      where organization_id = 'a0000000-0000-0000-0000-0000000000a1' and title = 'Cărămizi eco';
    begin
      insert into public.order_items (organization_id, order_id, item_id, quantity)
      values ('a0000000-0000-0000-0000-0000000000a1', 'eeee0000-0000-0000-0000-00000000ee19',
              v_item, 1);
      raise exception 'FAIL: B26 clientul a pus un item arhivat (livrat) pe un aport';
    exception
      when sqlstate 'AR001' then raise notice 'PASS: B26 aport client cu item arhivat livrat respins (AR001)';
    end;
  end $$;
rollback;

-- ===========================================================================
-- B27: retur cerut din portal (0044) - clientul trimite cererea (draft -> sent),
--      staff-ul o accepta din `sent` (lot `return`); un retur acceptat NU se mai
--      anuleaza (RT005); unul trimis se poate respinge (anula).
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';
  insert into public.orders (id, organization_id, client_id, order_type, status, created_by)
  values ('eeee0000-0000-0000-0000-00000000ee20', :org, :client_demo, 'material', 'delivered',
          'b0000000-0000-0000-0000-0000000000b1');
  insert into public.order_items (organization_id, order_id, item_id, quantity)
  values (:org, 'eeee0000-0000-0000-0000-00000000ee20', :item_nisip, 5);

  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b3"}';
  insert into public.orders (id, organization_id, client_id, order_type, status, created_by)
  values
    ('eeee0000-0000-0000-0000-00000000ee21', :org, :client_demo, 'material', 'draft',
     'b0000000-0000-0000-0000-0000000000b3'),
    ('eeee0000-0000-0000-0000-00000000ee22', :org, :client_demo, 'material', 'draft',
     'b0000000-0000-0000-0000-0000000000b3');
  insert into public.order_items (organization_id, order_id, item_id, quantity)
  values
    (:org, 'eeee0000-0000-0000-0000-00000000ee21', :item_nisip, 2),
    (:org, 'eeee0000-0000-0000-0000-00000000ee22', :item_nisip, 1);
  insert into public.order_links (organization_id, link_type, original_order_id, linked_order_id)
  values
    (:org, 'return', 'eeee0000-0000-0000-0000-00000000ee20', 'eeee0000-0000-0000-0000-00000000ee21'),
    (:org, 'return', 'eeee0000-0000-0000-0000-00000000ee20', 'eeee0000-0000-0000-0000-00000000ee22');
  update public.orders set status = 'sent'
  where id in ('eeee0000-0000-0000-0000-00000000ee21', 'eeee0000-0000-0000-0000-00000000ee22');

  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';
  select public.accept_return_order('eeee0000-0000-0000-0000-00000000ee21');
  select pg_temp.assert_eq('B27 retur acceptat din sent', status::text, 'accepted')
  from public.orders where id = 'eeee0000-0000-0000-0000-00000000ee21';
  select pg_temp.assert_num('B27 lot de retur creat', sum(initial_qty), 2)
  from public.lots
  where item_id = :item_nisip and provenance = 'return' and created_at = now();

  do $$
  begin
    begin
      perform public.cancel_order('eeee0000-0000-0000-0000-00000000ee21'::uuid);
      raise exception 'FAIL: B27 un retur acceptat nu trebuia anulat';
    exception
      when sqlstate 'RT005' then raise notice 'PASS: B27 anularea returului acceptat respinsa (RT005)';
    end;
  end $$;

  select public.cancel_order('eeee0000-0000-0000-0000-00000000ee22');
  select pg_temp.assert_eq('B27 returul trimis se poate respinge (anula)', status::text,
    'cancelled')
  from public.orders where id = 'eeee0000-0000-0000-0000-00000000ee22';
rollback;

-- ===========================================================================
-- B28: clientul confirma receptia livrarii din portal (0045) - atomic: receptie
--      + comanda `delivered`; nu de doua ori (DR003), nu pe comanda altui client
--      (DR001), nu pe o comanda neconfirmata (DR002), nu fara nume (DR004).
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  insert into public.clients (id, organization_id, cui, name)
  values ('cccc0000-0000-0000-0000-0000000000ca', :org, 'RO998', 'Alt client B28');
  insert into public.orders (id, organization_id, client_id, order_type, status, created_by)
  values
    ('eeee0000-0000-0000-0000-00000000ee23', :org, :client_demo, 'material', 'accepted',
     'b0000000-0000-0000-0000-0000000000b1'),
    ('eeee0000-0000-0000-0000-00000000ee24', :org, 'cccc0000-0000-0000-0000-0000000000ca',
     'material', 'accepted', 'b0000000-0000-0000-0000-0000000000b1'),
    ('eeee0000-0000-0000-0000-00000000ee25', :org, :client_demo, 'material', 'sent',
     'b0000000-0000-0000-0000-0000000000b1');
  insert into public.deliveries (id, organization_id, order_id, scheduled_date, carrier_name,
    vehicle_plate, driver_name, route_origin, route_destination)
  values
    ('dddd0000-0000-0000-0000-00000000dd06', :org, 'eeee0000-0000-0000-0000-00000000ee23',
     current_date, 'Fan Courier', 'B-33-GRD', 'Ionel', 'Depozit', 'Santier'),
    ('dddd0000-0000-0000-0000-00000000dd07', :org, 'eeee0000-0000-0000-0000-00000000ee24',
     current_date, 'Alt', 'B-44-XYZ', 'Vasile', 'Depozit', 'Alt santier'),
    ('dddd0000-0000-0000-0000-00000000dd08', :org, 'eeee0000-0000-0000-0000-00000000ee25',
     current_date, 'Alt', 'B-55-XYZ', 'Gheorghe', 'Depozit', 'Santier');

  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b3"}';

  do $$
  begin
    begin
      perform public.client_confirm_delivery_receipt(
        'eeee0000-0000-0000-0000-00000000ee23'::uuid, '   ', null);
      raise exception 'FAIL: B28 confirmare fara nume acceptata';
    exception
      when sqlstate 'DR004' then raise notice 'PASS: B28 nume obligatoriu (DR004)';
    end;
  end $$;

  select public.client_confirm_delivery_receipt(
    'eeee0000-0000-0000-0000-00000000ee23', ' Maria Pop ', 'ok');

  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';
  select pg_temp.assert_eq('B28 receptie salvata (nume, portal)',
    received_by_name || '|' || received_via_portal::text || '|' || (received_at is not null)::text,
    'Maria Pop|true|true')
  from public.deliveries where id = 'dddd0000-0000-0000-0000-00000000dd06';
  select pg_temp.assert_eq('B28 comanda trece in delivered',
    status::text || '|' || (delivered_at is not null)::text, 'delivered|true')
  from public.orders where id = 'eeee0000-0000-0000-0000-00000000ee23';

  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b3"}';
  do $$
  begin
    begin
      perform public.client_confirm_delivery_receipt(
        'eeee0000-0000-0000-0000-00000000ee23'::uuid, 'Maria Pop', null);
      raise exception 'FAIL: B28 receptie confirmata de doua ori';
    exception
      when sqlstate 'DR003' then raise notice 'PASS: B28 a doua confirmare respinsa (DR003)';
    end;
    begin
      perform public.client_confirm_delivery_receipt(
        'eeee0000-0000-0000-0000-00000000ee24'::uuid, 'Maria Pop', null);
      raise exception 'FAIL: B28 clientul a confirmat livrarea altui client';
    exception
      when sqlstate 'DR001' then raise notice 'PASS: B28 comanda altui client respinsa (DR001)';
    end;
    begin
      perform public.client_confirm_delivery_receipt(
        'eeee0000-0000-0000-0000-00000000ee25'::uuid, 'Maria Pop', null);
      raise exception 'FAIL: B28 receptie pe comanda neconfirmata';
    exception
      when sqlstate 'DR002' then raise notice 'PASS: B28 comanda neconfirmata respinsa (DR002)';
    end;
  end $$;

  -- staff-ul nu foloseste RPC-ul clientului (are ecranul /livrari)
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';
  do $$
  begin
    begin
      perform public.client_confirm_delivery_receipt(
        'eeee0000-0000-0000-0000-00000000ee25'::uuid, 'Admin', null);
      raise exception 'FAIL: B28 staff-ul a folosit RPC-ul clientului';
    exception
      when sqlstate 'DR001' then raise notice 'PASS: B28 RPC-ul refuza staff-ul (DR001)';
    end;
  end $$;
rollback;

select '*** TOATE TESTELE FUNCTIONALE DE BUSINESS AU TRECUT ***' as result;
