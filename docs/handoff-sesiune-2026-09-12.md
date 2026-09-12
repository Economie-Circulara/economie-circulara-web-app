# Handoff - sesiunea 2026-09-12 (reluarea proiectului înainte de recepție)

> **Pentru cine e acest document:** agentul/dezvoltatorul care preia lucrul de aici,
> fără context din sesiunea precedentă. Citește-l integral înainte de prima modificare.
> După el, citește **`AGENTS.md`** (regulile de proces sunt obligatorii) și
> **`docs/plans/implementation-plan.md`** (starea pe task-uri).
>
> Pentru contextul de **business** (ce construim și de ce), documentul de referință
> rămâne `docs/handoff.md` - acesta de aici e strict despre **starea tehnică și ce
> urmează**.

---

## 0. Situația în trei propoziții

Tot planul de implementare era marcat "livrat în cod", dar **aplicația nu funcționa**:
toate ecranele pentru admin/operator/client returnau HTTP 500, iar două reguli de
business din baza de date erau încălcate în silențiu. Cauza de fond nu a fost codul
prost scris, ci o **gaură de verificare**: `typecheck`, `lint`, 584 teste unitare și
`pnpm build` treceau toate, pentru că niciunul nu randa o pagină reală și niciunul nu
executa SQL pe un Postgres real. În această sesiune s-au reparat 4 bug-uri de această
clasă și s-au construit plasele de siguranță care le-ar fi prins.

**Prioritățile fixate explicit de client (în această ordine):**

1. **Funcționalitate** - aplicația să meargă cu adevărat
2. **Deployment**
3. **Documentație** (capturi de ecran pentru manual)
4. **E2E** (`mvp-flow.spec.ts`)

**Termen:** recepția e declarată de client ca **iminentă, sub 2 săptămâni** de la
2026-09-12. Proiectul e finanțat din fonduri europene; la recepție se verifică
funcționalitățile din `docs/anexa-1-specificatii-tehnice.md` (vezi
`docs/analiza-conformitate-anexa.md`).

---

## 1. Cum pornești mediul de lucru

```bash
pnpm install
pnpm db:start          # Supabase local (cere Docker pornit)
pnpm db:reset          # aplică migrările 0000-0018 + supabase/seed.sql
pnpm dev               # http://localhost:3000
```

`.env.local` e deja configurat spre Supabase **local** (`http://127.0.0.1:54321`);
linia pentru proiectul hosted e comentată în același fișier.

**Conturi din seed** (toate cu parola `password123`):

| Email | Rol |
| --- | --- |
| `admin@demo.local` | admin |
| `operator@demo.local` | operator |
| `client@demo.local` | client |
| `super@demo.local` | super_admin |

Organizația demo: **Lateris Demo** (`a0000000-0000-0000-0000-0000000000a1`, slug `demo`).

### Capcane de mediu, verificate

- **`psql` NU e instalat local.** Scripturile `pnpm db:test` și `pnpm db:test:business`
  presupun `psql` (există pe runnerele CI). Local, rulează-le prin container:
  ```bash
  docker exec -i supabase_db_economie-circulara psql -U postgres -d postgres \
    -v ON_ERROR_STOP=1 < supabase/tests/business_flow.sql
  ```
- **Playwright** cere browserul descărcat pentru versiunea instalată:
  `pnpm exec playwright install chromium`. Fără el, toate testele E2E cad cu
  "Executable doesn't exist", ceea ce arată ca un eșec de test dar nu e.
- **Nu rula `pnpm db:reset` dacă altcineva lucrează pe aceeași bază** - șterge tot.
  Pentru a aplica doar migrările noi: `supabase migration up`.
- **`rls_isolation.sql` își inserează fixture-urile în AUTOCOMMIT** și lasă în bază
  organizații de test (`Org A`, `Org B`, `Org C`). Dacă le vezi în lista de organizații
  a super-adminului, de acolo vin - nu e un bug de aplicație. `business_flow.sql`, în
  schimb, rulează totul în `begin; ... rollback;` și nu lasă urme. De asta, în CI,
  testele funcționale rulează **înaintea** celor de RLS.

---

## 1b. Mediul de PRODUCȚIE (deployat 2026-09-12)

### URL-uri

| Ce | URL | Stare |
| --- | --- | --- |
| **Producție (public)** | `https://economie-circulara-web-app.vercel.app` | **200 OK** - folosește-l pe acesta |
| URL-ul unic al deployment-ului | `...-ewwm8qidn-....vercel.app` | 302 -> Vercel SSO (Deployment Protection) |

