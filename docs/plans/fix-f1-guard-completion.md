# Fix F1 + F6 — completare guard organizatie suspendata

Plan scurt (AGENTS.md §1.1), scris inainte de codare.

## Problema (findings de review pe 0012_suspended_org_guard.sql)

0012 a adaugat a doua linie de aparare (RLS) pentru organizatii suspendate, dar a
lasat deliberat doua goluri (documentate atunci ca decizie asumata):

- **F1a**: `client_addresses_self_all` a ramas `FOR ALL` nesparta pe operatii =>
  un client al unei organizatii suspendate putea crea/edita/sterge adrese de
  livrare direct prin Data API.
- **F1b**: SELECT-urile clientului (orders/order_items/certificates/documents/
  clients/items/order_links) nu cereau `app.org_is_active` => un client al unei
  organizatii suspendate isi putea citi comenzile/certificatele/documentele
  proprii prin Data API (blocat doar in UI).
- **F6**: `app.org_is_active(org)` (subquery pe `organizations`, evaluat per-rand)
  nu avea index de suport dedicat.

## Plan

Migrare aditiva noua `supabase/migrations/0014_suspended_guard_completion.sql`
(nu se editeaza 0001/0003/0012):

1. **F1a** — `drop policy client_addresses_self_all` + 4 politici noi per-operatie
   (`client_addresses_client_select/insert/update/delete`, pattern identic cu
   spargerea `orders_client_all` din 0003): SELECT neschimbat, INSERT/UPDATE/DELETE
   cu `app.org_is_active(organization_id)` in plus. `client_addresses_staff_all`
   neatinsa.
2. **F1b** — drop+create pe SELECT-urile clientului: `orders_client_select`,
   `order_items_client_select`, `certificates_client_select`,
   `documents_client_select`, `clients_self_select`, `items_client_catalog`,
   `order_links_client_select` — toate cu `app.org_is_active(organization_id)` in
   plus. Decizie: DA se guardeaza (completitudine/defense-in-depth), impact minim
   (clientii organizatiilor active nu vad nicio diferenta). `client_addresses`
   SELECT ramane explicit neatins (cerinta F1a).
3. **F6** — `create index if not exists organizations_id_status_idx on
   public.organizations (id, status)` — index compus pentru index-only scan pe
   `app.org_is_active` (PK-ul pe `id` singur nu contine `status`, deci tot cere
   heap fetch fara acest index compus).
4. **Teste** — extindem `supabase/tests/rls_isolation.sql`, reutilizand Org C
   (suspendata, TEST 11-14 existente): dupa reactivarea din TEST 14, adaugam un
   client nou in Org C, o resuspendam punctual, verificam ca clientul NU poate
   insera/actualiza `client_addresses` cat org e suspendata si NU isi vede
   comenzile (SELECT guardat, F1b), apoi reactivam din nou si verificam ca poate.
   Numerotarea/id-urile testelor existente (1-14) raman neatinse.

## Neatins / afara scopului

- `order_links_client_insert` (0010_returns.sql, dupa 0012) nu cere
  `app.org_is_active` — acelasi tip de gol, dar pe un tabel din domeniul
  `orders`, unde alt agent lucreaza in paralel; semnalat, nu reparat aici.
- Nicio schimbare in cod TS / `database.types.ts` — politicile si functiile RLS
  nu apar in tipurile generate.

## Riscuri / incertitudini

- Nu am putut rula `supabase db reset` / `pnpm db:test` local (fara Docker in
  acest mediu) — SQL-ul migrarii si testele sunt validate prin citire atenta a
  stilului 0003/0012 + CI (`db.yml`).
- Extinderea SELECT-urilor (F1b) e defense-in-depth: riscul real (scrierea) era
  deja acoperit de 0012 + F1a; daca se considera disproportionat, F1b poate fi
  revenit fara sa afecteze F1a/F6 (politici independente).
