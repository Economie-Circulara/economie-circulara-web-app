# Fix CI findings F2 + F4

Plan scurt (AGENTS.md §1.1), scris inainte de codare. Scope strict: `.github/workflows/db.yml`
(DOAR pasul de drift), `.github/workflows/e2e.yml` (nou), acest plan. NU s-a atins cod TS,
migrari, `database.types.ts`, `playwright.config.ts` (doar citit), alte workflow-uri.

## F2 — drift real de schema, nu de format (`.github/workflows/db.yml`)

**Problema:** pasul "Verifica drift..." facea `diff` byte-cu-byte intre
`database.types.generated.ts` (output brut `supabase gen types`) si `database.types.ts`
(intretinut manual, in `.prettierignore`). Diff-ul semnala mereu drift, chiar cand schema
era identica, din cauza formatarii CLI-ului (fara `;`, wrapping diferit de linii lungi) -
zgomot, nu semnal.

**Fix:** ambele fisiere se normalizeaza prin `prettier` (`npx --yes prettier@3 --parser
typescript ...`, major version fixat la 3.x ca in `package.json`, nu `latest`) inainte de
`diff`, in fisiere temporare `/tmp/gen.fmt.ts` / `/tmp/committed.fmt.ts`. Prettier
descopera automat `.prettierrc`/config-ul repo-ului (cauta in sus de la fisierul procesat),
deci wrapping-ul si stilul de citare/indentare devin identice pe ambele parti - un diff
ramas dupa normalizare inseamna drift REAL (tabel/coloana/tip lipsa sau diferit), nu
zgomot de formatare.

Pasul ramane **informativ** (non-blocant: `::warning::` + `|| true` la `diff` final, fara
`exit 1`) - nu exista inca o rulare canonica `pnpm gen:types` (cu Docker) confirmata
drift-free pe fisierul curent. Comentariul inline din workflow documenteaza explicit ca,
dupa o astfel de regenerare + commit, pasul poate deveni blocant (se elimina `|| true` /
se foloseste `exit 1`).

**Ce NU s-a schimbat:** restul jobului `migrations` (start/reset Supabase, RLS tests,
regenerarea in `database.types.generated.ts`), header-ul workflow-ului, trigger-ele.

## F4 — job E2E nou (`.github/workflows/e2e.yml`)

Workflow nou, separat de `db.yml` (nu se ating trigger-ele/pasii existenti), care ruleaza
`tests/e2e/mvp-flow.spec.ts` (Playwright) end-to-end pe CI.

**Trigger:** `pull_request` cu `paths: src/**, supabase/**, tests/e2e/**,
playwright.config.*, .github/workflows/e2e.yml` + `workflow_dispatch`.

**Pasi:**

1. `actions/checkout@v4`.
2. `pnpm/action-setup@v4` (v10) + `actions/setup-node@v4` (Node 22, cache pnpm) - acelasi
   pattern ca `ci.yml`.
3. `pnpm install --frozen-lockfile`.
4. `supabase/setup-cli@v1` (`version: latest`, ca in `db.yml`).
5. `supabase start` apoi `supabase db reset` (aplica migrarile + `supabase/seed.sql` -
   organizatia demo "Lateris Demo" cu conturile admin/operator/client/super@demo.local,
   parola `password123`, folosite direct de `mvp-flow.spec.ts`). Acelasi pattern ca jobul
   `migrations` din `db.yml`.
6. **Extrage cheile Supabase locale** din `supabase status -o env` si le scrie atat in
   `$GITHUB_ENV` (pentru pasii urmatori din job), cat si direct in `.env.local` (Next.js
   il incarca automat la `pnpm dev`/`pnpm build`, dubla siguranta fata de mostenirea de
   mediu a procesului copil pornit de Playwright `webServer`).
7. `pnpm exec playwright install --with-deps chromium`.
8. `pnpm test:e2e` (= `playwright test`), cu `CI: true`.
9. Upload `playwright-report/` ca artifact pe esec (`if: failure()`) - reporterul e
   `html` in `playwright.config.ts`.
10. `supabase stop --no-backup || true` (`if: always()`).

**Cum porneste appul:** `playwright.config.ts` (verificat, NU modificat) are deja
`webServer: { command: "pnpm dev", url: "http://localhost:3000", reuseExistingServer:
!process.env.CI, timeout: 120_000 }`. Pe CI, `process.env.CI` e setat de GitHub Actions,
deci `reuseExistingServer` e `false` - Playwright porneste singur `pnpm dev` inainte de
teste si il opreste la final. **Nu a fost nevoie sa adaug pornire manuala de app
(`pnpm build && pnpm start` in background)** - jobul doar trebuie sa garanteze ca variabilele
de mediu Supabase sunt prezente in mediul jobului INAINTE de pasul `pnpm test:e2e`
(procesul `pnpm dev` pornit de Playwright mosteneste acest mediu).