Proiect Vercel: `economie-circulara-web-app` (`prj_Y75Lr6khth2jSnKw08pdslCQVBej`, scope
`gions-projects-cb2e6eea`). Supabase: `nnmsqefeennxgilnlcjx`, `eu-central-1` (GDPR, cum
cere `docs/handoff.md`).

**Verificat pe producție:** `/` și `/login` -> 200, login-ul randează formularul real
("Autentificare", "Conectare", "Parola", câmpul de magic link); `/dashboard`, `/portal`,
`/platform` -> 307 către login pentru un vizitator neautentificat, deci **guard-urile
funcționează în prod**.

**Deployment Protection** e activ pe URL-urile unice de deployment (Vercel SSO), dar
domeniul de producție e public. Dacă dai linkul cuiva din afară (auditor, client),
asigură-te că e domeniul de producție, nu URL-ul unic al deployment-ului.

### Variabile de mediu pe Vercel

| Variabilă | Production | Notă |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ setată | `https://nnmsqefeennxgilnlcjx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ setată | cheie publishable (publică prin design) |
| `SUPABASE_SECRET_KEY` | ❌ **LIPSEȘTE** | vezi mai jos |
| `NEXT_PUBLIC_ROOT_DOMAIN` | nesetată, intenționat | fără ea tenantul se rezolvă din segmentul de path - corect pentru un domeniu `vercel.app` |
| `EMAIL_API_URL` / `EMAIL_API_KEY` | nesetate | providerul de notificări cade pe mock (jurnalizează, nu trimite) |

**`SUPABASE_SECRET_KEY` lipsește** și nu a putut fi obținută automat (citirea cheilor
secrete e blocată - materializare de credențiale). Fără ea **eșuează la runtime** tot ce
trece prin clientul administrativ (`src/lib/supabase/admin.ts`):

- invitarea utilizatorilor (`settings/user-actions.ts`)
- crearea organizațiilor (`platform/service.ts`)
- upload de documente (`documents/service.ts`)
- generarea certificatelor (`certificates/service.ts`)
- notificările (`notifications/service.ts`)

Restul aplicației (autentificare, comenzi, stoc, producție, rapoarte) merge fără ea,
pentru că folosește clientul utilizatorului, cu RLS în vigoare.

Cum se adaugă - cheia se ia din Supabase Dashboard -> Settings -> API Keys -> tab
"Publishable and secret API keys":

```bash
printf '%s' "<cheia_secreta>" | vercel env add SUPABASE_SECRET_KEY production
vercel deploy --prod --yes    # variabilele noi se aplică abia la un redeploy
```

### Starea datelor pe baza hosted - de ce nu te poți loga încă

Baza are **schema completă (0018)**, dar date minime, rămase din teste manuale anterioare:
**2 organizații** (`ec3`, `test-demo`), **2 profiluri** (ambele cu rol `admin`), **0 itemi**,
**0 clienți**, **niciun `super_admin`**.

Două blocaje concrete pentru a testa logat:

1. **Niciunul dintre cele două conturi nu are parolă setată** (`encrypted_password` gol),
   deși emailul e confirmat - deci login cu email+parolă nu merge. Opțiuni: setează o
   parolă din Supabase Dashboard -> Authentication -> Users, sau folosește magic link /
   Google.
2. **Dacă folosești magic link sau Google**, verifică în Supabase Dashboard ->
   Authentication -> URL Configuration că **Site URL** și **Redirect URLs** includ
   `https://economie-circulara-web-app.vercel.app` - altfel linkul din email te trimite
   înapoi la `localhost:3000`.

Mai departe: fără `super_admin`, ruta `/platform` (creare de organizații) nu e accesibilă
nimănui în prod. Și nu există date demo - pentru o demonstrație de recepție merită
populată o organizație, fie prin UI, fie adaptând `supabase/seed.sql`.

---

## 2. Ce s-a făcut în această sesiune (12 commit-uri pe `main`)

`main` **NU e pushat** - push-ul a fost blocat de politica de permisiuni a sesiunii, deci
CI nu a rulat pe aceste commit-uri. Vezi §5. **Arborele de lucru e curat**: tot ce descrie
§6 a fost comis (secțiunea rămâne ca istoric al provenienței fiecărui set de modificări).

