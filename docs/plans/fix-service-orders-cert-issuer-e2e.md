# Plan: 3 goluri funcționale semnalate la sesiunea de verificare (2026-09-13/14)

Continuare a analizei funcționale ("ce mai e de făcut?") - trei puncte confirmate,
de reparat:

1. **`accept_order` eșua pentru comenzi cu itemi `kind = 'service'`** (abonamente) -
   `consume_fifo` era apelat necondiționat pentru fiecare linie, iar un serviciu nu are
   loturi de stoc -> "Stoc insuficient" chiar la cantitatea 1.
2. **`tests/e2e/mvp-flow.spec.ts` pica la login** - `getByLabel("Email", {exact:false})`
   e ambiguu (formularul are și `#magic-email` pentru magic link, cu eticheta "Sau
   primește un link pe email" - conține substringul "email").
3. **Certificatul de trasabilitate fără CUI-ul emitentului** - `organizations` nu avea
   coloane pentru datele fiscale ale organizației (spike S2,
   `docs/analiza-standarde-certificat.md` §7.1, rândul B2/B4).

## Pași

1. **#2 (izolat, rapid):** `loginAsAdmin` din `mvp-flow.spec.ts` trece pe `#email`/
   `#password` (ca în `routes-smoke.spec.ts`). Verificat rulând testul complet, real
   (Supabase local + `pnpm dev`), nu doar static - trece 1-9.
2. **Pe drum, `supabase/tests/business_flow.sql` era complet stricat** (nu doar un caz
   izolat): toate UUID-urile de item/lot/comandă erau hardcodate, dar `items`/`lots`/
   `orders` din `seed.sql` folosesc `gen_random_uuid()` - testul nu putea trece decât
   întâmplător, o singură dată (la reset-ul din care fuseseră copiate). Rescris să
   caute entitățile dinamic (`\gset` + subquery-uri pe `title`/`order_number`/
   `provenance`, în loc de literali) - inclusiv în interiorul blocurilor `do $$ ... $$`
   (unde substituția `:variabila` a psql NU se aplică - alt motiv pentru care fixul
   inițial cu simplă înlocuire de literali nu mergea acolo). Verificat: trece pe un
   `db reset` complet, idempotent la rulări repetate.
3. **#1:** migrarea `0022_accept_order_skip_service_items.sql` - `accept_order` sare
   peste liniile cu `items.kind = 'service'` (fără efect de stoc pentru ele;
   `cancel_order` rămâne neschimbat - nu are ce reface pentru o linie care n-a
   consumat stoc). Test nou B13 în `business_flow.sql` (comandă doar cu serviciu +
   comandă mixtă serviciu+fizic, verificat manual cu RPC-uri directe înainte de a găsi
   locul potrivit în suită).
4. **#3:** migrarea `0023_organization_legal_fields.sql` (`organizations.cui`,
   `reg_com`, `address`, toate nullable, fără validare de format - la fel ca
   `clients.cui`). `getCurrentOrg()` extins; card nou "Date firmă" în
   `settings-form.tsx` + `updateOrganizationAction`; certificatul (web
   `certificate-view.tsx` + PDF `pdf.tsx`) afișează linia
   `CUI ... · Reg. Com. · Adresă` prin funcția pură partajată
   `src/features/certificates/issuer.ts` (`formatIssuerLine`). Verificat end-to-end
   prin UI local: completat Setări -> generat o comandă nouă -> certificatul (web și
   PDF descărcat din Storage) arată linia.
5. **Descoperire pe drum:** `supabase/tests/assistant_rls.sql` (migrarea 0020) avea 2
   blocuri `begin ... exception ... end` și un `perform` scrise "bare", fără
   `do $$ ... $$` - sintaxă PL/pgSQL invalidă la nivel de psql. Fișierul nu era rulat
   deloc de `db.yml` (scriptul `pnpm db:test:assistant` există în `package.json`, dar
   nu era cablat în CI) - de-asta a trecut nedetectat de la commit-ul care l-a introdus.
   Reparat + adăugat pasul lipsă în `.github/workflows/db.yml`.
6. `pnpm gen:types` rulat (Docker disponibil în acest mediu) - a recuperat și tipurile
   pentru `assistant_*`/`item_images` care lipseau din `database.types.ts` de la
   migrările 0020/0021 (comisă fără `gen:types`, semnalat explicit în prompt-log ca
   "de rulat local inainte de merge").

## Verificat

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (694 teste, inclusiv cele noi:
  `issuer.test.ts`, `settings/actions.test.ts`, extensie la
  `certificates/service.test.ts`).
- `supabase/tests/business_flow.sql`, `rls_isolation.sql`, `assistant_rls.sql` - toate
  trei, în ordinea din `db.yml`, pe un `db reset` complet.
- `pnpm exec playwright test tests/e2e/mvp-flow.spec.ts` - trece integral (real, cu
  Supabase local + `pnpm dev`).
- Verificare manuală în UI (Setări -> completare date firmă -> flux comandă completă
  -> certificat web + PDF descărcat din Storage local) pentru #3.

## Nereparat (în afara scope-ului acestor 3 puncte)

- Restul rândurilor ❌ din `docs/analiza-standarde-certificat.md` §7.1 (disclaimer,
  UIT pe certificat, cod de deșeu, etc.) - decizii de produs/juridice, nu doar cod.
- Adresa de instalație / contacte pe organizație (dacă diferă de sediu) - nu a fost
  cerută explicit.
