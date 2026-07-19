# Task X3 — Dashboard, KPI & Rapoarte

> Plan scris inainte de codare (AGENTS.md §1.1). Scope: `src/features/reports/**`,
> `src/app/(admin)/dashboard/page.tsx`, `src/app/(admin)/rapoarte/**`,
> `src/components/layout/nav-config.ts` (doar intrarea Rapoarte/Dashboard).
> Doar citire de date (fara migrari). UI romana, cod engleza.

## 1. Ce exista deja (reutilizat, nu reinventat)

- `orders`/`order_items`/`order_links` (Task E/F) — status, linii, legaturi retur/garantie.
- `stock_events`, `lots` (`provenance`, `entry_date`), `processes`/`process_inputs`/`process_outputs`
  (Task C/D) — trasabilitate.
- `certificates` (Task G) — un rand per comanda inchisa.
- `@react-pdf/renderer`, pattern PDF in `src/features/certificates/pdf.tsx` +
  `service.ts#renderCertificatePdf` (randare in `Buffer`, `renderToBuffer` mock-uit in teste).
- Export CSV: `src/features/stock/csv.ts` + ruta `/stoc/audit/export` (GET, `NextResponse`
  cu `Content-Disposition: attachment`).
- `getCurrentOrg()` (`src/features/auth/queries.ts`) — branding organizatie (nume, culori,
  logo) pentru antetul white-label al PDF-urilor.
- Componente: `Card`, `DataTable` (`@tanstack/react-table`, client), `PageHeader`,
  `StatusBadge`, `EmptyState`.

## 2. Formulele KPI (dashboard)

Carduri (mockup `docs/design/Lateris_Trace.dc.html`, ecranul principal):

| KPI | Formula |
| --- | --- |
| Comenzi active | `count(orders)` cu `status IN ('sent','accepted','delivered')` |
| De acceptat | `count(orders)` cu `status = 'sent'` |
| Livrate luna curenta | `count(orders)` cu `status = 'delivered'` si `updated_at` in luna curenta (UTC) |
| Certificate emise | `count(certificates)` — total, all-time, per organizatie (RLS) |

**Limitare cunoscuta (documentata, nu blocheaza task-ul):** schema `orders` nu are un
timestamp dedicat per tranzitie de status (fara istoric de status) — singurele coloane de
timp sunt `created_at`/`updated_at` + `delivery_date` (data planificata, optionala, introdusa
manual la creare). Pentru „livrate luna curenta" folosim `updated_at` ca aproximare a
momentului tranzitiei `-> delivered`: comenzile deja trecute in `closed` in aceeasi luna NU
sunt numarate aici (sub-raportare posibila, mica). **Recomandare v2:** coloana `delivered_at`
(si eventual `accepted_at`/`closed_at`) printr-o migrare viitoare, in afara scope-ului acestui
task (doar citire de date).

## 3. Pagina Rapoarte — selectie perioada + 6 rapoarte operationale

Selector de perioada: doua date (`from`/`to`, GET query params), implicit luna curenta
(1 a lunii → azi). Validare + parsare in `src/features/reports/period.ts` (functii pure,
testate: `currentMonthRange`, `parseDateRange`, `isDateWithinRange`, `exclusiveEndOfDay`).

1. **Comenzi pe perioada** — `orders` filtrate pe `created_at` in interval (coloana
   neambigua, mereu prezenta), grupate pe status (`ORDER_STATUS_LABELS` existent).
2. **Livrari** — comenzi cu `status IN ('delivered','closed')`; data de referinta pentru
   filtrarea pe perioada = `delivery_date ?? updated_at` (aceeasi aproximare ca la KPI,
   functie pura `resolveDeliveryReferenceDate`, testata explicit).
3. **Retururi** — `order_links` cu `link_type IN ('return','warranty')` (fara
   `replacement` — nu e o miscare de material), filtrate pe `created_at` al legaturii
   (momentul cererii de retur/garantie); afiseaza si statusul curent al comenzii-retur
   (draft/accepted/cancelled).
4. **Materiale reciclate/recondiționate reintegrate** — `lots` cu
   `provenance IN ('recycling','reconditioning','return')`, filtrate pe `entry_date`
   (coloana `date`, comparabila direct cu perioada), agregate pe provenienta + item.