| Commit | Ce |
| --- | --- |
| `e942a8a` | Merge `origin/claude/app-plan-review-w3cr7a` (rămăsese nemerge) + regenerare canonică a tipurilor |
| `20f1e80` | Spike **S2** rezolvat - `docs/analiza-standarde-certificat.md` |
| `d12a942` | **Fix 2 bug-uri de DB** (0017, 0018) + suita `supabase/tests/business_flow.sql` |
| `75e5c36` | **Fix certificat**: PDF-ul afișa numărul comenzii în loc de al certificatului |
| `960fd02` | Acest document (versiunea inițială) |
| `c10cf40` | Acest document - secțiunea 6 completată cu raportul verificării funcționale |
| `eb97b3d` | **Fix cele 2 bug-uri P0** (randare + scrieri) + smoke test de rute + seed + 28 capturi |
| `5f6cdd1` | **Layout responsive pentru mobil** (Codex GPT-5) |
| `941b21a` | Fix `platform`: starea formularelor scoasă din modulul `"use server"` |
| `05fbb47` | Google OAuth activat pe stack-ul local (**atenție la CI** - vezi mesajul commitului) |
| `d6ea013` | Eliminarea hook-ului SessionStart din `.claude/` |

### 2.1 `main` era roșu la typecheck - reparat

Commitul anterior, `20705a7 "chore: generated types"`, regenerase
`src/lib/database.types.ts` contra unei baze care avea aplicate **doar migrările
0000-0002**. Fișierul pierduse tabela `deliveries`, valoarea de enum `reconditioning`
și **toate RPC-urile în afară de `org_branding`** (917 inserări / 1178 ștergeri = pierdere
netă) -> 14 erori TS. Tipurile au fost regenerate pe o bază cu **toate** migrările.

**Drift real rezolvat în treacăt** (nu de formatare): CLI-ul actual generează
argumentele RPC cu `default` în SQL ca **opționale fără `| null`** (`p_reason?: string`),
iar codul trimitea `null` explicit. Apelurile trimit acum `undefined` - cheia se omite,
PostgREST aplică `default null` din SQL, comportament identic. Consecință utilă:
`database.types.ts` e acum **exact** output-ul CLI-ului, deci drift-check-ul din
`.github/workflows/db.yml` poate fi făcut **blocant** (e încă informativ - vezi §4).

### 2.2 Branch de review care rămăsese nemerge

`origin/claude/app-plan-review-w3cr7a` conținea fix-urile F1-F7 dintr-un code review
(migrările **0014** guard suspendare complet, **0015** `accepted_at`/`delivered_at`/
`closed_at` pe comenzi, **0016** hardening `order_links` + index unic "un client = un
user", invitare client în `/setari/utilizatori`, `/cauta` pentru portalul client,
workflow CI `e2e.yml`). Acum e pe `main`.

### 2.3 Cele 4 bug-uri găsite și reparate

Toate patru erau **invizibile** pentru `typecheck`, `lint`, testele unitare și `build`.

| # | Bug | Cauză | Fix |
| --- | --- | --- | --- |
| 1 | **Toate ecranele admin/operator/client -> HTTP 500** (56/56 rute) | `nav-config.ts` punea componente Lucide în `NavItem.icon`, iar layout-urile server le pasau către `AppShell`/`Sidebar` (`"use client"`). Referințele de componentă nu sunt serializabile peste granița RSC. | `NavItem.icon` devine `NavIconName` (union strict de nume), maparea nume -> componentă trăiește în `sidebar.tsx`. *(necommitat - vezi §3)* |
| 2 | **Toate scrierile din 5 zone -> HTTP 500 la submit** | Un fișier `"use server"` poate exporta **doar funcții async**; 5 module de actions exportau și constanta de stare inițială pentru `useActionState`. GET-ul paginii mergea, POST-ul crăpa la evaluarea modulului. | Constantele mutate în `action-state.ts` per feature - convenția exista deja în proiect, respectată de 7 feature-uri, aceste 5 fuseseră omise. *(necommitat - vezi §3)* |
| 3 | **`set_lot_block` eșua la FIECARE apel** - blocarea loturilor nu a funcționat niciodată | `case when p_blocked then 'block' else 'unblock' end` rezolvă literalii la `text` înainte de atribuire, iar Postgres nu face cast implicit `text -> enum`. | Migrarea `0017_fix_set_lot_block_enum_cast.sql` - cast explicit. |
| 4 | **`cancel_order` nu refăcea stocul** și nu scria evenimentul `reversal` | Bucla citea evenimentele cu `select ... for update`. Sub RLS, o citire cu clauză de **blocare** cere și politica de **UPDATE**; `stock_events` e append-only (doar SELECT+INSERT) -> returna **0 rânduri**, bucla nu rula niciodată, fără nicio eroare. | Migrarea `0018_fix_cancel_order_stock_restore.sql` - fără `for update` pe auditul append-only. |

Bug-ul 4 merită subliniat: regula "stocul se scade la acceptare, se reface la anulare"
(`docs/handoff.md`, `AGENTS.md` §4) era **pe jumătate nefuncțională**, cu stoc pierdut
definitiv la fiecare anulare a unei comenzi acceptate.

**Lecțiile sunt scrise în `AGENTS.md` §4.2** ca să nu fie reînvățate. Citește-le înainte
să scrii plpgsql sau să treci date peste granița server/client.

