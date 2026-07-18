# Task G — Certificate de trasabilitate (PDF + graf)

Plan scurt (AGENTS.md §1.1) inainte de codare.

## Scop

La inchiderea unei comenzi (`orders.status -> 'closed'`), genereaza automat, o
singura data (idempotent, `certificates.order_id` UNIQUE):

1. un **snapshot de trasabilitate** (graf noduri/legaturi: surse → loturi → procese →
   lot produs → livrare, plus tabel „Materiale si origine" cu procente per sursa),
   construit prin **traversare TS** (nu SQL) a `process_inputs`/`process_outputs`/`lots`,
   pornind de la loturile efectiv consumate de comanda (`stock_events` cu
   `order_id` + `event_type='consumption'`, scrise de `accept_order`/`consume_fifo`).
2. un **PDF** generat server-side, stocat in bucket-ul privat `certificates`.
3. randul `certificates` (numar unic per organizatie, `traceability_snapshot` jsonb inghetat, `pdf_path`).

## Decizii

- **PDF**: `@react-pdf/renderer` (pur JS, fara Chromium/Puppeteer — merge pe Vercel
  serverless). Peer-deps verificate: declara `react: "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"`,
  deci compatibil cu React 19 fara conflicte (`pnpm add` fara warning-uri de peer-deps).
  Randeaza graful de trasabilitate ca `<Svg>`/`<Path>`/`<Rect>` in interiorul PDF-ului,
  refolosind functia pura de layout din `production/sankey-data.ts` (extrasa acolo ca sa
  fie consumabila si de componenta React (browser) si de documentul PDF (server) — un
  singur loc care calculeaza pozitiile nodurilor si curbele Bezier ale "panglicilor").
- **Traversare graf**: pur TS, in doua straturi — `repository.ts` (fetch iterativ pe
  niveluri din DB, batch-uit, respecta RLS prin clientul utilizatorului) + `traceability.ts`
  (functie pura, sincrona, testabila cu date mock, fara nicio dependenta de Supabase).
  Alocarea procentuala per sursa foloseste un mass-balance simplu (proportia consumata
  dintr-un lot se propaga proportional catre input-urile procesului care l-a produs);
  recondiționarea ramane vizibila distinct (provenance separat, AGENTS.md §4).
- **Numar certificat**: `certificate_counters` + `generate_certificate_number(p_org)`,
  analog `order_counters`/`generate_order_number` din 0007 (migrarea 0009).
- **Storage**: bucket privat `certificates`, FARA politici pe `storage.objects` — acces
  doar prin server actions + client admin, exact ca la `documents` (0006).

## Fisiere

- `supabase/migrations/0009_certificates_storage.sql`
- `src/lib/database.types.ts` (adaugiri: `certificate_counters` + `generate_certificate_number`)
- `src/features/production/sankey-data.ts` (extras `layout()` + tipuri pozitionate, reutilizabile)
- `src/features/certificates/*` (types, traceability.ts + test, repository.ts, pdf.tsx, service.ts + test, actions.ts, certificate-view.tsx)
- `src/app/(admin)/comenzi/[id]/certificat/page.tsx`
- `src/features/orders/notifications.ts` (hook `onOrderStatusChanged`, la `toStatus==='closed'`)
- `src/app/(admin)/comenzi/[id]/page.tsx` (link catre certificat cand comanda e inchisa)

## Ramane de verificat pe DB reala

- Rularea migrarii 0009 pe o instanta Supabase reala (CI/local) — sintaxa validata manual,
  fara `pnpm db:reset` in acest mediu (Docker blocat).
- `pnpm gen:types` trebuie sa confirme ca adaugirile manuale din `database.types.ts`
  raman identice cu ce genereaza CLI-ul.
