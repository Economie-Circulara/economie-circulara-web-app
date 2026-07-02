# Prompt Log

Jurnal al sarcinilor lucrate de agenti AI in acest repo. Conform regulii 1.2 din
[`AGENTS.md`](../AGENTS.md), la **fiecare commit** se adauga o intrare aici.
Cele mai noi intrari sus.

Format intrare:

- **Data** — YYYY-MM-DD
- **Agent / model**
- **Cerut** — rezumat al sarcinii
- **Facut** — rezumat al modificarilor

---

## 2026-07-02 — Claude Haiku 4.5

- **Cerut:** remediare proces documente — backfill prompt-log pentru T1.1/T1.2, actualizar termen
  MVP, documente trade-off-uri acceptate.
- **Facut:** adaugat doua intrari backfill in docs/prompt-log.md (T1.1/T1.2, 2026-07-01, marcat
  "(backfill)"), actualizat termen MVP in docs/plans/implementation-plan.md la "august 2026" cu nota
  istorica, adaugat sectiune AGENTS.md §4.1 "Limitari cunoscute / trade-off-uri acceptate"
  (stock_events audit, org_branding anonim, profiles.email duplication), formatted si lintat.

## 2026-07-01 — Claude Opus 4.8 (backfill)

- **Cerut:** auth + role routing + tenant context (T1.2).
- **Facut:** login/magic link/Google + password reset (src/features/auth/), getCurrentUser/requireRole
  (session.ts), tenant resolution (tenant.ts), org_branding RPC (migration 0002), route guards pentru
  (admin)/(client)/(auth) pages, middleware session refresh + guard. Commit: 92e170c.

## 2026-07-01 — Claude Opus 4.8 (backfill)

- **Cerut:** consolidated MVP schema + multi-tenant RLS (T1.1).
- **Facut:** migrare supabase/migrations/0001_core_schema.sql (17 tables, enums, app.* tenant helper
  functions, RLS policies, grants), RLS smoke test supabase/tests/rls_isolation.sql, regenerat
  src/lib/database.types.ts. Commit: 00cb830.

## 2026-07-02 — Claude Sonnet 5

- **Cerut:** PR 2 din planul de remediere (`docs/plans/code-review-remediation.md`, constatari
  3 si 4) — CI care sa ruleze efectiv testele de izolare RLS si sa faca blocanta verificarea
  de drift a tipurilor generate.
