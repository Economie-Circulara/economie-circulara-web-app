# Setup - Lateris Trace (repo web app)

Ghid de configurare pentru noul repo `Economie-Circulara/economie-circulara-web-app`:
dezvoltare locala, conectare la **Supabase** si **Vercel**, si configurarea unui
**environment Claude Code on the web** in care agentul poate rula tot (inclusiv baza de
date) fara restrictii.

---

## 0. Prerechizite

- Node 22, pnpm 10 (`corepack enable pnpm`)
- Docker (pentru stack-ul Supabase local)
- Conturi: GitHub (org `Economie-Circulara`), Supabase, Vercel

---

## 1. Dezvoltare locala

```bash
git clone https://github.com/Economie-Circulara/economie-circulara-web-app.git
cd economie-circulara-web-app
pnpm install
cp .env.example .env.local   # completeaza valorile (vezi sectiunea 2)
pnpm dev                     # http://localhost:3000
```

Comenzi utile: vezi [`AGENTS.md`](../AGENTS.md) §3.2.

---

## 2. Supabase

### 2.1 Ia cheile din proiectul cloud
In dashboard-ul Supabase → **Project Settings → API Keys** → tab **"Publishable and
secret API keys"** (chei API noi; le inlocuiesc pe cele legacy `anon` / `service_role`):

| Variabila (`.env.local`) | De unde |
| ------------------------ | ------- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (Settings → API) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key (`sb_publishable_…`) |
| `SUPABASE_SECRET_KEY` | secret key (`sb_secret_…`) — **doar pe server, niciodata in client/commit** |

> Regiune: alege **EU** (GDPR) la crearea proiectului — vezi `docs/handoff.md`.

### 2.2 Leaga repo-ul de proiectul cloud (o singura data)
```bash
pnpm supabase login                       # token din Supabase → Account → Access Tokens
pnpm supabase link --project-ref <REF>    # REF = din Project Settings → General
```

### 2.3 Stack local + migrari + tipuri
```bash
pnpm db:start     # porneste Postgres/Auth/Storage local (Docker; pull din ghcr.io)
pnpm db:reset     # aplica toate migrarile din supabase/migrations/
pnpm gen:types    # regenereaza src/lib/database.types.ts din schema
```

### 2.4 Publica schema in cloud (cand e gata)
```bash
pnpm supabase db push     # aplica migrarile locale pe proiectul cloud legat
```

### 2.5 Dezactiveaza sign-up-ul public (OBLIGATORIU)

Provizionarea conturilor e **doar prin invitatie de admin** (un rand `profiles` creat de
admin, nu de utilizator). Ca sa nu poata oricine sa-si creeze cont singur (inclusiv prin
"Continua cu Google"), dezactiveaza sign-up-ul public din dashboard-ul Supabase:

**Authentication → Sign In / Up → Auth Providers/Settings → dezactiveaza "Allow new
users to sign up"** (uneori afisat ca "Enable sign ups").

Fara acest pas, OAuth (Google) poate crea un rand nou in `auth.users` fara profil
corespunzator in `public.profiles`; callback-ul de autentificare (`/auth/callback`)
detecteaza acest caz si respinge accesul (`error=unprovisioned`), dar pasul de mai sus
elimina complet posibilitatea ca un cont neinvitat sa apara in `auth.users`.

---

## 3. Vercel

1. **Import** repo-ul in Vercel (New Project → din GitHub, org `Economie-Circulara`).
2. Framework: Next.js (auto-detectat). Build: `pnpm build`.
3. **Environment Variables** (Project Settings → Environment Variables) — aceleasi ca in
   `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Production + Preview)
   - `SUPABASE_SECRET_KEY` (doar unde e nevoie pe server; marcheaza ca secret)
4. Deploy. Pentru deploy din CLI: `pnpm dlx vercel link` apoi `vercel --prod`.

> White labeling pe domeniu (logo/culori per organizatie) se configureaza ulterior; vezi
> `docs/handoff.md` si T1.3 din plan.

---

## 4. Environment Claude Code on the web (ca agentul sa ruleze tot de-aici)

Documentatie: https://code.claude.com/docs/en/claude-code-on-the-web

La crearea environment-ului pentru acest repo:

1. **Acces GitHub App** pentru organizatia `Economie-Circulara` (altfel sesiunea nu poate
   citi/scrie repo-ul).
2. **Network policy** care permite egress catre **`ghcr.io`** si **Docker Hub**
   (`registry-1.docker.io`, `auth.docker.io`) — necesar ca `pnpm db:start` sa poata
   descarca imaginile Supabase. (Fara asta, stack-ul local nu porneste — vezi nota din
   `AGENTS.md` §3.2.)
3. **Secrete / env vars** in config-ul environment-ului (NU in repo):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_SECRET_KEY`, si token Vercel cand ajungem la deploy automat.
4. **Setup script:** repo-ul are deja un SessionStart hook
   ([`.claude/hooks/session-start.sh`](../.claude/hooks/session-start.sh)) care instaleaza
   dependentele si pregateste `.env.local` la pornirea sesiunii.

---

## 5. CI (GitHub Actions)

| Workflow | Ce face | Trigger |
| -------- | ------- | ------- |
| `.github/workflows/ci.yml` | typecheck + lint + teste unitare | PR, push pe `main` |
| `.github/workflows/db.yml` | porneste Supabase, aplica migrarile, genereaza tipuri | PR care atinge `supabase/**`, manual |

Pe runnerele GitHub, `ghcr.io` este accesibil, deci validarea bazei de date (migrari +,
ulterior, teste RLS) ruleaza acolo chiar daca mediul agentic local nu are acces.

> Asigura-te ca **Actions este activat** pe repo: Settings → Actions → General →
> "Allow all actions".
