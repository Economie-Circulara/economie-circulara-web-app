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

- `src/lib/site-url.ts`: `getOrgOrigin(org)` -> `https://<custom_domain>` daca exista,
  altfel `<slug>.<NEXT_PUBLIC_ROOT_DOMAIN>` (daca root e setat), altfel `getSiteOrigin()`.
- Folosit peste tot unde se genereaza linkuri pentru un user al unui tenant:
  - `settings/user-actions.ts` (invitatii staff/client) -> org-ul adminului;
  - `platform/actions.ts` (super-adminul invita adminul unei organizatii) -> org-ul
    **tinta**, nu domeniul de pe care lucreaza super-adminul;
  - `auth/actions.ts` (magic link, OAuth, reset parola) -> tenantul rezolvat din host
    (userul e deja pe domeniul corect; T2 garanteaza asta).
- Teste unitare: custom domain, fallback subdomeniu, fallback canonic, org-tinta la invitatia
  din platforma.

### T2 - Garda de domeniu

- `middleware.ts` / `src/lib/supabase/middleware.ts`: dupa `getUser()`, pe rutele
  protejate, daca userul are `organization_id` si organizatia are `custom_domain`
  diferit de host -> `signOut` local + redirect la `https://<custom_domain>/login`.
  (Sesiunea nu se poate transfera intre domenii - cookie-urile sunt per domeniu.)
- Super-adminul (fara organizatie) e exceptat.
- Login pe domeniul unui tenant: callback-ul verifica si el apartenenta (a doua linie)
  -> `/login?error=wrong_tenant` cu link catre domeniul corect.
- Domeniul platformei (`lotculot.eu`) ramane pentru super-admin si pentru organizatiile
  fara `custom_domain`.
- Teste: `middleware.test.ts` (user A pe domeniul B, super-admin, org fara domeniu),
  `auth/callback/route.test.ts`.

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

### T5 - Diferentiere vizuala

- Profilul da: `font` (2-3 variante preincarcate prin `next/font`), `radius`,
  `sidebarVariant` (`light` | `dark`), `loginLayout` (`centered` | `split`).
- Aplicate prin CSS variables / `data-*` pe `<html>` in layout-ul radacina (tema pe
  culori ramane din DB, ca acum).
- Verificare vizuala cu Playwright (screenshot default vs profil B).

### T6 - Header/footer PDF per profil

- Certificat, aviz, raport PDF: header (logo + nume produs + culoare) si footer (text
  din profil, ex. date firma / „Document generat de <productName>”) din profil.
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
