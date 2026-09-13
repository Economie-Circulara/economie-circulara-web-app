# Prompt Log

Jurnal al sarcinilor lucrate de agenti AI in acest repo. Conform regulii 1.2 din
[`AGENTS.md`](../AGENTS.md), la **fiecare commit** se adauga o intrare aici.
Cele mai noi intrari sus.

Format intrare:

- **Data** - YYYY-MM-DD
- **Agent / model**
- **Cerut** - rezumat al sarcinii
- **Facut** - rezumat al modificarilor

---

## 2026-09-13 — Codex GPT-5 — Redirect de siguranta de pe pagina principala

- **Cerut:** magic link-ul tot ajungea pe pagina principala dupa deploy, nu in dashboard.
- **Facut:** pagina `/` verifica acum sesiunea si redirecteaza utilizatorii autentificati
  catre ruta rolului (`homePathForRole`), astfel incat chiar si un link/callback care
  ajunge la root nu lasa userul logat pe landing page. Testul paginii principale acopera
  redirectul pentru admin.
- **Verificat:** `pnpm vitest run src/app/page.test.tsx src/app/auth/callback/route.test.ts`,
  `pnpm typecheck`, `pnpm lint`.

## 2026-09-13 — Codex GPT-5 — Redirect magic link catre dashboard-ul rolului

- **Cerut:** magic link-ul nu mai dadea eroare, dar dupa autentificare trimitea la pagina
  principala; userul nu poate testa local si a cerut push pentru verificare pe Vercel.
- **Facut:** callback-ul Auth citeste rolul din `profiles` si, cand linkul nu are `next`,
  redirecteaza implicit prin `homePathForRole`: admin/operator -> `/dashboard`, client ->
  `/portal`, super-admin -> `/platform`. Fluxurile cu `next` explicit (ex. setare parola)
  raman neschimbate.
- **Verificat:** `pnpm vitest run src/app/auth/callback/route.test.ts`, `pnpm typecheck`,
  `pnpm lint`.

## 2026-09-13 — Codex GPT-5 — Fix magic link Supabase SSR

- **Cerut:** dupa configurarea Resend + domeniul `lotculot.eu`, login-ul prin magic link
  ajungea la `/login?error=auth`; userul a cerut repararea, apoi commit + push.
- **Facut:** `/auth/callback` accepta acum si linkuri SSR cu `token_hash` + `type` si le
  verifica prin `supabase.auth.verifyOtp`, pastrand fluxul vechi cu `code` pentru OAuth,
  invite si reset parola. Testele de callback acopera succesul si esecul pe `token_hash`.
- **Verificat:** `pnpm vitest run src/app/auth/callback/route.test.ts`, `pnpm typecheck`,
  `pnpm lint`.
- **Nota operationala:** template-ul Supabase **Magic Link** trebuie sa foloseasca linkul
  catre `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=magiclink`; linkurile vechi
  generate inainte de schimbarea template-ului pot ramane invalide.

## 2026-09-12 — Claude Opus 5 — Numele final: „Lot cu Lot" (lotculot.eu)

- **Cerut:** mai multe sugestii de nume; apoi userul a cumparat **lotculot.eu** si a ales
  „Lot cu Lot".
- **Explorat inainte** (unghiuri diferite, nu variatii pe „proveniență"): Evidentia, Filiera,
  Agrega, Cirqa, Vestigia, Traseo, Atesta — cu disponibilitate verificata. Constatare
  structurala: **niciunul** nu avea TLD internațional liber, doar `.ro`.
  **Atesta respins explicit** (desi `atesta.ro` era liber): ar fi intrat in conflict cu
  concluzia spike-ului S2 — certificatul e o declaratie VOLUNTARA, care NU atesta
  conformitatea; un produs numit „Atesta" care emite documente insotite de „nu atesta..."
  e o contradictie exploatabila juridic.
- **De ce „Lot cu Lot" e mai bun decat tot ce evaluasem:** descrie mecanismul real
  (trasabilitatea se construieste lot cu lot, iar `lot` e deja termenul de domeniu al
  aplicatiei), e autoexplicativ pentru operatorul roman fara pas de traducere, si — cel mai
  important — **nu pretinde autoritate oficiala**, deci nu intra in conflict cu disclaimerul
  din `docs/analiza-standarde-certificat.md`. Compromis asumat: joc de limba romana, nu
  traverseaza granita.
- **Aplicat:** 67 de fisiere. `PLATFORM_NAME = "Lot cu Lot"` in `src/lib/brand.ts`;
  identificatorii au devenit `lotculot` (pachet npm, cheia de localStorage a cosului
  `lotculot:cart:v1`, fixture-uri de test); adresa implicita de expediere
  `notificari@lotculot.eu`. Inchisa si ultima apariție rămasa a numelui vechi (titlul din
  `comenzile-mele/[id]/page.tsx`, fisier care nu mai era in lucru la Codex).
- **Capcana prinsa de teste:** inlocuirea mecanica a stricat un fixture de host
  (`ACME.Provenio.App:3000` -> `ACME.Lot cu Lot.App:3000`, host invalid cu spatii).
  Corectat la `ACME.LotCuLot.EU:3000`. Restul identificatorilor verificati pentru acelasi
  tip de problema.
- **Pastrat intenționat:** `docs/prompt-log.md` si `docs/plans/denumire-produs.md` NU au fost
  rescrise mecanic — prima e jurnal, a doua contine analiza care EVALUEAZA Provenio ca
  candidat; rescrierea lor ar falsifica istoricul deciziei. In documentul de denumire e
  adaugata secțiunea cu decizia finala.
- **Verificat:** typecheck, lint, **594 teste** — toate verzi.
- **Domenii:** `lotculot.ro`, `.com`, `.app`, `.io` erau TOATE libere — namespace curat.
  Recomandat `.ro` de la registrar romanesc (piata naturala), `.com` ca inregistrare
  defensiva ieftina.

## 2026-09-12 — Claude Opus 5 — Corectie: URL-ul de productie era greșit in handoff

- **Constatat la verificarea deploy-ului cu numele nou:** URL-ul pe care il raportasem ca
  producție, `economie-circulara-web-app.vercel.app`, servea in continuare build-ul VECHI
  (`<title>Lateris Trace</title>`), desi deployment-ul nou era `● Ready / Production`.
- **Cauza:** aliasurile reale ale proiectului (`vercel alias ls`) sunt
  `economie-circulara-web-app-rho.vercel.app` si
  `economie-circulara-web-app-gions-projects-cb2e6eea.vercel.app`, ambele pe deployment-ul
  curent. URL-ul fara `-rho` **nu apare** in lista de aliasuri a proiectului si nu poate fi
  redirecționat din CLI. `vercel projects ls` confirma „Latest Production URL" =
  varianta cu `-rho`.
- **URL corect de productie: https://economie-circulara-web-app-rho.vercel.app** —
  verificat: `<title>Provenio</title>`, h1 = „Trasabilitatea materialelor în economia
  circulară" (deci entry point neutru fata de tenant, fara nume de organizatie), CTA
  „Intră în platformă". Varianta cu `-gions-projects-` e 302 (Vercel SSO).
- **Corectat in `docs/handoff-sesiune-2026-09-12.md`** §1b, cu avertisment explicit: URL-ul
  vechi rămâne o capcana de demonstratie (raspunde 200 cu aplicatia veche) si trebuie
  verificat/sters din dashboard.

## 2026-09-12 — Claude Opus 5 — Redenumire produs: Lateris Trace -> Provenio

- **Cerut:** userul a ales „Provenio" din opțiunile propuse in `docs/plans/denumire-produs.md`.
- **Facut:** 65 de fisiere pentru „Lateris Trace" -> „Provenio" + 9 pentru variantele
  lowercase (`lateristrace`, `lateris-trace`). `PLATFORM_NAME` in `src/lib/brand.ts` e sursa
  unica la runtime, iar cele 8 locuri cu fallback `?? "Lateris Trace"` importa acum
  constanta in loc de un literal duplicat.
- **Doua schimbari cu efect real, nu doar cosmetice:**
  * `notifications/service.ts` — adresa implicita de expediere e acum
    `notificari@provenio.ro` (era `notificari@lateristrace.app`). Domeniul trebuie verificat
    la providerul de email ca notificarile sa plece.
  * `client-portal/cart-context.tsx` — cheia de `localStorage` a cosului a devenit
    `provenio:cart:v1`. Goleste cosurile existente; fara efect acum (productia nu are
    utilizatori reali).
- **Pastrate intenționat:** `docs/design/Lateris_Trace.dc.html` (numele real al fisierului de
  mockup) si `Lateris Demo`, organizatia demo din seed — e nume de TENANT, nu al platformei,
  deci nu e incoerent; redenumirea ar atinge seed-ul, 28 de capturi, manualele si E2E-ul,
  cost mare pentru valoare mica.
- **Rămas o singura apariție:** titlul din `src/app/(client)/comenzile-mele/[id]/page.tsx`.
  Fisierul era in curs de editare de sesiunea concurenta (Codex) si un `sed` peste el i-ar fi
  putut pierde munca necommitata. Notat in `docs/plans/denumire-produs.md`.
- **Verificat:** typecheck, lint, **594 teste** — toate verzi.
- **Domeniul rămâne la user** (cumpararea nu se automatizeaza): `provenio.ro` de la un
  registrar ROTLD (~10-15 EUR/an, NU prin Vercel la $110.99), apoi
  `NEXT_PUBLIC_ROOT_DOMAIN=provenio.ro` ca rezolvarea tenantului din subdomeniu sa devina activa.

## 2026-09-12 — Claude Opus 5 — Entry point neutru fata de tenant + analiza de denumire

- **Cerut:** „homepage-ul nu trebuie sa zica lateris... e un entry point in platforma, nu
  pentru un client anume, decat daca avem un path name, sau un subdomeniu special pentru
  un client" + bonus: cum ar trebui sa se numeasca produsul, eventual si domeniu.
- **Constatat:** „Provenio" NU e un nume decis — a aparut in faza de mockup
  (`docs/design/Lateris_Trace.dc.html`) si s-a propagat ca nume de produs. Nu vine de la
  client: nu apare nici in `docs/brain-dump.md`, nici in `docs/design-prompt.md`.
- **Fix arhitectural (nu doar de copy):** `src/app/page.tsx` rezolva acum tenantul
  (`resolveTenant`: custom domain -> subdomeniu -> segment de path) si:
  * pe **domeniul platformei** (fara tenant) nu afiseaza niciun nume de organizatie si
    niciun brand inventat — titlul e functia platformei;
  * pe **intrarea unui client** (tenant rezolvat) afiseaza brandul acelei organizatii
    (denumire + logo), ca ecranul de login.
  Exact distincția ceruta. Pagina a devenit dinamica (citeste `headers`), compromis
  acceptat pentru corectitudinea white-label.
- **`src/lib/brand.ts` (nou):** `PLATFORM_NAME` + `PLATFORM_DESCRIPTION`, singurul loc din
  care se schimba numele. Pana la decizie valoarea e un DESCRIPTOR, nu un brand inventat.
- **Teste:** 5 teste pe ambele moduri — inclusiv o regresie care verifica explicit ca
  „Lateris" nu mai apare pe entry point-ul platformei, si una care verifica ca toate
  linkurile duc la `/login` (nu la `/showcase`, care e 404 in productie).
- **`docs/plans/denumire-produs.md` (nou):** de ce „Lateris" e slab (citeste ca nume de
  client; *later* = caramida, prea ingust pentru o platforma generica), criteriile, si
  4 opțiuni cu disponibilitate de domenii verificata. Recomandare: **Provenio**
  (proveniența = exact ce dovedeste certificatul; rădăcina latina, lizibila in UE;
  `provenio.ro` + `.io` + `.eu` toate libere — combinatie neobisnuita). Alternative:
  Recircula (doar `.app` liber), Circularis, sau amanarea deciziei pe un subdomeniu al
  lui `nvxapp.ro`, deja deținut.