### 2.4 Plasele de siguranță adăugate

| Plasă | Ce prinde |
| --- | --- |
| `supabase/tests/business_flow.sql` (`pnpm db:test:business`) | **12 teste** pe invarianții de business, direct pe RPC-uri, pe Postgres real: FIFO pe `entry_date`, sărirea loturilor blocate, atomicitate la stoc insuficient, ordinea la selecție manuală de loturi, scăderea stocului la acceptare + `accepted_at`, refacerea la anulare, loturi de output la procese, `reconditioning` ca proveniență distinctă, reintrarea în stoc la retur. Rulează în CI (`db.yml`), înaintea `rls_isolation.sql`. |
| `tests/e2e/routes-smoke.spec.ts` | Fiecare rută, pentru fiecare rol: HTTP < 400, fără "This page couldn't load", există `<h1>`, zero `pageerror`. Rutele se citesc din `STAFF_NAV`/`CLIENT_NAV`, deci **o intrare nouă în sidebar intră automat în smoke**. Prinde clasa bug-ului 1. *(necommitat)* |

**Audit de vecinătate făcut:** toate celelalte `for update` din migrări sunt pe
`orders`/`order_items`/`lots`/`processes`, care au politici UPDATE/ALL -> neafectate. Și
toate expresiile enum din `insert`-uri: `0004` linia 237 era singurul caz.

---

## 3. Starea arborelui de lucru - CITEȘTE ÎNAINTE DE PRIMUL COMMIT

`git status` are modificări necommitate de **două proveniențe diferite**. Nu le amesteca.

### 3.1 WIP-ul clientului - NU-L ATINGE fără să întrebi

```
 M supabase/config.toml                              (google enabled = true)
 D .claude/hooks/session-start.sh
 D .claude/settings.json
 M src/features/platform/actions{,.test}.ts
 M src/features/platform/create-organization-form.tsx
 M src/features/platform/org-status-controls.tsx
?? src/features/platform/form-state.ts
```

E muncă începută de client acum ~8 săptămâni și lăsată neterminată. Detaliu
interesant: `platform/form-state.ts` e **exact** fixul bug-ului 2, pe feature-ul
`platform` - clientul lucra la acea problemă când s-a oprit. Fixul din §2.3 duce la
capăt aceeași curățenie, pe cele 5 module omise.

Clientul n-a decis încă ce se comite din acest set (în special `config.toml` cu Google
OAuth activat și ștergerea configului `.claude/`). **Întreabă-l.**

### 3.2 Restul modificărilor necommitate - fix-urile P0 și capturile

Fix-urile bug-urilor 1 și 2, plus munca de capturi de ecran:

```
 M src/components/layout/nav-config.ts, sidebar.tsx        (bug 1)
 M src/features/{items,recipes,settings,stock}/actions.ts  (bug 2)
 M src/features/{items,recipes,settings,stock}/*-form.tsx  (importuri actualizate)
?? src/features/{items,recipes,settings,stock}/action-state.ts
?? tests/e2e/routes-smoke.spec.ts
?? tests/e2e/manual-screenshots.spec.ts
?? docs/manual/img/
?? docs/plans/task-manual-screenshots.md
?? docs/plans/mobile-responsive-layout.md
```

Acestea sunt gata de commit (verifică `typecheck`/`lint`/`test` mai întâi). Le poți
comita **separat de §3.1**.

---

## 4. Ce urmează, în ordinea priorităților clientului

### Prioritate 1 - funcționalitate

1. **Continuă verificarea fluxului 1->9 prin UI, cu efectul verificat în date.**
   Fluxul e descris în `docs/handoff.md` §"Flux complet MVP". Ambele bug-uri P0 au
   blocat pașii 3-4 (definire itemi/rețete, intrare stoc), deci zonele de după ele sunt
   **slab verificate**. Regula de lucru care a dat rezultate: nu te opri la "UI-ul a
   răspuns 200" - verifică în baza de date că efectul s-a produs.
2. **Verifică prin UI cele două fix-uri de DB** (migrările 0017/0018): blocare/deblocare
   lot din `/stoc`, și acceptă -> anulează o comandă, confirmând că stocul revine și că
   apare evenimentul `reversal` în `/stoc/audit`.
3. **Extinde plasa de siguranță pe SCRIERI.** `routes-smoke.spec.ts` verifică doar
   GET-uri, iar **ambele** bug-uri P0 au fost la scriere - un smoke test care nu apasă
   niciun submit ar fi lăsat bug-ul 2 să treacă. Acoperire necesară pe submit: itemi
   (creare + editare), rețetă (creare + componentă), lot (înregistrare + blocare),
   setări organizație, invitare utilizator, client, comandă. Suficient: submit-ul să nu
   dea 5xx și să ajungă la redirect/mesaj de succes.
