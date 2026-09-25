# Plan - Domeniu propriu per tenant + profiluri de diferentiere

## Context

Platforma se livreaza simultan la doi clienti (A, B), ambii finantati din fonduri UE.
Aceeasi codebase, acelasi proiect Vercel, aceeasi baza Supabase, dar:

- fiecare tenant are **domeniul lui** (cel mai probabil un subdomeniu al domeniului
  clientului, ex. `trasabilitate.firmaA.ro`), iar orice link generat pentru un user al
  tenantului (auth, invitatii, redirecturi) duce pe acel domeniu;
- cele doua aplicatii trebuie sa **arate suficient de diferit** incat sa nu fie evident
  ca sunt acelasi produs.

## Decizii (2026-09-25, raspunsurile utilizatorului)

| # | Intrebare | Decizie |
|---|---|---|
| 1 | Tip domeniu | Domeniu propriu al clientului (probabil subdomeniu). Se stocheaza in `organizations.custom_domain` (existent). |
| 2 | Nume produs pe domeniul tenantului | Nedecis de client -> **implicit numele organizatiei**, suprascriptibil din profil (`productName`). „Lot cu Lot” NU apare pe domeniile tenantilor (fara „powered by”). |
| 3 | Expeditor emailuri Auth | Acelasi expeditor pentru ambii -> **fara Send Email Hook** in acest task. Linkurile duc totusi pe domeniul tenantului. |
| 4 | User pe domeniul altui tenant | **Redirect** pe domeniul propriu (cost mic, evita confuzia si activitate logata „pe domeniul gresit”). |
| 5 | Super-admin | Are acces pe **toate** domeniile (exceptat de garda de domeniu). |
| 6 | Nivel diferentiere | **(b)**: nume, navigare, dashboard, font/raza/sidebar/login + **header/footer PDF** diferit. |
| 7 | Fonduri UE / infrastructura partajata | OK, cu conditia: date **izolate** (RLS - existent), **auditabile** (`stock_events` + stampile - existent) si **usor de extras per companie** (export - NOU, T8). |

## Taskuri

### T1 - Originea linkurilor per organizatie

- `src/lib/site-url.ts`: `orgOrigin(customDomain, fallback)` pur -> `https://<custom_domain>`
  daca org-ul are domeniu, altfel originea canonica (`NEXT_PUBLIC_SITE_URL`). Fara
  fallback pe `<slug>.<root>`: ar cere DNS wildcard neconfigurat azi.
- `src/features/auth/origin.ts` (server):
  - `getOrganizationOrigin(orgId)` - domeniul organizatiei TINTA (invitatii din
    `/setari/utilizatori` si din `/platform`, unde super-adminul lucreaza de pe alt domeniu);
  - `getOriginForEmail(email)` - magic link: domeniul organizatiei careia ii apartine
    emailul (lookup server-side, raspunsul catre browser ramane identic);
  - `getRequestTenantOrigin()` - hostul cererii, DOAR daca e `custom_domain` al unei
    organizatii active (validat prin `org_branding`), altfel originea canonica. Folosit
    la OAuth si resetare parola: ambele sunt PKCE, iar cookie-ul verifier traieste pe
    hostul care a initiat cererea, deci callback-ul trebuie sa ramana pe acelasi host.
- Magic link-ul si invitatiile nu depind de host (template `token_hash` / flux implicit
  cu bridge), deci pot sari direct pe domeniul organizatiei.

### T2 - Garda de domeniu

- Pur, in `tenant.ts`: `tenantDomainRedirect(host, orgCustomDomain)` -> domeniul corect
  sau `null`. Nu se aplica pe host local (`localhost`, IP, `*.localhost`) si pe
  preview-urile Vercel (`*.vercel.app`) - altfel dev/e2e/QA ar fi aruncate in productie.
- `src/lib/supabase/middleware.ts`: pe rutele protejate, daca userul are organizatie cu
  `custom_domain` diferit de host -> `signOut({ scope: "local" })` (DOAR sesiunea de pe
  acest domeniu; `global` ar invalida si sesiunea valida de pe domeniul corect) +
  redirect la `https://<custom_domain>/login?error=wrong_domain`, cu cookie-urile sterse
  copiate pe raspunsul de redirect.
- Super-adminul (fara organizatie) si organizatiile fara `custom_domain` nu sunt afectate.
- Login: mesaj pentru `error=wrong_domain`.
- Teste: functia pura + `middleware.test.ts` (A pe domeniul B, domeniu corect,
  super-admin, localhost).

### T3 - Profil de tenant + nume de produs

- `src/config/tenant-profiles.ts`: `TenantProfile` tipat, cheie pe `slug`, cu `default`
  (= comportamentul actual). Hardcodat in cod, fara migrare/UI.
- `getTenantProfile(slug)` + propagare catre client printr-un context (date simple,
  fara functii - AGENTS.md §4.2).
- `PLATFORM_NAME` inlocuit cu `productName` rezolvat (profil -> numele organizatiei ->
  `PLATFORM_NAME` doar pe domeniul platformei) in: `metadata` (layout + pagini cu titlu
  hardcodat, ex. dashboard), login, help, PDF-uri (certificat, aviz, rapoarte),
  system prompt-ul asistentului.