- **Semnalat:** Vercel cere **$110.99/an** pentru `.ro`, fata de ~10-15 EUR/an la un
  registrar acreditat ROTLD — de 7-10x. Recomandat sa ia `.ro` de la registrar romanesc
  si sa indrepte DNS-ul catre Vercel.

## 2026-09-12 — Claude Opus 5 — Homepage real + diagnostic email

- **Cerut:** „ce ar mai fi de facut next?" + doua observatii: homepage-ul e varza, si
  email-related stuff nu merge (invite, magic link).
- **Homepage:** `src/app/page.tsx` era inca **schela Wave 0** livrata in productie —
  textul „Schela initiala (Wave 0). Vezi docs/plans/implementation-plan.md pentru pasii
  urmatori" plus un buton „Vezi design system-ul" catre `/showcase`, care e `notFound()`
  in productie (guard corect, dar linkul era rupt exact in mediul unde il vedea un
  vizitator). Inlocuit cu o pagina publica reala: header cu CTA de autentificare, hero,
  si 6 capabilitati descrise in termenii platformei (certificat de trasabilitate, stoc pe
  loturi cu FIFO si istoric, productie/reciclare, livrari + avize + e-Transport, portal
  client, rapoarte). Responsive (grid 1/2/3 coloane), pe tokenii temei, fara asset-uri
  externe. Deliberat STATICA: CTA-ul duce la `/login`, care redirecteaza singur un user
  deja autentificat — deci pagina publica rămâne prerandata. Teste extinse: titlu, faptul
  ca toate linkurile duc la `/login` (regresie pentru linkul rupt), si capabilitatile.
- **Email — diagnosticat, TREI cauze distincte, niciuna reparabila doar din cod:**
  1. `invite` esueaza INAINTE de email: `inviteUserByEmail` merge prin `createAdminClient()`,
     iar `SUPABASE_SECRET_KEY` nu e setata pe Vercel (nu a putut fi obtinuta automat —
     citirea cheilor secrete e blocata).
  2. Toate emailurile de Auth (invite, magic link, reset parola) pleaca prin senderul
     Supabase, nu prin aplicatie. Proiectul hosted nu are SMTP propriu → senderul
     implicit trimite doar catre membrii proiectului si e limitat la cateva emailuri/ora.
     Separat, `Site URL`/`Redirect URLs` trebuie sa includa domeniul de productie.
     (`siteOrigin()` deduce corect originea din `host`, deci `redirectTo` e bun — dar
     Supabase il valideaza contra allowlist-ului.)
  3. Notificarile de schimbare de status comanda (X1) folosesc alt drum:
     `EMAIL_API_URL`/`EMAIL_API_KEY`, nesetate → `ConsoleEmailProvider`, care doar
     jurnalizeaza.
- **Provizionare:** discovery pe marketplace a dat **Resend** (`resend/resend-email`) —
  potrivirea e exacta, `HttpApiEmailProvider` e deja scris pentru formatul Resend/Postmark,
  iar SMTP-ul Resend acopera si emailurile Supabase Auth, deci un singur provider rezolva
  ambele drumuri. `vercel integration add` a fost **blocat de politica de permisiuni**
  (creeaza resursa de cont cu potential de costuri) — predat userului cu pasii exacti.

## 2026-09-12 - Claude Opus 5 - Commit integral + deploy in productie

- **Cerut:** "aplica tot, comite tot (inclusiv modificarile de responsive), apoi aplica ce
  poti sa mai aplici tu automat. as vrea sa pot testa pe vercel in prod".
- **Comis** (arborele era un amestec de trei autori, separat in commit-uri logice):
  fix-urile celor 2 bug-uri P0 + smoke test de rute + seed + 28 capturi (`eb97b3d`);
  layout responsive mobil, lucrare Codex GPT-5 (`5f6cdd1`); fix `platform` -
  starea formularelor scoasa din modulul `"use server"`, WIP-ul userului dus la capat
  (`941b21a`); Google OAuth pe stack-ul local (`05fbb47`, cu avertisment de CI in mesaj);
  eliminarea hook-ului SessionStart (`d6ea013`).
- **Supabase hosted:** `supabase db push` a aplicat 0011-0018 (era la 0010). Verificat
  independent prin API: 19/19 migrari inregistrate pe `nnmsqefeennxgilnlcjx` (eu-central-1).
