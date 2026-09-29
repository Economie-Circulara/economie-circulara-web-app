# Setup - Lot cu Lot (repo web app)

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
In dashboard-ul Supabase -> **Project Settings -> API Keys** -> tab **"Publishable and
secret API keys"** (chei API noi; le inlocuiesc pe cele legacy `anon` / `service_role`):

| Variabila (`.env.local`) | De unde |
| ------------------------ | ------- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (Settings -> API) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key (`sb_publishable_...`) |
| `SUPABASE_SECRET_KEY` | secret key (`sb_secret_...`) - **doar pe server, niciodata in client/commit** |
| `NEXT_PUBLIC_SITE_URL` | originea canonica a aplicatiei; in productie `https://www.lotculot.eu` |

> Regiune: alege **EU** (GDPR) la crearea proiectului - vezi `docs/handoff.md`.

### 2.2 Leaga repo-ul de proiectul cloud (o singura data)
```bash
pnpm supabase login                       # token din Supabase -> Account -> Access Tokens
pnpm supabase link --project-ref <REF>    # REF = din Project Settings -> General
```

### 2.3 Stack local + migrari + tipuri
```bash
pnpm db:start     # porneste Postgres/Auth/Storage local (Docker; pull din ghcr.io)
pnpm db:reset     # aplica toate migrarile din supabase/migrations/
pnpm gen:types    # regenereaza src/lib/database.types.ts din schema
```

### 2.4 Publica schema in cloud (cand e gata)

Automat: workflow-ul `.github/workflows/db-deploy.yml` ruleaza `supabase db push` pe
proiectul cloud legat de fiecare data cand `supabase/migrations/**` ajunge pe `main`
(dupa merge). Necesita 3 secrete in Settings -> Secrets and variables -> Actions:
`SUPABASE_ACCESS_TOKEN` (Account -> Access Tokens), `SUPABASE_PROJECT_REF` (Project
Settings -> General) si `SUPABASE_DB_PASSWORD` (parola DB, Project Settings -> Database).
Fara aceste secrete configurate, jobul pica si migrarea ramane neaplicata - vezi
tab-ul Actions pe repo dupa orice merge care atinge `supabase/migrations/`.

Manual (fallback, sau pentru o aplicare imediata fara sa astepti CI):
```bash
pnpm supabase db push     # aplica migrarile locale pe proiectul cloud legat
```

### 2.5 Dezactiveaza sign-up-ul public (OBLIGATORIU)

Provizionarea conturilor e **doar prin invitatie de admin** (un rand `profiles` creat de
admin, nu de utilizator). Ca sa nu poata oricine sa-si creeze cont singur (inclusiv prin
"Continua cu Google"), dezactiveaza sign-up-ul public din dashboard-ul Supabase:

**Authentication -> Sign In / Up -> Auth Providers/Settings -> dezactiveaza "Allow new
users to sign up"** (uneori afisat ca "Enable sign ups").

Fara acest pas, OAuth (Google) poate crea un rand nou in `auth.users` fara profil
corespunzator in `public.profiles`; callback-ul de autentificare (`/auth/callback`)
detecteaza acest caz si respinge accesul (`error=unprovisioned`), dar pasul de mai sus
elimina complet posibilitatea ca un cont neinvitat sa apara in `auth.users`.

### 2.6 Configureaza emailurile Auth pentru SSR (OBLIGATORIU)

Fluxul hosted trebuie sa trimita tokenul magic direct la callback-ul aplicatiei. In
**Authentication -> URL Configuration** seteaza:

- **Site URL:** `https://www.lotculot.eu`
- **Redirect URLs:** `https://www.lotculot.eu/auth/callback` + cate o intrare
  `https://<domeniu-tenant>/auth/callback` pentru fiecare organizatie cu domeniu propriu
  (vezi 3.1).

In **Authentication -> Email Templates -> Magic Link**, linkul butonului trebuie sa fie:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=magiclink">
  Autentifica-te
</a>
```

Nu folosi `{{ .ConfirmationURL }}` pentru acest flux SSR: acesta introduce pasul PKCE
cu `code`, dependent de cookie-ul browserului care a cerut emailul. Dupa orice schimbare
a template-ului, genereaza un link nou; linkurile anterioare sunt one-time si pot ramane
invalide.

Aplicatia pastreaza temporar un bridge client-side pentru linkurile vechi care ajung ca
`#access_token=...&refresh_token=...`. Fragmentul nu este trimis serverului; bridge-ul il
sterge imediat, valideaza sesiunea in browser si continua spre dashboard sau
`/set-password`. Acesta este fallback de compatibilitate, nu template-ul recomandat.

