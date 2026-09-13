-- =============================================================================
-- Șterge organizația demo creată de supabase/demo/seed-demo.sql (+ conturile ei).
-- =============================================================================
-- Atinge DOAR organizația cu slug `beton-circular` și conturile @demo.lotculot.eu.
-- Fișierele din Storage (certificate PDF, documente) NU se șterg din SQL - vezi
-- supabase/demo/README.md, secțiunea "Ștergere".
-- =============================================================================

do $$
declare
  v_org uuid;
  v_users int;
begin
  select id into v_org from public.organizations where slug = 'beton-circular';

  delete from auth.users where email like '%@demo.lotculot.eu';
  get diagnostics v_users = row_count;

  if v_org is not null then
    -- Toate tabelele de business au FK `organization_id ... on delete cascade`.
    delete from public.organizations where id = v_org;
  end if;

  if exists (select 1 from public.profiles where email like '%@demo.lotculot.eu') then
    raise exception 'Au ramas profiluri demo - verifica FK-urile catre auth.users.';
  end if;

  raise notice 'Demo sters: organizatie % , % conturi.', coalesce(v_org::text, '(inexistenta)'), v_users;
end $$;
