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
