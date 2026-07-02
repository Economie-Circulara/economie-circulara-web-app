# Plan: remedierea constatarilor din code review (Wave 0–1)

Review-ul din 2026-07-02 (plan + cod, dupa T0.1–T0.3, T1.1, T1.2) a confirmat ca
proiectul e pe traiectoria din `implementation-plan.md`, dar a identificat **2 gauri
de securitate in RLS**, mai multe criterii de acceptare „bifate pe hartie" dar
ne-executate, cod mort/induce-in-eroare si abateri de proces. Acest plan le grupeaza
in **4 PR-uri independente**, fiecare implementat de un agent separat.

## Constatari (rezumat)

| #   | Severitate | Constatare                                                                                                                                            |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | CRITIC     | `profiles_update` permite unui admin de organizatie sa-si seteze singur `role = 'super_admin'` (si `profiles_insert` permite crearea unui profil super_admin pentru un user auth orfan). Escaladare de privilegii pe toata platforma, direct prin Data API. |
| 2   | CRITIC     | `orders_client_all` / `order_items_client_all` sunt `FOR ALL`: clientul poate modifica/sterge comenzi **dupa acceptare** (stoc deja scazut), corupand stocul si snapshot-ul de trasabilitate. Masina de stari exista doar in server actions, dar clientul are acces PostgREST direct. |
| 3   | MARE       | `supabase/tests/rls_isolation.sql` exista dar **nu e rulat nicaieri** (nici in CI, nici printr-un script). Acopera doar SELECT, nu si caile de UPDATE unde sunt gaurile #1/#2.       |
| 4   | MARE       | Verificarea de drift `database.types.ts` din `db.yml` e inca **ne-blocanta** (comentariul zicea „blocant din T1.1"); tipurile — contractul comun al Wave 2 — pot devia silentios.      |
| 5   | MEDIU      | Middleware seteaza `x-tenant-slug`/`x-tenant-domain` pe **raspuns** (merg la browser), nu pe request — nu se propaga la server components; comentariul sustine contrariul. Nimeni nu le consuma. `RESERVED_PATH_SEGMENTS` nu include `dashboard`/`portal`/`platform`/`showcase` etc. |
| 6   | MEDIU      | `signInWithOAuth` (Google) creeaza useri auth fara profil (provisionarea prin invitatie e ocolita la nivel de auth) daca sign-up-ul public nu e dezactivat din dashboard-ul Supabase; dependenta de config nedocumentata; userii orfani raman in limbo.   |
| 7   | PROCES     | Commiturile T1.1 (`00cb830`) si T1.2 (`92e170c`) **nu au intrari in `docs/prompt-log.md`** (incalca AGENTS.md regula 1.2).                             |
| 8   | PROCES     | Termenul din docs („august 2025") e in trecut; lucrul a inceput in 2026-06. Spike-urile S1–S3 (care deblocheaza Task A/D/G) nu au pornit.               |
| —   | MINOR      | `/showcase` public in productie; `stock_events` e doar informativ (nereconciliat cu `lots.remaining_qty`); `org_branding` enumerabil anonim (trade-off acceptat); `profiles.email` duplica `auth.users.email`. |

## PR-uri planificate

### PR 1 — `claude/rls-hardening`: intarirea RLS (constatarile 1, 2 + teste)

Migrare noua `supabase/migrations/0003_rls_hardening.sql` (aditiva, nu se editeaza 0001):

- **Profiles:** trigger `BEFORE INSERT OR UPDATE` care, pentru apelanti autentificati
  non-super-admin (`auth.uid()` non-null si `app.is_super_admin()` fals):
  - la UPDATE interzice modificarea `role`, `organization_id`, `client_id`;
  - la INSERT interzice `role = 'super_admin'`.
  - Contextele de serviciu (`auth.uid()` null: seed, service_role, migrari) trec nefiltrat.
- **Orders (client):** inlocuieste `orders_client_all` cu politici pe status:
  - SELECT: propriile comenzi, orice status;
  - INSERT: doar `draft`/`sent`, propriul `client_id` + organizatie;
  - UPDATE: `USING` status in (`draft`,`sent`); `WITH CHECK` status in (`draft`,`sent`,`cancelled`);
  - DELETE: doar `draft`.
- **Order items (client):** inlocuieste `order_items_client_all` — SELECT pe comenzile
  proprii; scriere doar cat timp comanda-parinte e `draft`/`sent`.
- **Teste:** extinde `supabase/tests/rls_isolation.sql`: admin nu se poate auto-promova;
  admin nu poate insera profil super_admin; clientul nu poate modifica/sterge o comanda
  `accepted`; clientul poate anula o comanda `sent`; super_admin vede ambele organizatii.

### PR 2 — `claude/ci-db-enforcement`: CI care chiar verifica (constatarile 3, 4)

- `db.yml`: dupa `supabase db reset`, ruleaza `supabase/tests/rls_isolation.sql` cu
  `psql -v ON_ERROR_STOP=1` pe DB-ul local (port din `supabase/config.toml`).
- Verificarea de drift a tipurilor devine **blocanta** (exit 1 la diferente).
- Declanseaza `db.yml` si la modificari `src/lib/database.types.ts`.
- Script `pnpm db:test` + actualizarea tabelului de comenzi din AGENTS.md §3.2.

### PR 3 — `claude/tenant-oauth-fixes`: corectii aplicatie (constatari 5, 6 + minor)

- `src/lib/supabase/middleware.ts`: propaga `x-tenant-slug`/`x-tenant-domain` pe
  **request headers** (`NextResponse.next({ request: { headers } })`), pastrand intact
  pattern-ul de cookies `@supabase/ssr`; corecteaza comentariul.
- `src/features/auth/tenant.ts`: adauga in `RESERVED_PATH_SEGMENTS`: `dashboard`,
  `portal`, `platform`, `showcase`, `set-password`, `forgot-password` (+ teste).
- Useri OAuth fara profil: dupa autentificare, daca `getCurrentUser()` nu gaseste profil,
  sesiunea e inchisa si userul redirectat la `/login?error=unprovisioned` cu mesaj clar.
- `docs/setup.md`: pas obligatoriu — dezactivarea sign-up-ului public in Supabase Auth.
- `/showcase` accesibil doar in afara productiei.

### PR 4 — `claude/docs-process-fixes`: proces si documentatie (constatari 7, 8 + minore)

- Backfill in `docs/prompt-log.md` pentru commiturile T1.1 si T1.2 (marcate ca backfill).
- `implementation-plan.md`: termen tinta corectat la **august 2026** (data din handoff,
  „august 2025", ramane ca inregistrare istorica, cu nota editoriala — handoff-ul NU se rescrie).
- Nota vizibila ca spike-urile S1–S3 sunt acum pe drumul critic.
- Documentarea trade-off-urilor acceptate: `stock_events` informativ (reconcilierea se
  intareste in Task C), `org_branding` enumerabil anonim, `profiles.email` duplicat.

## Ordine si dependente

PR-urile sunt independente ca fisiere (exceptie: toate adauga intrari in
`docs/prompt-log.md` — conflicte triviale la merge, se rezolva pastrand toate intrarile).
PR 2 (CI) va valida efectiv migrarile si testele din PR 1 dupa ce ambele ajung pe `main`;
ordinea de merge recomandata: PR 1 → PR 2 → PR 3 → PR 4.

## Ce NU se face acum (explicit)

- Reconcilierea automata `stock_events` ↔ `lots.remaining_qty` — se livreaza cu Task C
  (stock service), unde apare logica de consum.
- Restrictionarea `org_branding` — enumerarea slug-urilor e un trade-off acceptat pentru
  branding pe ecranul de login.
- T1.3 si Wave 2 — neatinse de acest plan.