- **Vercel:** proiect legat (`economie-circulara-web-app`), `NEXT_PUBLIC_SUPABASE_URL` +
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` setate pe production, deploy de productie reusit.
  **https://economie-circulara-web-app.vercel.app** - `/` si `/login` 200, login-ul
  randeaza formularul real, `/dashboard`/`/portal`/`/platform` dau 307 catre login pentru
  vizitator neautentificat (guard-urile functioneaza in prod). URL-ul unic al
  deployment-ului rămâne in spatele Vercel Deployment Protection; domeniul de productie e public.
- **Blocat, NU ocolit:** `git push origin main` (politica de permisiuni) si citirea cheii
  secrete Supabase de producție (materializare de credentiale). Ambele predate userului,
  cu comenzile exacte, in `docs/handoff-sesiune-2026-09-12.md` §1b si §5.
- **Constatat pe hosted:** baza are schema completa dar date minime (2 organizatii, 2
  profiluri admin, 0 itemi, 0 clienti, niciun `super_admin`), si **niciun cont nu are
  parola setata** - deci login cu email+parola nu merge; magic link/Google cer Site URL +
  Redirect URLs actualizate pe proiectul hosted. Documentat in handoff.
- **Verificat inainte de commit:** typecheck, lint, 584 teste, `pnpm build` - toate verzi
  pe arborele combinat (inclusiv refactorul responsive).

## 2026-09-12 - Codex GPT-5 - Font PDF cu diacritice românești

- **Cerut:** folosirea unui font sigur pentru diacritice în PDF-uri, după probleme
  observate pe avizul de însoțire a mărfii.
- **Facut:** adăugat Noto Sans ca asset local pentru PDF-uri, helper comun de
  înregistrare font pentru `@react-pdf/renderer`, înlocuite fonturile standard din
  aviz, certificat și rapoarte, plus test unitar pentru înregistrarea fontului.

## 2026-09-12 - Codex GPT-5 - Layout responsive mobil

- **Cerut:** implementarea planului din `docs/plans/mobile-responsive-layout.md`.
- **Facut:** adaugat drawer mobil accesibil pe baza Radix Dialog (`Sheet`), navigatie
  reutilizata intre sidebar desktop si meniul hamburger din topbar, padding/container
  ajustate pentru 375px, filtre si catalog client facute responsive, tabelele izolate
  in scroll intern si Playwright extins cu proiect mobil + assertie fara overflow
  orizontal. Actualizata nota de conformitate din `docs/analiza-conformitate-anexa.md`.

## 2026-09-12 - Claude Opus 5 - Verificare functionala pre-recepție + 2 fix-uri P0 de randare/scriere

- **Cerut:** initial, inlocuirea celor 27 de placeholder-e de capturi din `docs/manual/`
  cu capturi reale din aplicatia rulanta. Prioritatile s-au schimbat pe parcurs:
  verificarea functionala a fiecarui ecran si flux, cu toate cele 4 roluri, a devenit
  prioritatea 1 (recepție de finantare europeana in sub 2 saptamani), capturile au
  coborat la prioritatea 3.
- **Facut (P0 #1 - toata aplicatia dadea 500):** sweep-ul Playwright pe 56 de rute a
  aratat ca TOATE ecranele pentru admin, operator si client raspundeau 500; doar
  super_admin si paginile de auth mergeau. Cauza: `NavItem.icon` din
  `src/components/layout/nav-config.ts` ducea o componenta Lucide din layout-urile
  SERVER catre `Sidebar` (`"use client"`) - referintele de componenta nu sunt
  serializabile peste granita RSC in Next 16 / React 19. `icon` e acum un union strict
  de nume (`NavIconName`), iar maparea nume -> componenta traieste in `sidebar.tsx`
  (modul client). Peste granita trec doar date simple.
- **Facut (P0 #2 - toate scrierile din 5 zone dadeau 500):** cinci module cu directiva
  `"use server"` exportau si o constanta (starea initiala pt. `useActionState`), ceea ce
  arunca la RUNTIME, la primul submit: "A 'use server' file can only export async
  functions". Ecrane afectate: creare/editare item, creare reteta + adaugare componenta,
  inregistrare lot, blocare/deblocare lot, salvare setari organizatie, invitare
  utilizator - adica pasii 3 si 4 din fluxul MVP erau inoperanti prin UI. Constantele au
  fost mutate in `action-state.ts` per feature, dupa conventia deja existenta si
  documentata in `src/features/orders/action-state.ts` (7 feature-uri o respectau, 5
  fusesera omise).
- **Facut (plasa de siguranta):** `tests/e2e/routes-smoke.spec.ts` - 7 teste, ~15s, care
  pentru fiecare rol afirma pe fiecare ruta: HTTP < 400, absenta error boundary-ului
  Next, existenta unui `<h1>`, zero `pageerror`; plus guard-urile de rol. Lista de rute
  se citeste din `STAFF_NAV`/`CLIENT_NAV`, deci nu se invecheste. Ambele P0 erau
  invizibile pentru `typecheck`, `lint`, cele 584 de teste unitare si `pnpm build`.
- **Facut (seed coerent):** `supabase/seed.sql` scria `CMD-2026-0001` cu status `closed`
  dar cu `accepted_at`/`delivered_at`/`closed_at` NULL (insertie directa, nu prin RPC),
  deci demo-ul arata "-" la toate datele. Acum: creata acum 6 zile -> acceptata acum 5 ->
  livrata acum 3 (= `delivery_date`) -> inchisa acum 2, iar `issued_at` al certificatului
  coincide cu `closed_at`.
- **Facut (capturi):** `tests/e2e/manual-screenshots.spec.ts` - walkthrough pe roluri cu
  capturi ca produs secundar; 28 de imagini in `docs/manual/img/`, 23 din cele 26 de
  placeholder-e reale inlocuite (cel din `README.md` e doar exemplul de format si a
  ramas neatins, corect).
- **Nu s-a facut:** smoke test pe SUBMIT-ul formularelor (gaura ramasa in plasa de
  siguranta - ambele P0 au fost la scriere, iar `routes-smoke` verifica doar GET-uri).

---

## 2026-09-12 - Claude Opus 5 - Fix certificat + handoff de sesiune

- **Cerut:** repararea bug-ului de certificat gasit de spike-ul S2, apoi un document de
  handoff pentru continuarea lucrului in alta sesiune (Codex), cu revenire ulterioara.
- **Facut (fix certificat):** `certificates.number` (`CRT-<an>-<seq>`) se genera in
  `service.ts` dar nu ajungea niciodata in `CertificatePdfProps` - PDF-ul afisa
  `snapshot.order.number` etichetat "Nr. ... · CRT", adica numarul COMENZII. Ecranul
  (`certificate-view.tsx`) folosea deja numarul corect, deci PDF-ul descarcat si pagina
  din aplicatie se contraziceau, iar numarul din PDF nu corespundea nici randului din
  `certificates`, nici numelui fisierului din Storage (`<number>.pdf`).
  `certificateNumber` e acum prop OBLIGATORIU (omisiunea cade la typecheck), folosit si
  in titlul documentului PDF. Corectata si caseta de semnatura: spunea "Semnatura &
  stampila electronica", desi PDF-ul nu e semnat eIDAS - acum "Emis electronic, fara
  semnatura olografa" (vezi `docs/analiza-standarde-certificat.md`).
- **Facut (handoff):** `docs/handoff-sesiune-2026-09-12.md` - stare tehnica, cum se
  porneste mediul (inclusiv capcanele reale: `psql` lipsa local, browserul Playwright,
  `rls_isolation.sql` care lasa fixture-uri in autocommit), cele 4 bug-uri reparate cu
  cauza fiecaruia, plasele de siguranta noi, separarea clara a WIP-ului userului de
  restul modificarilor necommitate, prioritatile clientului (functionalitate >
  deployment > documentatie > E2E), deciziile care ii rămân lui, regulile de proces si
  capcanele Postgres/RSC. Adaugat in `docs/index.md`.
- **Neaplicat deliberat:** disclaimer-ul legal pe certificat (text cu consecinte
  juridice - decizia clientului) si completarile de certificat care cer migrare
  (`organizations` nu are `cui`/`reg_com`/`address`).

## 2026-09-12 - Claude Opus 5 - Verificare functionala pe Postgres real: 2 bug-uri de business reparate

- **Cerut:** prioritate pe FUNCTIONALITATE (inaintea deployment/documentatie/E2E).
- **Abordare:** verificarea invariantilor de business direct pe RPC-urile Postgres, pe
  un Supabase local cu toate migrarile + seed - stratul pe care typecheck, lint, 584
  teste unitare (care mock-uiesc RPC-urile) si `pnpm build` NU il executa niciodata.
  Suita noua `supabase/tests/business_flow.sql` (12 teste, `pnpm db:test:business`),
  fiecare test in `begin; ... rollback;` deci fara urme in baza.
- **BUG 1 (migrarea `0017_fix_set_lot_block_enum_cast.sql`):** `set_lot_block` esua la
  FIECARE apel - blocarea/deblocarea loturilor nu a functionat niciodata. Cauza:
  `case when p_blocked then 'block' else 'unblock' end` rezolva literalii la `text`
  inainte de atribuire, iar Postgres nu face cast implicit `text -> enum`. Fix: cast
  explicit `::public.stock_event_type`.
- **BUG 2 (migrarea `0018_fix_cancel_order_stock_restore.sql`):** `cancel_order` NU
  refacea stocul si nu scria evenimentul `reversal` la anularea unei comenzi acceptate
  - regula "la anulare stocul se reface" era incalcata in silentiu, cu stoc pierdut
  definitiv la fiecare anulare. Cauza, subtila: bucla de refacere citea evenimentele cu
  `select ... for update`, iar sub RLS o citire cu clauza de BLOCARE cere si politica de
  **UPDATE**; `stock_events` e append-only (doar SELECT+INSERT, deliberat), deci
  returna **0 randuri** si bucla nu se executa niciodata - fara nicio eroare. Verificat
  empiric: acelasi select da 1 rand fara `for update` si 0 randuri cu. Fix: fara
  `for update` pe auditul append-only (concurenta e deja serializata de lock-ul pe
  `orders` de la inceputul functiei).
- **Audit de vecinatate:** verificate toate celelalte `for update` din migrari - restul
  sunt pe `orders`/`order_items`/`lots`/`processes`, care au politici de UPDATE/ALL,
  deci neafectate. Si toate expresiile enum din insert-uri: `0004` linia 237 era singura.
- **Acoperire si CI:** `supabase/tests/business_flow.sql` ruleaza acum in `db.yml`
  INAINTEA `rls_isolation.sql` (aceea isi insereaza fixture-urile in autocommit si
  lasa urme; a mea nu). Script nou `pnpm db:test:business`.
- **AGENTS.md §4.2 (nou):** lecțiile, ca sa nu fie reinvatate - cast obligatoriu la enum
  in expresii, `for update` sub RLS cere politica de UPDATE, corpul plpgsql nu e
  verificat la tip la creare (o migrare aplicata cu succes NU dovedeste ca RPC-ul
  merge), si granita RSC transporta doar date simple.
- **Rezultat:** 12/12 teste functionale trec. Invarianti confirmati pe Postgres real:
  FIFO pe `entry_date`, sarirea loturilor blocate, atomicitate totala la stoc
  insuficient (fara consum partial), ordinea respectata la selectie manuala de loturi,
  scaderea stocului la ACCEPTARE + `accepted_at`, refacerea la anulare, loturi de output
  cu provenienta corecta la procese, `reconditioning` ca provenienta distincta,
  reintrarea in stoc la acceptarea returului (doar pentru comenzi legate ca retur).

## 2026-09-12 - Claude Opus 5 - Spike S2: standarde legale pentru certificatul de trasabilitate

- **Cerut:** rezolvarea spike-ului de research **S2** (`plans/implementation-plan.md` §8) -
  standarde legale RO/EU pentru certificatul de trasabilitate materiale reciclate, cu output
  "continut minim obligatoriu". Fara modificari de cod de aplicatie.
- **Facut:** document nou [`analiza-standarde-certificat.md`](analiza-standarde-certificat.md)
  (research din surse publice, cu link per afirmatie): cadrul RO (O.U.G. 92/2021 art. 5/6/27
  end-of-waste + trasabilitate, H.G. 856/2002, H.G. 1061/2008 formular incarcare-descarcare,
  H.G. 668/2017, NE 012/1-2022, O.P.A.N.A.F. 802/2022 e-Transport), cadrul UE (**noul CPR -
  Reg. (UE) 2024/3110**, aplicabil din 8 ian. 2026, cu DPP la art. 67-68; criterii EoW UE
  doar pentru metale/sticla/cupru, **nu pentru agregate**), standardele de produs
  (EN 12620 / EN 13242 -> DoP + CE obligatoriu; **SR EN 206 nu e armonizat -> betonul nu are
  marcaj CE**; EN 933-11 pentru constituentii agregatului reciclat) si schemele voluntare
  (ISO 14021, EN 45557, EPD EN 15804, CSC modulul R, Protocolul UE DCD 2024).
- **Verdict:** certificatul nostru **nu are temei legal obligatoriu** - e document voluntar,
  auto-declarat; documentele obligatorii (DoP/CE, evidenta deseurilor, bon de livrare beton,
  aviz/UIT) sunt emise de organizatie/organism notificat, nu de platforma.
- **Livrabile in document:** continutul minim pe **grupe de campuri A-G**, **tabel de DELTA**
  fata de codul real (`src/features/certificates/`, migrarea `0009`), **text de disclaimer**
  propus (bloc + footer + nota de metoda + reguli de comunicare), **8 intrebari pentru
  jurist** si prioritizare pentru recepție.
- **Defecte descoperite (nereparate - task separat, de cod):** (1) PDF-ul afiseaza "Nr.
  `{snapshot.order.number}` · CRT" = **numarul comenzii**, nu `certificates.number`
  (numarul certificatului nu e pasat in `CertificatePdfProps`); (2) caseta "Semnătură &
  ștampilă electronică" desi PDF-ul nu e semnat eIDAS; (3) `materials[].percentage` poate
  insuma cantitati in **UM diferite**; (4) `organizations` **nu are CUI/adresa**; (5)
  `RawProcess.type`/`completedAt` si `RawLot.entryDate` sunt incarcate si nefolosite.
- **Nota:** nu s-a atins cod de aplicatie, Supabase local sau portul 3000 (alt agent le
  foloseste). Doar `docs/`.

## 2026-09-12 - Claude Opus 5 - Reluare proiect: main verde + merge review fixes

- **Cerut:** analiza starii proiectului dupa ~8 saptamani de pauza (docs + branch-uri + cod),
  apoi repararea `main` si pregatirea muncii in paralel (recepție iminenta).
- **Constatat:** `main` NU trecea `typecheck` (CI rosu). Commitul `20705a7` "chore: generated
  types" regenerase `src/lib/database.types.ts` contra unei baze cu doar migrarile 0000-0002
  aplicate: fisierul pierduse `deliveries`, valoarea `reconditioning` si toate RPC-urile in
  afara de `org_branding` (917 inserari / 1178 stergeri = pierdere neta, 14 erori TS).
  Separat, branch-ul `origin/claude/app-plan-review-w3cr7a` (fix-urile F1-F7 din review,
  migrarile 0014-0016, invitare client, `/cauta`, CI e2e) ramasese **nemerge**.
- **Facut:** merge `origin/claude/app-plan-review-w3cr7a` in `main` (singurul conflict:
  `database.types.ts`). **Regenerare canonica a tipurilor** (`pnpm gen:types`) pe un Supabase
  local cu TOATE cele 17 migrari aplicate (0000-0016 aplicate curat pe Postgres real) + seed.
- **Drift real rezolvat (nu de format):** CLI-ul actual (v2.108) genereaza argumentele RPC cu
  default in SQL ca **opționale fara `| null`** (`p_reason?: string`), in timp ce fisierul
  intretinut manual avea `| null`. Codul trimitea explicit `null` -> 13 erori TS. Fix: apelurile
  trimit acum `undefined` (cheia se omite -> PostgREST aplica `default null` din SQL, comportament
  identic), in `src/features/stock/service.ts` (create_lot, consume_fifo, set_lot_block) si
  `src/features/production/service.ts` (confirm_process) + asertiunile de payload din
  `src/features/stock/service.test.ts`. Tipurile generate rămân **exact** output-ul CLI-ului,
  deci drift-check-ul din `db.yml` poate deveni blocant.
- **Verificat efectiv (nu pe hartie):** `typecheck` ✅, `lint` ✅, **584 teste unitare** ✅,
  `pnpm build` ✅, **suita RLS rulata pe Postgres real** (`rls_isolation.sql`, T1-T19 inclusiv
  0014-0016) ✅ - rulata prin `docker exec` in containerul `supabase_db_*` (psql nu e instalat local).
- **E2E - prima rulare reala** (Docker disponibil acum, spre deosebire de iulie): `home.spec.ts`
  trece; `mvp-flow.spec.ts` **esueaza pe selectori**, exact cum anticipa nota din `e2e.yml`.
  Primul blocaj: `getByLabel("Email")` e ambiguu pe `/login` (formularul are si un input
  `#magic-email` pentru magic link). Rămâne de reparat iterativ - task separat.
