-- =============================================================================
-- 0014 — Completare guard organizatie suspendata (F1 + F6, review 0012)
-- =============================================================================
-- Migrarea 0012 a adaugat a doua linie de aparare (RLS) pentru organizatiile
-- suspendate, dar a lasat deliberat doua goluri, documentate explicit in
-- comentariul ei de atunci:
--
--   F1a. `client_addresses_self_all` a ramas o politica `FOR ALL` nesparta pe
--        operatii (spre deosebire de orders/order_items, spart in 0003) => un
--        client al unei organizatii suspendate putea in continuare crea/edita/
--        sterge adrese de livrare direct prin Data API, ocolind guard-ul.
--   F1b. SELECT-urile clientului (orders/order_items/certificates/documents/
--        clients/items/order_links) nu cereau `app.org_is_active` => un client
--        al unei organizatii suspendate isi putea in continuare CITI comenzile,
--        certificatele si documentele proprii prin Data API (blocat doar in UI,
--        de middleware/`requireUser`).
--
-- Migrare ADITIVA (nu se editeaza 0001/0003/0012): spargem politica FOR ALL de pe
-- `client_addresses` in politici per-operatie (pattern 0003), extindem SELECT-urile
-- clientului cu `app.org_is_active` (drop+create, pattern 0012) si adaugam un index
-- de suport pentru `app.org_is_active` (F6).
--
-- NEATINS in aceasta migrare (afara scopului F1/F6):
--   - `order_links_client_insert` (adaugata in 0010_returns.sql, dupa 0012) nu cere
--     `app.org_is_active(organization_id)` — acelasi gol de scriere, dar pe un tabel
--     din domeniul `orders`, in afara scopului acestei migrari (evitam sa atingem
--     cod/politici din zona `orders` in timp ce alt task lucreaza acolo in paralel).
--     Semnalat separat pentru o migrare viitoare dedicata.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- F1a. client_addresses — sparge FOR ALL in politici per-operatie
-- -----------------------------------------------------------------------------
-- SELECT ramane cu exact aceeasi conditie ca politica veche (citirea nu produce
-- efecte de business; ramane neguardat aici, redeschis punctual la F1b mai jos
-- doar pentru tabelele explicit vizate acolo — `client_addresses` NU e in acea
-- lista, ca sa pastram schimbarea din F1a strict pe scriere, usor de revizuit).
-- INSERT/UPDATE/DELETE adauga suplimentar `app.org_is_active(organization_id)`,
-- exact ca politicile client pe orders/order_items/documents din 0012.
drop policy client_addresses_self_all on public.client_addresses;

create policy client_addresses_client_select on public.client_addresses
  for select using (
    app.role() = 'client' and client_id = app.client_id()
  );

create policy client_addresses_client_insert on public.client_addresses
  for insert with check (
    app.role() = 'client'
    and client_id = app.client_id()
    and app.org_is_active(organization_id)
  );

create policy client_addresses_client_update on public.client_addresses
  for update using (
    app.role() = 'client'
    and client_id = app.client_id()
    and app.org_is_active(organization_id)
  )
  with check (
    app.role() = 'client'
    and client_id = app.client_id()
    and app.org_is_active(organization_id)
  );

create policy client_addresses_client_delete on public.client_addresses
  for delete using (
    app.role() = 'client'
    and client_id = app.client_id()
    and app.org_is_active(organization_id)
  );

-- `client_addresses_staff_all` (0001, FOR ALL, `app.is_staff_of(organization_id)`)
-- ramane neatinsa — deja guardata tranzitiv prin `app.is_staff_of` (0012).

