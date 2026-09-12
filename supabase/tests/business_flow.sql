-- =============================================================================
-- Teste FUNCTIONALE pe regulile de business (nu pe izolarea RLS — aceea e in
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
-- RULARE (psql nu e instalat local — se ruleaza prin containerul Supabase):
--   docker exec -i supabase_db_<proiect> psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/business_flow.sql
--
-- PRECONDITIE: `supabase db reset` rulat (migrarile 0000-0016 + `supabase/seed.sql`).
-- Testele presupun datele demo din seed (organizatia "Lateris Demo").
--
-- IMPORTANT — fiecare test ruleaza in `begin; ... rollback;` cu
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

-- Itemi din seed.
\set item_moloz    '''23c1eadf-a57e-4e33-b369-c2143b57f686'''
\set item_pietris  '''dcf1b592-d06b-4d87-8a1a-43f2722e91ea'''
\set item_beton    '''afd7c237-5416-45c7-9400-22b48f5f55d0'''
\set item_nisip    '''4dad3bea-84b8-49ed-976e-1335dfe4855c'''
\set item_caramizi '''545b7ec8-d79b-4b97-b1c6-24ce4534275a'''

-- Loturi din seed. ATENTIE: psql include comentariul de la capatul liniei IN
-- valoarea variabilei, asa ca descrierile stau deasupra, nu pe linia `\set`.
--   lot_pietris_old: 5 ramase,  entry 2026-08-25
--   lot_pietris_new: 38 ramase, entry 2026-08-28
--   lot_beton_ok:    15 ramase, NEblocat
--   lot_beton_blk:   3 ramase,  BLOCAT
--   lot_nisip:       54 ramase (singurul lot de nisip)
\set lot_pietris_old '''cd9f90fd-1cbe-4c1c-a978-3c821dbc229f'''
\set lot_pietris_new '''64bb0317-811d-4cbd-ab44-568f2cecc7bc'''
\set lot_beton_ok    '''d684d698-7ab2-4c88-a17b-0eb5a9dbbddb'''
\set lot_beton_blk   '''d7ce4eeb-d42f-4a16-97e4-5579c42c7a91'''
\set lot_nisip       '''21d93f11-3c4b-46df-b784-85574a276a72'''

-- Comenzi din seed:
--   order_sent   = CMD-2026-0002, status 'sent', o linie de 10 Nisip reciclat
--   order_closed = CMD-2026-0001, status 'closed' (are certificat)
\set order_sent      '''13fc52d1-c2d3-4921-9994-5d2c6a4488c8'''
\set order_closed    '''07b390b3-8a04-46f0-bca1-fc1a9834b233'''
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
  declare v_code text;
  begin
    begin
      perform public.consume_fifo(
        p_item_id => 'afd7c237-5416-45c7-9400-22b48f5f55d0'::uuid, p_qty => 16,
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
  declare v_lot public.lots;
  begin
    v_lot := public.create_lot(
      p_item_id => '23c1eadf-a57e-4e33-b369-c2143b57f686'::uuid,
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
-- B6: set_lot_block — blocarea cere motiv, scoate lotul din disponibil,
--     deblocarea il readuce
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  -- Blocare fara motiv => respinsa.
  do $$
  begin
    begin
      perform public.set_lot_block(
        p_lot_id => '21d93f11-3c4b-46df-b784-85574a276a72'::uuid,
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
  begin
    begin
      perform public.consume_fifo(
        p_item_id => '4dad3bea-84b8-49ed-976e-1335dfe4855c'::uuid, p_qty => 1,
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
-- B7: accept_order — REGULA CENTRALA: stocul se scade la ACCEPTARE
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
  begin
    begin
      perform public.accept_order('13fc52d1-c2d3-4921-9994-5d2c6a4488c8'::uuid);
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
-- B10: confirm_process — consuma inputuri si creeaza loturi de output, cu
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
  begin
    v_proc := public.confirm_process(
      p_type => 'input_fixed'::public.process_type,
      p_output_item_id => '4dad3bea-84b8-49ed-976e-1335dfe4855c'::uuid,  -- Nisip reciclat
      p_recipe_id => null,
      p_notes => 'test B10 reciclare',
      p_inputs => jsonb_build_array(jsonb_build_object(
        'item_id', '23c1eadf-a57e-4e33-b369-c2143b57f686',               -- Moloz
        'lot_ids', jsonb_build_array('6e281d0b-6cf4-4e88-8aae-6a9ff1959797'),
        'qty', 20)),
      p_outputs => jsonb_build_array(
        jsonb_build_object('item_id','4dad3bea-84b8-49ed-976e-1335dfe4855c',
                           'qty',12,'provenance','recycling'),
        jsonb_build_object('item_id','dcf1b592-d06b-4d87-8a1a-43f2722e91ea',
                           'qty',6,'provenance','recycling'))
    );

    perform pg_temp.assert_eq('B10 proces finalizat', v_proc.status::text, 'completed');

    -- Inputul: Moloz avea 200 => 180.
    select remaining_qty into v_in_qty from public.lots
    where id = '6e281d0b-6cf4-4e88-8aae-6a9ff1959797';
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
-- B11: recondiționare — `reconditioning` e o provenienta VALIDA si distincta
--      (cerinta d din Anexa 1: recondiționarea trebuie sa apara distinct)
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  do $$
  declare v_lot public.lots;
  begin
    v_lot := public.create_lot(
      p_item_id => 'dcf1b592-d06b-4d87-8a1a-43f2722e91ea'::uuid,
      p_quantity => 10, p_provenance => 'reconditioning'::public.lot_provenance,
      p_source => 'Test B11', p_entry_date => null, p_location => null,
      p_quality_status => null, p_reason => 'test B11 recondiționare'
    );
    perform pg_temp.assert_eq('B11 provenienta reconditioning acceptata',
      v_lot.provenance::text, 'reconditioning');
  end $$;
rollback;

-- ===========================================================================
-- B12: accept_return_order — materialele returnate REINTRA in stoc ca lot nou
--      cu provenienta `return`, si doar pentru o comanda legata ca retur
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-0000000000b1"}';

  -- Comanda-retur (draft) legata de comanda inchisa CMD-2026-0001.
  insert into public.orders (id, organization_id, client_id, status, created_by)
  values ('eeee0000-0000-0000-0000-00000000ee02', :org,
          'd74894e3-1b54-4678-8eab-4dcf24867896', 'draft',
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

select '*** TOATE TESTELE FUNCTIONALE DE BUSINESS AU TRECUT ***' as result;