- **Nota:** WIP-ul necommitat al userului (`src/features/platform/form-state.ts` +
  `supabase/config.toml`, `.claude/`) a fost lasat INTACT, in afara acestui commit.

## 2026-07-19 - Claude (orchestrator, 5 subagenti Sonnet paraleli) - Review fixes

- **Cerut:** rezolvarea prin subagenti a findings-urilor din review-ul tehnic (ce se poate
  fara acces manual/extern).
- **Facut F1+F6:** migrarea `0014_suspended_guard_completion.sql` - guard org suspendata
  completat pe scrierile clientului (`client_addresses` spart in politici per-operatie) +
  toate SELECT-urile client (defense-in-depth) + index `organizations(id,status)`.
  `rls_isolation.sql` TEST 15-19.
- **Facut F3:** migrarea `0015_order_status_timestamps.sql` - `accepted_at`/`delivered_at`/
  `closed_at` pe orders; `accept_order` recreat byte-identic + `accepted_at=now()`;
  tranzitiile delivered/closed seteaza timestamp in server action; rapoartele folosesc
  `deliveredAt ?? deliveryDate ?? updatedAt` (mai exact).
- **Facut F7a:** invitare **client** in `/setari/utilizatori` (`inviteClientAction`;
  "un client = un user" impus in aplicatie + coloana Firma in lista).
