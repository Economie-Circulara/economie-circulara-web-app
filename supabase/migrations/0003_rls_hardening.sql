-- =============================================================================
-- 0003 — Intarire RLS: anti-escaladare privilegii + politici client pe status
-- =============================================================================
-- Migrare aditiva (nu se editeaza 0001/0002). Inchide doua gauri de securitate
-- confirmate in modelul RLS din 0001:
--
--   GAURA 1 (escaladare privilegii pe profiles):
--     Politicile `profiles_update` / `profiles_insert` verifica doar
--     `app.is_admin_of(organization_id)`. Un admin de organizatie putea, prin
--     Data API, sa isi seteze singur `role = 'super_admin'` (sau sa mute profilul
--     in alta organizatie / la alt client), respectiv sa creeze un profil
--     `super_admin` pentru un rand orfan din `auth.users`. RLS nu poate opri
--     modificarea unei coloane sensibile in randul propriu -> folosim un trigger.
--
--   GAURA 2 (client cu drept nelimitat de scriere pe comenzi):
--     `orders_client_all` / `order_items_client_all` sunt politici FOR ALL. Un
--     client cu acces direct la PostgREST putea modifica/sterge o comanda DUPA
--     acceptare (stocul se scade la acceptare - vezi AGENTS.md §4), corupand
--     contabilitatea de stoc si trasabilitatea. Le inlocuim cu politici constiente
--     de status (masina de stari: draft, sent, accepted, delivered, closed, cancelled).
--
-- Politicile de staff raman neatinse.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. GAURA 1 — trigger anti-escaladare pe public.profiles
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER + search_path gol (toate referintele sunt calificate complet),
-- in stilul lui app.touch_updated_at() din 0001.
--
-- Se aplica DOAR cand exista un apelant autentificat (auth.uid() not null) care NU
-- este super_admin. Contextele de serviciu (seed-uri, service_role, auth admin,
-- migrari) au auth.uid() null si trec neatinse — la fel super_admin-ul, care are
-- voie sa administreze roluri/tenant.
--
-- Ridica exceptia cu errcode `insufficient_privilege` (42501), acelasi cod ca o
-- violare de politica RLS, ca sa fie prins uniform cu politicile din 0001.
create or replace function app.enforce_profile_security()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Contexte de serviciu si super_admin: fara restrictii.
  if auth.uid() is null or app.is_super_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Un admin de organizatie nu poate crea un profil de super_admin.
    if new.role = 'super_admin' then
      raise exception
        'escaladare de privilegii blocata: nu se poate crea un profil super_admin'
        using errcode = 'insufficient_privilege';
    end if;
  elsif tg_op = 'UPDATE' then
    -- Coloanele sensibile (rol / tenant / legatura de client) nu pot fi schimbate
    -- de un non-super_admin, nici macar pe propriul rand.
    if new.role is distinct from old.role
       or new.organization_id is distinct from old.organization_id
       or new.client_id is distinct from old.client_id then
      raise exception
        'escaladare de privilegii blocata: role/organization_id/client_id nu pot fi modificate'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_enforce_security
  before insert or update on public.profiles
  for each row execute function app.enforce_profile_security();

-- -----------------------------------------------------------------------------
-- 2. GAURA 2 — politici client pe comenzi, constiente de status
-- -----------------------------------------------------------------------------
-- Inlocuim politicile FOR ALL cu politici per-operatie. Clientul poate:
--   SELECT  — propriile comenzi, in orice status;
--   INSERT  — doar cu propriul client_id + propria organizatie, status draft/sent;
--   UPDATE  — doar cat timp comanda e draft/sent; poate trece la 'cancelled'
--             (anulare inainte de acceptare), dar nu la alte statusuri;
--   DELETE  — doar cat timp comanda e in draft.
-- Dupa acceptare (stoc scazut) clientul nu mai poate modifica/sterge comanda.
--
-- In plus, toate WITH CHECK-urile de client pun conditia `organization_id =
-- app.org_id()` — politicile FOR ALL din 0001 verificau doar client_id, deci un
-- client putea re-punta un rand propriu catre alt tenant (organization_id strain),
-- plantand un rand corupt in listele altei organizatii.

drop policy orders_client_all on public.orders;

create policy orders_client_select on public.orders
  for select using (
    app.role() = 'client' and client_id = app.client_id()
  );

create policy orders_client_insert on public.orders
  for insert with check (
    app.role() = 'client'
    and client_id = app.client_id()
    and organization_id = app.org_id()
    and status in ('draft', 'sent')
  );

create policy orders_client_update on public.orders
  for update using (
    app.role() = 'client'
    and client_id = app.client_id()
    and status in ('draft', 'sent')
  )
  with check (
    app.role() = 'client'
    and client_id = app.client_id()
    and organization_id = app.org_id()
    and status in ('draft', 'sent', 'cancelled')
  );

create policy orders_client_delete on public.orders
  for delete using (
    app.role() = 'client'
    and client_id = app.client_id()
    and status = 'draft'
  );

-- --- order_items: scriere permisa doar cat timp comanda-parinte e draft/sent ---
drop policy order_items_client_all on public.order_items;

create policy order_items_client_select on public.order_items
  for select using (
    app.role() = 'client'
    and exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.client_id = app.client_id()
    )
  );

create policy order_items_client_insert on public.order_items
  for insert with check (
    app.role() = 'client'
    and organization_id = app.org_id()
    and exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.client_id = app.client_id()
        and o.status in ('draft', 'sent')
    )
  );

create policy order_items_client_update on public.order_items
  for update using (
    app.role() = 'client'
    and exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.client_id = app.client_id()
        and o.status in ('draft', 'sent')
    )
  )
  with check (
    app.role() = 'client'
    and organization_id = app.org_id()
    and exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.client_id = app.client_id()
        and o.status in ('draft', 'sent')
    )
  );

create policy order_items_client_delete on public.order_items
  for delete using (
    app.role() = 'client'
    and exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.client_id = app.client_id()
        and o.status in ('draft', 'sent')
    )
  );