## Presupuneri de validat pe primul CI real (necesita rulare reala, nu s-a putut simula fara Docker)

1. **Formatul `supabase status -o env`** - presupun ca produce variabile shell de forma
   `API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY` (denumirile "legacy", istoric stabile in CLI)
   si, posibil, in versiuni mai noi, si `PUBLISHABLE_KEY`/`SECRET_KEY` (denumirile noi,
   folosite de proiect in cloud - vezi `docs/setup.md` §2.1). Scriptul din
   `e2e.yml` incearca ambele, cu legacy ca fallback (`PUBLISHABLE_KEY:-ANON_KEY`,
   `SECRET_KEY:-SERVICE_ROLE_KEY`). **Functional e echivalent** indiferent de eticheta:
   `createClient(url, key)` din `@supabase/supabase-js` foloseste cheia ca API key/JWT brut
   - rolul (anon vs service_role) e codificat in JWT-ul insusi, nu in numele variabilei de
   mediu. Daca pasul esueaza cu `::error::` (variabile lipsa), urmatorul fix e sa citesti
   output-ul brut afisat de pasul de debug (`cat /tmp/supabase-status.env`, tiparit
   necondiționat inainte de parsare) si sa ajustezi numele variabilelor.
2. **`supabase status -o env` suporta flag-ul `-o env`** pe versiunea `latest` a CLI-ului
   la momentul rularii CI - daca nu, alternativa e `supabase status -o json` + `jq`, sau
   parsarea output-ului text implicit (`supabase status`) cu `grep`/`sed`. Nu s-a putut
   verifica local (fara Docker in acest mediu, cf. AGENTS.md §3.2).
3. **`.env.local` + `$GITHUB_ENV`, ambele scrise redundant** - presupun ca procesul `pnpm
   dev` pornit de Playwright `webServer` mosteneste mediul jobului (`$GITHUB_ENV` aplicat
   de Actions inainte de fiecare pas urmator), dar am adaugat si `.env.local` ca sursa de
   adevar directa pentru Next.js, in caz ca mostenirea de mediu prin procesul copil al
   Playwright nu se comporta cum ma astept.
4. **Timpul total al jobului** - `mvp-flow.spec.ts` are `test.setTimeout(180_000)` si
   parcurge tot fluxul MVP (9 pasi); combinat cu `supabase start`/`db reset` (imagini
   Docker de la `ghcr.io`) si instalarea Chromium, jobul poate dura cateva minute; nu am
   setat un `timeout-minutes` explicit pe job (ramane la default-ul Actions, 360 min) -
   de ajustat daca se dovedeste necesar.
5. **`pnpm dev` vs `pnpm build && pnpm start`** - am pastrat `webServer` existent din
   `playwright.config.ts` (`pnpm dev`, dev server) neschimbat, conform constrangerii de a
   nu atinge acel fisier. Daca testele se dovedesc instabile/lente pe modul dev in CI,
   o alternativa (necesita modificarea `playwright.config.ts`, in afara scopului acestui
   task) ar fi `webServer.command: "pnpm build && pnpm start"`.
6. **Coliziuni cu joburi paralele** - `e2e.yml` e complet separat de `db.yml`/`ci.yml`
   (nume de job distinct, fisier distinct), deci nu ar trebui sa existe conflicte de
   concurenta pe acelasi PR; fiecare job porneste propriul stack Supabase izolat pe
   runner-ul lui.

## Verificari efectuate (fara Docker/Supabase local disponibil in acest mediu)

- YAML valid: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/e2e.yml'))"`
  si idem pentru `db.yml` - ambele parseaza fara erori.
- Citit `playwright.config.ts` (neschimbat) pentru a confirma `webServer`/`baseURL`.
- Citit `tests/e2e/mvp-flow.spec.ts` (neschimbat) - nu foloseste `process.env.*`
  Supabase direct; depinde doar de app-ul pornit + seed-ul din `supabase/seed.sql`.
- Citit `src/lib/env.ts`, `src/lib/supabase/admin.ts`, `.env.example`, `docs/setup.md`
  pentru numele exacte ale variabilelor de mediu asteptate de aplicatie
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SECRET_KEY`).
- Nu s-a putut rula `supabase start`/`db reset`/`playwright test` efectiv (fara Docker in
  acest mediu, cf. AGENTS.md §3.2) - validarea finala se face pe primul CI real (PR).