Dezactiveaza **click tracking/link tracking** in providerul SMTP (Resend). Rescrierea
URL-urilor din email poate invalida linkurile Auth. Daca infrastructura destinatarului
foloseste Safe Links/prefetch agresiv, varianta robusta ramane un ecran intermediar cu
confirmare explicita sau OTP numeric.

---

## 3. Vercel

1. **Import** repo-ul in Vercel (New Project -> din GitHub, org `Economie-Circulara`).
2. Framework: Next.js (auto-detectat). Build: `pnpm build`.
3. **Environment Variables** (Project Settings -> Environment Variables) - aceleasi ca in
   `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Production + Preview)
   - `NEXT_PUBLIC_SITE_URL=https://www.lotculot.eu` (Production; callback Auth canonic)
   - `SUPABASE_SECRET_KEY` (doar unde e nevoie pe server; marcheaza ca secret)
4. Deploy. Pentru deploy din CLI: `pnpm dlx vercel link` apoi `vercel --prod`.

> White labeling pe domeniu (logo/culori per organizatie) se configureaza ulterior; vezi
> `docs/handoff.md` si T1.3 din plan.

---

### 3.1 Domeniu propriu pentru o organizatie (tenant)

Fiecare organizatie poate lucra pe domeniul ei (un subdomeniu al domeniului clientului),
pe acelasi deploy si aceeasi baza (plan: `docs/plans/multi-domain-tenant-profiles.md`).

**Domeniile clientilor (decizie 2026-09-28):**

| Organizatie | Domeniu aplicatie        | Apex (site de prezentare, `sites/prezentare`) |
| ----------- | ------------------------ | --------------------------------------------- |
| Etora       | `circular.etora.ro`      | `etora.ro` / `www.etora.ro`                   |
| Maconxcx    | `abonamente.maconxcx.ro` | `maconxcx.ro` / `www.maconxcx.ro`             |

**DNS-ul e in Cloudflare.** Domeniile sunt inregistrate la chroot.ro
(`portal.chroot.ro`), care permite doar schimbarea nameserverelor, nu si inregistrari
DNS - deci zona DNS a fiecarui domeniu e gestionata in Cloudflare (plan Free).

#### 3.1.1 Mutarea DNS-ului in Cloudflare (o singura data per domeniu)

1. Cloudflare -> Add a domain -> `etora.ro` (plan Free). De preferat in contul
   proprietarului domeniului, cu echipa noastra invitata ca membru.
2. Verifica inregistrarile importate automat de Cloudflare (MX / email existent etc.) -
   tot ce trebuie sa functioneze in continuare trebuie sa fie in lista INAINTE de pasul 4.
3. `portal.chroot.ro`: daca DNSSEC e activ, dezactiveaza-l (altfel domeniul nu se mai
   rezolva dupa schimbarea nameserverelor). Se poate reactiva ulterior din Cloudflare.
4. `portal.chroot.ro`: inlocuieste nameserverele cu cele doua afisate de Cloudflare.
   Propagarea la `.ro` dureaza de obicei cateva ore (pana la ~24h); Cloudflare trimite
   email cand zona devine activa.

#### 3.1.2 Legarea subdomeniului de aplicatie (per organizatie)

1. **Vercel** (proiectul aplicatiei): Project -> Settings -> Domains -> adauga
   `circular.etora.ro`. Vercel afiseaza inregistrarile necesare - copiaza-le exact:
   - `CNAME circular -> <valoarea din Vercel>` (ex. `cname.vercel-dns.com` sau o valoare
     specifica proiectului, `…vercel-dns-0xx.com`);
   - eventual `TXT _vercel -> <valoarea din Vercel>` - apare cand domeniul-parinte e
     folosit si in ALT cont Vercel (site-ul de prezentare de pe apex).
2. **Cloudflare** -> DNS -> Records: adauga inregistrarile de mai sus cu **Proxy status =
   DNS only** (norisor gri). Cu proxy-ul Cloudflare activ, Vercel nu poate emite/reinnoi
   certificatul si apar redirecturi in bucla. Daca zona are inregistrari **CAA**, trebuie
   sa permita `letsencrypt.org`.
3. Asteapta in Vercel „Valid Configuration” (certificatul HTTPS se emite automat).
4. **Supabase:** Authentication -> URL Configuration -> Redirect URLs -> adauga
   `https://circular.etora.ro/**`. Fara pas, Supabase respinge `redirectTo` si trimite
   userul pe Site URL.
