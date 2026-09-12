# Plan - layout responsive pentru mobil

**Context:** `docs/design-prompt.md` §1 e explicit: *"Aplicația trebuie să meargă și pe
mobil, dar targetul principal este desktop."* În plus, `docs/analiza-conformitate-anexa.md`
(cerințe transversale) marchează "Interfață intuitivă, echipamente uzuale" ca ✅, motivat
prin "responsive" - dar la verificare, shell-ul aplicației (`AppShell` + `Sidebar` +
`Topbar`) **nu are nicio adaptare pentru mobil**: sidebar fix `w-60`, fără breakpoint-uri,
fără meniu hamburger. Pe un viewport de telefon (≤480px), sidebar-ul singur ocupă >60%
din lățime și conținutul e comprimat/scrollat orizontal. Practic e un gap de conformitate,
nu doar o îmbunătățire UX - vezi [[eu-funding-annex-compliance]].

Bug mic găsit și corectat separat: `Sidebar` folosea `position-sticky` (clasă
inexistentă, nu produce niciun efect) în loc de `sticky` din Tailwind.

## Obiectiv

Aplicația să fie **funcțională și utilizabilă** pe mobil (≥375px lățime) - navigare,
citire, completare formulare, fără scroll orizontal și fără elemente tăiate. Nu e o
redesenare mobile-first: desktop rămâne target principal (conform design-prompt), deci nu
optimizăm agresiv fiecare ecran pentru degete/gesture, doar eliminăm blocajele reale.

## Ce nu e nevoie (scope explicit exclus)

- Nav gestual, bottom-nav bar, PWA/offline - nimic din documentație nu cere asta.
- Redesign vizual pe mobil diferit de desktop - reutilizăm aceleași componente, doar
  cu breakpoint-uri.
- Tabele HTML native de responsive-izat - verificat: doar 3 fișiere folosesc `<table>`
  (`setari/utilizatori`, `certificate-view`, `variable-output-form`); restul listelor
  sunt grid-uri/flex-uri proprii, deci se rezolvă cu breakpoint-uri Tailwind, nu cu
  pattern-uri complexe de "responsive table".

## Etape

### 1. Shell-ul aplicației (blocajul principal)

- **`AppShell`** (`src/components/layout/app-shell.tsx`): sub `lg`, sidebar-ul nu se mai
  randează inline - devine un panou ascuns, deschis printr-un buton hamburger în
  `Topbar`.
- **Componentă nouă de drawer mobil**: proiectul nu are încă `Sheet`/`Dialog` (nu există
  `@radix-ui/react-dialog` în `package.json`). Adăugăm dependența și componenta shadcn
  `sheet` (`pnpm dlx shadcn@latest add sheet`, sau instalare manuală a primitivei) -
  e calea standard cu accesibilitate (focus trap, Esc, overlay) inclusă, mai sigură decât
  un drawer custom.
- **`Sidebar`**: extragem conținutul de navigare într-un sub-component reutilizabil
  (logo + listă `nav`), randat atât în `<aside>` (desktop, `hidden lg:flex`) cât și în
  `SheetContent` (mobil). Item-ul activ închide automat drawer-ul la navigare.
- **`Topbar`**: adăugăm butonul hamburger (`lg:hidden`), vizibil doar sub breakpoint.
  Bara de căutare + email + sign-out trebuie să încapă pe 375px: căutarea trece pe lățime
  flexibilă (`w-full` în loc de `w-56` fix) sau se ascunde în spatele unei iconițe pe
  mobil; `email` lung se trunchiază (`truncate`) sau se ascunde sub `sm`.

### 2. Container de conținut

- `main` din `AppShell`: padding `p-6` -> `p-4 sm:p-6`, verificat că `max-w-7xl` nu
  forțează scroll orizontal pe ecrane înguste (nu ar trebui, dar de validat vizual).

### 3. Audit pagini cheie (breakpoint-uri pe grid-uri existente)

Pagini cu `md:`/`lg:` grid deja parțial: `dashboard`, `comenzi/[id]`, `productie/[id]`,
`livrari/[id]` - de verificat că varianta de o singură coloană sub `md` e completă și nu
lasă card-uri cu lățime fixă. Pagini fără niciun breakpoint (marea majoritate - liste
comenzi/stoc/clienți/catalog, formulare) - de trecut prin ele și înlocuit orice `w-[Npx]`
fix sau `grid-cols-N` fără variantă mobilă cu echivalent responsive (`grid-cols-1
md:grid-cols-N`).

Prioritate: **portalul de client** (catalog, coș, comenzile-mele) - clienții au șanse mai
mari să folosească telefonul decât operatorii/adminii (care lucrează la birou/hală, per
design-prompt). Ecranele admin/operator rămân cu bară joasă de efort (must-work, nu
must-be-pretty).

### 4. Testare

- Adăugăm un al doilea `project` în `playwright.config.ts` cu un viewport mobil
  (`devices["iPhone 13"]` sau echivalent, 390×844).
- Extindem `tests/e2e/routes-smoke.spec.ts` (deja există, listă de rute) să ruleze și pe
  proiectul mobil, cu o verificare simplă de "fără overflow orizontal"
  (`document.documentElement.scrollWidth <= window.innerWidth`) pe fiecare rută.

### 5. Corectare status conformitate

- După ce shell-ul + paginile cheie sunt responsive, actualizăm nota din
  `docs/analiza-conformitate-anexa.md` (linia "Interfață intuitivă... responsive") ca să
  reflecte starea reală, nu doar intenția.

## Definition of Done

- [ ] Sidebar mobil funcțional (drawer) sub `lg`, fără regresie pe desktop
- [ ] Topbar utilizabil pe 375px lățime (fără elemente tăiate/overlap)
- [ ] Fără scroll orizontal pe rutele din `routes-smoke.spec.ts`, viewport mobil
- [ ] Catalog + coș (portal client) verificate manual pe mobil
- [ ] `pnpm typecheck` + `pnpm lint` trec
- [ ] Proiect Playwright mobil adăugat + smoke test overflow trece în CI
- [ ] Intrare în `docs/prompt-log.md` (regula 1.2)
- [ ] Nota de conformitate din `analiza-conformitate-anexa.md` actualizată
