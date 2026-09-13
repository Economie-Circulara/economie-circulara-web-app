-- =============================================================================
-- Date DEMO pentru recepție / prezentări - organizația "Beton Circular SRL (demo)"
-- =============================================================================
-- NU face parte din migrări și NU rulează la `db reset` (vezi supabase/seed.sql pentru
-- seed-ul de dezvoltare). Se rulează MANUAL, o singură dată per mediu - vezi
-- supabase/demo/README.md pentru pașii completi (parola, certificatele PDF, documentele).
--
-- Ce creează (totul într-o organizație NOUĂ, izolată - nu atinge alte organizații):
--   * 7 conturi: super_admin, admin, 2 operatori, 3 clienți cu acces la portal
--   * 8 clienți (inclusiv furnizori și o instituție publică), cu adrese de livrare
--   * 18 itemi: deșeuri, materii prime, agregate reciclate, produse finite din beton,
--     echipamente închiriabile/reutilizabile și 3 abonamente (servicii)
--   * rețete, ~6 luni de istoric operațional: recepții, reciclare, producție,
--     recondiționare, comenzi în toate statusurile, livrări cu aviz/UIT, închirieri,
--     retururi, garanție cu comandă de înlocuire, loturi blocate, ajustare de inventar
--
-- CUM E CONSTRUIT: fiecare operațiune de business trece prin RPC-urile REALE ale
-- aplicației (create_lot, confirm_process, accept_order, cancel_order,
-- accept_return_order, set_lot_block, consume_fifo), rulate cu identitatea
-- utilizatorului care ar fi făcut-o în UI (`set local role authenticated` + JWT claims)
-- - deci FIFO, verificările de stoc, RLS și evenimentele de audit sunt exact cele din
-- producție. Scriptul doar mută apoi timestamp-urile în trecut, ca istoricul să arate
-- plauzibil (rapoarte pe perioadă, dashboard "luna aceasta").
--
-- Ce NU creează (au nevoie de fișiere în Storage, deci de cod TS - vezi README):
--   * certificatele de trasabilitate ale comenzilor închise (PDF)
--   * documentele atașate (contracte, fișe tehnice)
--
-- Parola: placeholder-ul __DEMO_PASSWORD__ se înlocuiește la rulare (NU o comite).
-- Atomic: orice eroare face rollback complet (tot scriptul e un singur bloc DO).
-- =============================================================================

create function pg_temp.idof(p_ids jsonb, p_key text) returns uuid
language plpgsql immutable as $$
begin
  if p_key is null or not (p_ids ? p_key) then
    raise exception 'Cheie demo necunoscuta: %', p_key;
  end if;
  return (p_ids ->> p_key)::uuid;
end $$;

-- Rulează instrucțiunile următoare ca utilizatorul dat (exact ce face PostgREST).
-- `set local` persistă până la `reset role` / finalul tranzacției.
create function pg_temp.become(p_user uuid) returns void
language plpgsql as $$
begin
  execute 'set local role authenticated';
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text,
    true
  );
end $$;

do $$
declare
  c_password constant text := '__DEMO_PASSWORD__';
  c_slug     constant text := 'beton-circular';
  c_domain   constant text := 'demo.lotculot.eu';
  c_depot    constant text := 'Platforma Beton Circular, Str. Depozitelor nr. 7, Chitila, Ilfov';

  v_start date := current_date - 182;
  v_org   uuid := gen_random_uuid();
  v_ids   jsonb := '{}'::jsonb;
  v_events jsonb;

  e        record;
  j        jsonb;
  l        jsonb;
  u        record;
  v_ts     timestamptz;
  v_day    int;
  v_prev_day int := -1;
  v_seq    int := 0;
  v_actor  uuid;
  v_id     uuid;
  v_id2    uuid;
  v_num    text;
  v_inputs jsonb;
  v_outputs jsonb;
  v_is_client boolean;
  v_rows   int;