5. **Aplicatie (ULTIMUL pas):** super-admin -> `/platform` -> organizatia -> "Domeniu
   propriu" = `circular.etora.ro` (doar hostul; tot acolo se aleg tema si organizarea).
   Doar super-adminul il poate schimba (migrarea `0045`). Setat inainte de pasul 3,
   userii organizatiei ar fi redirectionati pe un domeniu care inca nu raspunde.

Identic pentru `abonamente.maconxcx.ro` (CNAME `abonamente` in zona `maconxcx.ro`).

**Site-ul de prezentare de pe apex** e in acest repo (`sites/prezentare`) - vezi 3.1.3.

**Emailurile (Auth + notificari) au brandul si expeditorul organizatiei** - vezi 3.2.
Template-urile din dashboard-ul Supabase NU se mai folosesc dupa activarea hook-ului.

Efecte:

- invitatiile (admin, staff, client), magic link-ul, resetarea parolei si login-ul
  Google ajung pe domeniul organizatiei;
- un user al organizatiei intrat pe alt domeniu e delogat acolo si trimis la login pe
  domeniul lui (`?error=wrong_domain`); super-adminul lucreaza pe orice domeniu;
- garda nu se aplica pe `localhost` si pe preview-urile `*.vercel.app`.

Verificare: invita un user de test -> linkul din email e pe domeniul organizatiei;
logheaza-te cu el pe `www.lotculot.eu` -> ajungi pe login-ul domeniului organizatiei.

#### 3.1.3 Site-ul de prezentare de pe apex (`sites/prezentare`)

Un singur cod (Next static, plan `docs/plans/site-prezentare-tenanti.md`), cate un
proiect Vercel per client, in ACELASI cont/echipa cu aplicatia:

1. **Vercel** -> Add New Project -> acelasi repo GitHub. Nume: `etora-site`
   (respectiv `maconxcx-site`). **Root Directory = `sites/prezentare`** (framework
   Next.js detectat automat).
2. **Environment Variables** (Production + Preview):
   - `SITE_TENANT=etora` (numele fisierului din `sites/prezentare/content/`);
   - optional `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` (aceleasi valori ca
     `NEXT_PUBLIC_SUPABASE_*` ale aplicatiei; cheia publishable e publica): la build,
     site-ul ia tema si logo-ul setate in `/platform` (RPC `org_branding` dupa
     `appDomain`). Fara ele - tema/logo-ul din fisierul de continut.
3. **Settings -> Git -> Ignored Build Step** = `git diff --quiet HEAD^ HEAD -- .`
   (build doar cand s-a schimbat ceva in `sites/prezentare`). La proiectul
   APLICATIEI, acelasi camp = `git diff --quiet HEAD^ HEAD -- . ':(exclude)sites'`,
   ca o modificare doar in site sa nu redeploy-eze aplicatia.
4. **Domains**: adauga `etora.ro` si `www.etora.ro` (unul redirectioneaza pe
   celalalt - Vercel propune). In Cloudflare pune inregistrarile cerute (de regula
   `A @ -> 76.76.21.21` si `CNAME www -> cname.vercel-dns.com`), **DNS only**, ca la
   3.1.2.
5. O schimbare de tema/logo in `/platform` NU redeploy-eaza site-ul: Deployments ->
   Redeploy (sau orice push in `sites/prezentare`).

Continutul se editeaza in `sites/prezentare/content/<tenant>.json` (validat la build: un
camp obligatoriu lipsa opreste build-ul). `"draft": true` = pagina e `noindex`; treci
pe `false` cand textele de la client sunt finale. Logo / sigle UE: fisiere in
`sites/prezentare/public/<tenant>/`, referite ca `/etora/logo.svg`. Local:
`cd sites/prezentare && pnpm install && SITE_TENANT=etora pnpm dev`.

### 3.2 Emailuri pe domeniul organizatiei (Resend + Cloudflare + hook Supabase)

Plan: `docs/plans/email-white-label-per-domeniu.md`. Toate emailurile (invitatie, magic
link, resetare parola, notificari de comenzi) folosesc logo-ul, tema si datele
organizatiei destinatarului si pleaca de pe domeniul ei **dupa ce domeniul e verificat**;
pana atunci pleaca de pe adresa platformei (`EMAIL_DEFAULT_FROM_ADDRESS`, implicit
`notificari@lotculot.eu`), cu numele organizatiei.

#### 3.2.1 O singura data (platforma)