4. **Certificat - completări semnalate de S2** (detalii și motivație în
   `docs/analiza-standarde-certificat.md`, secțiunea de delta):
   - efort mic, fără migrare: `%` materii prime secundare pe certificat (logica există
     în `reports/calculations.ts`, `SECONDARY_PROVENANCES`), identificatorii de lot
     (`TraceabilitySnapshotItem` nu are `lotIds`), etichetele nodurilor de proces
     (acum `Proces {8 hex}`, deși `RawProcess.type`/`completedAt` sunt deja încărcate),
     data și adresa de livrare, codul UIT din `deliveries`;
   - cere **migrare**: `organizations` nu are `cui`, `reg_com`, `address` - un certificat
     fără CUI-ul emitentului nu e utilizabil comercial;
   - **risc de corectitudine:** `materials[].percentage` se normalizează peste cantități
     care pot fi în **unități de măsură diferite** (platforma e "un UM unic per produs,
     fără conversii") -> procentele pot însuma mărimi neomogene. Ascunde coloana sau
     etichetează-o ca indicativă când `new Set(units).size > 1`.

### Prioritate 2 - deployment - ✅ FĂCUT, cu 3 lucruri rămase

5. ✅ **Supabase hosted migrat la 0018.** Era la 0010; s-au aplicat 0011-0018 cu
   `supabase db push`. Verificat independent prin API: toate cele 19 migrări sunt
   înregistrate pe proiectul `nnmsqefeennxgilnlcjx` (`eu-central-1`).
6. ✅ **Deployat în producție pe Vercel.** Vezi §1b pentru URL, variabile setate și ce
   mai lipsește.
7. **SMTP real** pentru notificări (finding F5, nerezolvat) - fără credențiale,
   notificările nu pleacă efectiv (providerul cade pe mock, care doar jurnalizează).

### Prioritate 3 - documentație

8. **Capturile de ecran** din `docs/manual/` - erau 27 de placeholder-e `📷 **[Captură
   de adăugat: ...]**` în 4 fișiere. O parte au fost făcute în această sesiune
   (`docs/manual/img/`, generate cu `tests/e2e/manual-screenshots.spec.ts`); vezi §6
   pentru câte rămân. Livrabil obligatoriu Anexa 1.
   *Notă: placeholder-ul din `docs/manual/README.md` e exemplul de format - nu e o
   captură de adăugat.*

### Prioritate 4 - E2E

9. **`tests/e2e/mvp-flow.spec.ts` nu a trecut niciodată.** Prima rulare reală a fost în
   această sesiune: `home.spec.ts` trece, `mvp-flow.spec.ts` cade pe selectori. Primul
   blocaj concret: `getByLabel("Email")` e ambiguu pe `/login` (formularul are și un
   input `#magic-email` pentru magic link). Probabil e la câțiva selectori distanță de
   a trece, mai ales acum că aplicația funcționează.
10. **Fă blocant drift-check-ul de tipuri** din `db.yml` (scoate `|| true` și
    `continue-on-error`, folosește `exit 1`). Nota din workflow spunea că aștepta "o
    rulare canonică `pnpm gen:types` confirmată drift-free" - acum există (§2.1).
    Similar pentru `e2e.yml`, care e `continue-on-error: true`.

### Rămase deschise, nelegate de priorități

- **S4 - Socrate.io (e-Transport real).** Adapterul e construit complet în spatele unei
  interfețe (`src/features/deliveries/e-transport.ts`): provider **mock** activ (UIT
  determinist, prefix `MOCK-UIT-`) + schelet `SocrateETransportProvider` care aruncă
  până la credențiale. Când vin: completează `declare`, setează
  `ETRANSPORT_PROVIDER=socrate` + `SOCRATE_API_URL`/`SOCRATE_API_KEY`. **Dependență
  externă cu lead time (contract) - nu e sub controlul nostru.** Confirmat de S2 că
  obligația e reală: agregatele (NC 2505, NC 2517) sunt bunuri cu risc fiscal ridicat.
- **Disclaimer legal pe certificat.** S2 a redactat un text complet (în
  `docs/analiza-standarde-certificat.md`) care protejează atât emitentul cât și
  platforma: documentul e declarație **voluntară** de trasabilitate, NU declarație de
  performanță, NU atestă încetarea statutului de deșeu, nu înlocuiește marcajul CE.
  **Nu a fost aplicat pe certificat** - e text cu consecințe juridice, deci decizia
  aparține clientului. Documentul conține și 8 întrebări pentru jurist.
- **`activity_log` general** - singurul 🟡 rămas în `docs/analiza-conformitate-anexa.md`,
  marcat acolo ca îmbunătățire **opțională**, nu cerință.
- **`docs/plans/mobile-responsive-layout.md`** - plan apărut în această sesiune pentru o
  problemă de layout pe mobil; vezi §6.

---

## 5. Decizii / acțiuni care rămân la client (nu le lua singur)

1. **Push pe `origin/main`** - commit-urile sunt doar locale; push-ul a fost **blocat de
   politica de permisiuni** a sesiunii. Trebuie făcut de client (sau cu permisiunea
   acordată explicit). Până atunci CI nu rulează pe ele.
2. **`SUPABASE_SECRET_KEY` pe Vercel** - vezi §1b. Nu a putut fi obținută automat
   (materializare de credențiale, blocată corect).
3. **Configurarea Auth pe proiectul hosted** - vezi §1b: parolă pentru un admin + Site
   URL / Redirect URLs.
4. **Dacă se pune disclaimer-ul legal pe certificat** (text redactat în
   `docs/analiza-standarde-certificat.md`).
5. **Data reală de recepție** - `docs/handoff.md` și planul spun "august 2026", dată deja
   trecută la 2026-09-12; clientul a declarat "sub 2 săptămâni", dar data exactă n-a fost
   confirmată în documente.
6. **Dacă producția rămâne în spatele Vercel Deployment Protection** - vezi §1b.

---

## 6. Arborele necommitat conține TREI seturi de muncă suprapuse

> **Citește asta înainte de `git add`.** La predare, `git status` amestecă munca a trei
> autori diferiți, dintre care unul **era încă în lucru**. Nu face `git add -A`.

Starea verificărilor pe arborele combinat, rulate la predare:
`pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ **584/584**.
Deci arborele e coerent ca tipuri și teste - dar vezi setul C, care poate fi incomplet
**funcțional**.

### Set A - WIP-ul clientului (vezi §3.1)

`src/features/platform/*`, `supabase/config.toml`, ștergerile din `.claude/`.
**Nu-l atinge fără să întrebi.**

### Set B - fix-urile P0 + capturile (gata de commit, verificate)

Livrat și raportat complet; `typecheck`/`lint`/`test`/`routes-smoke` treceau pe el.

- **Fix P0 #1 (randare):** `src/components/layout/nav-config.ts` (`NavItem.icon` ->
  `NavIconName`, union strict de 13 nume, importurile Lucide scoase din modul) +
  `src/components/layout/sidebar.tsx` (`NAV_ICONS: Record<NavIconName, LucideIcon>`).
- **Fix P0 #2 (scrieri):** noi `src/features/{items,recipes,stock,settings}/action-state.ts`;
  modificate `{items,recipes,stock,settings}/actions.ts`, `settings/user-actions.ts`, plus
  consumatorii (`items/item-form.tsx`,
  `recipes/{create-recipe-button,recipe-new-form,recipe-editor}.tsx`,
  `stock/{lot-block-controls,lot-form}.tsx`,
  `settings/{settings-form,invite-staff-form,invite-client-form}.tsx`) și testele
  (`items/actions.test.ts`, `recipes/actions.test.ts`, `settings/user-actions.test.ts`).
- **A11y:** `stock/lot-block-controls.tsx` - `aria-label="Motivul blocării"` pe inputul de
  motiv (avea doar `placeholder`, deci niciun nume accesibil).
- **Seed reparat:** `supabase/seed.sql` - `CMD-2026-0001` era `closed` cu
  `accepted_at`/`delivered_at`/`closed_at` NULL. Acum cronologic: creată -6z -> acceptată
  -5z -> livrată -3z (= `delivery_date`) -> închisă -2z; `issued_at` al certificatului
  coincide cu `closed_at`.
- **Teste noi:** `tests/e2e/routes-smoke.spec.ts`, `tests/e2e/manual-screenshots.spec.ts`.
- **Capturi:** `docs/manual/img/` - **28 PNG**, 1440×900 @2x, luate după `pnpm db:reset`
  pe date demo curate. **23 din 26 de placeholder-e reale înlocuite** în
  `docs/manual/{utilizare-admin-operator,utilizare-client,ghid-administrare}.md`; toate
  referințele rezolvă.
- `docs/plans/task-manual-screenshots.md`, intrare în `docs/prompt-log.md`.

### Set C - refactor responsive/mobil, de la o SESIUNE CONCURENTĂ, posibil NETERMINAT

O altă sesiune lucra în paralel pe același arbore, pe layout-ul de mobil (plan în
**`docs/plans/mobile-responsive-layout.md`** - citește-l, explică motivația: shell-ul nu
avea nicio adaptare pentru mobil, iar `docs/analiza-conformitate-anexa.md` marca
"Interfață intuitivă, echipamente uzuale" ca ✅ motivat prin "responsive").

Fișiere care par să-i aparțină:
`src/components/layout/{app-shell,topbar,sidebar,nav-config}.tsx`,
`src/components/{page-header,data-table}.tsx`,
`src/app/(admin)/layout.tsx`, `src/app/(client)/layout.tsx`, `src/app/platform/layout.tsx`,
`src/app/(admin)/{clienti,comenzi,itemi,rapoarte,stoc,stoc/audit}/page.tsx`,
`src/features/client-portal/catalog-view.tsx`, `src/features/orders/order-form.tsx`,
**nou** `src/components/ui/sheet.tsx`, plus `playwright.config.ts`, `package.json`,
`pnpm-lock.yaml`, `docs/analiza-conformitate-anexa.md`.

**Atenție la trei lucruri:**

1. **`nav-config.ts` și `sidebar.tsx` sunt atinse de AMBELE seturi (B și C).** Fix-ul P0
   #1 trăiește exact în ele, deci nu poți comita B fără o parte din C. Verifică diff-ul
   pe aceste două fișiere înainte de commit și asigură-te că `NavIconName`/`NAV_ICONS`
   au supraviețuit refactorului.
2. **`.pnpm-store/` a apărut în arbore și NU e în `.gitignore`.** Nu-l comita -
   adaugă-l în `.gitignore`.
3. Sesiunea concurentă a reparat singură un bug pe care îl semnalase revizia: `Sidebar`
   folosea `position-sticky`, care nu e clasă Tailwind validă (acum `sticky`).

**Recomandare:** confirmă cu clientul dacă sesiunea de responsive s-a încheiat, înainte
de a comita orice din `src/components/layout/` sau `src/app/**/layout.tsx`.

---

## 6b. Bug-uri găsite și NEREPARATE (de la verificarea funcțională)

Ordonate după severitate. Acestea sunt cele mai valoroase pentru tine - sunt confirmate,
cu cauză identificată.

| Sev. | Ce | Unde / cauză |
| --- | --- | --- |
| MEDIU | **Bara de căutare din `/catalog` e strivită la ~60px** - se vede în `docs/manual/img/client-catalog.png`, deci ar fi ajuns așa în manualul de recepție | `client-portal/catalog-view.tsx:220`: `` className={`${selectClassName} w-56`} ``, iar `selectClassName` conține deja `w-full` -> conflict Tailwind nerezolvat, `w-full` câștigă. Fix: `cn(selectClassName, "w-56")` (tailwind-merge e deja în proiect). Nereparat pentru a nu intra în conflict cu setul C. |
| MEDIU | **`tests/e2e/mvp-flow.spec.ts` cade la login** | `getByLabel("Email")` prinde 2 elemente (câmpul de login + `#magic-email`) -> strict mode violation. E la un selector distanță: folosește `#email` / `#password`. |
| MIC | **Rândurile din `/clienti` nu sunt link-uri** | `ClientTable` navighează prin `onRowClick` (`router.push`) pe `<tr>`: inaccesibil din tastatură, fără "deschide în tab nou", fără URL la hover. |
| MIC | **Badge-ul dev-tools Next apare în capturi** (cercul "N", stânga-jos) | Pentru livrabilul de recepție: `devIndicators: false` sau capturi pe build de producție. |
| MIC | **Diacritice lipsă pe dashboard** | "Privire de ansamblu asupra activitatii." |
| INFO | **Manualul are text depășit** | `utilizare-admin-operator.md` §9 spune că "nu există încă o rută `/livrari`" - există. `manual/README.md` §"Notă importantă" spune că manualul nu conține capturi - acum e fals. |
| INFO | `/livrari/nou` dă 404 fără `?orderId=` | Prin design (`notFound()` explicit). Nu e bug; de aceea nu e în `routes-smoke`. |

### Cele 3 capturi rămase

Toate din lipsă de date în seed, nu din bug: formularul de **Retur/Garanție** (admin și
client) și **detaliul comenzii client cu "Repetă comanda"** - firma `Client Demo SRL`
n-are nicio comandă finalizată. Cea mai simplă rezolvare: adaugă în `supabase/seed.sql` o
comandă `closed` pentru `Client Demo SRL` (`c0000000-0000-0000-0000-0000000000c1`), apoi
rerulează `tests/e2e/manual-screenshots.spec.ts`.

---

## 6c. Fluxul 1->9 - ce e verificat efectiv prin UI

**Confirmat, cu efectul verificat în baza de date:**

- **Pas 2 - client nou:** lookup ANAF pe CUI real (`14399840`) a precompletat "DANTE
  INTERNATIONAL SA"; clientul s-a creat, redirect corect. *Integrarea externă e vie.*
- **Pas 3 - itemi:** creare item OK după fix (8 -> 9 itemi în DB).
- **Pas 4 - intrare stoc:** lot nou (`Moloz` 120t) + `stock_event` de tip `intake`.
- **Blocare/deblocare lot** (migrarea 0017): evenimente `block` și `unblock` scrise.
- **Pas 7-8 - comandă -> trimite -> acceptă:** `consumption -7.000` pe `Cărămizi eco`.
- **Anulare comandă** (migrarea 0018): `reversal +7.000`, `remaining_qty` revenit la
  100.000, status `cancelled` - confirmat pe calea reală din UI, nu doar în SQL.
- **Export CSV audit stoc:** download real.
- **Guard-uri:** clientul redirectat de pe toate ecranele staff și de pe `/platform`;
  nelogat -> `/login`; comanda altui client -> 404.

**Atins superficial** (ecranul randează, acțiunea neverificată în date): rapoarte, setări
organizație, utilizatori, `/platform`, portalul client (catalog/comenzi/documente).

**NEATINS deloc - aici începe munca ta:**

- **pașii 5-6: reciclare + producție cu consum FIFO** (verificate doar la nivel de RPC,
  prin `business_flow.sql` B10, nu prin UI)
- **pasul 9: livrare -> închidere -> generare certificat, prin UI**
- livrare planificată + aviz + declarare e-Transport
- retur / garanție și acceptarea returului
- export PDF/CSV pe rapoarte
- invitare utilizator; creare organizație; suspendare/reactivare organizație

## 7. Reguli de proces - obligatorii în acest repo

Din `AGENTS.md` (citește-l, nu doar acest rezumat):

- **1.1** Orice task cu plan -> fișier în `docs/plans/` **înainte** de a coda.
- **1.2** **La fiecare commit**, intrare în `docs/prompt-log.md` (dată, agent/model, ce
  s-a cerut, ce s-a făcut), cele mai noi sus, **în același commit**.
- **1.3** Orice corecție pe o regulă de business sau pe o direcție de dezvoltare ->
  adaugă regula în `AGENTS.md` (§3 sau §4), în același commit.
- **2.1/2.2** Teste unitare obligatorii pentru logica nouă; **mocks, nu spies**.
- **Migrări aditive, numerotate.** Nu se editează niciodată o migrare existentă - se
  adaugă una nouă. Următorul număr liber: **0019**.
- **Schema e contractul comun.** Nu redefini modele; consumă
  `src/lib/database.types.ts`, regenerat cu `pnpm gen:types` pe o bază cu **toate**
  migrările aplicate (vezi §2.1 - greșeala asta a spart `main`).
- **Română în UI, engleză în cod.**

**Definition of Done:** `typecheck` + `lint` trec, teste pentru logica nouă trec, RLS
respectat unde e cazul, fără secrete hardcodate, intrare în `docs/prompt-log.md`.
Adaugă la asta, pe baza acestei sesiuni: **dacă ai atins o regulă de business în DB,
adaugă un test în `supabase/tests/business_flow.sql`** - un test unitar cu RPC-ul
mock-uit nu dovedește nimic despre comportamentul real.

---

## 8. Capcanele care au produs bug-urile (rezumat - detalii în `AGENTS.md` §4.2)

- **Enum + expresie = cast obligatoriu.** Într-un `INSERT` către o coloană enum, un
  literal simplu e coercitat automat, dar o **expresie** (`case`, `coalesce`) rezolvă
  literalii la `text`, iar Postgres nu face cast implicit `text -> enum`.
- **`SELECT ... FOR UPDATE` sub RLS cere politica de UPDATE.** Rândurile care n-o
  satisfac sunt **filtrate în silențiu**, nu eroare. Pe tabele append-only
  (`stock_events`) orice `for update` returnează 0 rânduri.
- **Corpul unei funcții plpgsql nu e verificat la tip la creare, doar la execuție.** O
  migrare aplicată cu succes **nu** dovedește că RPC-ul funcționează.
- **Granița RSC transportă doar date simple.** Nu pasa referințe de componente din
  Server Components către Client Components - eroare la **runtime**, iar `build` trece.
- **Un fișier `"use server"` poate exporta DOAR funcții async.** Constantele de stare
  pentru `useActionState` stau în `action-state.ts` per feature. Eroarea apare doar la
  **submit real**, nu la build și nu la randarea paginii.

Numitorul comun: **`build` verde nu însemna aplicație funcțională.** Orice verificare
care contează aici trece prin randarea unei pagini reale sau prin execuția de SQL pe un
Postgres real.