- **Facut F7b:** cautare pentru portalul clientului - ruta `/cauta` (distinct de `/cautare`
  staff), bara topbar cablata pe rol, href-uri corecte per rol.
- **Facut F2+F4:** drift-check tipuri normalizat prin prettier (prinde doar drift real de
  schema) + workflow nou `e2e.yml` (ruleaza testul E2E pe Supabase live in CI).
- **Facut (orchestrator, hardening):** migrarea `0016_review_hardening.sql` - inchide doua
  gap-uri semnalate de agenti: `order_links_client_insert` primeste `app.org_is_active`
  (guard suspendare complet) + index unic partial `profiles_client_id_unique`
  ("un client = un user" acum si la nivel de DB). AGENTS.md §4.1 actualizat.
- **Integrare:** verificat pe arborele unificat: typecheck, lint, **584 teste** - verzi.
  F5 (SMTP/Socrate.io real) + regenerarea canonica a tipurilor = partea manuala a userului.

## 2026-07-19 - Claude (orchestrator, subagenti Sonnet paraleli) - Milestone 3

- **Cerut:** X5 (livrari + avize/e-Transport) + X6 (documentatie/instruire), in paralel - ultimul milestone.
- **Facut X5:** `src/features/deliveries/` + `/livrari` - migrarea `0013_deliveries.sql`
  (tabel `deliveries` legat de comanda, unique order_id; enum `delivery_declaration_status`;
  RLS staff). Planificare livrare pe comanda acceptata, **aviz PDF** cu cod UIT (render
  on-demand, nu persistat). **Adapter e-Transport**: interfata `ETransportProvider`, impl
  **mock** (UIT determinist, fara retea - activa acum) + schelet **Socrate.io** (env
  `SOCRATE_*`, arunca "neconfigurat" pana la credentiale S4); declarare idempotenta cu
  eroare vizibila + re-incercabila. Nav "Livrări". 30 teste.
- **Facut X6:** `docs/manual/` - manual utilizare RO pe roluri (admin/operator + client,
  acopera fluxul 1->9), ghid administrare (setari org, useri, white-label, operare
  Supabase/Vercel), plan de instruire (5 sesiuni). Scris din codul real, nu din mockup;
  gap-uri semnalate onest (invitare client, screenshot-uri de adaugat). `docs/index.md`
  actualizat.
- **Integrare (orchestrator):** verificat pe arborele unificat: typecheck, lint,
  **564 teste**, build - verzi. **Milestone 3 complet. Tot planul de implementare livrat
  in cod** (ramane: cablare reala Socrate.io = S4/decizie client; screenshot-uri manual).

## 2026-07-18 - Claude (orchestrator, fix CI Milestone 2)

- **Cerut:** CI DB a esuat pe PR #11.
- **Facut:** migrarile 0000-0012 + seed-ul demo s-au aplicat CURAT pe Postgres real.
  Esecul era un typo in `rls_isolation.sql` (TEST 11-14, T2.1): unit `'buc'` in loc de
  `'bucata'` (valoarea enum `unit_of_measure`). Corectat (3 aparitii).

## 2026-07-18 - Claude (orchestrator, subagenti Sonnet paraleli) - Milestone 2 Batch 7

- **Cerut:** X2 (cautare globala) + X4 (seed demo + E2E), in paralel - finalul Milestone 2.
- **Facut X2:** `src/features/search/` - `globalSearch(query, {role})` peste comenzi/clienti/
  loturi/produse/certificate prin clientul user-ului (RLS = izolare automata); rolul client
  cauta DOAR in datele proprii (aparare in profunzime, testata). Bara din topbar (staff) ->
  `/cautare`. Fara migrare (query-based). 11 teste noi.
- **Facut X4:** `supabase/seed.sql` extins (organizatia demo: 3 clienti, 8 itemi din domeniul
  pilot - moloz, nisip/pietris/balast reciclat, caramizi eco, beton, + 1 serviciu - 3 retete,
  9 loturi pe 5 provenante + un lot blocat, 4 procese cu trasabilitate completa, 2 comenzi
  in stadii diferite + 1 certificat demo; contoare sincronizate; id-uri fara coliziune cu
  testul RLS). Test E2E `tests/e2e/mvp-flow.spec.ts` pe fluxul complet 1->9 (9 test.step prin
  UI real). Verificat static (typecheck/lint/`playwright --list`) - rularea efectiva cere
  Supabase live (fara Docker aici).
- **Integrare (orchestrator):** verificat pe arborele unificat: typecheck, lint, **534 teste**,
  E2E listat. **Milestone 2 (X1, X3, T2.1, X2, X4) complet.**

## 2026-07-18 - Claude (orchestrator, subagenti Sonnet paraleli) - Milestone 2 Batch 6

- **Cerut:** X1 (notificari email) + X3 (dashboard/rapoarte) + T2.1 (guard org suspendata),
  in paralel.
- **Facut X1:** `src/features/notifications/` - provider abstract (mock console in dev,
  stub HTTP configurabil; fara SMTP real), template-uri RO per tranzitie status,
  migrarea `0011_notifications.sql` (tabel + enum-uri, scriere doar prin service_role);
  cablat in `onOrderStatusChanged` (PASTRAND generarea certificatului de la G). 22 teste.
- **Facut X3:** `src/features/reports/` + `/dashboard` (4 carduri KPI) + `/rapoarte`
  (6 rapoarte pe perioada cu export PDF white-label + CSV): comenzi, livrari, retururi,
  materiale reciclate/recondiționate reintegrate, **PaaS "utilizat=livrat-returnat"** per
  client, **% materii prime secundare** per produs. Nav: Dashboard + Rapoarte. Limitare
  documentata: fara timestamp per-tranzitie (livrat aproximat). CO2 = v2.
- **Facut T2.1:** guard org suspendata pe 2 linii - middleware + `requireUser`/`requireRole`
  (redirect `/organizatie-suspendata`) + migrarea `0012_suspended_org_guard.sql` (helper
  `app.org_is_active`; `app.is_staff_of`/`is_admin_of` + politici client cer org activa;
  super_admin neafectat). `rls_isolation.sql` TEST 11-14. AGENTS.md §4 + plan actualizate.
- **Integrare (orchestrator):** reparat un test flaky in reports (localeCompare, trecea
  izolat). Verificat pe arborele unificat: typecheck, lint, **523 teste**, build - verzi.
  Sincronizat pe `origin/main` regenerat (`e38e409`); `database.types.ts` = versiunea
  canonica a schemei + tabelul `notifications` (X1).

## 2026-07-18 - Claude (orchestrator, fix CI)

- **Cerut:** merge Milestone 1 in main; CI-ul DB a esuat pe PR #10.
- **Facut:** migrarile 0000-0010 s-au aplicat CURAT pe Postgres real (validare CI, prima
  pe DB adevarat). Esecul era la testul RLS: `T9 super_admin vede ambele organizatii`
  folosea un count GLOBAL (=2), fragil pentru ca `supabase db reset` ruleaza si
  `seed.sql` (o organizatie demo) -> super_admin vedea 3. Fix: T9 verifica cele DOUA
  organizatii de test prin id (nu total global) - test mai corect, robust la seed.
  Restul aserttiilor sunt tenant-scoped, neafectate.

## 2026-07-17 - Claude (orchestrator, subagenti Sonnet paraleli) - Milestone 1 complet

