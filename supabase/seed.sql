-- =============================================================================
-- Seed pentru dezvoltare locala (ruleaza automat la `pnpm db:reset`).
-- Creeaza o organizatie demo + utilizatori pentru fiecare rol, ca sa poti testa
-- login-ul, white-labeling-ul si guard-urile fara provizionare manuala.
--
-- Conturi (parola pentru toate: `password123`):
--   admin@demo.local     - admin organizatie demo
--   operator@demo.local  - operator
--   client@demo.local    - client (firma Client Demo SRL)
--   super@demo.local     - super-admin (fara organizatie)
--
-- NU folosi aceste conturi in productie.
--
-- Task X4 (seed data & E2E): al doilea bloc `do $$ ... $$` de mai jos extinde
-- organizatia demo cu date bogate pentru clientul pilot (firma de constructii
-- care concaseaza moloz -> nisip/pietris/balast reciclat -> caramizi/beton),
-- ca demo-ul sa arate populat imediat dupa `supabase db reset`, fara pasi
-- manuali. Insereaza DIRECT in tabele (nu prin RPC-urile create_lot/consume_fifo/
-- confirm_process/accept_order): acele functii sunt SECURITY INVOKER si verifica
-- `app.is_staff_of()` pe baza `auth.uid()`, care e null cand seed.sql ruleaza ca
-- `postgres` (fara `set local role authenticated` + JWT claims) -- ar respinge
-- orice apel. Insertiile directe reproduc exact ce ar fi scris RPC-ul respectiv
-- (lot + stock_event 'intake'/'consumption', process_inputs/outputs, etc.), deci
-- rezultatul e indistingibil de unul produs prin flux normal.
--
-- ID-uri: continua schema din blocul de mai jos (`a0.../b0.../c0...`), NU
-- foloseste prefixele `aaaa.../bbbb.../cccc.../1111...-6666...` rezervate lui
-- `supabase/tests/rls_isolation.sql` -- fara coliziuni intre cele doua fisiere.
-- =============================================================================

do $$
declare
  v_org uuid := 'a0000000-0000-0000-0000-0000000000a1';
  v_client uuid := 'c0000000-0000-0000-0000-0000000000c1';
  u record;
begin
  -- Organizatie demo (cu tema white-label).
  insert into public.organizations (id, name, slug, primary_color, secondary_color, email_from_name)
  values (v_org, 'Lateris Demo', 'demo', '#1f5e3a', '#c8862b', 'Lateris Demo');

  -- Firma-client demo.
  insert into public.clients (id, organization_id, cui, name, email, is_vat_payer)
  values (v_client, v_org, 'RO12345678', 'Client Demo SRL', 'client@demo.local', true);

  -- Utilizatori: auth.users (email confirmat) + identitate email (login cu parola).
  for u in
    select * from (values
      ('b0000000-0000-0000-0000-0000000000b1'::uuid, 'admin@demo.local'),
      ('b0000000-0000-0000-0000-0000000000b2'::uuid, 'operator@demo.local'),
      ('b0000000-0000-0000-0000-0000000000b3'::uuid, 'client@demo.local'),
      ('b0000000-0000-0000-0000-0000000000b4'::uuid, 'super@demo.local')
    ) as t(id, email)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      -- GoTrue cere string-uri (nu NULL) pe coloanele de token.
      confirmation_token, recovery_token, email_change, email_change_token_new,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('password123', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), u.id, u.id::text,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end loop;

  -- Profiluri (rol + tenant).
  insert into public.profiles (id, organization_id, role, client_id, full_name, email) values
    ('b0000000-0000-0000-0000-0000000000b1', v_org, 'admin',       null,     'Admin Demo',    'admin@demo.local'),
    ('b0000000-0000-0000-0000-0000000000b2', v_org, 'operator',    null,     'Operator Demo', 'operator@demo.local'),
    ('b0000000-0000-0000-0000-0000000000b3', v_org, 'client',      v_client, 'Client Demo',   'client@demo.local'),
    ('b0000000-0000-0000-0000-0000000000b4', null,  'super_admin', null,     'Super Admin',   'super@demo.local');
end $$;