1. **Resend**: aplicatia foloseste aceeasi cheie si la trimitere, si la gestionarea
   domeniilor. Daca in Vercel exista deja `EMAIL_API_URL=https://api.resend.com/emails` +
   `EMAIL_API_KEY`, nu mai e nevoie de nimic - DOAR ca cheia trebuie sa aiba permisiunea
   **Full access** (o cheie „Sending access” trimite emailuri, dar nu poate crea/verifica
   domenii; in `/platform/<id>` apare atunci eroarea Resend). Altfel: cheie noua Full
   access in `EMAIL_API_KEY` sau separat in `RESEND_API_KEY` (are prioritate la domenii).
2. Domeniul platformei (`lotculot.eu`) trebuie verificat si el in Resend (adresa de
   rezerva). Il poti adauga din Resend -> Domains, cu aceiasi pasi DNS ca mai jos.
3. **Supabase** -> Authentication -> **Hooks** -> **Send Email** -> tip HTTPS:
   - URL: `https://www.lotculot.eu/auth/email-hook`;
   - **Generate secret** -> copiaza valoarea (`v1,whsec_...`) in Vercel ca
     `SEND_EMAIL_HOOK_SECRET`, apoi redeploy;
   - activeaza hook-ul. Din acest moment Supabase nu mai trimite emailuri prin SMTP:
     le trimite aplicatia, cu brandul organizatiei userului. Daca hook-ul raspunde cu
     eroare, userul vede eroarea (nu se pierde nimic in tacere).
4. Invitatiile trimise inainte de deploy nu au `organization_id` in metadata - hook-ul
   gaseste organizatia dupa profil sau dupa domeniul din link, deci merg in continuare.

#### 3.2.2 Per organizatie (ex. Etora, Maconxcx)

1. Aplicatie: super-admin -> `/platform/<id>` -> sectiunea **Email** -> „Domeniu de
   trimitere” = domeniul firmei (ex. `etora.ro`), „Adresa expeditorului” (ex.
   `notificari`) -> **Salveaza domeniul**. Aplicatia creeaza domeniul in Resend (regiunea
   EU, click/open tracking oprite - altfel linkurile Auth sunt rescrise) si afiseaza
   inregistrarile DNS.
2. **Cloudflare** -> zona `etora.ro` -> DNS -> Records: adauga EXACT inregistrarile
   afisate, cu **Proxy status = DNS only**. De regula:

   | Tip | Nume                | Valoare                                  | Prioritate |
   | --- | ------------------- | ---------------------------------------- | ---------- |
   | MX  | `send`              | `feedback-smtp.eu-west-1.amazonses.com`  | 10         |
   | TXT | `send`              | `v=spf1 include:amazonses.com ~all`      | -          |
   | TXT | `resend._domainkey` | cheia DKIM (lunga) din pagina            | -          |

   Sunt pe subdomenii (`send`, `resend._domainkey`), deci **nu ating emailul existent al
   firmei** (MX/SPF de pe `etora.ro` raman neschimbate - nu adauga un al doilea SPF pe
   radacina). Recomandat, daca zona nu are deja: `TXT _dmarc` =
   `v=DMARC1; p=none; rua=mailto:<adresa firmei>` (dupa cateva saptamani fara probleme se
   poate trece pe `p=quarantine`).
3. Inapoi in `/platform/<id>` -> **Verifica DNS**. Propagarea dureaza de la minute la
   cateva ore; reapasa pana apare „Verificat”. De atunci emailurile organizatiei pleaca
   de pe `notificari@etora.ro`.
4. Adminul organizatiei poate seta din Setari numele expeditorului si adresa de raspuns
   (reply-to); domeniul si adresa expeditorului raman la super-admin (migrarea `0050`).

Logo-ul din emailuri e varianta orizontala (Setari); clientii de email nu afiseaza SVG,
deci pentru emailuri e de preferat un logo PNG/JPG.

Verificare: invita un user de test in organizatie -> emailul vine de la
`notificari@etora.ro`, are logo-ul/culoarea Etora, iar linkul duce pe
`circular.etora.ro`.

## 4. Environment Claude Code on the web (ca agentul sa ruleze tot de-aici)

Documentatie: https://code.claude.com/docs/en/claude-code-on-the-web

La crearea environment-ului pentru acest repo:

1. **Acces GitHub App** pentru organizatia `Economie-Circulara` (altfel sesiunea nu poate
   citi/scrie repo-ul).
2. **Network policy** care permite egress catre **`ghcr.io`** si **Docker Hub**
   (`registry-1.docker.io`, `auth.docker.io`) - necesar ca `pnpm db:start` sa poata
   descarca imaginile Supabase. (Fara asta, stack-ul local nu porneste - vezi nota din
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

> Asigura-te ca **Actions este activat** pe repo: Settings -> Actions -> General ->
> "Allow all actions".