-- -----------------------------------------------------------------------------
-- F1b. SELECT-urile clientului — defense-in-depth, `app.org_is_active` in plus
-- -----------------------------------------------------------------------------
-- Decizie: DA, extindem toate SELECT-urile clientului enumerate mai jos. Citirea
-- nu are efecte de business (motivul pentru care 0012 le-a lasat neatinse), dar
-- odata ce scrierea e guardata complet (0012 + F1a de mai sus), a lasa SELECT-ul
-- neguardat inseamna ca un client al unei organizatii suspendate — deja scos din
-- portal de aplicatie — isi poate totusi citi comenzile/certificatele/documentele
-- proprii direct prin Data API. Impactul modificarii e minim: clientii activi nu
-- sunt afectati (`app.org_is_active` e adevarat pentru orice organizatie `active`,
-- acelasi cost de evaluare ca-n politicile de scriere deja in productie din 0012);
-- singurul efect vizibil e ca un client al unei organizatii suspendate nu mai
-- poate citi nimic prin Data API, consistent cu ce vede deja in UI.
--
-- `client_addresses_client_select` (F1a de mai sus) e lasata deliberat NEATINSA
-- aici: task-ul cere explicit ca varianta ei SELECT sa ramana neschimbata.

drop policy orders_client_select on public.orders;
create policy orders_client_select on public.orders
  for select using (
    app.role() = 'client'
    and client_id = app.client_id()
    and app.org_is_active(organization_id)
  );

drop policy order_items_client_select on public.order_items;
create policy order_items_client_select on public.order_items
  for select using (
    app.role() = 'client'
    and app.org_is_active(organization_id)
    and exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.client_id = app.client_id()
    )
  );

drop policy certificates_client_select on public.certificates;
create policy certificates_client_select on public.certificates
  for select using (
    app.role() = 'client'
    and app.org_is_active(organization_id)
    and exists (
      select 1 from public.orders o
      where o.id = certificates.order_id and o.client_id = app.client_id()
    )
  );

drop policy documents_client_select on public.documents;
create policy documents_client_select on public.documents
  for select using (
    app.role() = 'client'
    and organization_id = app.org_id()
    and app.org_is_active(organization_id)
    and (
      (owner_type = 'client' and owner_id = app.client_id())
      or (owner_type = 'order' and exists (
            select 1 from public.orders o
            where o.id = documents.owner_id and o.client_id = app.client_id()))
      or (owner_type = 'item' and exists (
            select 1 from public.items i
            where i.id = documents.owner_id and i.sellable = true))
    )
  );

drop policy clients_self_select on public.clients;
create policy clients_self_select on public.clients
  for select using (
    app.role() = 'client'
    and id = app.client_id()
    and app.org_is_active(organization_id)
  );

drop policy items_client_catalog on public.items;
create policy items_client_catalog on public.items
  for select using (
    app.role() = 'client'
    and sellable = true
    and organization_id = app.org_id()
    and app.org_is_active(organization_id)
  );

drop policy order_links_client_select on public.order_links;
create policy order_links_client_select on public.order_links
  for select using (
    app.role() = 'client'
    and app.org_is_active(organization_id)
    and exists (
      select 1 from public.orders o
      where o.id = order_links.original_order_id and o.client_id = app.client_id()
    )
  );

-- -----------------------------------------------------------------------------
-- F6. Index de suport pentru app.org_is_active(org)
-- -----------------------------------------------------------------------------
-- `app.org_is_active` (0012) face `select status = 'active' from organizations
-- where id = org` — un subquery evaluat PER RAND de aproape toate politicile RLS
-- de staff (via is_staff_of/is_admin_of) si acum, dupa aceasta migrare, si de toate
-- SELECT-urile de client de mai sus. `id` e deja PRIMARY KEY (index unic pe `id`
-- singur), deci lookup-ul dupa `id` era deja rapid; problema e ca planner-ul tot
-- trebuie sa viziteze heap-ul ca sa citeasca `status`, pentru ca PK-ul nu contine
-- acea coloana. Un index compus `(id, status)` face ca interogarea `where id = ?`
-- (care doar citeste `status`) sa fie raspunsa integral din index (index-only
-- scan), fara heap fetch — relevant la scara, cand `organizations` are multe
-- randuri si multe randuri din alte tabele evalueaza acest subquery in aceeasi
-- interogare (ex. un SELECT staff pe `orders` cu multe randuri).
create index if not exists organizations_id_status_idx
  on public.organizations (id, status);