-- =============================================================================
-- Task X4 — Date demo bogate pentru organizatia "Lateris Demo" (clientul pilot:
-- firma de constructii care concaseaza moloz -> nisip/pietris/balast reciclat ->
-- caramizi/beton, cf. handoff.md "MVP - termen si flux").
--
-- Acopera: 3 clienti (2 noi + cel existent), 8 itemi (7 fizice + 1 serviciu),
-- 3 retete, 8 loturi cu 5 proveniente diferite (achizitie, reciclare,
-- recondiționare, productie interna, retur) inclusiv un lot BLOCAT, 4 procese
-- (1 reciclare, 1 recondiționare, 2 productie) cu trasabilitate completa
-- (process_inputs/process_outputs + stock_events), 2 comenzi in stadii diferite
-- (una inchisa cu certificat generat, una doar trimisa) + contoarele
-- corespunzatoare (order_counters/certificate_counters), ca urmatoarea comanda
-- creata din UI sa continue numerotarea fara coliziune.
-- =============================================================================
do $$
declare
  v_org       uuid := 'a0000000-0000-0000-0000-0000000000a1'; -- Lateris Demo (blocul de mai sus)
  v_client_demo uuid := 'c0000000-0000-0000-0000-0000000000c1'; -- Client Demo SRL (deja existent)
  v_admin     uuid := 'b0000000-0000-0000-0000-0000000000b1';
  v_operator  uuid := 'b0000000-0000-0000-0000-0000000000b2';
  v_client_user uuid := 'b0000000-0000-0000-0000-0000000000b3';

  v_client_bravo   uuid;
  v_client_edilamo uuid;
  v_addr_bravo     uuid;

  v_item_moloz      uuid;
  v_item_nisip      uuid;
  v_item_pietris    uuid;
  v_item_balast     uuid;
  v_item_caramizi   uuid;
  v_item_beton      uuid;
  v_item_umplutura  uuid;
  v_item_abonament  uuid;

  v_recipe_moloz    uuid;
  v_recipe_caramizi uuid;
  v_recipe_beton    uuid;

  v_lot_moloz          uuid;
  v_lot_nisip          uuid;
  v_lot_pietris        uuid;
  v_lot_pietris_recond uuid;
  v_lot_balast         uuid;
  v_lot_umplutura      uuid;
  v_lot_caramizi       uuid;
  v_lot_beton          uuid;
  v_lot_beton_blocat   uuid;

  v_proc_recycling uuid;
  v_proc_recond    uuid;
  v_proc_caramizi  uuid;
  v_proc_beton     uuid;

  v_order1 uuid;
  v_order2 uuid;