begin
  if c_password = '__DEMO_' || 'PASSWORD__' or length(c_password) < 12 then
    raise exception 'Inlocuieste placeholder-ul parolei cu o parola de minim 12 caractere (vezi supabase/demo/README.md).';
  end if;
  if exists (select 1 from public.organizations where slug = c_slug) then
    raise exception 'Organizatia demo "%" exista deja - ruleaza intai supabase/demo/teardown-demo.sql.', c_slug;
  end if;
  if exists (select 1 from auth.users where email like '%@' || c_domain) then
    raise exception 'Exista deja conturi @% - ruleaza intai supabase/demo/teardown-demo.sql.', c_domain;
  end if;

  -- Update-urile de mai jos rescriu timestamp-urile in trecut; trigger-ele
  -- touch_updated_at le-ar suprascrie cu now(). Dezactivate DOAR in aceasta tranzactie
  -- (re-activate la final; la eroare, rollback-ul le re-activeaza oricum).
  alter table public.orders     disable trigger orders_touch_updated_at;
  alter table public.lots       disable trigger lots_touch_updated_at;
  alter table public.processes  disable trigger processes_touch_updated_at;
  alter table public.deliveries disable trigger deliveries_touch_updated_at;

  -- ---------------------------------------------------------------------------
  -- 1. Organizatia + conturile
  -- ---------------------------------------------------------------------------
  insert into public.organizations (id, name, slug, primary_color, secondary_color, email_from_name, created_at, updated_at)
  values (v_org, 'Beton Circular SRL (demo)', c_slug, '#1f4e5f', '#d98e32', 'Beton Circular',
          v_start - 30, v_start - 30);

  -- Clientii (inainte de profiluri - profilurile de client au FK catre ei).
  for u in
    select * from (values
      ('C_BRAVO',   'RO31845920', 'Bravo Construct SRL',          'J40/8812/2013', true,  'Bd. Iuliu Maniu nr. 244, sector 6, București', 'delivered+bravo@resend.dev',   '0722 418 330', 'Ion Popescu',     false, 'Antreprenor general - clădiri rezidențiale și de birouri. Contract-cadru 14/2026.'),
      ('C_ARCADA',  'RO40217735', 'Arcada Residence SRL',         'J23/2210/2019', true,  'Str. Fabricii nr. 3, Popești-Leordeni, Ilfov', 'delivered+arcada@resend.dev',  '0731 902 115', 'Alina Georgescu', false, 'Dezvoltator imobiliar - ansamblul Arcada Sud (etapa II).'),
      ('C_DRUMURI', 'RO14926011', 'Drumuri și Poduri Sud SA',     'J16/455/2002',  true,  'Calea București nr. 112, Craiova, Dolj',       'delivered+drumuri@resend.dev', '0251 410 877', 'Radu Stoica',     false, 'Lucrări de infrastructură rutieră - consumator mare de agregate reciclate.'),
      ('C_VERESTI', '4351820',    'Comuna Lunca Verde',            null,            false, 'Str. Principală nr. 1, Lunca Verde, Suceava',  'delivered+luncaverde@resend.dev', '0230 520 145', 'Maria Rusu',      false, 'Autoritate publică locală - modernizare trotuare și alei (pavele, borduri).'),
      ('C_EDILAMO', 'RO27561443', 'Edilamo Trading SRL',          'J40/5678/2010', true,  'Șos. Chitilei nr. 45, sector 1, București',    'delivered+edilamo@resend.dev', '0733 987 654', 'Mihai Ionescu',   true,  'Furnizor de deșeu ceramic sortat și client pentru agregate reciclate.'),
      ('C_DEMOLARI','RO38809126', 'Demolări Rapid SRL',           'J23/1904/2017', true,  'Str. Gării nr. 21, Buftea, Ilfov',             'delivered+demolari@resend.dev','0744 210 998', 'Cristian Vlad',   true,  'Furnizor principal de moloz din demolări (avize de însoțire DR-xxxx).'),
      ('C_CASAVERDE','RO42775310','Casa Verde Imobiliare SRL',    'J23/3317/2020', true,  'Str. Libertății nr. 88, Corbeanca, Ilfov',     'delivered+casaverde@resend.dev','0765 330 412', 'Andreea Matei',  false, 'Închiriază cofraje și containere (model de utilizare temporară + retur).'),
      ('C_TUDOR',   '45118236',   'Tudor Pop Construcții PFA',    'F40/1120/2021', false, 'Str. Morii nr. 5, Snagov, Ilfov',              'delivered+tudor@resend.dev',   '0722 007 581', 'Tudor Pop',       false, null)
    ) as t(k, cui, name, reg_com, vat, hq, email, phone, contact, supplier, notes)
  loop
    insert into public.clients (organization_id, cui, name, reg_com, is_vat_payer, hq_address, email, phone,
                                contact_person, is_supplier, notes, created_at, updated_at)
    values (v_org, u.cui, u.name, u.reg_com, u.vat, u.hq, u.email, u.phone, u.contact, u.supplier, u.notes,
            v_start - 25, v_start - 25)
    returning id into v_id;
    v_ids := v_ids || jsonb_build_object(u.k, v_id);
  end loop;

  for u in
    select * from (values
      ('A_BRAVO_SEDIU',   'C_BRAVO',     'Sediu social',                 'Bd. Iuliu Maniu nr. 244, sector 6, București',        false),
      ('A_BRAVO_MILITARI','C_BRAVO',     'Șantier Militari Residence',   'Str. Uzinei nr. 3, Chiajna, Ilfov',                   true),
      ('A_BRAVO_PIPERA',  'C_BRAVO',     'Șantier Pipera Office Park',   'Bd. Pipera nr. 1/VII, Voluntari, Ilfov',              false),
      ('A_ARCADA_SUD',    'C_ARCADA',    'Ansamblul Arcada Sud',         'Str. Fabricii nr. 3, lot 12, Popești-Leordeni, Ilfov', true),
      ('A_DRUMURI_DJ606', 'C_DRUMURI',   'Lot 3 - DJ 606 Pielești',      'DJ 606 km 4+200, Pielești, Dolj',                     true),
      ('A_DRUMURI_BAZA',  'C_DRUMURI',   'Baza de producție Craiova',    'Str. Depozitului nr. 9, Craiova, Dolj',               false),
      ('A_VERESTI_CENTRU','C_VERESTI',   'Trotuare zona centrală',       'Str. Principală, între nr. 1 și 60, Lunca Verde, Suceava', true),
      ('A_EDILAMO_DEP',   'C_EDILAMO',   'Depozit Chitila',              'Str. Rudeni nr. 70, Chitila, Ilfov',                  true),
      ('A_CV_CORBEANCA',  'C_CASAVERDE', 'Șantier Corbeanca',            'Str. Libertății nr. 88, Corbeanca, Ilfov',            true),
      ('A_CV_SNAGOV',     'C_CASAVERDE', 'Șantier Snagov Lac',           'Aleea Lacului nr. 14, Snagov, Ilfov',                 false),
      ('A_TUDOR_SNAGOV',  'C_TUDOR',     'Casă P+1 Snagov',              'Str. Morii nr. 5, Snagov, Ilfov',                     true)
    ) as t(k, client, label, address, is_default)
  loop
    insert into public.client_addresses (organization_id, client_id, label, address, is_default, created_at, updated_at)
    values (v_org, pg_temp.idof(v_ids, u.client), u.label, u.address, u.is_default, v_start - 25, v_start - 25)
    returning id into v_id;
    v_ids := v_ids || jsonb_build_object(u.k, v_id);
  end loop;

  -- Utilizatori: auth.users (email confirmat) + identitate email (login cu parola),
  -- acelasi format ca supabase/seed.sql.
  for u in
    select * from (values
      ('U_SUPER',   'super',          'Administrator Platformă', 'super_admin', null),
      ('U_ADMIN',   'admin',          'Andrei Marinescu',        'admin',       null),
      ('U_OP',      'operator',       'Elena Dumitru',           'operator',    null),
      ('U_PROD',    'productie',      'Mihai Stan',              'operator',    null),
      ('U_BRAVO',   'client.bravo',   'Ion Popescu',             'client',      'C_BRAVO'),
      ('U_ARCADA',  'client.arcada',  'Alina Georgescu',         'client',      'C_ARCADA'),
      ('U_DRUMURI', 'client.drumuri', 'Radu Stoica',             'client',      'C_DRUMURI')
    ) as t(k, local_part, full_name, role, client)
  loop
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      u.local_part || '@' || c_domain,
      extensions.crypt(c_password, extensions.gen_salt('bf')),
      v_start - 28, v_start - 28, v_start - 28,
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', u.full_name),
      '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', u.local_part || '@' || c_domain, 'email_verified', true),
      'email', v_start - 28, v_start - 28, v_start - 28
    );
    insert into public.profiles (id, organization_id, role, client_id, full_name, email, created_at, updated_at)
    values (
      v_id,
      case when u.role = 'super_admin' then null else v_org end,
      u.role::public.user_role,
      case when u.client is null then null else pg_temp.idof(v_ids, u.client) end,
      u.full_name, u.local_part || '@' || c_domain, v_start - 28, v_start - 28
    );
    v_ids := v_ids || jsonb_build_object(u.k, v_id);
  end loop;

  -- ---------------------------------------------------------------------------
  -- 2. Itemi + retete
  -- ---------------------------------------------------------------------------
  for u in
    select * from (values
      ('I_MOLOZ',    'Moloz beton din demolări',               'Deșeu de construcții (cod 17 01 01) - materie primă pentru concasare. Nevandabil.', 'tona',   'physical', false),
      ('I_CERAMIC',  'Deșeu ceramic (cărămidă, țiglă)',        'Deșeu ceramic sortat (cod 17 01 02) - materie primă pentru balast reciclat.',        'tona',   'physical', false),
      ('I_CIMENT',   'Ciment CEM II/A-LL 42,5R',               'Liant achiziționat - intră în rețetele de pavele, borduri, blocuri și beton.',        'tona',   'physical', false),
      ('I_NISIP',    'Nisip natural spălat 0-4 mm',            'Agregat natural achiziționat, completează fracția fină în rețete.',                  'tona',   'physical', false),
      ('I_AGR04',    'Agregat reciclat 0-4 mm',                'Nisip de concasare din moloz de beton, conform SR EN 12620 (utilizare în betoane).', 'tona',   'physical', true),
      ('I_AGR416',   'Agregat reciclat 4-16 mm',               'Pietriș de concasare din moloz de beton, sortat și spălat.',                          'tona',   'physical', true),
      ('I_AGR1631',  'Agregat reciclat 16-31,5 mm',            'Fracție grosieră pentru straturi de fundație și drumuri (SR EN 13242).',              'tona',   'physical', true),
      ('I_BALAST',   'Balast reciclat 0-63 mm',                'Balast din deșeu ceramic și beton - umpluturi, platforme, drumuri de șantier.',       'tona',   'physical', true),
      ('I_PAVELE',   'Pavele eco 20×10×6 cm',                  'Pavele vibropresate cu minimum 45% agregat reciclat. 1 palet ≈ 9 mp.',                'palet',  'physical', true),
      ('I_BORDURI',  'Borduri beton 100×25×15 cm',             'Borduri stradale cu agregat reciclat. 1 palet = 24 buc.',                              'palet',  'physical', true),
      ('I_BLOCURI',  'Blocuri zidărie eco 50×25×20 cm',        'Blocuri pentru zidărie de umplutură cu agregat și balast reciclat.',                   'palet',  'physical', true),
      ('I_BETON',    'Beton C16/20 cu agregat reciclat',       'Beton de clasă C16/20 cu fracții reciclate - fundații, egalizări, platforme.',        'mc',     'physical', true),
      ('I_COFRAJ',   'Panou cofraj metalic modular 2,4×1,2 m', 'Echipament închiriabil și reutilizabil - se recondiționează după fiecare retur.',     'bucata', 'physical', true),
      ('I_CONTAINER','Container moloz 7 mc',                    'Container închiriabil pentru colectarea molozului pe șantier.',                        'bucata', 'physical', true),
      ('I_PALET',    'Palet lemn EURO reutilizabil',           'Ambalaj reutilizabil - se returnează și se recondiționează.',                          'bucata', 'physical', true),
      ('I_ABON_BASIC',  'Abonament preluare moloz - Basic',    'Serviciu lunar: 2 transporturi/lună, container 7 mc inclus.',                          'bucata', 'service',  true),
      ('I_ABON_PREMIUM','Abonament preluare moloz - Premium',  'Serviciu lunar: transporturi nelimitate, raport lunar de trasabilitate.',              'bucata', 'service',  true),
      ('I_PAYPERUSE',   'Preluare moloz - Pay-per-Use',        'Serviciu la cerere, facturat per transport.',                                          'bucata', 'service',  true)
    ) as t(k, title, description, unit, kind, sellable)
  loop
    insert into public.items (organization_id, title, description, unit, kind, sellable, created_at, updated_at)
    values (v_org, u.title, u.description, u.unit::public.unit_of_measure, u.kind::public.item_kind, u.sellable,
            v_start - 22, v_start - 22)
    returning id into v_id;
    v_ids := v_ids || jsonb_build_object(u.k, v_id);
  end loop;

  -- Retete: pentru produse = compozitie (consum per unitate de output); pentru deseuri
  -- = descompunerea in fractii la reciclare (vezi migrarea 0008).
  for u in
    select * from (values
      ('R_MOLOZ',   'I_MOLOZ',   '[["I_AGR04",40],["I_AGR416",28],["I_AGR1631",22]]'),
      ('R_CERAMIC', 'I_CERAMIC', '[["I_BALAST",88]]'),
      ('R_PAVELE',  'I_PAVELE',  '[["I_AGR04",45],["I_NISIP",25],["I_CIMENT",15]]'),
      ('R_BORDURI', 'I_BORDURI', '[["I_AGR416",50],["I_AGR04",30],["I_CIMENT",20]]'),
      ('R_BLOCURI', 'I_BLOCURI', '[["I_AGR04",40],["I_BALAST",30],["I_CIMENT",15]]'),
      ('R_BETON',   'I_BETON',   '[["I_AGR416",45],["I_AGR04",30],["I_CIMENT",15],["I_NISIP",10]]')
    ) as t(k, item, components)
  loop
    insert into public.recipes (organization_id, item_id, created_at, updated_at)
    values (v_org, pg_temp.idof(v_ids, u.item), v_start - 20, v_start - 20)
    returning id into v_id;
    v_ids := v_ids || jsonb_build_object(u.k, v_id);
    for l in select value from jsonb_array_elements(u.components::jsonb) loop
      insert into public.recipe_components (organization_id, recipe_id, component_item_id, percentage, created_at, updated_at)
      values (v_org, v_id, pg_temp.idof(v_ids, l->>0), (l->>1)::numeric, v_start - 20, v_start - 20);
    end loop;
  end loop;

  -- ---------------------------------------------------------------------------
  -- 3. Istoricul operational - evenimente in ordine cronologica
  -- ---------------------------------------------------------------------------
  -- d = ziua fata de v_start (azi = 182); k = tipul evenimentului. Cheile (key/order/lot)
  -- leaga evenimentele intre ele. Toate cantitatile au fost verificate sa aiba stoc
  -- disponibil la momentul consumului (altfel RPC-ul arunca si scriptul face rollback).
  v_events :=
  -- Martie-aprilie: pornire, primele receptii, reciclare, productie si comenzi
  '[
   {"d":1,"k":"lot","item":"I_MOLOZ","qty":640,"prov":"purchase","src":"Aviz DR-1021 - Demolări Rapid SRL (demolare hală, Str. Fabricii 14, Chitila)","loc":"Platforma recepție deșeuri"},
   {"d":2,"k":"lot","item":"I_CERAMIC","qty":210,"prov":"purchase","src":"Aviz ED-311 - Edilamo Trading SRL (deșeu ceramic sortat)","loc":"Platforma recepție deșeuri"},
   {"d":3,"k":"lot","item":"I_CIMENT","qty":80,"prov":"purchase","src":"Factura CM-5512 - achiziție ciment CEM II","loc":"Siloz 1"},
   {"d":3,"k":"lot","item":"I_NISIP","qty":180,"prov":"purchase","src":"Factura BN-208 - Balastiera Olt","loc":"Depozit agregate"},
   {"d":4,"k":"lot","item":"I_COFRAJ","qty":120,"prov":"purchase","src":"Factura FC-77 - achiziție panouri cofraj","loc":"Hala echipamente"},
   {"d":4,"k":"lot","item":"I_CONTAINER","qty":16,"prov":"purchase","src":"Factura CT-19 - achiziție containere 7 mc","loc":"Parc containere"},
   {"d":5,"k":"lot","item":"I_PALET","qty":500,"prov":"purchase","src":"Factura PL-930 - paleți EURO","loc":"Hala echipamente"},
   {"d":6,"k":"proc","type":"input_fixed","out":"I_AGR04","recipe":"R_MOLOZ","notes":"Concasare și sortare moloz - aviz DR-1021",
    "in":[["I_MOLOZ",500]],"outs":[["I_AGR04",200,"recycling"],["I_AGR416",140,"recycling"],["I_AGR1631",110,"recycling"]]},
   {"d":8,"k":"proc","type":"input_fixed","out":"I_BALAST","recipe":"R_CERAMIC","notes":"Concasare deșeu ceramic - aviz ED-311",
    "in":[["I_CERAMIC",200]],"outs":[["I_BALAST",178,"recycling"]]},
   {"d":10,"k":"proc","type":"output_fixed","out":"I_PAVELE","recipe":"R_PAVELE","notes":"Șarjă pavele eco #1",
    "in":[["I_AGR04",54],["I_NISIP",30],["I_CIMENT",18]],"outs":[["I_PAVELE",120,"internal_production"]]},
   {"d":11,"k":"proc","type":"output_fixed","out":"I_BETON","recipe":"R_BETON","notes":"Stație betoane - șarjă C16/20 #1",
    "in":[["I_AGR416",22.5],["I_AGR04",15],["I_CIMENT",7.5],["I_NISIP",5]],"outs":[["I_BETON",50,"internal_production"]]},
   {"d":12,"k":"proc","type":"output_fixed","out":"I_BORDURI","recipe":"R_BORDURI","notes":"Șarjă borduri #1",
    "in":[["I_AGR416",40],["I_AGR04",24],["I_CIMENT",16]],"outs":[["I_BORDURI",80,"internal_production"]]},
   {"d":13,"k":"proc","type":"output_fixed","out":"I_BLOCURI","recipe":"R_BLOCURI","notes":"Șarjă blocuri zidărie #1",
    "in":[["I_AGR04",40],["I_BALAST",30],["I_CIMENT",15]],"outs":[["I_BLOCURI",100,"internal_production"]]},

   {"d":14,"k":"order","key":"O1","client":"C_BRAVO","addr":"A_BRAVO_MILITARI","dd":17,"lines":[["I_PAVELE",40],["I_BORDURI",20]]},
   {"d":15,"k":"accept","order":"O1"},
   {"d":15,"k":"plan","order":"O1","sd":17,"decl":"declared"},
   {"d":16,"k":"order","key":"O2","client":"C_DRUMURI","by":"U_DRUMURI","addr":"A_DRUMURI_DJ606","dd":20,"lines":[["I_AGR1631",60],["I_BALAST",80]],"notes":"Strat de formă - lot 3 DJ 606"},
   {"d":17,"k":"deliver","order":"O1"},
   {"d":17,"k":"accept","order":"O2"},
   {"d":17,"k":"plan","order":"O2","sd":19,"decl":"declared"},
   {"d":18,"k":"order","key":"O3","client":"C_ARCADA","by":"U_ARCADA","addr":"A_ARCADA_SUD","dd":22,"lines":[["I_BLOCURI",30],["I_AGR04",20]]},
   {"d":19,"k":"close","order":"O1"},
   {"d":19,"k":"accept","order":"O3"},
   {"d":20,"k":"deliver","order":"O2"},
   {"d":20,"k":"order","key":"O4","client":"C_VERESTI","addr":"A_VERESTI_CENTRU","dd":24,"lines":[["I_PAVELE",25],["I_BORDURI",15]],"notes":"Contract de achiziție publică nr. 118/2026"},
   {"d":20,"k":"plan","order":"O3","sd":22,"decl":"declared"},
   {"d":21,"k":"accept","order":"O4"},
   {"d":22,"k":"close","order":"O2"},
   {"d":22,"k":"deliver","order":"O3"},
   {"d":22,"k":"order","key":"R1","client":"C_CASAVERDE","addr":"A_CV_CORBEANCA","dd":24,"ret":82,"lines":[["I_COFRAJ",60],["I_CONTAINER",4]],"notes":"Închiriere cofraje și containere - șantier Corbeanca, 60 de zile"},
   {"d":23,"k":"plan","order":"O4","sd":24,"decl":"declared"},
   {"d":23,"k":"accept","order":"R1"},
   {"d":23,"k":"plan","order":"R1","sd":24,"decl":"declared"},
   {"d":24,"k":"deliver","order":"O4"},
   {"d":24,"k":"deliver","order":"R1"},
   {"d":25,"k":"close","order":"O3"},
   {"d":25,"k":"order","key":"O5","client":"C_EDILAMO","addr":"A_EDILAMO_DEP","dd":27,"lines":[["I_AGR416",45],["I_AGR04",20]]},
   {"d":26,"k":"accept","order":"O5"},
   {"d":26,"k":"plan","order":"O5","sd":27,"decl":"declared"},
   {"d":27,"k":"deliver","order":"O5"},
   {"d":28,"k":"close","order":"O4"},
   {"d":28,"k":"order","key":"O6","client":"C_TUDOR","addr":"A_TUDOR_SNAGOV","dd":30,"lines":[["I_BETON",8]],"notes":"Turnare fundație casă P+1"},
   {"d":29,"k":"close","order":"O5"},
   {"d":29,"k":"accept","order":"O6"},
   {"d":29,"k":"plan","order":"O6","sd":30,"decl":"declared"},
   {"d":30,"k":"deliver","order":"O6"},
   {"d":30,"k":"order","key":"O7","client":"C_BRAVO","by":"U_BRAVO","addr":"A_BRAVO_PIPERA","dd":35,"lines":[["I_PAVELE",30],["I_AGR04",15]]},
   {"d":31,"k":"close","order":"O6"},
   {"d":31,"k":"cancel","order":"O7","by":"U_BRAVO","notes":"Anulată de client - etapa de amenajări exterioare a fost amânată"},
   {"d":33,"k":"lot","item":"I_MOLOZ","qty":520,"prov":"purchase","src":"Aviz DR-1088 - Demolări Rapid SRL (bloc P+4, Str. Viilor, Buftea)","loc":"Platforma recepție deșeuri"},
   {"d":35,"k":"lot","item":"I_CIMENT","qty":70,"prov":"purchase","src":"Factura CM-5630 - achiziție ciment CEM II","loc":"Siloz 1"},
   {"d":36,"k":"proc","type":"input_fixed","out":"I_AGR04","recipe":"R_MOLOZ","notes":"Concasare și sortare moloz - avize DR-1021 (rest) și DR-1088",
    "in":[["I_MOLOZ",480]],"outs":[["I_AGR04",165,"recycling"],["I_AGR416",145,"recycling"],["I_AGR1631",120,"recycling"]]},
   {"d":38,"k":"lot","item":"I_CERAMIC","qty":150,"prov":"purchase","src":"Aviz ED-347 - Edilamo Trading SRL","loc":"Platforma recepție deșeuri"},
   {"d":40,"k":"proc","type":"output_fixed","out":"I_PAVELE","recipe":"R_PAVELE","notes":"Șarjă pavele eco #2",
    "in":[["I_AGR04",72],["I_NISIP",40],["I_CIMENT",24]],"outs":[["I_PAVELE",160,"internal_production"]]}
  ]'::jsonb
  -- Aprilie-iunie: volum in crestere, prima inchiriere returnata si recondiționata
  || '[
   {"d":42,"k":"order","key":"O8","client":"C_ARCADA","by":"U_ARCADA","addr":"A_ARCADA_SUD","dd":46,"lines":[["I_PAVELE",80],["I_BORDURI",25]],"notes":"Alei și parcare bloc C2"},
   {"d":43,"k":"accept","order":"O8"},
   {"d":44,"k":"plan","order":"O8","sd":46,"decl":"declared"},
   {"d":45,"k":"order","key":"O9","client":"C_DRUMURI","addr":"A_DRUMURI_DJ606","dd":48,"lines":[["I_AGR1631",90],["I_AGR416",60],["I_BALAST",40]]},
   {"d":46,"k":"deliver","order":"O8"},
   {"d":46,"k":"accept","order":"O9"},
   {"d":46,"k":"plan","order":"O9","sd":48,"decl":"declared"},
   {"d":47,"k":"proc","type":"input_fixed","out":"I_BALAST","recipe":"R_CERAMIC","notes":"Concasare deșeu ceramic - aviz ED-347",
    "in":[["I_CERAMIC",150]],"outs":[["I_BALAST",134,"recycling"]]},
   {"d":48,"k":"close","order":"O8"},
   {"d":48,"k":"deliver","order":"O9"},
   {"d":50,"k":"close","order":"O9"},
   {"d":50,"k":"proc","type":"output_fixed","out":"I_BORDURI","recipe":"R_BORDURI","notes":"Șarjă borduri #2",
    "in":[["I_AGR416",50],["I_AGR04",30],["I_CIMENT",20]],"outs":[["I_BORDURI",100,"internal_production"]]},
   {"d":52,"k":"order","key":"O10","client":"C_BRAVO","by":"U_BRAVO","addr":"A_BRAVO_PIPERA","dd":55,"lines":[["I_BETON",30],["I_BORDURI",40]]},
   {"d":53,"k":"accept","order":"O10"},
   {"d":53,"k":"plan","order":"O10","sd":55,"decl":"declared"},
   {"d":55,"k":"deliver","order":"O10"},
   {"d":55,"k":"order","key":"O11","client":"C_VERESTI","addr":"A_VERESTI_CENTRU","dd":58,"lines":[["I_PAVELE",50]],"notes":"Contract de achiziție publică nr. 118/2026 - tranșa a II-a"},
   {"d":56,"k":"accept","order":"O11"},
   {"d":57,"k":"close","order":"O10"},
   {"d":57,"k":"plan","order":"O11","sd":58,"decl":"declared"},
   {"d":58,"k":"lot","item":"I_CIMENT","qty":80,"prov":"purchase","src":"Factura CM-5801 - achiziție ciment CEM II","loc":"Siloz 2"},
   {"d":58,"k":"deliver","order":"O11"},
   {"d":60,"k":"close","order":"O11"},
   {"d":60,"k":"lot","item":"I_MOLOZ","qty":700,"prov":"purchase","src":"Aviz DR-1143 - Demolări Rapid SRL (demolare depozit, Șos. Odăii)","loc":"Platforma recepție deșeuri"},
   {"d":61,"k":"lot","item":"I_NISIP","qty":150,"prov":"purchase","src":"Factura BN-266 - Balastiera Olt","loc":"Depozit agregate"},
   {"d":62,"k":"proc","type":"input_fixed","out":"I_AGR04","recipe":"R_MOLOZ","notes":"Concasare și sortare moloz - aviz DR-1143",
    "in":[["I_MOLOZ",620]],"outs":[["I_AGR04",250,"recycling"],["I_AGR416",190,"recycling"],["I_AGR1631",130,"recycling"]]},
   {"d":63,"k":"proc","type":"output_fixed","out":"I_BLOCURI","recipe":"R_BLOCURI","notes":"Șarjă blocuri zidărie #2",
    "in":[["I_AGR04",60],["I_BALAST",45],["I_CIMENT",22.5]],"outs":[["I_BLOCURI",150,"internal_production"]]},
   {"d":64,"k":"proc","type":"output_fixed","out":"I_BETON","recipe":"R_BETON","notes":"Stație betoane - șarjă C16/20 #2",
    "in":[["I_AGR416",31.5],["I_AGR04",21],["I_CIMENT",10.5],["I_NISIP",7]],"outs":[["I_BETON",70,"internal_production"]]},
   {"d":65,"k":"order","key":"O12","client":"C_CASAVERDE","addr":"A_CV_CORBEANCA","dd":68,"lines":[["I_BLOCURI",90],["I_AGR04",30]]},
   {"d":66,"k":"accept","order":"O12"},
   {"d":66,"k":"plan","order":"O12","sd":68,"decl":"declared"},
   {"d":68,"k":"deliver","order":"O12"},
   {"d":70,"k":"order","key":"O13","client":"C_DRUMURI","by":"U_DRUMURI","addr":"A_DRUMURI_DJ606","dd":73,"lines":[["I_AGR1631",120],["I_BALAST",60]],"notes":"Strat de fundație - lot 3 DJ 606, tronson 2"},
   {"d":71,"k":"close","order":"O12"},
   {"d":71,"k":"accept","order":"O13"},
   {"d":71,"k":"plan","order":"O13","sd":73,"decl":"declared"},
   {"d":72,"k":"order","key":"O14","client":"C_EDILAMO","addr":"A_EDILAMO_DEP","dd":75,"lines":[["I_AGR04",50],["I_AGR416",40]]},
   {"d":73,"k":"deliver","order":"O13"},
   {"d":73,"k":"accept","order":"O14"},
   {"d":74,"k":"plan","order":"O14","sd":75,"decl":"declared"},
   {"d":74,"k":"adjust","item":"I_AGR04","qty":4.5,"reason":"Inventar lunar - pierdere prin umiditate și antrenare vânt (PV inventar 05)"},
   {"d":75,"k":"close","order":"O13"},
   {"d":75,"k":"deliver","order":"O14"},
   {"d":75,"k":"lot","item":"I_MOLOZ","qty":18,"prov":"inventory_adjustment","src":"Inventar lunar - diferență cântar platformă (PV inventar 05)","loc":"Platforma recepție deșeuri"},
   {"d":77,"k":"close","order":"O14"},
   {"d":78,"k":"order","key":"O15","client":"C_BRAVO","addr":"A_BRAVO_MILITARI","dd":81,"lines":[["I_PAVELE",60]]},
   {"d":79,"k":"accept","order":"O15"},
   {"d":79,"k":"plan","order":"O15","sd":81,"decl":"declared"},
   {"d":80,"k":"return","key":"RT_R1","original":"R1","type":"return","lines":[["I_COFRAJ",58],["I_CONTAINER",4]],"notes":"Returnare echipamente închiriate - 2 panouri de cofraj declarate pierdute de client"},
   {"d":81,"k":"deliver","order":"O15"},
   {"d":81,"k":"accept_return","order":"RT_R1","lots":{"I_COFRAJ":"L_COF_RET1"}},
   {"d":82,"k":"close","order":"R1"},
   {"d":83,"k":"close","order":"O15"},
   {"d":84,"k":"proc","type":"input_fixed","out":"I_COFRAJ","notes":"Recondiționare panouri cofraj returnate (Corbeanca): curățare, îndreptare, vopsire - 4 panouri casate",
    "in":[["I_COFRAJ",58,["L_COF_RET1"]]],"outs":[["I_COFRAJ",54,"reconditioning"]]},
   {"d":86,"k":"order","key":"R2","client":"C_CASAVERDE","addr":"A_CV_SNAGOV","dd":88,"ret":146,"lines":[["I_COFRAJ",70],["I_CONTAINER",6]],"notes":"Închiriere cofraje și containere - șantier Snagov Lac, 60 de zile"},
   {"d":87,"k":"accept","order":"R2"},
   {"d":87,"k":"plan","order":"R2","sd":88,"decl":"declared"},
   {"d":88,"k":"deliver","order":"R2"},
   {"d":88,"k":"lot","item":"I_CERAMIC","qty":180,"prov":"purchase","src":"Aviz ED-402 - Edilamo Trading SRL","loc":"Platforma recepție deșeuri"},
   {"d":90,"k":"lot","item":"I_CIMENT","qty":70,"prov":"purchase","src":"Factura CM-5977 - achiziție ciment CEM II","loc":"Siloz 1"},
   {"d":91,"k":"proc","type":"output_fixed","out":"I_PAVELE","recipe":"R_PAVELE","notes":"Șarjă pavele eco #3",
    "in":[["I_AGR04",90],["I_NISIP",50],["I_CIMENT",30]],"outs":[["I_PAVELE",200,"internal_production"]]},
   {"d":92,"k":"order","key":"O16","client":"C_ARCADA","by":"U_ARCADA","addr":"A_ARCADA_SUD","dd":96,"lines":[["I_PAVELE",20],["I_BLOCURI",60],["I_BORDURI",30]]},
   {"d":93,"k":"accept","order":"O16"},
   {"d":94,"k":"plan","order":"O16","sd":96,"decl":"declared"},
   {"d":96,"k":"deliver","order":"O16"}
  ]'::jsonb
  -- Iunie-august: garantie, retururi, lot blocat, al doilea ciclu de inchiriere
  || '[
   {"d":97,"k":"return","key":"W1","original":"O15","type":"warranty","by":"U_BRAVO","lines":[["I_PAVELE",4]],"notes":"Garanție: 4 paleți de pavele cu fisuri la muchii, constatate la punerea în operă (PV constatare nr. 12)"},
   {"d":98,"k":"close","order":"O16"},
   {"d":98,"k":"accept_return","order":"W1","lots":{"I_PAVELE":"L_PAV_GARANTIE"}},
   {"d":98,"k":"block","lot":"L_PAV_GARANTIE","reason":"Pavele fisurate returnate în garanție - nu se reintroduc la vânzare, se direcționează la concasare"},
   {"d":99,"k":"send","order":"W1_REPL"},
   {"d":99,"k":"accept","order":"W1_REPL"},
   {"d":100,"k":"plan","order":"W1_REPL","sd":101,"decl":"declared"},
   {"d":100,"k":"lot","item":"I_MOLOZ","qty":650,"prov":"purchase","src":"Aviz DR-1207 - Demolări Rapid SRL (demolare hală, Str. Industriilor, Chiajna)","loc":"Platforma recepție deșeuri"},
   {"d":101,"k":"deliver","order":"W1_REPL"},
   {"d":102,"k":"close","order":"W1_REPL"},
   {"d":103,"k":"proc","type":"input_fixed","out":"I_BALAST","recipe":"R_CERAMIC","notes":"Concasare deșeu ceramic - avize ED-347 (rest) și ED-402",
    "in":[["I_CERAMIC",170]],"outs":[["I_BALAST",150,"recycling"]]},
   {"d":105,"k":"proc","type":"input_fixed","out":"I_AGR04","recipe":"R_MOLOZ","notes":"Concasare și sortare moloz - avize DR-1143 (rest) și DR-1207",
    "in":[["I_MOLOZ",700]],"outs":[["I_AGR04",280,"recycling"],["I_AGR416",210,"recycling"],["I_AGR1631",150,"recycling"]]},
   {"d":107,"k":"order","key":"O17","client":"C_DRUMURI","addr":"A_DRUMURI_DJ606","dd":110,"lines":[["I_AGR1631",150],["I_BALAST",100],["I_AGR416",80]]},
   {"d":108,"k":"accept","order":"O17"},
   {"d":108,"k":"plan","order":"O17","sd":110,"decl":"declared"},
   {"d":109,"k":"proc","type":"output_fixed","out":"I_BORDURI","recipe":"R_BORDURI","notes":"Șarjă borduri #3",
    "in":[["I_AGR416",60],["I_AGR04",36],["I_CIMENT",24]],"outs":[["I_BORDURI",120,"internal_production"]]},
   {"d":110,"k":"deliver","order":"O17"},
   {"d":111,"k":"proc","type":"output_fixed","out":"I_BETON","recipe":"R_BETON","notes":"Stație betoane - șarjă C16/20 #3",
    "in":[["I_AGR416",36],["I_AGR04",24],["I_CIMENT",12],["I_NISIP",8]],"outs":[["I_BETON",80,"internal_production"]]},
   {"d":112,"k":"close","order":"O17"},
   {"d":113,"k":"order","key":"O18","client":"C_BRAVO","by":"U_BRAVO","addr":"A_BRAVO_PIPERA","dd":116,"lines":[["I_BETON",45],["I_BORDURI",60],["I_PAVELE",50],["I_PALET",50]]},
   {"d":114,"k":"accept","order":"O18"},
   {"d":114,"k":"plan","order":"O18","sd":116,"decl":"declared"},
   {"d":115,"k":"return","key":"RT2","original":"O13","type":"return","by":"U_DRUMURI","lines":[["I_AGR1631",12]],"notes":"Retur material neutilizat - surplus la stratul de fundație, tronson 2"},
   {"d":116,"k":"deliver","order":"O18"},
   {"d":117,"k":"accept_return","order":"RT2"},
   {"d":118,"k":"close","order":"O18"},
   {"d":119,"k":"order","key":"O19","client":"C_VERESTI","addr":"A_VERESTI_CENTRU","dd":122,"lines":[["I_PAVELE",70],["I_BORDURI",40],["I_PALET",40]],"notes":"Contract de achiziție publică nr. 118/2026 - tranșa a III-a"},
   {"d":120,"k":"accept","order":"O19"},
   {"d":120,"k":"lot","item":"I_CIMENT","qty":90,"prov":"purchase","src":"Factura CM-6120 - achiziție ciment CEM II","loc":"Siloz 2"},
   {"d":121,"k":"plan","order":"O19","sd":122,"decl":"declared"},
   {"d":122,"k":"deliver","order":"O19"},
   {"d":122,"k":"lot","item":"I_NISIP","qty":120,"prov":"purchase","src":"Factura BN-331 - Balastiera Olt","loc":"Depozit agregate"},
   {"d":124,"k":"close","order":"O19"},
   {"d":125,"k":"order","key":"O20","client":"C_EDILAMO","addr":"A_EDILAMO_DEP","dd":127,"lines":[["I_AGR04",80],["I_BALAST",50]]},
   {"d":126,"k":"accept","order":"O20"},
   {"d":126,"k":"plan","order":"O20","sd":127,"decl":"declared"},
   {"d":127,"k":"deliver","order":"O20"},
   {"d":128,"k":"proc","type":"output_fixed","out":"I_BLOCURI","recipe":"R_BLOCURI","notes":"Șarjă blocuri zidărie #3",
    "in":[["I_AGR04",64],["I_BALAST",48],["I_CIMENT",24]],"outs":[["I_BLOCURI",160,"internal_production"]]},
   {"d":129,"k":"close","order":"O20"},
   {"d":130,"k":"lot","item":"I_MOLOZ","qty":480,"prov":"purchase","src":"Aviz DR-1266 - Demolări Rapid SRL (demolare școală veche, Mogoșoaia)","loc":"Platforma recepție deșeuri"},
   {"d":131,"k":"lot","key":"L_MOLOZ_SUSPECT","item":"I_MOLOZ","qty":45,"prov":"purchase","q":"failed","src":"Aviz RB-044 - Recon Build SRL (livrare ocazională)","loc":"Zona de carantină"},
   {"d":131,"k":"block","lot":"L_MOLOZ_SUSPECT","reason":"Suspiciune de plăci din fibrociment (azbest) în lot - interzis la procesare până la buletinul de analiză"},
   {"d":133,"k":"order","key":"O21","client":"C_TUDOR","addr":"A_TUDOR_SNAGOV","dd":135,"lines":[["I_BLOCURI",25],["I_BETON",6]]},
   {"d":134,"k":"accept","order":"O21"},
   {"d":134,"k":"plan","order":"O21","sd":135,"decl":"declared"},
   {"d":135,"k":"deliver","order":"O21"},
   {"d":137,"k":"close","order":"O21"},
   {"d":138,"k":"return","key":"RT3","original":"O19","type":"return","lines":[["I_PALET",36]],"notes":"Retur paleți EURO după descărcare - 4 paleți rămași la beneficiar"},
   {"d":139,"k":"accept_return","order":"RT3","lots":{"I_PALET":"L_PAL_RET"}},
   {"d":140,"k":"proc","type":"input_fixed","out":"I_AGR04","recipe":"R_MOLOZ","notes":"Concasare și sortare moloz - avize DR-1207 (rest) și DR-1266",
    "in":[["I_MOLOZ",600]],"outs":[["I_AGR04",240,"recycling"],["I_AGR416",180,"recycling"],["I_AGR1631",130,"recycling"]]},
   {"d":141,"k":"proc","type":"input_fixed","out":"I_PALET","notes":"Recondiționare paleți returnați: înlocuire scânduri, remarcare - 4 paleți casați",
    "in":[["I_PALET",36,["L_PAL_RET"]]],"outs":[["I_PALET",32,"reconditioning"]]},
   {"d":143,"k":"order","key":"O22","client":"C_ARCADA","by":"U_ARCADA","addr":"A_ARCADA_SUD","dd":147,"lines":[["I_PAVELE",60],["I_BORDURI",50],["I_BLOCURI",80]],"notes":"Etapa II - blocurile D1 și D2"},
   {"d":144,"k":"accept","order":"O22"},
   {"d":145,"k":"plan","order":"O22","sd":147,"decl":"declared"},
   {"d":146,"k":"proc","type":"output_fixed","out":"I_PAVELE","recipe":"R_PAVELE","notes":"Șarjă pavele eco #4",
    "in":[["I_AGR04",99],["I_NISIP",55],["I_CIMENT",33]],"outs":[["I_PAVELE",220,"internal_production"]]},
   {"d":147,"k":"deliver","order":"O22"},
   {"d":149,"k":"close","order":"O22"},
   {"d":150,"k":"return","key":"RT_R2","original":"R2","type":"return","lines":[["I_COFRAJ",70],["I_CONTAINER",6]],"notes":"Returnare echipamente - închirierea Snagov Lac s-a încheiat"},
   {"d":151,"k":"accept_return","order":"RT_R2","lots":{"I_COFRAJ":"L_COF_RET2"}},
   {"d":152,"k":"close","order":"R2"},
   {"d":153,"k":"proc","type":"input_fixed","out":"I_COFRAJ","notes":"Recondiționare panouri cofraj returnate (Snagov): curățare, îndreptare - 3 panouri casate",
    "in":[["I_COFRAJ",70,["L_COF_RET2"]]],"outs":[["I_COFRAJ",67,"reconditioning"]]}
  ]'::jsonb
  -- August-septembrie: activitate curenta - comenzi in toate stadiile, inchirieri active
  || '[
   {"d":155,"k":"lot","item":"I_MOLOZ","qty":560,"prov":"purchase","src":"Aviz DR-1302 - Demolări Rapid SRL (demolare parcare supraetajată, Otopeni)","loc":"Platforma recepție deșeuri"},
   {"d":156,"k":"lot","item":"I_CIMENT","qty":80,"prov":"purchase","src":"Factura CM-6288 - achiziție ciment CEM II","loc":"Siloz 1"},
   {"d":157,"k":"lot","item":"I_CERAMIC","qty":120,"prov":"purchase","src":"Aviz ED-455 - Edilamo Trading SRL","loc":"Platforma recepție deșeuri"},
   {"d":158,"k":"order","key":"O23","client":"C_DRUMURI","by":"U_DRUMURI","addr":"A_DRUMURI_DJ606","dd":161,"lines":[["I_AGR1631",140],["I_AGR416",90]]},
   {"d":159,"k":"accept","order":"O23"},
   {"d":159,"k":"plan","order":"O23","sd":161,"decl":"declared"},
   {"d":160,"k":"proc","type":"output_fixed","out":"I_BORDURI","recipe":"R_BORDURI","notes":"Șarjă borduri #4",
    "in":[["I_AGR416",55],["I_AGR04",33],["I_CIMENT",22]],"outs":[["I_BORDURI",110,"internal_production"]]},
   {"d":161,"k":"deliver","order":"O23"},
   {"d":162,"k":"order","key":"R3","client":"C_CASAVERDE","addr":"A_CV_CORBEANCA","dd":164,"ret":224,"lines":[["I_COFRAJ",50],["I_CONTAINER",5]],"notes":"Închiriere cofraje - Corbeanca etapa II, 60 de zile"},
   {"d":163,"k":"close","order":"O23"},
   {"d":163,"k":"accept","order":"R3"},
   {"d":163,"k":"plan","order":"R3","sd":164,"decl":"declared"},
   {"d":164,"k":"deliver","order":"R3"},
   {"d":164,"k":"order","key":"R4","client":"C_BRAVO","addr":"A_BRAVO_PIPERA","dd":165,"ret":176,"lines":[["I_CONTAINER",3]],"notes":"Închiriere containere moloz - șantier Pipera, 12 zile"},
   {"d":164,"k":"accept","order":"R4"},
   {"d":164,"k":"plan","order":"R4","sd":165,"decl":"declared"},
   {"d":165,"k":"deliver","order":"R4"},
   {"d":166,"k":"proc","type":"input_fixed","out":"I_AGR04","recipe":"R_MOLOZ","notes":"Concasare și sortare moloz - avize DR-1266 (rest), inventar 05 și DR-1302",
    "in":[["I_MOLOZ",520]],"outs":[["I_AGR04",210,"recycling"],["I_AGR416",160,"recycling"],["I_AGR1631",110,"recycling"]]},
   {"d":167,"k":"proc","type":"input_fixed","out":"I_BALAST","recipe":"R_CERAMIC","notes":"Concasare deșeu ceramic - avize ED-402 (rest) și ED-455",
    "in":[["I_CERAMIC",115]],"outs":[["I_BALAST",100,"recycling"]]},
   {"d":168,"k":"order","key":"O24","client":"C_BRAVO","addr":"A_BRAVO_MILITARI","dd":171,"lines":[["I_PAVELE",90],["I_BORDURI",45],["I_PALET",60]],"notes":"Amenajări exterioare Militari Residence - etapa finală"},
   {"d":169,"k":"accept","order":"O24"},
   {"d":169,"k":"plan","order":"O24","sd":171,"decl":"declared"},
   {"d":170,"k":"order","key":"O25","client":"C_VERESTI","addr":"A_VERESTI_CENTRU","dd":174,"lines":[["I_PAVELE",40],["I_BLOCURI",30]],"notes":"Act adițional 1 la contractul nr. 118/2026"},
   {"d":171,"k":"deliver","order":"O24"},
   {"d":171,"k":"accept","order":"O25"},
   {"d":171,"k":"order","key":"O26","client":"C_EDILAMO","addr":"A_EDILAMO_DEP","dd":173,"lines":[["I_AGR04",60],["I_BALAST",40],["I_AGR416",50]]},
   {"d":172,"k":"plan","order":"O25","sd":174,"decl":"declared"},
   {"d":172,"k":"accept","order":"O26"},
   {"d":172,"k":"plan","order":"O26","sd":173,"decl":"declared"},
   {"d":173,"k":"close","order":"O24"},
   {"d":173,"k":"deliver","order":"O26"},
   {"d":173,"k":"order","key":"O27","client":"C_ARCADA","by":"U_ARCADA","addr":"A_ARCADA_SUD","dd":177,"lines":[["I_BLOCURI",50],["I_BETON",20]]},
   {"d":174,"k":"deliver","order":"O25"},
   {"d":174,"k":"accept","order":"O27"},
   {"d":174,"k":"proc","type":"output_fixed","out":"I_BETON","recipe":"R_BETON","notes":"Stație betoane - șarjă C16/20 #4",
    "in":[["I_AGR416",27],["I_AGR04",18],["I_CIMENT",9],["I_NISIP",6]],"outs":[["I_BETON",60,"internal_production"]]},
   {"d":175,"k":"plan","order":"O27","sd":177,"decl":"declared"},
   {"d":175,"k":"order","key":"O28","client":"C_DRUMURI","by":"U_DRUMURI","addr":"A_DRUMURI_DJ606","dd":178,"lines":[["I_AGR1631",100],["I_BALAST",50]]},
   {"d":176,"k":"close","order":"O25"},
   {"d":176,"k":"accept","order":"O28"},
   {"d":176,"k":"plan","order":"O28","sd":178,"decl":"declared"},
   {"d":176,"k":"order","key":"O29","client":"C_TUDOR","addr":"A_TUDOR_SNAGOV","dd":179,"lines":[["I_BETON",10]],"notes":"Placă peste parter"},
   {"d":176,"k":"proc","type":"input_fixed","out":"I_AGR04","recipe":"R_MOLOZ","notes":"Concasare parțială aviz DR-1302 - șarjă de 100 t",
    "in":[["I_MOLOZ",100]],"outs":[["I_AGR04",40,"recycling"],["I_AGR416",28,"recycling"],["I_AGR1631",22,"recycling"]]},
   {"d":177,"k":"deliver","order":"O27"},
   {"d":177,"k":"return","key":"RT4","original":"O24","type":"return","lines":[["I_PALET",55]],"notes":"Retur paleți EURO de pe șantierul Militari Residence - 5 paleți rămași la beneficiar"},
   {"d":179,"k":"accept_return","order":"RT4"},
   {"d":177,"k":"accept","order":"O29"},
   {"d":177,"k":"order","key":"O30","client":"C_CASAVERDE","addr":"A_CV_CORBEANCA","dd":184,"lines":[["I_PAVELE",35],["I_BORDURI",20]]},
   {"d":178,"k":"deliver","order":"O28"},
   {"d":178,"k":"plan","order":"O29","sd":179,"decl":"failed"},
   {"d":178,"k":"accept","order":"O30"},
   {"d":178,"k":"order","key":"O31","client":"C_BRAVO","by":"U_BRAVO","addr":"A_BRAVO_PIPERA","dd":183,"lines":[["I_AGR04",25],["I_PAVELE",40]]},
   {"d":179,"k":"plan","order":"O30","sd":184,"decl":"not_declared"},
   {"d":179,"k":"order","key":"O36","client":"C_EDILAMO","addr":"A_EDILAMO_DEP","dd":182,"lines":[["I_AGR416",30]]},
   {"d":179,"k":"accept","order":"O36"},
   {"d":179,"k":"proc_open","status":"in_progress","out":"I_PAVELE","recipe":"R_PAVELE","notes":"Șarjă pavele eco #5 - pentru comenzile Casa Verde și Bravo (în lucru pe presă)"},
   {"d":180,"k":"accept","order":"O31"},
   {"d":180,"k":"cancel","order":"O36","notes":"Anulată la cererea clientului - transportul propriu nu mai este disponibil"},
   {"d":180,"k":"proc_open","status":"awaiting_confirmation","out":"I_BETON","recipe":"R_BETON","notes":"Șarjă C16/20 de 9 mc - în așteptarea buletinului de rezistență la 7 zile"},
   {"d":180,"k":"proc_open","status":"cancelled","out":"I_BLOCURI","recipe":"R_BLOCURI","notes":"Șarjă blocuri #4 - anulată: cimentul disponibil a fost alocat bordurilor"},
   {"d":181,"k":"proc_open","status":"planned","out":"I_AGR04","recipe":"R_MOLOZ","notes":"Concasare rest aviz DR-1302 (aprox. 50 t) - programată săptămâna viitoare"},
   {"d":181,"k":"order","key":"O32","client":"C_ARCADA","by":"U_ARCADA","addr":"A_ARCADA_SUD","dd":186,"lines":[["I_PAVELE",30],["I_BORDURI",20]],"notes":"Etapa II - spații verzi"},
   {"d":181,"k":"order","key":"O33","client":"C_DRUMURI","by":"U_DRUMURI","addr":"A_DRUMURI_DJ606","dd":185,"lines":[["I_AGR1631",80]]},
   {"d":181,"k":"order","key":"O34","client":"C_VERESTI","addr":"A_VERESTI_CENTRU","send":false,"lines":[["I_BLOCURI",20]],"notes":"Ofertă în lucru - în așteptarea aprobării bugetului local"},
   {"d":181,"k":"order","key":"O35","client":"C_BRAVO","by":"U_BRAVO","addr":"A_BRAVO_MILITARI","send":false,"lines":[["I_BETON",15]]}
  ]'::jsonb;

  for e in
    select x.value as j, x.ord
    from jsonb_array_elements(v_events) with ordinality as x(value, ord)
    order by (x.value ->> 'd')::int, x.ord
  loop
    j := e.j;
    v_day := (j ->> 'd')::int;
    if v_day <> v_prev_day then v_seq := 0; v_prev_day := v_day; end if;
    v_seq := v_seq + 1;
    v_ts := (v_start + v_day)::timestamp + interval '6 hours 40 minutes' + v_seq * interval '23 minutes';

    begin
      case j ->> 'k'

      -- Receptie stoc (Stoc -> Intrare lot)
      when 'lot' then
        v_actor := pg_temp.idof(v_ids, coalesce(j ->> 'by', 'U_OP'));
        v_id2 := pg_temp.idof(v_ids, j ->> 'item');
        perform pg_temp.become(v_actor);
        select (public.create_lot(
          p_item_id => v_id2, p_quantity => (j ->> 'qty')::numeric,
          p_provenance => (j ->> 'prov')::public.lot_provenance, p_source => j ->> 'src',
          p_entry_date => v_ts::date, p_location => j ->> 'loc',
          p_quality_status => coalesce(j ->> 'q', 'passed')::public.quality_status,
          p_reason => case when j ->> 'prov' = 'inventory_adjustment' then 'Ajustare inventar' else 'Recepție lot' end
        )).id into v_id;
        execute 'reset role';
        if j ? 'key' then v_ids := v_ids || jsonb_build_object(j ->> 'key', v_id); end if;

      when 'block' then
        v_id := pg_temp.idof(v_ids, j ->> 'lot');
        perform pg_temp.become(pg_temp.idof(v_ids, 'U_OP'));
        perform public.set_lot_block(v_id, true, j ->> 'reason');
        execute 'reset role';

      when 'adjust' then
        v_id2 := pg_temp.idof(v_ids, j ->> 'item');
        perform pg_temp.become(pg_temp.idof(v_ids, 'U_OP'));
        perform public.consume_fifo(
          p_item_id => v_id2, p_qty => (j ->> 'qty')::numeric, p_manual_lot_ids => null,
          p_event_type => 'adjustment', p_order_id => null, p_process_id => null, p_reason => j ->> 'reason'
        );
        execute 'reset role';

      -- Productie / reciclare / recondiționare (wizard-ul din /productie)
      when 'proc' then
        v_inputs := '[]'::jsonb;
        for l in select value from jsonb_array_elements(j -> 'in') loop
          v_inputs := v_inputs || jsonb_build_array(jsonb_build_object(
            'item_id', pg_temp.idof(v_ids, l ->> 0),
            'qty', (l ->> 1)::numeric,
            'lot_ids', case when jsonb_array_length(l) > 2
              then (select jsonb_agg(pg_temp.idof(v_ids, k)) from jsonb_array_elements_text(l -> 2) as k)
              else null end
          ));
        end loop;
        v_outputs := '[]'::jsonb;
        for l in select value from jsonb_array_elements(j -> 'outs') loop
          v_outputs := v_outputs || jsonb_build_array(jsonb_build_object(
            'item_id', pg_temp.idof(v_ids, l ->> 0),
            'qty', (l ->> 1)::numeric,
            'provenance', l ->> 2,
            'source', j ->> 'notes',
            'location', case when l ->> 0 in ('I_COFRAJ', 'I_CONTAINER', 'I_PALET') then 'Hala echipamente'
                             when l ->> 2 = 'internal_production' then 'Depozit produse finite'
                             else 'Depozit agregate' end,
            'quality_status', 'passed'
          ));
        end loop;
        v_id2 := pg_temp.idof(v_ids, j ->> 'out');
        v_id := case when j ? 'recipe' then pg_temp.idof(v_ids, j ->> 'recipe') end;
        perform pg_temp.become(pg_temp.idof(v_ids, 'U_PROD'));
        perform public.confirm_process(
          p_type => (j ->> 'type')::public.process_type, p_output_item_id => v_id2,
          p_recipe_id => v_id, p_notes => j ->> 'notes', p_inputs => v_inputs, p_outputs => v_outputs
        );
        execute 'reset role';

      -- Procese nefinalizate: nu misca stocul (confirm_process creeaza doar procese
      -- `completed`); cel anulat trece prin RPC-ul real `cancel_process`.
      when 'proc_open' then
        insert into public.processes (organization_id, type, status, output_item_id, recipe_id, notes,
                                      started_at, created_by, created_at, updated_at)
        values (v_org, 'output_fixed',
                case when j ->> 'status' = 'cancelled' then 'planned' else j ->> 'status' end::public.process_status,
                pg_temp.idof(v_ids, j ->> 'out'), pg_temp.idof(v_ids, j ->> 'recipe'), j ->> 'notes',
                case when j ->> 'status' in ('in_progress', 'awaiting_confirmation') then v_ts end,
                pg_temp.idof(v_ids, 'U_PROD'), v_ts, v_ts)
        returning id into v_id;
        if j ->> 'status' = 'cancelled' then
          perform pg_temp.become(pg_temp.idof(v_ids, 'U_PROD'));
          perform public.cancel_process(v_id);
          execute 'reset role';
        end if;

      -- Comanda noua (draft) + trimitere (numar alocat prin RPC, ca in UI)
      when 'order' then
        v_actor := pg_temp.idof(v_ids, coalesce(j ->> 'by', 'U_ADMIN'));
        v_is_client := coalesce(j ->> 'by', '') like 'U\_%' and j ->> 'by' not in ('U_ADMIN', 'U_OP', 'U_PROD');
        insert into public.orders (organization_id, client_id, status, created_by_admin, delivery_address_id,
                                   delivery_date, expected_return_date, notes, created_by, created_at, updated_at)
        values (v_org, pg_temp.idof(v_ids, j ->> 'client'), 'draft', not v_is_client,
                case when j ? 'addr' then pg_temp.idof(v_ids, j ->> 'addr') end,
                case when j ? 'dd' then v_start + (j ->> 'dd')::int end,
                case when j ? 'ret' then v_start + (j ->> 'ret')::int end,
                j ->> 'notes', v_actor, v_ts, v_ts)
        returning id into v_id;
        for l in select value from jsonb_array_elements(j -> 'lines') loop
          insert into public.order_items (organization_id, order_id, item_id, quantity, created_at, updated_at)
          values (v_org, v_id, pg_temp.idof(v_ids, l ->> 0), (l ->> 1)::numeric, v_ts, v_ts);
        end loop;
        v_ids := v_ids || jsonb_build_object(j ->> 'key', v_id, (j ->> 'key') || '_BY', v_actor);
        if coalesce((j ->> 'send')::boolean, true) then
          perform pg_temp.become(v_actor);
          v_num := public.generate_order_number(v_org);
          execute 'reset role';
          update public.orders set status = 'sent', order_number = v_num, updated_at = v_ts where id = v_id;
        end if;

      when 'send' then
        v_id := pg_temp.idof(v_ids, j ->> 'order');
        perform pg_temp.become(pg_temp.idof(v_ids, 'U_ADMIN'));
        v_num := public.generate_order_number(v_org);
        execute 'reset role';
        update public.orders set status = 'sent', order_number = v_num, updated_at = v_ts
        where id = v_id and status = 'draft';
        get diagnostics v_rows = row_count;
        if v_rows <> 1 then raise exception 'send: comanda % nu e draft', j ->> 'order'; end if;

      when 'accept' then
        v_id := pg_temp.idof(v_ids, j ->> 'order');
        perform pg_temp.become(pg_temp.idof(v_ids, coalesce(j ->> 'by', 'U_OP')));
        perform public.accept_order(v_id);
        execute 'reset role';
        update public.orders set accepted_at = v_ts, updated_at = v_ts where id = v_id;

      -- Planificare livrare + declarare e-Transport (UIT identic cu MockETransportProvider)
      when 'plan' then
        v_id := pg_temp.idof(v_ids, j ->> 'order');
        insert into public.deliveries (organization_id, order_id, scheduled_date, carrier_name, vehicle_plate,
                                       driver_name, route_origin, route_destination, created_by, created_at, updated_at)
        select v_org, o.id, v_start + (j ->> 'sd')::int,
               (array['Beton Circular - flotă proprie', 'Trans Agregate Logistic SRL', 'Rapid Cargo Ilfov SRL'])[1 + (abs(hashtext(o.id::text)) % 3)],
               (array['IF-27-BCR', 'IF-31-BCR', 'B-208-TAL', 'IF-09-RCI', 'B-714-TAL'])[1 + (abs(hashtext(o.id::text || 'p')) % 5)],
               (array['Gheorghe Ionescu', 'Marian Vlad', 'Cristian Neagu', 'Florin Dobre'])[1 + (abs(hashtext(o.id::text || 'd')) % 4)],
               c_depot, coalesce(a.address, c.hq_address, '-'),
               pg_temp.idof(v_ids, 'U_OP'), v_ts, v_ts
        from public.orders o
        join public.clients c on c.id = o.client_id
        left join public.client_addresses a on a.id = o.delivery_address_id
        where o.id = v_id
        returning id into v_id2;
        if j ->> 'decl' = 'declared' then
          update public.deliveries
          set uit_code = 'MOCK-UIT-' || upper(left(encode(sha256(convert_to(id::text, 'UTF8')), 'hex'), 10)),
              declaration_status = 'declared', updated_at = v_ts + interval '12 minutes'
          where id = v_id2;
        elsif j ->> 'decl' = 'failed' then
          update public.deliveries
          set declaration_status = 'failed', updated_at = v_ts + interval '12 minutes',
              declaration_error = 'Nu am putut contacta Socrate.io.'
          where id = v_id2;
        end if;

      when 'deliver' then
        v_id := pg_temp.idof(v_ids, j ->> 'order');
        update public.orders set status = 'delivered', delivered_at = v_ts, updated_at = v_ts
        where id = v_id and status = 'accepted';
        get diagnostics v_rows = row_count;
        if v_rows <> 1 then raise exception 'deliver: comanda % nu e acceptata', j ->> 'order'; end if;

      when 'close' then
        v_id := pg_temp.idof(v_ids, j ->> 'order');
        update public.orders set status = 'closed', closed_at = v_ts, updated_at = v_ts
        where id = v_id and status = 'delivered';
        get diagnostics v_rows = row_count;
        if v_rows <> 1 then raise exception 'close: comanda % nu e livrata', j ->> 'order'; end if;

      when 'cancel' then
        v_id := pg_temp.idof(v_ids, j ->> 'order');
        perform pg_temp.become(pg_temp.idof(v_ids, coalesce(j ->> 'by', 'U_ADMIN')));
        perform public.cancel_order(v_id);
        execute 'reset role';
        update public.orders
        set updated_at = v_ts, notes = coalesce(notes || E'\n', '') || (j ->> 'notes')
        where id = v_id;

      -- Retur / garantie (Task F): comanda-retur draft + legatura; la garantie si
      -- comanda de inlocuire draft (exact ca returns/service.ts#createReturnOrder).
      when 'return' then
        v_actor := pg_temp.idof(v_ids, coalesce(j ->> 'by', 'U_ADMIN'));
        v_is_client := coalesce(j ->> 'by', '') not in ('', 'U_ADMIN', 'U_OP', 'U_PROD');
        v_id2 := pg_temp.idof(v_ids, j ->> 'original');
        insert into public.orders (organization_id, client_id, status, created_by_admin, notes, created_by, created_at, updated_at)
        select v_org, client_id, 'draft', not v_is_client, j ->> 'notes', v_actor, v_ts, v_ts
        from public.orders where id = v_id2
        returning id into v_id;
        for l in select value from jsonb_array_elements(j -> 'lines') loop
          insert into public.order_items (organization_id, order_id, item_id, quantity, created_at, updated_at)
          values (v_org, v_id, pg_temp.idof(v_ids, l ->> 0), (l ->> 1)::numeric, v_ts, v_ts);
        end loop;
        insert into public.order_links (organization_id, link_type, original_order_id, linked_order_id, created_at)
        values (v_org, (j ->> 'type')::public.order_link_type, v_id2, v_id, v_ts);
        v_ids := v_ids || jsonb_build_object(j ->> 'key', v_id);

        if j ->> 'type' = 'warranty' then
          insert into public.orders (organization_id, client_id, status, created_by_admin, notes, created_by,
                                     delivery_address_id, created_at, updated_at)
          select v_org, client_id, 'draft', not v_is_client,
                 'Comandă de înlocuire (garanție) pentru ' || coalesce(order_number, id::text),
                 v_actor, delivery_address_id, v_ts, v_ts
          from public.orders where id = v_id2
          returning id into v_id;
          for l in select value from jsonb_array_elements(j -> 'lines') loop
            insert into public.order_items (organization_id, order_id, item_id, quantity, created_at, updated_at)
            values (v_org, v_id, pg_temp.idof(v_ids, l ->> 0), (l ->> 1)::numeric, v_ts, v_ts);
          end loop;
          insert into public.order_links (organization_id, link_type, original_order_id, linked_order_id, created_at)
          values (v_org, 'replacement', v_id2, v_id, v_ts);
          v_ids := v_ids || jsonb_build_object((j ->> 'key') || '_REPL', v_id);
        end if;

      when 'accept_return' then
        v_id := pg_temp.idof(v_ids, j ->> 'order');
        perform pg_temp.become(pg_temp.idof(v_ids, 'U_OP'));
        perform public.accept_return_order(v_id);
        execute 'reset role';
        update public.orders set updated_at = v_ts where id = v_id;
        -- Loturile create acum (created_at = now() pana la stampilare) - retinute pt.
        -- evenimente ulterioare (blocare, recondiționare cu selectie manuala de lot).
        if j ? 'lots' then
          for l in select jsonb_build_array(key, value) from jsonb_each_text(j -> 'lots') loop
            select id into v_id2 from public.lots
            where organization_id = v_org and provenance = 'return' and created_at = now()
              and item_id = pg_temp.idof(v_ids, l ->> 0);
            if v_id2 is null then raise exception 'accept_return: lotul de retur % negasit', l ->> 0; end if;
            v_ids := v_ids || jsonb_build_object(l ->> 1, v_id2);
          end loop;
        end if;

      else
        raise exception 'Tip de eveniment necunoscut: %', j ->> 'k';
      end case;
    exception when others then
      raise exception 'Evenimentul demo #% (ziua %) a esuat: % | %', e.ord, v_day, sqlerrm, j::text;
    end;

    -- Stampilare: tot ce a scris evenimentul are created_at = now() (aceeasi valoare
    -- pe toata tranzactia) -> il mutam la momentul simulat al evenimentului.
    update public.lots set created_at = v_ts, updated_at = v_ts, entry_date = v_ts::date
    where organization_id = v_org and created_at = now();
    update public.stock_events set created_at = v_ts
    where organization_id = v_org and created_at = now();
    update public.processes
    set started_at   = case when started_at = now() then v_ts - interval '2 hours 30 minutes' else started_at end,
        completed_at = case when completed_at = now() then v_ts else completed_at end,
        created_at   = case when created_at = now() then v_ts - interval '2 hours 30 minutes' else created_at end,
        updated_at   = v_ts
    where organization_id = v_org and (created_at = now() or updated_at = now());
    update public.process_inputs set created_at = v_ts where organization_id = v_org and created_at = now();
    update public.process_outputs set created_at = v_ts where organization_id = v_org and created_at = now();
    update public.orders set updated_at = v_ts where organization_id = v_org and updated_at = now();
  end loop;

  alter table public.orders     enable trigger orders_touch_updated_at;
  alter table public.lots       enable trigger lots_touch_updated_at;
  alter table public.processes  enable trigger processes_touch_updated_at;
  alter table public.deliveries enable trigger deliveries_touch_updated_at;

  -- ---------------------------------------------------------------------------
  -- 4. Verificari de consistenta (esueaza => rollback)
  -- ---------------------------------------------------------------------------
  if exists (
    select 1 from public.lots l
    where l.organization_id = v_org
      and l.remaining_qty <> (select coalesce(sum(se.quantity), 0) from public.stock_events se
                              where se.lot_id = l.id and se.event_type in ('intake', 'consumption', 'adjustment', 'reversal'))
  ) then
    raise exception 'Verificare esuata: remaining_qty nu corespunde evenimentelor de stoc.';
  end if;
  if exists (select 1 from public.stock_events where organization_id = v_org and created_at > now() - interval '1 hour') then
    raise exception 'Verificare esuata: au ramas evenimente de stoc nestampilate.';
  end if;

  raise notice 'Demo creat: organizatia % (%), % comenzi, % loturi, % procese, % livrari.',
    c_slug, v_org,
    (select count(*) from public.orders where organization_id = v_org),
    (select count(*) from public.lots where organization_id = v_org),
    (select count(*) from public.processes where organization_id = v_org),
    (select count(*) from public.deliveries where organization_id = v_org);
end $$;
