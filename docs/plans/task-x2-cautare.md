# Task X2 — Cautare globala

Plan scurt (AGENTS.md §1.1), scris inainte de codare.

## Scop

Bara de cautare din topbar (mockup: `docs/design/Lateris_Trace.dc.html`, header
`⌕ Caută comenzi, loturi, clienți…`) trebuie sa navigheze la o pagina de rezultate
cross-entitate (`/cautare`), grupate pe tip, respectand RLS/izolarea multi-tenant
si regula "clientul nu vede stocul si procesele interne" (AGENTS.md §4).

## Decizie: query-based (ILIKE), FARA migrare noua

Toate entitatile cautate sunt deja indexate/filtrabile suficient de bine cu
`ilike`/`or()` pe volumele de date ale unui tenant (organizatie unica, cateva mii
de randuri cel mult in pilot). Full-text Postgres (migrarea `0013_search.sql` +
RPC) ar adauga complexitate (migrare noua, `database.types.ts` manual, sincronizare
cu CI care nu poate rula `db:reset` local in acest mediu) fara beneficiu clar la
aceasta scara. Ramane o optiune de rescris ulterior daca volumul de date creste.

## Reutilizare (AGENTS.md — "foloseste, NU reinventa")

`globalSearch` NU reimplementeaza cautarea per entitate acolo unde exista deja:

- **orders** → `listOrders({ search })` din `src/features/orders/queries.ts`
  (cauta deja dupa `order_number` SAU numele clientului — acopera "orders
  (order_number, prin client)").
- **clients** (doar staff) → `listClients({ search })` din
  `src/features/clients/queries.ts` (name SAU cui, escapare deja implementata).
- **items** (staff) → `listItems({ search })` din `src/features/items/queries.ts`
  (title).
- **items/catalog** (client) → `listCatalogItems({ search })` din
  `src/features/client-portal/queries.ts` (title, RLS `items_client_catalog`
  limiteaza deja la `sellable=true` din organizatia clientului).
- **lots** (doar staff, "via item") si **certificates** (number) nu au o functie
  de listare cu cautare text existenta — interogari noi, minime, in
  `src/features/search/service.ts`, in stilul `queries.ts` deja folosit
  (`ilike`, escapare manuala, `createClient()` per interogare).

Fiecare rezultat e limitat la `limit` (implicit 5) per entitate.

## Respectarea RLS pe rol

Toate interogarile trec prin `createClient()` (clientul UTILIZATORULUI, cookie-based)
— RLS izoleaza automat pe `organization_id`/`client_id`, ca in restul codebase-ului
(niciun filtru manual pe organizatie in query-uri, la fel ca `items/queries.ts`,
`clients/queries.ts` etc.).

Suplimentar, `globalSearch` decide LA NIVEL DE APLICATIE ce entitati interogheaza,
per rol (aparare in profunzime, nu doar RLS):

- **staff** (`admin`/`operator`): orders, clients, lots, items, certificates.
- **client**: DOAR orders (proprii, via `orders_client_all`), certificates
  (proprii, via `certificates_client_select`), items/catalog (`sellable=true`,
  via `items_client_catalog`). NU se interogheaza deloc `clients`/`lots` pentru
  rolul client — nici macar RLS nu ar permite lots (`lots_staff_all` e singura
  policy, fara `client_select`), dar clients ARE o policy `clients_self_select`
  pt. client (el insusi) — irelevanta pt. cautare globala, deci omisa explicit.
- alte roluri (`super_admin`, fara organizatie) → `[]` (fara context de tenant).

## Fisiere noi

- `src/features/search/types.ts` — `SearchResultType`, `SearchResultItem`,
  `SearchResultGroup`, `GlobalSearchOptions`.
- `src/features/search/labels.ts` — etichete RO per tip de rezultat (grupare).
- `src/features/search/service.ts` — `globalSearch(query, { role, limit? })` +
  `toIlikePattern` (escapare `%`/`_`, exportata pt. teste) + interogarile proprii
  pt. lots/certificates.
- `src/features/search/service.test.ts` — mocks (nu spies): query-uri per rol,
  agregare/grupare, client NU cauta stoc/procese, escapare input.
- `src/features/search/search-results.tsx` — componenta de prezentare (grupuri +
  linkuri), `EmptyState` cand nu-s rezultate.
- `src/app/(admin)/cautare/page.tsx` — pagina de rezultate (staff), citeste
  `?q=`.

## UI topbar

`Topbar` primeste un prop nou `role` si afiseaza bara de cautare (form HTML nativ,
`GET /cautare`, fara JS) DOAR pentru staff (`admin`/`operator`). Pentru client,
bara nu e cablata la o pagina agregata: scope-ul declarat al acestui task listeaza
explicit doar `src/app/(admin)/cautare/**` (nicio ruta noua in `(client)`), iar
layout-ul `(admin)` blocheaza oricum accesul clientului la orice ruta din acel
grup (`requireRole(["admin", "operator"])` in `src/app/(admin)/layout.tsx`) —
vezi sectiunea „Incertitudini" din raportul final pt. urmarire.

## Teste

`src/features/search/service.test.ts`:

- construieste query-urile corecte per rol (ce e apelat, ce NU e apelat);
- agrega/grupeaza rezultatele in ordinea comanda/client/lot/produs/certificat,
  omitand grupurile fara rezultate;
- rolul `client` NU interogheaza `clients`/`lots` (spy pe `from`/pe functiile
  reutilizate din alte feature-uri, mockuite);
- `toIlikePattern` escapeaza `%`/`_` din input.