begin
  -- ---------------------------------------------------------------------------
  -- 1. Clienti (firme de constructii reale ca profil, date fictive)
  -- ---------------------------------------------------------------------------
  insert into public.clients (
    organization_id, cui, name, reg_com, is_vat_payer, hq_address, email, phone, contact_person
  ) values (
    v_org, 'RO23456789', 'Bravo Construct SRL', 'J40/1234/2015', true,
    'Str. Industriilor nr. 12, București', 'contact@bravoconstruct.ro', '0722123456', 'Ion Popescu'
  ) returning id into v_client_bravo;

  insert into public.clients (
    organization_id, cui, name, reg_com, is_vat_payer, hq_address, email, phone, contact_person,
    is_supplier
  ) values (
    v_org, 'RO34567890', 'Edilamo Trading SRL', 'J40/5678/2018', true,
    'Șos. Chitilei nr. 45, București', 'office@edilamo.ro', '0733987654', 'Maria Ionescu', true
  ) returning id into v_client_edilamo;

  insert into public.client_addresses (organization_id, client_id, label, address, is_default)
  values (v_org, v_client_bravo, 'Șantier Militari', 'Str. Uzinei nr. 3, Chiajna, Ilfov', true)
  returning id into v_addr_bravo;

  -- ---------------------------------------------------------------------------
  -- 2. Itemi pilot (moloz -> nisip/pietriș/balast reciclat -> cărămizi/beton)
  -- ---------------------------------------------------------------------------
  insert into public.items (organization_id, title, description, unit, kind, sellable)
  values (
    v_org, 'Moloz', 'Deșeu brut de demolare — materie primă pentru reciclare, nevandabil.',
    'tona', 'physical', false
  ) returning id into v_item_moloz;

  insert into public.items (organization_id, title, description, unit, kind, sellable)
  values (
    v_org, 'Nisip reciclat', 'Nisip obținut din concasarea molozului.', 'tona', 'physical', true
  ) returning id into v_item_nisip;

  insert into public.items (organization_id, title, description, unit, kind, sellable)
  values (
    v_org, 'Pietriș reciclat', 'Pietriș obținut din concasarea molozului.', 'tona', 'physical', true
  ) returning id into v_item_pietris;

  insert into public.items (organization_id, title, description, unit, kind, sellable)
  values (
    v_org, 'Balast reciclat', 'Balast obținut din concasarea molozului.', 'tona', 'physical', true
  ) returning id into v_item_balast;

  insert into public.items (organization_id, title, description, unit, kind, sellable)
  values (
    v_org, 'Cărămizi eco', 'Cărămizi fabricate din materiale reciclate (nisip/pietriș/balast).',
    'bucata', 'physical', true
  ) returning id into v_item_caramizi;

  insert into public.items (organization_id, title, description, unit, kind, sellable)
  values (
    v_org, 'Beton reciclat', 'Beton produs cu agregate reciclate (nisip/pietriș/balast).',
    'mc', 'physical', true
  ) returning id into v_item_beton;

  insert into public.items (organization_id, title, description, unit, kind, sellable)
  values (
    v_org, 'Deșeuri umplutură', 'Material de umplutură pentru șantiere (nivelări, terasamente).',
    'tona', 'physical', true
  ) returning id into v_item_umplutura;

  insert into public.items (organization_id, title, description, unit, kind, sellable)
  values (
    v_org, 'Abonament preluare deșeuri — Basic', 'Serviciu recurent de preluare deșeuri de șantier.',
    'bucata', 'service', true
  ) returning id into v_item_abonament;

  -- ---------------------------------------------------------------------------
  -- 3. Rețete (procente; "reteta" e folosita atat pentru compozitia unui produs
  --    finit — 4a output fix — cat si pentru descompunerea in fractii a unui
  --    material la reciclare — 4b input fix, vezi migrarea 0008 si
  --    src/features/production/variable-output-form.tsx)
  -- ---------------------------------------------------------------------------
  insert into public.recipes (organization_id, item_id) values (v_org, v_item_moloz)
  returning id into v_recipe_moloz;
  insert into public.recipe_components (organization_id, recipe_id, component_item_id, percentage)
  values
    (v_org, v_recipe_moloz, v_item_nisip, 45),
    (v_org, v_recipe_moloz, v_item_pietris, 35),
    (v_org, v_recipe_moloz, v_item_balast, 15); -- 5% pierdere la concasare (informativ, nevalidat)

  insert into public.recipes (organization_id, item_id) values (v_org, v_item_caramizi)
  returning id into v_recipe_caramizi;
  insert into public.recipe_components (organization_id, recipe_id, component_item_id, percentage)
  values
    (v_org, v_recipe_caramizi, v_item_nisip, 60),
    (v_org, v_recipe_caramizi, v_item_pietris, 30),
    (v_org, v_recipe_caramizi, v_item_balast, 10);

  insert into public.recipes (organization_id, item_id) values (v_org, v_item_beton)
  returning id into v_recipe_beton;
  insert into public.recipe_components (organization_id, recipe_id, component_item_id, percentage)
  values
    (v_org, v_recipe_beton, v_item_pietris, 50),
    (v_org, v_recipe_beton, v_item_nisip, 30),
    (v_org, v_recipe_beton, v_item_balast, 20);

  -- ---------------------------------------------------------------------------
  -- 4. Loturi + procese, in ordine cronologica (fiecare pas reflecta EXACT ce ar
  --    fi scris RPC-ul corespunzator: lot nou + stock_event 'intake', consum ->
  --    stock_event 'consumption' + remaining_qty scazut).
  -- ---------------------------------------------------------------------------

  -- 4.1 Intrare stoc: achiziție moloz (materie primă) -------------------------
  insert into public.lots (
    organization_id, item_id, entry_date, source, provenance, location,
    initial_qty, remaining_qty, quality_status
  ) values (
    v_org, v_item_moloz, current_date - 20,
    'Achiziție moloz — șantier demolare Bloc A, Edilamo Trading SRL', 'purchase',
    'Depozit principal', 500, 200, 'passed'
  ) returning id into v_lot_moloz;

  insert into public.stock_events (organization_id, item_id, lot_id, event_type, quantity, reason, created_by)
  values (v_org, v_item_moloz, v_lot_moloz, 'intake', 500, 'Intrare stoc — achiziție', v_operator);

  -- 4.2 Proces 1 — reciclare (input fix / output variabil): 300t moloz -> nisip/pietriș/balast
  insert into public.processes (
    organization_id, type, status, output_item_id, recipe_id, notes, started_at, completed_at, created_by
  ) values (
    v_org, 'input_fixed', 'completed', v_item_nisip, v_recipe_moloz,
    'Reciclare moloz în fracții (nisip/pietriș/balast).',
    now() - interval '18 days', now() - interval '18 days', v_operator
  ) returning id into v_proc_recycling;

  insert into public.stock_events (organization_id, item_id, lot_id, event_type, quantity, reason, process_id, created_by)
  values (v_org, v_item_moloz, v_lot_moloz, 'consumption', -300, 'Reciclare moloz #1', v_proc_recycling, v_operator);
  insert into public.process_inputs (organization_id, process_id, lot_id, item_id, quantity)
  values (v_org, v_proc_recycling, v_lot_moloz, v_item_moloz, 300);

  insert into public.lots (
    organization_id, item_id, entry_date, source, provenance, location, initial_qty, remaining_qty, quality_status
  ) values (
    v_org, v_item_nisip, current_date - 18, 'Proces reciclare moloz #1', 'recycling',
    'Depozit principal', 150, 54, 'passed'
  ) returning id into v_lot_nisip;
  insert into public.stock_events (organization_id, item_id, lot_id, event_type, quantity, reason, process_id, created_by)
  values (v_org, v_item_nisip, v_lot_nisip, 'intake', 150, 'Output reciclare moloz #1', v_proc_recycling, v_operator);
  insert into public.process_outputs (organization_id, process_id, lot_id, item_id, quantity)
  values (v_org, v_proc_recycling, v_lot_nisip, v_item_nisip, 150);

  insert into public.lots (
    organization_id, item_id, entry_date, source, provenance, location, initial_qty, remaining_qty, quality_status
  ) values (
    v_org, v_item_pietris, current_date - 18, 'Proces reciclare moloz #1', 'recycling',
    'Depozit principal', 100, 5, 'passed'
  ) returning id into v_lot_pietris;
  insert into public.stock_events (organization_id, item_id, lot_id, event_type, quantity, reason, process_id, created_by)
  values (v_org, v_item_pietris, v_lot_pietris, 'intake', 100, 'Output reciclare moloz #1', v_proc_recycling, v_operator);
  insert into public.process_outputs (organization_id, process_id, lot_id, item_id, quantity)
  values (v_org, v_proc_recycling, v_lot_pietris, v_item_pietris, 100);

  insert into public.lots (
    organization_id, item_id, entry_date, source, provenance, location, initial_qty, remaining_qty, quality_status
  ) values (
    v_org, v_item_balast, current_date - 18, 'Proces reciclare moloz #1', 'recycling',
    'Depozit principal', 40, 21, 'passed'
  ) returning id into v_lot_balast;
  insert into public.stock_events (organization_id, item_id, lot_id, event_type, quantity, reason, process_id, created_by)
  values (v_org, v_item_balast, v_lot_balast, 'intake', 40, 'Output reciclare moloz #1', v_proc_recycling, v_operator);
  insert into public.process_outputs (organization_id, process_id, lot_id, item_id, quantity)
  values (v_org, v_proc_recycling, v_lot_balast, v_item_balast, 40);

  -- 4.3 Proces 2 — recondiționare (sortare/curățare pietriș, DISTINCTA de
  --     reciclare in provenienta lotului nou -- cerinta Anexa 1d / AGENTS.md §4)
  insert into public.processes (
    organization_id, type, status, output_item_id, recipe_id, notes, started_at, completed_at, created_by
  ) values (
    v_org, 'input_fixed', 'completed', v_item_pietris, null,
    'Recondiționare (sortare/curățare) pietriș reciclat.',
    now() - interval '15 days', now() - interval '15 days', v_operator
  ) returning id into v_proc_recond;

  insert into public.stock_events (organization_id, item_id, lot_id, event_type, quantity, reason, process_id, created_by)
  values (v_org, v_item_pietris, v_lot_pietris, 'consumption', -40, 'Recondiționare #1', v_proc_recond, v_operator);
  insert into public.process_inputs (organization_id, process_id, lot_id, item_id, quantity)
  values (v_org, v_proc_recond, v_lot_pietris, v_item_pietris, 40);

  insert into public.lots (
    organization_id, item_id, entry_date, source, provenance, location, initial_qty, remaining_qty, quality_status
  ) values (
    v_org, v_item_pietris, current_date - 15, 'Proces recondiționare #1', 'reconditioning',
    'Depozit principal', 38, 38, 'passed'
  ) returning id into v_lot_pietris_recond;
  insert into public.stock_events (organization_id, item_id, lot_id, event_type, quantity, reason, process_id, created_by)
  values (v_org, v_item_pietris, v_lot_pietris_recond, 'intake', 38, 'Output recondiționare #1', v_proc_recond, v_operator);
  insert into public.process_outputs (organization_id, process_id, lot_id, item_id, quantity)
  values (v_org, v_proc_recond, v_lot_pietris_recond, v_item_pietris, 38);

  -- 4.4 Proces 3 — producție (output fix): 150 buc. cărămizi eco din rețetă
  insert into public.processes (
    organization_id, type, status, output_item_id, recipe_id, notes, started_at, completed_at, created_by
  ) values (
    v_org, 'output_fixed', 'completed', v_item_caramizi, v_recipe_caramizi,
    'Fabricație cărămizi eco.', now() - interval '10 days', now() - interval '10 days', v_operator
  ) returning id into v_proc_caramizi;

  insert into public.stock_events (organization_id, item_id, lot_id, event_type, quantity, reason, process_id, created_by)
  values (v_org, v_item_nisip, v_lot_nisip, 'consumption', -90, 'Fabricație cărămizi #1', v_proc_caramizi, v_operator);
  insert into public.process_inputs (organization_id, process_id, lot_id, item_id, quantity)
  values (v_org, v_proc_caramizi, v_lot_nisip, v_item_nisip, 90);

  insert into public.stock_events (organization_id, item_id, lot_id, event_type, quantity, reason, process_id, created_by)
  values (v_org, v_item_pietris, v_lot_pietris, 'consumption', -45, 'Fabricație cărămizi #1', v_proc_caramizi, v_operator);
  insert into public.process_inputs (organization_id, process_id, lot_id, item_id, quantity)
  values (v_org, v_proc_caramizi, v_lot_pietris, v_item_pietris, 45);

  insert into public.stock_events (organization_id, item_id, lot_id, event_type, quantity, reason, process_id, created_by)
  values (v_org, v_item_balast, v_lot_balast, 'consumption', -15, 'Fabricație cărămizi #1', v_proc_caramizi, v_operator);
  insert into public.process_inputs (organization_id, process_id, lot_id, item_id, quantity)
  values (v_org, v_proc_caramizi, v_lot_balast, v_item_balast, 15);

  insert into public.lots (
    organization_id, item_id, entry_date, source, provenance, location, initial_qty, remaining_qty, quality_status
  ) values (
    v_org, v_item_caramizi, current_date - 10, 'Proces fabricație #1', 'internal_production',
    'Depozit principal', 150, 100, 'passed'
  ) returning id into v_lot_caramizi;
  insert into public.stock_events (organization_id, item_id, lot_id, event_type, quantity, reason, process_id, created_by)
  values (v_org, v_item_caramizi, v_lot_caramizi, 'intake', 150, 'Output fabricație #1', v_proc_caramizi, v_operator);
  insert into public.process_outputs (organization_id, process_id, lot_id, item_id, quantity)
  values (v_org, v_proc_caramizi, v_lot_caramizi, v_item_caramizi, 150);

  -- 4.5 Proces 4 — producție (output fix): 20 mc beton reciclat din rețetă
  insert into public.processes (
    organization_id, type, status, output_item_id, recipe_id, notes, started_at, completed_at, created_by
  ) values (
    v_org, 'output_fixed', 'completed', v_item_beton, v_recipe_beton,
    'Fabricație beton reciclat.', now() - interval '8 days', now() - interval '8 days', v_operator
  ) returning id into v_proc_beton;

  insert into public.stock_events (organization_id, item_id, lot_id, event_type, quantity, reason, process_id, created_by)
  values (v_org, v_item_pietris, v_lot_pietris, 'consumption', -10, 'Fabricație beton #1', v_proc_beton, v_operator);
  insert into public.process_inputs (organization_id, process_id, lot_id, item_id, quantity)
  values (v_org, v_proc_beton, v_lot_pietris, v_item_pietris, 10);

  insert into public.stock_events (organization_id, item_id, lot_id, event_type, quantity, reason, process_id, created_by)
  values (v_org, v_item_nisip, v_lot_nisip, 'consumption', -6, 'Fabricație beton #1', v_proc_beton, v_operator);
  insert into public.process_inputs (organization_id, process_id, lot_id, item_id, quantity)
  values (v_org, v_proc_beton, v_lot_nisip, v_item_nisip, 6);

  insert into public.stock_events (organization_id, item_id, lot_id, event_type, quantity, reason, process_id, created_by)
  values (v_org, v_item_balast, v_lot_balast, 'consumption', -4, 'Fabricație beton #1', v_proc_beton, v_operator);
  insert into public.process_inputs (organization_id, process_id, lot_id, item_id, quantity)
  values (v_org, v_proc_beton, v_lot_balast, v_item_balast, 4);

  insert into public.lots (
    organization_id, item_id, entry_date, source, provenance, location, initial_qty, remaining_qty, quality_status
  ) values (
    v_org, v_item_beton, current_date - 8, 'Proces fabricație #2', 'internal_production',
    'Depozit principal', 20, 15, 'passed'
  ) returning id into v_lot_beton;
  insert into public.stock_events (organization_id, item_id, lot_id, event_type, quantity, reason, process_id, created_by)
  values (v_org, v_item_beton, v_lot_beton, 'intake', 20, 'Output fabricație #2', v_proc_beton, v_operator);
  insert into public.process_outputs (organization_id, process_id, lot_id, item_id, quantity)
  values (v_org, v_proc_beton, v_lot_beton, v_item_beton, 20);

  -- 4.6 Retur material neconsumat (proveniența "retur", fara flux formal de
  --     retur/garanție — doar o intrare de stoc cu aceasta proveniență)
  insert into public.lots (
    organization_id, item_id, entry_date, source, provenance, location, initial_qty, remaining_qty, quality_status
  ) values (
    v_org, v_item_umplutura, current_date - 5, 'Retur material neconsumat — șantier Bravo Construct SRL',
    'return', 'Depozit principal', 25, 25, 'passed'
  ) returning id into v_lot_umplutura;
  insert into public.stock_events (organization_id, item_id, lot_id, event_type, quantity, reason, created_by)
  values (v_org, v_item_umplutura, v_lot_umplutura, 'intake', 25, 'Intrare stoc — retur', v_operator);

  -- 4.7 Lot BLOCAT (control calitate esuat) -- demonstreaza `set_lot_block`
  insert into public.lots (
    organization_id, item_id, entry_date, source, provenance, location,
    initial_qty, remaining_qty, quality_status, is_blocked, block_reason
  ) values (
    v_org, v_item_beton, current_date - 2, 'Proces fabricație #3 (test)', 'internal_production',
    'Depozit principal', 3, 3, 'failed', true,
    'Rezistență la compresiune sub pragul minim — în așteptare retestare.'
  ) returning id into v_lot_beton_blocat;
  insert into public.stock_events (organization_id, item_id, lot_id, event_type, quantity, reason, created_by)
  values (v_org, v_item_beton, v_lot_beton_blocat, 'intake', 3, 'Intrare stoc — lot test', v_operator);
  insert into public.stock_events (organization_id, item_id, lot_id, event_type, quantity, reason, created_by)
  values (
    v_org, v_item_beton, v_lot_beton_blocat, 'block', 0,
    'Rezistență la compresiune sub pragul minim — în așteptare retestare.', v_admin
  );

  -- ---------------------------------------------------------------------------
  -- 5. Comenzi — 2 stadii diferite (flux 7->8->9 din handoff)
  -- ---------------------------------------------------------------------------

  -- 5.1 Comanda 1 (Bravo Construct SRL): flux COMPLET, INCHISA + certificat.
  insert into public.orders (
    organization_id, client_id, order_number, status, created_by_admin,
    delivery_address_id, delivery_date, created_by
  ) values (
    v_org, v_client_bravo, 'CMD-2026-0001', 'closed', true,
    v_addr_bravo, current_date - 3, v_admin
  ) returning id into v_order1;

  insert into public.order_items (organization_id, order_id, item_id, quantity) values
    (v_org, v_order1, v_item_caramizi, 50),
    (v_org, v_order1, v_item_beton, 5);

  -- Scaderea stocului la acceptare (accept_order) -- reflectata direct in
  -- remaining_qty-urile de mai sus (lot_caramizi/lot_beton deja scazute cu 50/5).
  insert into public.stock_events (organization_id, item_id, lot_id, event_type, quantity, reason, order_id, created_by)
  values
    (v_org, v_item_caramizi, v_lot_caramizi, 'consumption', -50, 'Acceptare comandă CMD-2026-0001', v_order1, v_admin),
    (v_org, v_item_beton, v_lot_beton, 'consumption', -5, 'Acceptare comandă CMD-2026-0001', v_order1, v_admin);

  -- Certificat de trasabilitate (generat automat la inchiderea comenzii in
  -- fluxul real -- vezi src/features/orders/notifications.ts). Snapshot minim,
  -- dar structural identic cu forma reala (TraceabilitySnapshot, vezi
  -- src/features/certificates/types.ts), ca ecranul /comenzi/[id]/certificat
  -- sa il poata reda fara erori.
  insert into public.certificates (organization_id, order_id, number, issued_at, traceability_snapshot)
  values (
    v_org, v_order1, 'CRT-2026-0001', now() - interval '1 day',
    jsonb_build_object(
      'version', 1,
      'generatedAt', (now() - interval '1 day')::text,
      'order', jsonb_build_object(
        'id', v_order1, 'number', 'CMD-2026-0001',
        'clientName', 'Bravo Construct SRL', 'clientCui', 'RO23456789'
      ),
      'deliveredItems', jsonb_build_array(
        jsonb_build_object('itemId', v_item_caramizi, 'itemTitle', 'Cărămizi eco', 'unit', 'bucata', 'quantity', 50),
        jsonb_build_object('itemId', v_item_beton, 'itemTitle', 'Beton reciclat', 'unit', 'mc', 'quantity', 5)
      ),
      'graph', jsonb_build_object('nodes', '[]'::jsonb, 'links', '[]'::jsonb),
      'materials', jsonb_build_array(
        jsonb_build_object(
          'material', 'Moloz', 'origin', 'Achiziție',
          'source', 'Achiziție moloz — șantier demolare Bloc A, Edilamo Trading SRL',
          'quantity', 55, 'unit', 'tona', 'percentage', 100.0
        )
      )
    )
  );

  -- 5.2 Comanda 2 (Client Demo SRL): doar TRIMISA, in asteptarea acceptarii.
  insert into public.orders (
    organization_id, client_id, order_number, status, created_by_admin, created_by
  ) values (
    v_org, v_client_demo, 'CMD-2026-0002', 'sent', false, v_client_user
  ) returning id into v_order2;

  insert into public.order_items (organization_id, order_id, item_id, quantity)
  values (v_org, v_order2, v_item_nisip, 10);

  -- ---------------------------------------------------------------------------
  -- 6. Contoare — sincronizate cu numerele deja alocate mai sus, ca urmatoarea
  --    comanda/certificat creat din UI sa continue numerotarea fara coliziune
  --    (generate_order_number/generate_certificate_number fac ON CONFLICT DO
  --    UPDATE pe (organization_id, year), vezi migrarile 0007/0009).
  -- ---------------------------------------------------------------------------
  insert into public.order_counters (organization_id, year, seq) values (v_org, 2026, 2);
  insert into public.certificate_counters (organization_id, year, seq) values (v_org, 2026, 1);
end $$;