- **Cerut:** Batch 5, Task F (retur/garantie/inchiriere) + Task H (portal client), in paralel.
- **Facut Task F:** `src/features/returns/` - `createReturnAction`/`acceptReturnAction`/
  `getReturnableItems`; retur = comanda legata (order_links), garantie = retur + inlocuire,
  inchiriere via `expected_return_date`; la acceptare materialele intra in stoc
  (`create_lot` provenance `return`). Migrarea `0010_returns.sql`: **fix RLS** (politica
  `order_links_client_insert` lipsea - clientul nu putea crea retururi) + RPC atomic
  `accept_return_order` (creeaza N loturi + status intr-o tranzactie; nu reutilizeaza
  `accept_order` care CONSUMA stoc). Butoane pe detaliul comenzii admin. 29 teste.
- **Facut Task H:** `src/features/client-portal/` + `src/app/(client)/`: **/catalog** (grid
  itemi sellable, search/filtre, **cos** cu localStorage), formular comanda (adresa, data,
  observatii -> draft+trimitere), **/comenzile-mele** (lista + detaliu, "repeta comanda"),
  **/documente** (documente + certificate proprii, download URL semnat). Reutilizeaza
  serviciile existente (orders, certificates, documents) fara sa le modifice. 34 teste.
- **Integrare (orchestrator):** conectat butonul de retur din portal la `ReturnActions`
  real al lui F (adaugat prop `redirectBasePath` -> `/comenzile-mele`; stub-ul sters);
  retur pe detaliul comenzii client cu `getReturnableItems`. Verificat pe arborele
  unificat: typecheck, lint, **438 teste**, build - verzi. **Milestone 1 (trasabilitate
  MVP: certificate + portal + retur) complet.**

## 2026-07-17 - Claude (orchestrator, implementare subagent Sonnet) - Milestone 1

- **Cerut:** Batch 4, Task G - Certificate de trasabilitate (PDF + graf), piesa centrala.
- **Facut:** verticala `src/features/certificates/`: traversare pura a grafului de
  trasabilitate (`process_outputs`->`processes`->`process_inputs`->loturi->surse, cu
  mass-balance proportional, recondiționarea distincta), snapshot inghetat in
  `certificates.traceability_snapshot`. **PDF server-side (decizie S3): `@react-pdf/renderer`**
  (pur JS, fara Chromium - merge pe Vercel serverless; verificat peer-deps React 19 OK).
  Graful randat cu aceeasi functie pura de layout (`layoutSankey`, extrasa din
  `production/sankey-data.ts`) atat in browser cat si in PDF. Migrarea
  `0009_certificates_storage.sql`: `certificate_counters` + `generate_certificate_number`
  (CRT-an-seq, sigur la concurenta) + bucket privat `certificates` (acces doar prin server
  actions). **Wiring:** `onOrderStatusChanged` genereaza certificatul automat la `closed`
  (idempotent pe `order_id` UNIQUE; erori logate, nu propagate). Ecran certificat
  `/comenzi/[id]/certificat` (mockup: header, date, graf SVG, tabel materiale+origine,
  documente, semnatura) + buton descarcare (URL semnat). 21 teste noi; typecheck, lint,
  387 teste, build - verzi.

## 2026-07-17 - Claude (orchestrator, merge cu origin/main)

- **Cerut:** merge `origin/main` in branch-ul de feature si rezolvarea conflictelor.
- **Facut:** `origin/main` avansase independent (PR-uri #2-#9: schema/auth backfill,
  **rls-hardening**, ci-db-enforcement, docs-process-fixes, **tenant-oauth-fixes**) fata
  de branch-ul nostru, divergent de la `92e170c` (T1.2). Rezolvare conflicte:
  - **Coliziune migrari `0003`:** eliminata `0003_client_write_hardening.sql` (T2.0) -
    `0003_rls_hardening.sql` din main e superset (aceleasi politici client constiente de
    status + trigger anti-escaladare pe `profiles` + pinning `organization_id` in
    WITH CHECK). Secventa finala: 0000->0008, un singur 0003.
  - **`rls_isolation.sql`, `db.yml`:** adoptata versiunea main (aliniata cu 0003-ul lor +
    ci-db-enforcement).
  - **`AGENTS.md`:** pastrate ambele - regulile mele de business (§4) + §4.1 (limitari
    cunoscute) din main.
  - **`prompt-log.md`, `implementation-plan.md`:** union cronologic / pastrata versiunea
    mea (mai actuala pe status). Aduse din main fix-urile auth/OAuth (middleware pe request
    headers, useri OAuth neprovizionati blocati, `/showcase` scos din productie).
  - Verificat pe arborele unificat: typecheck, lint, **369 teste**, build - toate verzi.

## 2026-07-17 - Claude (orchestrator, implementare subagenti Sonnet in worktree izolat)

- **Cerut:** Batch 3, Task E (Comenzi) + Task D (Productie) - rulate in paralel cu
  **izolare pe worktree** (ambele editeaza database.types.ts).
- **Facut Task E:** migrarea `0007_orders_ops.sql` (`order_counters` + `generate_order_number`
  sigur la concurenta; RPC-uri atomice `accept_order` - scadere stoc la acceptare prin
  `consume_fifo` - si `cancel_order` - refacere stoc + evenimente `reversal`). Verticala
  `src/features/orders/` cu masina de stari (draft->sent->accepted->delivered->closed,
  ->cancelled), ecranele `/comenzi`, `/comenzi/nou`, `/comenzi/[id]`, hook `onOrderStatusChanged`
  pt. notificari (X1). 68 teste noi.
- **Facut Task D:** migrarea `0008_reconditioning.sql` (`lot_provenance += reconditioning`
  ca ALTER TYPE ADD VALUE intr-o migrare proprie; RPC-uri atomice `confirm_process`/
  `cancel_process`). Verticala `src/features/productie/` cu cele doua sub-fluxuri (4a output
  fix / 4b input fix), diagrama **Sankey custom SVG** (decizie S3: fara librarie noua -
  risc peer-deps React 19/Next 16 + bundle nejustificat; portat 1:1 din mockup, logica pura
  testabila separata de randare), recondiționarea ca provenient/badge distinct. Agentul a
  validat SQL-ul pe un Postgres 16 local (0000->0008 + smoke FIFO/reconditioning/rollback).
  39 teste noi.
- **Integrare (orchestrator):** worktree-urile au pornit din `origin/main` (divergenta -
  vezi mai jos), deci am extras DOAR livrabilele proprii ale fiecarui task pe branch-ul
  `claude/app-plan-review-w3cr7a` (nu am absorbit lineage-ul independent din main).
  database.types.ts: adaugirile E + D aplicate manual, non-conflictual. Verificat pe arborele
  unificat: typecheck, lint, **352 teste** verzi. Worktree-urile sterse.

## 2026-07-17 - Claude (orchestrator, implementare subagent Sonnet)

- **Cerut:** Batch 2, Task A - clienti (lookup CUI, adrese, documente) + modul generic
  de documente; spike S1.
- **Facut:** **S1 rezolvat** - adapter ANAF v9 (webservicesp.anaf.ro) in spatele
  `CuiLookupProvider` (sursa inlocuibila), cu normalizare + checksum CUI inainte de
  apel, timeout scurt (AbortController) si degradare gratioasa (precompletare, nu
  obligatoriu). Verticala clienti (`/clienti`, `/clienti/nou`, `/clienti/[id]`): CRUD,
  lookup CUI cu confirmare manuala, adrese de livrare (o singura implicita/client),
  istoric comenzi ca placeholder (Task E). **Modul generic de documente**
  (`src/features/documents/`): migrarea `0006_documents_storage.sql` (bucket privat
  fara politici pe storage.objects - acces DOAR prin server actions), upload/list/
  download(URL semnat 60s)/delete cu verificare RLS pe ownerul entitatii + client admin
  pentru storage; eticheta "contract" (decizia de arhivare). Fix Next.js 16: constantele
  de state mutate din fisiere `"use server"` in `action-state.ts`. 77 teste noi (ANAF
  mock-uit); typecheck/lint/test/build verzi.

## 2026-07-17 - Claude (orchestrator claude-fable-5, implementare subagent Sonnet)

