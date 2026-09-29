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
- Super-adminul (fara organizatie) nu e afectat.
- **Extindere (2026-09-29):** userul unei organizatii FARA `custom_domain` lucreaza doar
  pe domeniile platformei (originea `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_ROOT_DOMAIN` si
  subdomeniile lui). Pe domeniul altui tenant vedea brandul acestuia peste datele lui
  (bug raportat: cont „Organizatie Test” logat cu Google pe `abonamente.maconxcx.ro`).
  Acelasi tratament: `signOut` local + login pe originea canonica. Fara domeniul
  platformei configurat, garda nu redirectioneaza. Impact asistent AI: `none`.
- Login: mesaj pentru `error=wrong_domain`.
- Teste: functia pura + `middleware.test.ts` (A pe domeniul B, domeniu corect,
  super-admin, localhost).

### T3 - Profil de tenant + nume de produs (implementat 2026-09-26)

- `src/features/branding/tenant-profiles.ts`: `TenantProfile` (deocamdata doar
  `productName`; T4 adauga meniu/dashboard), cheie pe `organizations.slug`, fara profil
  -> `DEFAULT_PROFILE`. Hardcodat in cod, fara migrare/UI.
- `productNameFor(org)`: `profile.productName` -> numele organizatiei DACA are
  `custom_domain` -> altfel „Lot cu Lot” (organizatiile de pe domeniul platformei nu se
  schimba). `issuerCreditFor(org)`: creditul „emis de X” din subsolul documentelor,
  omis cand ar repeta numele organizatiei.
- `src/features/branding/queries.ts#getHostProductName`: numele pe hostul cererii
  (independent de sesiune) - `generateMetadata` in layout-ul radacina da template-ul
  `%s - <productName>`; paginile isi dau doar partea specifica ("Comenzi").
- Inlocuit „Lot cu Lot” in: titluri (toate paginile), subsol certificat (PDF + ecran),
  aviz, raport PDF, numele expeditorului de notificari (cand org-ul n-are
  `email_from_name`), system prompt-ul asistentului, manualul din `/ajutor`
  (`brandManual`), logo-ul platformei din sidebar (ascuns pe domeniu propriu).
- Ramane „Lot cu Lot” doar in zona super-admin (`/platform`, help super-admin) si pe
  domeniul platformei. Adresa expeditorului de email ramane comuna (decizia 3).

### T4 - Organizare: meniu + panou de control (implementat 2026-09-27)

Decizie (2026-09-27): organizarea se ALEGE in `/platform` (`organizations.layout`,
migrarea `0046`, doar super-admin), la fel ca tema - nu se leaga in cod de slug-ul
organizatiei (slug-urile clientilor nu erau inca stiute, iar asa se poate schimba
fara deploy). Tema si organizarea sunt independente.

- `standard` - meniul si panoul initiale.
- `flux` - `STAFF_NAV_FLUX` (`nav-config.ts`): aceleasi pagini, grupate Producție ->
  Vânzări -> Inventar -> Rapoarte -> Administrare, cu alte etichete („Acasă”,
  „Procese”, „Loturi în stoc”, „Organizație”); portalul client incepe cu „Comenzile
  mele”. Panoul (`/dashboard`, titlu „Acasă”) incepe cu „Necesită atenție” + „Acțiuni
  rapide”, apoi ultimele comenzi + indicatorii 2x2, graficul de stoc la final.
- Sectiunile panoului sunt extrase in `src/features/reports/dashboard-sections.tsx`;
  pagina doar le aranjeaza.
- Teste: `nav-config.test.ts` (aceleasi rute/roluri in ambele organizari),
  `dashboard-sections.test.tsx`, `layouts.test.ts` (CHECK-ul din migrare), B28 extins.

### T5 - Sistem de teme (decizie 2026-09-25, implementat 2026-09-27)

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
  `/platform`. `primary_color`/`secondary_color` se aplica DOAR pe tema implicita (decizie
  2026-09-28, `docs/plans/tema-vs-culori-organizatie.md`).
- `/showcase?theme=<key>` pentru previzualizare; test: fiecare tema defineste toate
  variabilele cerute.
- Implementare: metadate in `src/features/branding/themes.ts` (nu `src/config/`), CSS in
  `src/app/themes.css`; fonturi Nunito Sans (teren), Barlow (industrial), Manrope
  (ciclu); tema pe `<html>` = tema organizatiei de pe host, altfel a userului logat;
  sidebar prin clasa `app-sidebar` + tokenii `--sidebar-*`; login „split” prin
  `--login-panel-display`. Garda super-admin acopera si `custom_domain`, care a iesit
  din setarile adminului organizatiei (devine read-only) si a intrat in `/platform/<id>`.

### T6 - Header/footer PDF per tema + profil (implementat 2026-09-27)

- `src/lib/pdf/document-chrome.tsx`: `PdfDocumentHeader` + `PdfDocumentFooter`, comune
  certificatului, avizului si rapoartelor (inainte: 3 copii ale aceluiasi antet).
  Trei variante de antet, alese de tema (`ThemeDefinition.pdfHeader`): `bar` (initial -
  Clasic), `band` (fundal plin in culoarea brandului - Teren, Ciclu), `rule` (bara
  verticala de accent, titlu cu majuscule - Industrial). Subsolul ia culoarea brandului
  in varianta `band`.
- `src/features/branding/pdf-brand.ts#pdfBrandFor(org)`: culorile = cele hex ale
  organizatiei, altfel mostrele temei (valorile ne-hex, ex. `oklch()`, sunt ignorate -
  @react-pdf nu le suporta); subtitlul (`documentTagline`, implicit „Materiale de
  construcții circulare”) si nota din subsol (`documentFooterNote`) din profil;
  creditul „emis de” ca in T3.
- Teste: `pdf-brand.test.ts` + randare REALA (fara mock) pentru fiecare varianta de
  antet in `src/lib/pdf/render.test.tsx`.

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