- **Facut:** `.github/workflows/db.yml` — dupa `supabase db reset`, ruleaza
  `supabase/tests/rls_isolation.sql` prin `psql -v ON_ERROR_STOP=1` (port `54322` din
  `supabase/config.toml`); verificarea de drift `database.types.ts` a devenit blocanta
  (`::error` + `exit 1`, comentariul „informativ, nu blocant" eliminat); trigger-ul `paths`
  extins cu `src/lib/database.types.ts`. Script nou `pnpm db:test` in `package.json` + rand nou
  in tabelul de comenzi din AGENTS.md §3.2. **Limitare mediu:** nu s-a putut porni Supabase
  local aici (egress `ghcr.io` blocat) — validat prin citire atenta a workflow-ului si a
  scripturilor; verificat `pnpm typecheck && pnpm lint && pnpm test` (verzi).

## 2026-07-02 — Claude Opus 4.8

- **Cerut:** fix RLS escaladare privilegii + politici client pe status (PR 1 din planul
  de remediere de securitate).
- **Facut:** migrare aditiva `supabase/migrations/0003_rls_hardening.sql`. (1) Trigger
  `app.enforce_profile_security` (SECURITY DEFINER, `search_path=''`) BEFORE INSERT OR
  UPDATE pe `public.profiles`: blocheaza pentru apelantii autentificati non-super_admin
  schimbarea `role`/`organization_id`/`client_id` (UPDATE) si crearea de profile
  `super_admin` (INSERT); contextele de serviciu (`auth.uid()` null) si super_admin trec
  neatinse. (2) Inlocuit politicile FOR ALL `orders_client_all` / `order_items_client_all`
  cu politici constiente de status: client SELECT orice status; INSERT/UPDATE/DELETE
  permise doar cat timp comanda e draft/sent (delete doar draft), cu tranzitie la
  'cancelled' permisa inainte de acceptare; toate WITH CHECK-urile de client pun si
  `organization_id = app.org_id()` (fix review: clientul nu poate re-punta randuri
  proprii catre alt tenant — gaura mostenita si de politicile FOR ALL din 0001).
  Politicile de staff neatinse. Extins `supabase/tests/rls_isolation.sql` (T5-T10).
  Validat prin citire — CI `db.yml` aplica migrarea pe PR.

## 2026-07-02 — Claude Fable 5

- **Cerut:** analiza plan + cod (suntem pe drum? zone gri / probleme), apoi plan de
  remediere a constatarilor si distribuirea lui pe subagenti, cu cate un PR per grup.
- **Facut:** review complet Wave 0–1 (schema/RLS, auth/tenant, CI, proces). Constatari
  majore: escaladare de privilegii prin `profiles_update`, politici client `FOR ALL` pe
  `orders`, teste RLS nerulate in CI, drift check ne-blocant, headere tenant setate pe
  raspuns in loc de request, useri OAuth fara profil, prompt-log lipsa la T1.1/T1.2,
  termen stale. Plan de remediere in 4 PR-uri:
  [`docs/plans/code-review-remediation.md`](plans/code-review-remediation.md).
  Adaugat `.claude/worktrees/` in `.gitignore` (worktree-uri temporare ale subagentilor).

## 2026-06-30 — Claude Opus 4.8

- **Cerut:** pregatirea pentru mutarea repo-ului in noua organizatie `Economie-Circulara` —
  setup script / session-start hook, `docs/setup.md` (Supabase + Vercel + environment) si
  workflow GitHub Actions pentru validarea DB.
- **Facut:** `.claude/hooks/session-start.sh` + `.claude/settings.json` (instaleaza deps,
  pregateste `.env.local`, expune Chromium pt. Playwright), validat end-to-end (hook + lint +
  test). `docs/setup.md` cu pasii de conectare la Supabase/Vercel si configurarea
  environment-ului Claude Code (acces GitHub App, network policy ghcr.io, secrete).
  `.github/workflows/db.yml` care porneste Supabase pe runner si aplica migrarile. Referinte
  adaugate in AGENTS.md.

## 2026-06-25 — Claude Opus 4.8

- **Cerut:** continuarea cu urmatorul task din plan (T0.2 — design system & tema).
- **Facut:** tokeni oklch extrasi din mockup → `globals.css` (paleta brand/accent, semantice
  status, pattern grid, mapare shadcn cu Tailwind v4 `@theme`); fonturi Archivo/IBM Plex
  Mono/Spectral via `next/font`. Primitive shadcn-style (`button`, `badge`, `table`, `input`,
  `label`, `card`) + `components.json`. Componente partajate: `StatusBadge` (registru statusuri
  din mockup), `DataTable` (TanStack: sortare/paginare/hover), `EmptyState`, `PageHeader`,
  `FormField`, `BrandProvider` (white-label), sidebar fix + `AppShell` + `nav-config` pe roluri.
  Pagina `/showcase` reda tot. Teste unitare pentru `StatusBadge` si `DataTable`. Verificat
  vizual prin screenshot. Toate check-urile verzi (typecheck/lint/test/build/format).

## 2026-06-25 — Claude Opus 4.8

- **Cerut:** continuarea cu urmatorul task din plan (T0.3 — integrare Supabase).
- **Facut:** `supabase init` (`config.toml`), migrare de baza `0000_extensions.sql`,
  clienti Supabase (`src/lib/supabase/{client,server,middleware}.ts`), helper `env.ts`,
  `middleware.ts` la root (refresh sesiune), scripturi `db:start|stop|reset`, `gen:types`,
  placeholder `database.types.ts`, teste unitare cu mocks pentru `env` si clientul browser.
  Actualizat AGENTS.md §3.1/§3.2 si `.env.example`.
  **Limitare mediu:** `pnpm db:start`/`gen:types` n-au putut rula aici — egress-ul catre
  imaginile Docker `ghcr.io/supabase/*` e blocat de politica (403). Se ruleaza local/CI.

## 2026-06-25 — Claude Opus 4.8

- **Cerut:** continuarea cu urmatorul task din plan (T0.1 — scaffolding).
- **Facut:** schela Next.js 16 (App Router, TS) + Tailwind v4, ESLint flat (`next` +
  `prettier`), Vitest (jsdom + RTL) cu 2 teste smoke, Playwright (config + 1 test e2e),
  structura `src/app|features|components/ui|lib`, husky + lint-staged, workflow CI
  (typecheck/lint/test), `.gitignore`, `.env.example`. Completat AGENTS.md §3.1/§3.2
  (structura repo + comenzi). Verificat: typecheck, lint, test, build si `pnpm dev` (HTTP 200).

## 2026-06-25 — Claude Opus 4.8

- **Cerut:** task-ul de scaffolding (T0.1) sa aiba ca criteriu de acceptare completarea
  sectiunii §3.1 din AGENTS.md (cai catre domenii + comenzi).
- **Facut:** adaugat criteriul de acceptare „AGENTS.md §3.1 completat" la T0.1 in
  `docs/plans/implementation-plan.md`.

## 2026-06-25 — Claude Opus 4.8

- **Cerut:** creare AGENTS.md cu reguli generale (planuri in `docs/plans/`, prompt log
  la commit, actualizare reguli la corectii, teste unitare obligatorii, descriere proiect
  - cai/comenzi), plus fisier de prompt log.
- **Facut:** adaugat `AGENTS.md` (reguli de proces, testare, descriere proiect, reguli de
  business). Creat `docs/prompt-log.md`. Mutat planul in `docs/plans/implementation-plan.md`
  si actualizat link-urile din `docs/index.md`.

## 2026-06-25 — Claude Opus 4.8

- **Cerut:** plan de implementare care imparte proiectul in task-uri pentru agenti AI.
- **Facut:** adaugat `docs/plans/implementation-plan.md` (waves, dependente, contracte
  interne, criterii de acceptare, spikes) si link din `docs/index.md`.