- **Cerut:** Batch 2, Task B - itemi, catalog (definitie) & retete, inclusiv `items.kind`.
- **Facut:** migrarea `0005_item_kind.sql` (enum `item_kind` physical|service +
  `items.kind` + index; motivatia PaaS/Anexa 1 in comentariu; tipuri actualizate manual
  in database.types.ts). Verticala itemi (`/itemi`, `/itemi/nou`, `/itemi/[id]`): lista
  cu filtre tip/vandabil + search, formular comun creare/editare (fara upload fisiere -
  modulul de documente e in Task A). Verticala retete (`/retete`, `/retete/nou`,
  `/retete/[itemId]`): editor componente cu upsert, self-reference blocat, suma
  procentelor avertizata informativ la !=100% (nu blocheaza - regula handoff), retete
  respinse server-side pentru itemi `service` (verificat din DB, nu din input). Nav:
  intrare "Itemi". Plan de task in docs/plans/task-b-itemi-retete.md. 54 teste noi;
  typecheck/lint/test verzi.

## 2026-07-17 - Claude (orchestrator claude-fable-5, implementare subagent Sonnet)

- **Cerut:** Batch 2, Task I - super-admin: management organizatii.
- **Facut:** verticala `src/features/platform/` + `src/app/platform/`: lista organizatii
  (nr. useri, URL de acces per tenant, status badge), creare organizatie + invitare
  admin initial (service-role; esec partial vizibil in UI cu re-incercare invitatie fara
  recreare org), suspendare/reactivare (client de sesiune - RLS permite super-adminului).
  Layout minim super-admin (fara shell-ul de staff). Validare slug identica cu
  constraint-ul DB. 43 teste noi. **Gap semnalat:** middleware/guard-urile nu verifica
  `organizations.status` - userii unei organizatii suspendate isi pastreaza accesul;
  de rezolvat intr-un task de hardening (adaugat in plan la integrarea batch-ului).

## 2026-07-17 - Claude (orchestrator claude-fable-5, implementare subagent Sonnet)

- **Cerut:** Batch 1, Task C - Stoc & Loturi + Audit + stock service (contractul pentru
  Task D si E).
- **Facut:** migrarea `0004_stock_service.sql` cu 3 RPC-uri SECURITY INVOKER (RLS activ,
  atomice prin tranzactia implicita): `create_lot` (lot + eveniment intake),
  `consume_fifo` (FIFO pe `lots_fifo_idx` cu FOR UPDATE, selectie manuala prin
  `array_position`, eroare LT001 la stoc insuficient -> rollback complet),
  `set_lot_block` (blocare/deblocare cu motiv). Coduri de eroare tipizate LT001-LT005
  traduse in erori TS. Verticala `src/features/stock/` (service, queries, actions, CSV,
  componente) + ecranele `/stoc`, `/stoc/nou`, `/stoc/audit` cu export CSV (BOM UTF-8,
  RFC 4180). Helper pur `planFifoConsumption()` pentru preview FIFO client-side (Task D).
  Tipurile RPC adaugate manual in `database.types.ts` (de regenerat local).
  39 teste noi; typecheck/lint/test verzi (76/76).

## 2026-07-17 - Claude (orchestrator claude-fable-5, implementare subagent Sonnet)

- **Cerut:** implementarea proiectului cu subagenti orchestrati - Batch 1, task T2.0
  (hardening RLS scrieri client, precede Task E/H).
- **Facut:** migrarea `0003_client_write_hardening.sql`: politicile `orders_client_all`
  si `order_items_client_all` (FOR ALL) inlocuite cu politici granulare
  select/insert/update/delete - clientul creeaza comenzi doar in draft/sent, editeaza
  doar draft/sent, sterge doar draft; `order_items` editabile doar cat comanda parinte
  e draft/sent; trigger BEFORE UPDATE `orders_client_status_transition` care permite
  clientului doar draft->sent, draft->cancelled, sent->cancelled. Staff neafectat.
  `rls_isolation.sql` extins cu testele T5-T9 (accepted/closed interzise clientului,
  items read-only dupa acceptare, delete doar pe draft, staff accepta in continuare).
  Testul RLS conectat in CI (`db.yml` ruleaza `psql -f rls_isolation.sql` dupa
  `db reset`). Validarea migrarilor pe DB real se face in CI (Docker blocat local).
  - **NOTA (merge cu `origin/main`, 2026-07-17):** migrarea `0003_client_write_hardening.sql`
    de aici a fost **eliminata** la merge - `origin/main` avea deja
    `0003_rls_hardening.sql` (PR independent) care face aceleasi politici client
    constiente de status **plus** un trigger anti-escaladare pe `profiles` **plus**
    pinning `organization_id` in WITH CHECK (superset). S-a pastrat versiunea din main.

## 2026-07-17 - Claude (claude-fable-5)

- **Cerut:** review serios al aplicatiei (plan + docs) fata de ultimele modificari din
  branch; apoi aplicarea revizuirilor decise: termen MVP = august 2026 (nu 2025) si
  decizia "arhivare" la intrebarea despre contracte.
- **Facut:** revizuit planul de implementare pe baza review-ului: termen corectat in
  plan/index/handoff; Wave 0-1 marcate ✅ livrate (+ descriere T1.2 aliniata la realitate:
  forms custom, Google OAuth, magic link, tenant pe 3 niveluri); task nou **T2.0**
  (hardening RLS scrieri client pe orders/order_items - gaura de securitate gasita la
  review, precede E/H); task nou **X6** (documentatie utilizare + instruire - singurul ❌
  de conformitate ramas fara task); recondiționarea alocata Task D (migrare enum);
  Task B noteaza migrarea `items.kind` (tipuri produs/serviciu); X5 noteaza extinderea
  `document_owner_type`; sectiune de prioritizare pentru termenul august 2026 (lant
  critic demo MVP). Decizia **contracte = arhivare** consemnata in
  anexa-1-modificari-propuse (§4 rezolvata), analiza-conformitate (nota PaaS, livrabile
  X6, recomandarea 8) si AGENTS.md §4 (3 reguli noi: contracte-arhivare, recondiționare
  vizibila, scrieri client prin server actions + RLS).
## 2026-07-02 - Claude Sonnet 5

- **Cerut:** PR 3 dintr-un plan de remediere - 3 fix-uri: (1) headerele de tenant
  (`x-tenant-slug`/`x-tenant-domain`) erau setate pe response headers in
  `src/lib/supabase/middleware.ts`, care nu ajung niciodata la server components/route
  handlers; (2) `RESERVED_PATH_SEGMENTS` din `tenant.ts` nu includea rutele reale ale
  aplicatiei (`dashboard`, `portal`, `platform`, `showcase`, `set-password`,
  `forgot-password`), deci rezolvarea pe path le-ar fi tratat ca slug de tenant; (3)
  `signInWithGoogleAction` (OAuth) poate crea un user in `auth.users` fara rand in
  `public.profiles` (spre deosebire de magic link, care are `shouldCreateUser: false`),
  ocolind provizionarea prin invitatie. Plus un fix minor: `/showcase` trebuie sa fie
  inaccesibil in productie.
- **Facut:** `middleware.ts` rezolva tenantul INAINTE de a crea raspunsul si il propaga pe
  REQUEST headers (`NextResponse.next({ request: { headers } })`), pastrand exact
  pattern-ul de cookie-uri `@supabase/ssr` (recreare `supabaseResponse` in `setAll`, fara
  logica intre `createServerClient` si `getUser()`); numele headerelor sunt acum constante
  exportate (`TENANT_SLUG_HEADER`/`TENANT_DOMAIN_HEADER`) din `features/auth/tenant.ts`.
  Extins `RESERVED_PATH_SEGMENTS` + teste. In `src/app/auth/callback/route.ts`, dupa
  `exchangeCodeForSession` reusit se verifica daca userul are profil; daca nu,
  `signOut()` + redirect `/login?error=unprovisioned` (fluxul de resetare parola nu are
  nevoie de exceptie - userul respectiv are deja profil). `login-form.tsx` +
  `(auth)/login/page.tsx` afiseaza acum mesaje clare in romana pentru
  `error=unprovisioned`/`auth`/`oauth` (nu erau afisate deloc inainte, desi erau setate).
  `docs/setup.md` - pas obligatoriu: dezactivarea sign-up-ului public din dashboard-ul
  Supabase. `showcase/page.tsx` apeleaza `notFound()` cand `NODE_ENV === "production"`
  (verificat manual cu build de productie: `/showcase` -> 404). Teste noi:
  `middleware.test.ts`, `auth/callback/route.test.ts`, `login-form.test.tsx`; extinse
  `tenant.test.ts`. Plan in `docs/plans/tenant-oauth-fixes.md`. Toate check-urile verzi
  (typecheck/lint/format/test/build).

## 2026-07-02 - Claude Haiku 4.5

