# Task T2.1 — Guard organizatie suspendata

Plan scurt (AGENTS.md §1.1), scris inainte de codare.

## Problema

`organizations.status = 'suspended'` era salvat (Task I), dar nimic nu-l verifica:
middleware-ul si `getCurrentUser`/`requireRole` nu citeau statusul, deci userii unui
tenant suspendat (admin/operator/client) isi pastrau accesul complet — atat in
aplicatie, cat si direct prin Data API (RLS).

## Plan (doua linii de aparare)

1. **Aplicatie** (`src/features/auth/session.ts` + `src/lib/supabase/middleware.ts`):
   - `SessionUser` capata `organizationStatus` (citit printr-un embed
     `organizations(status)` pe interogarea de profil existenta — o singura
     interogare, in stilul embed-urilor din `features/*/queries.ts`).
   - Helper nou `isOrgSuspended(user)` — `true` doar cand `organizationId` exista SI
     statusul e `suspended` (super_admin, fara organizatie, nu poate fi "suspendat").
   - `requireUser()` redirectioneaza la `/organizatie-suspendata` cand
     `isOrgSuspended` e adevarat (deci si `requireRole`, care il apeleaza).
   - `updateSession` (middleware) face aceeasi verificare direct pe fiecare request
     autentificat (interogare `profiles` + embed `organizations(status)`), inainte
     de a ajunge la layout/pagina — prima linie, mai eficienta si acopera orice cod
     care nu trece prin `requireUser`.
   - Pagina noua `src/app/organizatie-suspendata/page.tsx`: foloseste
     `getCurrentUser` DIRECT (nu `requireUser`/`requireRole` — ar cauza bucla de
     redirect catre ea insasi); mesaj RO + buton de delogare (functioneaza pentru ca
     pagina e exclusa explicit din verificarea middleware-ului).
   - `/organizatie-suspendata` adaugat in `RESERVED_PATH_SEGMENTS`
     (`src/features/auth/tenant.ts`) — ca „dashboard”/„portal”/„platform”, ca sa nu
     fie interpretata gresit ca slug de tenant in rezolvarea pe path (dev/local).

2. **RLS** (migrare aditiva `supabase/migrations/0012_suspended_org_guard.sql`):
   - Helper nou `app.org_is_active(org)`.
   - `app.is_staff_of`/`app.is_admin_of` (0001) redefinite CREATE OR REPLACE, aceeasi
     semnatura, cu conditie suplimentara `app.org_is_active(org)` pe ramura de
     tenant — NU pe ramura `app.is_super_admin()`. Cum aproape toate politicile de
     staff sunt `FOR ALL` bazate pe aceste helper-e, blocheaza automat
     select/insert/update/delete pentru staff-ul unei organizatii suspendate, pe
     toate tabelele de business, fara sa atingem fiecare politica individual.
   - Politicile de SCRIERE ale clientului (introduse per-operatie in 0003:
     `orders_client_insert/update/delete`, `order_items_client_insert/update/delete`,
     `documents_client_insert`) redefinite (drop+create, acelasi pattern ca 0003)
     cu `app.org_is_active(organization_id)` in plus.
   - SELECT-urile clientului si `client_addresses_self_all` (inca `FOR ALL`) NU sunt
     atinse — decizie documentata in comentariul migrarii: citirea nu are efecte, iar
     clientul e deja scos din portal de guard-ul de aplicatie; suprafata de risc
     reala (scrierea directa prin Data API) e acoperita.

3. **Teste:**
   - `src/features/auth/session.test.ts` — `isOrgSuspended`, `requireUser` (redirect
     suspendat / ok activ / super_admin neafectat).
   - `src/lib/supabase/middleware.test.ts` — redirect la `/organizatie-suspendata`,
     fara bucla pe pagina insasi, super_admin neafectat (mock-ul lantului
     `.from().select().eq().single()` extins, altfel testele existente pică).
   - `supabase/tests/rls_isolation.sql` — TEST 11-14: a treia organizatie de test
     (`Org C`, suspendata de la inceput), staff blocat la insert (eroare RLS) si
     update (0 randuri, tipar T7), reactivare (update direct ca `postgres`), staff
     reusit dupa reactivare, super_admin neafectat. Adaugate DUPA testele existente
     (id-uri noi) ca sa nu deranjeze T9 (numara organizatiile de test explicit dupa
     id, nu global).

## Riscuri / incertitudini

- Middleware face o interogare suplimentara (`profiles` + embed `organizations`) pe
  fiecare request autentificat non-public — cost acceptat pentru guard-ul cerut.
- Sign-out dintr-o pagina de business blocata: server action-ul posteaza pe
  path-ul curent: daca userul e deja suspendat, middleware-ul redirectioneaza
  cererea inainte sa ruleze `signOutAction` (acelasi comportament ca la orice ruta
  blocata azi pentru un user neautentificat). Utilizatorul ajunge oricum pe
  `/organizatie-suspendata`, care are propriul buton de delogare (functional, pentru
  ca pagina e exclusa din verificare).
- Nu am putut rula `supabase db reset` / `pnpm db:test` local (fara acces Docker in
  acest mediu) — SQL-ul migrarii si testele sunt validate doar prin citire atenta +
  CI.
