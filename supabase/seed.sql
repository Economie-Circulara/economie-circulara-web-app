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