5. **Raport PaaS „utilizat = livrat − returnat"** per client/perioada — per (client, item):
   `livrat` = suma `order_items.quantity` din comenzile livrate/inchise in perioada (raport 2);
   `returnat` = suma `order_items.quantity` din comenzile-retur (`order_links.link_type IN
   ('return','warranty')`) **acceptate** (`status='accepted'`) cu `updated_at` in perioada
   (acceptarea = momentul in care materialul chiar reintra in stoc, cf.
   `accept_return_order` RPC din `0010_returns.sql` — singura tranzitie posibila pentru o
   comanda-retur, deci `updated_at` e un proxy fiabil pentru „acceptat la"); `utilizat =
   max(0, livrat − returnat)`. Nota: garantia (`warranty`) e inclusa in `returnat` — materialul
   defect revine fizic in stoc la acceptare, deci nu ramane „utilizat" de client.
6. **Raport „% materii prime secundare"** per produs/perioada — pentru procesele
   `status='completed'` cu `completed_at` in perioada, grupate pe `output_item_id` (produsul
   fabricat): `% secundar = suma(process_inputs.quantity unde lots.provenance IN
   ('recycling','reconditioning','return')) / suma(toate process_inputs.quantity) * 100`.
   Raspunde direct la cerinta pietei PaaS (`docs/analiza-cerere-finantare-client-paas.md`,
   tinta ≥60% materii secundare).

Fiecare raport: tabel (`DataTable`) + **export PDF** (antet white-label, `getCurrentOrg()`)
+ **export CSV** (format identic cu `stock/csv.ts`: BOM UTF-8, CRLF, escaping RFC 4180).
Rute: `GET /rapoarte/export/pdf?report=<cheie>&from=&to=`,
`GET /rapoarte/export/csv?report=<cheie>&from=&to=`.

## 4. v2 — NU implementat aici

- **Raport CO2 economisit**: cere factori de emisie configurabili per organizatie
  (metodologia = raspunderea clientului, vezi §R2 in
  `docs/analiza-cerere-finantare-client-paas.md`); necesita camp nou de configurare
  (schema) — in afara scope-ului „doar citire" al acestui task. Placeholder informativ in
  UI (card dezactivat „In pregatire — v2"), fara logica.
- **Istoric de status pe comanda** (`delivered_at`/`accepted_at`/`closed_at`): ar elimina
  aproximarile de la §2/§3.2/§3.5 — recomandat pentru o migrare viitoare (Task separat,
  nu in acest task „doar citire").

## 5. Structura fisierelor noi

```
src/features/reports/
  types.ts            — tipuri comune (DateRange, randuri per raport, DashboardKpis)
  period.ts (+ .test)  — parsare/validare perioada, pure
  calculations.ts (+ .test) — agregari pure (status comenzi, PaaS, % secundar, reciclate)
  dashboard-queries.ts (+ .test) — IO: KPI carduri (counts Supabase)
  repository.ts (+ .test) — IO: fetch brut per raport (orders/order_links/lots/processes)
  queries.ts (+ .test) — combina repository + calculations -> API public pt. pagini/rute
  csv.ts (+ .test)     — generator CSV generic (headers + randuri) reutilizat de toate rapoartele
  pdf.tsx              — Document react-pdf generic (antet white-label + tabel) reutilizat
  report-tables.tsx    — componente client (DataTable) per raport

src/app/(admin)/
  dashboard/page.tsx           — extins cu cardurile KPI
  rapoarte/page.tsx            — pagina Rapoarte (selector perioada + 6 sectiuni)
  rapoarte/export/pdf/route.ts — export PDF (dispatch pe `report`)
  rapoarte/export/csv/route.ts — export CSV (dispatch pe `report`)
```

## 6. Nav

`src/components/layout/nav-config.ts`: adaugat `Rapoarte` (icon `BarChart3`) si
`Dashboard`/`Panou` (icon `LayoutDashboard`, lipsea complet din `STAFF_NAV`) in
`STAFF_NAV`. Nicio alta intrare atinsa.

## 7. Teste (Vitest, mocks nu spies)

- `period.test.ts` — parsare/validare interval, `isDateWithinRange`, `exclusiveEndOfDay`.
- `calculations.test.ts` — agregare status comenzi, `resolveDeliveryReferenceDate`,
  calcul PaaS (livrat/returnat/utilizat, inclusiv clamp la 0), % materii secundare
  (inclusiv total 0 → 0%), agregare materiale reciclate.
- `dashboard-queries.test.ts`, `repository.test.ts`, `queries.test.ts` — Supabase client
  mock-uit (`vi.mock("@/lib/supabase/server")`, query builder fals chainable, in stilul
  `orders/queries.test.ts`).
- `csv.test.ts` — escaping, BOM, CRLF.
- PDF: nu se testeaza randarea reala (`renderToBuffer` mock-uit, ca in
  `certificates/service.test.ts`) — se verifica doar orchestrarea (apelat cu datele corecte).

## 8. Verificari

`pnpm typecheck`, `pnpm lint`, `pnpm test` — obligatorii. `pnpm build` — rulat daca exista
incertitudine pe randarea PDF in mediul serverless (acelasi risc ca la certificate, deja
acceptat in Task G).