- **Cerut:** remediare proces documente - backfill prompt-log pentru T1.1/T1.2, actualizar termen
  MVP, documente trade-off-uri acceptate.
- **Facut:** adaugat doua intrari backfill in docs/prompt-log.md (T1.1/T1.2, 2026-07-01, marcat
  "(backfill)"), actualizat termen MVP in docs/plans/implementation-plan.md la "august 2026" cu nota
  istorica, adaugat sectiune AGENTS.md §4.1 "Limitari cunoscute / trade-off-uri acceptate"
  (stock_events audit, org_branding anonim, profiles.email duplication), formatted si lintat.

## 2026-07-01 - Claude Opus 4.8 (backfill)

- **Cerut:** auth + role routing + tenant context (T1.2).
- **Facut:** login/magic link/Google + password reset (src/features/auth/), getCurrentUser/requireRole
  (session.ts), tenant resolution (tenant.ts), org_branding RPC (migration 0002), route guards pentru
  (admin)/(client)/(auth) pages, middleware session refresh + guard. Commit: 92e170c.

## 2026-07-01 - Claude Opus 4.8 (backfill)

- **Cerut:** consolidated MVP schema + multi-tenant RLS (T1.1).
- **Facut:** migrare supabase/migrations/0001_core_schema.sql (17 tables, enums, app.* tenant helper
  functions, RLS policies, grants), RLS smoke test supabase/tests/rls_isolation.sql, regenerat
  src/lib/database.types.ts. Commit: 00cb830.

## 2026-07-02 - Claude Sonnet 5

- **Cerut:** PR 2 din planul de remediere (`docs/plans/code-review-remediation.md`, constatari
  3 si 4) - CI care sa ruleze efectiv testele de izolare RLS si sa faca blocanta verificarea
  de drift a tipurilor generate.
- **Facut:** `.github/workflows/db.yml` - dupa `supabase db reset`, ruleaza
  `supabase/tests/rls_isolation.sql` prin `psql -v ON_ERROR_STOP=1` (port `54322` din
  `supabase/config.toml`); verificarea de drift `database.types.ts` a devenit blocanta
  (`::error` + `exit 1`, comentariul "informativ, nu blocant" eliminat); trigger-ul `paths`
  extins cu `src/lib/database.types.ts`. Script nou `pnpm db:test` in `package.json` + rand nou
  in tabelul de comenzi din AGENTS.md §3.2. **Limitare mediu:** nu s-a putut porni Supabase
  local aici (egress `ghcr.io` blocat) - validat prin citire atenta a workflow-ului si a
  scripturilor; verificat `pnpm typecheck && pnpm lint && pnpm test` (verzi).

## 2026-07-02 - Claude Opus 4.8

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
  proprii catre alt tenant - gaura mostenita si de politicile FOR ALL din 0001).
  Politicile de staff neatinse. Extins `supabase/tests/rls_isolation.sql` (T5-T10).
  Validat prin citire - CI `db.yml` aplica migrarea pe PR.

## 2026-07-02 - Claude Fable 5

- **Cerut:** analiza plan + cod (suntem pe drum? zone gri / probleme), apoi plan de
  remediere a constatarilor si distribuirea lui pe subagenti, cu cate un PR per grup.
- **Facut:** review complet Wave 0-1 (schema/RLS, auth/tenant, CI, proces). Constatari
  majore: escaladare de privilegii prin `profiles_update`, politici client `FOR ALL` pe
  `orders`, teste RLS nerulate in CI, drift check ne-blocant, headere tenant setate pe
  raspuns in loc de request, useri OAuth fara profil, prompt-log lipsa la T1.1/T1.2,
  termen stale. Plan de remediere in 4 PR-uri:
  [`docs/plans/code-review-remediation.md`](plans/code-review-remediation.md).
  Adaugat `.claude/worktrees/` in `.gitignore` (worktree-uri temporare ale subagentilor).

## 2026-06-30 - Claude Opus 4.8

- **Cerut:** pregatirea pentru mutarea repo-ului in noua organizatie `Economie-Circulara` -
  setup script / session-start hook, `docs/setup.md` (Supabase + Vercel + environment) si
  workflow GitHub Actions pentru validarea DB.
- **Facut:** `.claude/hooks/session-start.sh` + `.claude/settings.json` (instaleaza deps,
  pregateste `.env.local`, expune Chromium pt. Playwright), validat end-to-end (hook + lint +
  test). `docs/setup.md` cu pasii de conectare la Supabase/Vercel si configurarea
  environment-ului Claude Code (acces GitHub App, network policy ghcr.io, secrete).
  `.github/workflows/db.yml` care porneste Supabase pe runner si aplica migrarile. Referinte
  adaugate in AGENTS.md.

## 2026-06-25 - Claude Opus 4.8

- **Cerut:** continuarea cu urmatorul task din plan (T0.2 - design system & tema).
- **Facut:** tokeni oklch extrasi din mockup -> `globals.css` (paleta brand/accent, semantice
  status, pattern grid, mapare shadcn cu Tailwind v4 `@theme`); fonturi Archivo/IBM Plex
  Mono/Spectral via `next/font`. Primitive shadcn-style (`button`, `badge`, `table`, `input`,
  `label`, `card`) + `components.json`. Componente partajate: `StatusBadge` (registru statusuri
  din mockup), `DataTable` (TanStack: sortare/paginare/hover), `EmptyState`, `PageHeader`,
  `FormField`, `BrandProvider` (white-label), sidebar fix + `AppShell` + `nav-config` pe roluri.
  Pagina `/showcase` reda tot. Teste unitare pentru `StatusBadge` si `DataTable`. Verificat
  vizual prin screenshot. Toate check-urile verzi (typecheck/lint/test/build/format).

## 2026-06-25 - Claude Opus 4.8

- **Cerut:** continuarea cu urmatorul task din plan (T0.3 - integrare Supabase).
- **Facut:** `supabase init` (`config.toml`), migrare de baza `0000_extensions.sql`,
  clienti Supabase (`src/lib/supabase/{client,server,middleware}.ts`), helper `env.ts`,
  `middleware.ts` la root (refresh sesiune), scripturi `db:start|stop|reset`, `gen:types`,
  placeholder `database.types.ts`, teste unitare cu mocks pentru `env` si clientul browser.
  Actualizat AGENTS.md §3.1/§3.2 si `.env.example`.
  **Limitare mediu:** `pnpm db:start`/`gen:types` n-au putut rula aici - egress-ul catre
  imaginile Docker `ghcr.io/supabase/*` e blocat de politica (403). Se ruleaza local/CI.

## 2026-06-25 - Claude Opus 4.8

- **Cerut:** continuarea cu urmatorul task din plan (T0.1 - scaffolding).
- **Facut:** schela Next.js 16 (App Router, TS) + Tailwind v4, ESLint flat (`next` +
  `prettier`), Vitest (jsdom + RTL) cu 2 teste smoke, Playwright (config + 1 test e2e),
  structura `src/app|features|components/ui|lib`, husky + lint-staged, workflow CI
  (typecheck/lint/test), `.gitignore`, `.env.example`. Completat AGENTS.md §3.1/§3.2
  (structura repo + comenzi). Verificat: typecheck, lint, test, build si `pnpm dev` (HTTP 200).

## 2026-06-25 - Claude Opus 4.8

- **Cerut:** task-ul de scaffolding (T0.1) sa aiba ca criteriu de acceptare completarea
  sectiunii §3.1 din AGENTS.md (cai catre domenii + comenzi).
- **Facut:** adaugat criteriul de acceptare "AGENTS.md §3.1 completat" la T0.1 in
  `docs/plans/implementation-plan.md`.

## 2026-06-25 - Claude Opus 4.8

- **Cerut:** creare AGENTS.md cu reguli generale (planuri in `docs/plans/`, prompt log
  la commit, actualizare reguli la corectii, teste unitare obligatorii, descriere proiect
  - cai/comenzi), plus fisier de prompt log.
- **Facut:** adaugat `AGENTS.md` (reguli de proces, testare, descriere proiect, reguli de
  business). Creat `docs/prompt-log.md`. Mutat planul in `docs/plans/implementation-plan.md`
  si actualizat link-urile din `docs/index.md`.

## 2026-06-25 - Claude Opus 4.8

- **Cerut:** plan de implementare care imparte proiectul in task-uri pentru agenti AI.
- **Facut:** adaugat `docs/plans/implementation-plan.md` (waves, dependente, contracte
  interne, criterii de acceptare, spikes) si link din `docs/index.md`.