- Teste: rezolvarea profilului si a numelui.

### T4 - Navigare si dashboard per profil

- `navForRole(role, profile)`: profilul poate da `navLayout` (ordine + grupare +
  etichete) peste acelasi set de `NavItem` (rute si roluri neschimbate -> `routes-smoke`
  ramane valid). Test: fiecare layout contine exact aceleasi href-uri ca `STAFF_NAV`.
- Dashboard: sectiunile existente extrase in componente (`KpiRow`, `StockChart`,
  `RecentOrders`, ...), profilul da `dashboardSections` (ordine/selectie).
- Profil B propus (de validat vizual): meniu plat, „Producție” + „Rapoarte” sus, grup
  „Vânzări” (Comenzi, Livrări, Clienți); dashboard orientat pe reciclare/productie.

### T5 - Sistem de teme (decizie 2026-09-25)

Tot ce tine de ASPECT e grupat in **teme cu nume**, alese per organizatie; ce tine de
ORGANIZARE (meniu, dashboard, nume produs, text footer PDF) ramane in profil (T3/T4).

- `src/config/themes.ts`: `ThemeKey` + definitii. O tema = paleta completa (light + dark:
  fundal, suprafete, sidebar, brand/accent, culori grafice), font (`next/font`), raza
  colturilor, densitate, pattern de fundal (SVG inline in CSS), `sidebarVariant`,
  `loginLayout`, stil header PDF.
- Aplicare: `data-theme="<key>"` pe `<html>` + blocuri CSS `[data-theme=...]` in
  `globals.css`; valorile non-CSS (login, sidebar, PDF) citite din definitie.
- **4 teme**: `default` (aspectul actual) + 3 noi, distincte vizibil (propunere, de
  validat pe showcase):
  - `teren` - ton cald/pamantiu, font umanist, colturi mari, pattern discret de puncte,
    sidebar deschis, login split cu imagine;
  - `industrial` - gri-antracit + accent portocaliu, font condensat, colturi mici, grila
    fina, sidebar inchis, login centrat;
  - `ciclu` - verde-teal, font geometric, colturi medii, pattern de linii/curbe, sidebar
    colorat, login split.
- Migrare: `organizations.theme text not null default 'default'` + check pe cheile
  cunoscute; modificabila **doar de super-admin** (acelasi model ca `ai_*`). Selector in
  `/platform`. `primary_color`/`secondary_color` raman override optional peste tema.
- `/showcase?theme=<key>` pentru previzualizare; test: fiecare tema defineste toate
  variabilele cerute.

### T6 - Header/footer PDF per profil

- Certificat, aviz, raport PDF: stilul header-ului (layout + culori) din TEMA, textul
  din footer (ex. date firma / „Document generat de <productName>”) din PROFIL.
- Test: randarea foloseste valorile din profil (fara snapshot binar).

### T7 - Configurare si documentatie

`docs/setup.md`, sectiune noua „Domeniu propriu pentru un tenant”:

1. `organizations.custom_domain` setat de super-admin (fara `https://`, lowercase).
2. Clientul adauga CNAME `trasabilitate.firmaA.ro -> cname.vercel-dns.com`.
3. Domeniul adaugat in proiectul Vercel (certificat automat).
4. Supabase Auth -> Redirect URLs: `https://trasabilitate.firmaA.ro/**`.
5. Test: invitatie + magic link + reset parola ajung pe domeniul tenantului.

### T8 - Export complet per organizatie (cerinta fonduri UE)

- Actiune super-admin: export ZIP pentru o organizatie - cate un CSV per tabel cu
  `organization_id` (+ tabelele copil legate prin FK), plus manifest (data, numar de
  randuri per tabel, hash SHA-256 per fisier) si fisierele din Storage ale organizatiei.
- Ruleaza pe clientul admin (service role), filtrat explicit pe `organization_id`;
  lista de tabele verificata de un test care compara cu tabelele din `database.types.ts`
  (orice tabel nou cu `organization_id` trebuie inclus sau exclus explicit).
- Plan detaliat separat inainte de implementare (`docs/plans/export-organizatie.md`).

## Impact asistent AI (AGENTS.md §2.4)

- Decizie: **none** (fara tool-uri noi). Singura schimbare: numele produsului din
  system prompt vine din profil (T3).

## Ordine

T1 -> T2 -> T3 (blocheaza livrarea), apoi T4, T5, T6 (independente), T7 odata cu T2,
T8 separat. Un PR per task (sau T1+T2 impreuna).

## Criterii de acceptare

- `pnpm typecheck && pnpm lint && pnpm test` verzi la fiecare task.
- User A invitat -> email cu link pe domeniul A; login pe domeniul B -> ajunge pe A.
- Super-adminul poate lucra pe orice domeniu.
- Pe domeniul A nu apare „Lot cu Lot”; navigarea, dashboard-ul, fontul, sidebar-ul,
  login-ul si header/footer-ul PDF difera vizibil intre A si B.
