# Plan de implementare - Lateris Trace (Economie Circulara)

Acest document transforma cerintele din [`handoff.md`](handoff.md) si designul din
[`design/Lateris_Trace.dc.html`](design/) intr-un plan de implementare impartit in
**task-uri individuale, autonome, ce pot fi preluate de agenti AI in paralel**.

Scopul: livrarea MVP-ului (termen tinta: **august 2026**) cu un set de task-uri clar
delimitate, cu dependente explicite, contracte (interfete) intre ele si criterii de
acceptare verificabile.

> **Status (2026-07-17):** Wave 0 + Wave 1 **livrate**. Wave 2 aproape completa:
> ✅ C, B, A, I, E, D, **G (certificate)**; ramase **F (retur)** + **H (portal client)**
> (Milestone 1). Spikes S1 (ANAF) + S3 (Sankey/PDF) rezolvate; S2 (standarde certificat)
> si S4 (Socrate.io e-Transport) inca deschise. Wave 3 (X1/X2/X3/X5/X6 + T2.1) = Milestone 2-3.

---

## 1. Principii de impartire pentru agenti AI

Ca mai multi agenti sa poata lucra in paralel fara sa se calce reciproc:

1. **Schema de date este contractul comun.** Se construieste prima (Wave 1) si devine
   sursa de adevar. Toti agentii de feature consuma tipuri TypeScript generate din
   schema (`supabase gen types`), nu redefinesc modele.
2. **Izolare pe foldere de feature.** Fiecare vertical traieste in
   `src/features/<feature>/` (componente, server actions, queries, teste). Conflictele
   de merge sunt minimizate pentru ca agentii ating fisiere diferite.
3. **Migrari aditive, numerotate.** Fiecare task care are nevoie de schema noua adauga
   _un singur_ fisier de migrare cu prefix ordonat (`0007_orders.sql`). Nu se editeaza
   migrari existente.
4. **Un task = un PR.** Fiecare task produce un branch + PR mic, review-abil, cu teste.
5. **Acceptance criteria sunt executabile.** Fiecare task se considera „done" doar cu
   teste verzi + lint + typecheck.
6. **Romana in UI, engleza in cod** (conform handoff).

### Definition of Done (global, valabil pentru fiecare task)

- [ ] `pnpm typecheck` + `pnpm lint` trec
- [ ] Teste unitare/integrare pentru logica noua trec
- [ ] RLS verificat (un tenant nu vede datele altui tenant)
- [ ] UI corespunde mockup-ului relevant din `design/`
- [ ] Fara secrete hardcodate; variabile prin `.env`

---

## 2. Stack si arhitectura (recap din docs)

| Strat        | Tehnologie                                                            |
| ------------ | --------------------------------------------------------------------- |
| Framework    | Next.js (App Router) + TypeScript                                     |
| UI           | shadcn/ui retematizat (paleta pamant/verde, pattern subtil de fundal) |
| Auth         | Supabase Auth (widgeturi out-of-the-box)                              |
| DB + Storage | Supabase Postgres (EU) + Supabase Storage                             |
| Multi-tenant | Izolare logica prin RLS pe `organization_id`                          |
| Diagrame     | librarie React pt. Sankey (Recharts/Nivo)                             |
| PDF          | generare server-side certificat (ex. React-PDF / Puppeteer)           |
| Hosting      | Vercel                                                                |

---

## 3. Harta dependentelor (waves)

```
Wave 0  Foundation (1 agent, secvential)          ──┐  blocheaza tot
Wave 1  Schema + Auth + Tenant (1-2 agenti)        ──┤  blocheaza Wave 2
Wave 2  Verticale de feature (mai multi agenti, PARALEL)
        A Clienti   B Itemi/Retete   C Stoc/Loturi
        D Productie D Certificate    E Comenzi
        F Retur     G Portal client  H Super-admin
Wave 3  Cross-cutting (paralel, dupa ce verticalele exista)
        Notificari · Cautare globala · Dashboard/KPI · E2E · Seed
```

Reguli de dependenta cheie in Wave 2:

- **C (Stoc/Loturi)** trebuie sa expuna API-ul de consum FIFO + creare lot inainte ca
  **D (Productie)** si **E (Comenzi)** sa fie complete. Vezi „contracte interne" mai jos.
- **G (Certificate)** depinde de modelul de trasabilitate produs de **D** si **E**.
- **F (Retur/Garantie)** depinde de **E (Comenzi)**.

---

## 4. WAVE 0 — Foundation (blocheaza tot, un singur agent) — ✅ LIVRAT

### T0.1 — Scaffolding proiect Next.js + tooling ✅

- **Scop:** initializare Next.js (App Router, TS), Tailwind, ESLint/Prettier, Vitest +
  Playwright, structura de foldere `src/app`, `src/features`, `src/components/ui`,
  `src/lib`, husky/lint-staged.
- **Livrabil:** repo care porneste (`pnpm dev`), CI minimal (typecheck+lint+test).
- **Acceptare:**
  - build verde, un test smoke trece, CI ruleaza pe PR;
  - **`AGENTS.md` §3.1 completat** cu caile reale catre domeniile principale
    (`src/features/<domeniu>/`, schema/migrari Supabase, tipuri generate) si cu comenzile
    uzuale efective (`dev`, `build`, `test`, `typecheck`, `lint`, `db reset`, `gen-types`).
    Placeholder-ul „de completat" din §3.1 nu mai exista dupa acest task.

### T0.2 — Design system & tema (din mockup) ✅

- **Scop:** instalare shadcn/ui; extragerea tokenilor din `Lateris_Trace.dc.html`
  (paleta pamant/verde/ocru/slate, tipografie, pattern de fundal, badge-uri de status);
  layout shell cu **sidebar fix** + componente comune (DataTable cu sortare/paginare/hover,
  StatusBadge, EmptyState, PageHeader cu breadcrumb, FormField).
- **Dependente:** T0.1
- **Acceptare:** un Storybook/pagina de showcase reda tema; DataTable si StatusBadge
  refolosibile; suport white-label prin CSS variables (logo + culori per org).

### T0.3 — Integrare Supabase (clienti + env) ✅

- **Scop:** proiect Supabase (regiune EU), `supabase/` cu CLI + migrari, clienti server
  & browser, helper de sesiune (`@supabase/ssr`), script `gen-types`.
- **Dependente:** T0.1
- **Acceptare:** conexiune locala functioneaza; `supabase db reset` ruleaza migrari;
  tipurile se genereaza in `src/lib/database.types.ts`.

---

## 5. WAVE 1 — Schema de date, Auth, Multi-tenant (blocheaza Wave 2) — ✅ LIVRAT

### T1.1 — Schema completa de baza de date + RLS (CONTRACTUL COMUN) ✅

- **Scop:** o migrare consolidata care defineste toate entitatile MVP si politicile RLS.
  Tabele minime:
  - `organizations` (white-label: logo, culori, domeniu, email settings)
  - `profiles` / `users` cu `role` (super_admin, admin, operator, client) si `organization_id`
  - `clients` (firma cumparatoare: CUI, denumire, reg. com., TVA, contact; flag `is_supplier`)
  - `client_addresses` (multiple adrese de livrare)
  - `items` (titlu, descriere, UM, flag `sellable`, poza)
  - `item_documents`, `client_documents`, `order_documents`
  - `recipes` + `recipe_components` (procente, refera `items`)
  - `lots` (item, data intrare, sursa, provenienta, cantitate initiala/ramasa, status
    calitate, blocat + motiv)
  - `stock_events` (audit trail: cine/cand/cantitate/lot/motiv/tip miscare)
  - `processes` (tip: output_fix | input_fix; status; reteta) + `process_inputs` (loturi
    consumate) + `process_outputs` (loturi create) — baza pentru Sankey & trasabilitate
  - `orders` + `order_items` (status: draft→trimisa→acceptata→livrata→inchisa/anulata;
    flag `created_by_admin`; `delivery_address_id`, `delivery_date?`, `expected_return_date?`)
  - `order_links` (retur/garantie → comanda originala)
  - `certificates` (numar unic, data, order_id, snapshot trasabilitate, path PDF)
- **RLS:** fiecare tabel filtrat pe `organization_id`; clientul vede doar randurile
  legate de `client_id`-ul propriu. Super-admin trece peste tenant.
- **Dependente:** T0.3
- **Acceptare:** `db reset` ruleaza curat; teste RLS (pgTAP sau integrare) demonstreaza
  izolarea intre 2 organizatii si intre 2 clienti.
- **Nota:** Acesta este cel mai important task de coordonare. Trebuie revizuit si
  „inghetat" inainte de a porni Wave 2. Modificarile ulterioare de schema = migrari noi.
- **Livrat:** migrarea `0001_core_schema.sql` (toate entitatile MVP + RLS + helper-e
  `app.*` SECURITY DEFINER) + test izolare `supabase/tests/rls_isolation.sql`.
  Schema e **inghetata** — orice modificare = migrare noua (vezi T2.0, Task B, Task D).

### T1.2 — Auth, rutare pe roluri, context de tenant ✅

- **Scop:** login email/parola, invitatie + setare parola, reset;
  middleware Next.js care rezolva organizatia (din domeniu/white-label) si rolul; guard-uri
  de ruta `/(admin)`, `/(client)`; helper `getCurrentUser()` + `requireRole()`.
- **Dependente:** T1.1, T0.2
- **Acceptare:** login functional (mockup „Autentificare"); rolul determina layout-ul;
  acces neautorizat redirectat; teste pe guard-uri.
- **Livrat (peste plan):** formulare custom + server actions (nu widgetul Supabase),
  **Google OAuth + magic link** pe langa email/parola; rezolvare tenant pe 3 niveluri
  (custom domain → subdomeniu → segment de path, fallback path in dev); RPC
  `org_branding` (anon) pentru branding per tenant pe ecranul de login.

### T1.3 — Setari organizatie & white labeling (admin) ✅

- **Scop:** ecranul **Setari** (doar admin): logo, culori, domeniu, sender email; aplicarea
  temei per tenant in runtime; management useri (creare operator & client, invitatii).
- **Dependente:** T1.1, T1.2
- **Acceptare:** schimbarea culorilor/logo se reflecta in sidebar; invitarea unui operator
  trimite email si creeaza cont.

---

## 6. WAVE 2 — Verticale de feature (PARALEL)

Fiecare task de mai jos este auto-continut: foloseste schema din T1.1, livreaza
UI + server actions + queries + teste pentru ecranul/fluxul lui.

### Contracte interne (interfete intre verticale) — de definit la inceputul Wave 2

Pentru a permite paralelismul, **Task C** publica primul un mic modul de „stock service":

```
createLot(input): Lot
consumeFIFO(item_id, qty, { manualSelection? }): { lot_id, qty }[]   // scade stoc + stock_events
recordStockEvent(...)
getAvailableStock(item_id): qty
```

D (Productie) si E (Comenzi) consuma aceste functii. Pana exista, pot lucra contra unui
stub tipat (mock) cu aceeasi semnatura.

---

### Task T2.0 — Hardening RLS scrieri client (PRECONDITIE pt. E & H)

- **Problema (review 2026-07):** politica `orders_client_all` din `0001_core_schema.sql`
  e `FOR ALL` conditionata doar de `client_id`, iar tabelele au GRANT pe `authenticated`
  si sunt expuse prin Data API. Un user client poate face PATCH **direct pe `status`**
  (ex. `sent` → `accepted`/`closed`) ocolind server actions — fara scadere de stoc,
  fara certificat. Similar `order_items_client_all` (editare cantitati pe comenzi
  deja acceptate).
- **Scop:** migrare noua (aditiva) care restrange scrierile rolului client:
  clientul poate crea/edita comenzi si `order_items` doar in status `draft`/`sent`;
  schimbarea de `status` de catre client e limitata la tranzitiile permise lui
  (draft→sent, si eventual →cancelled cat timp nu e acceptata) — prin politici RLS
  restranse + trigger, sau prin mutarea scrierilor client in RPC-uri SECURITY DEFINER.
- **Dependente:** T1.1
- **Acceptare:** test SQL (extindere `rls_isolation.sql`) demonstreaza ca un client
  NU poate seta `accepted`/`closed` si NU poate modifica itemii unei comenzi acceptate;
  fluxurile legitime (draft, trimitere) raman functionale.

### Task T2.1 — Guard organizatie suspendata (hardening, dupa Task I)

- **Problema (semnalata la livrarea Task I):** suspendarea unei organizatii seteaza
  `organizations.status = 'suspended'`, dar middleware-ul si `getCurrentUser`/
  `requireRole` nu verifica statusul — userii tenantului suspendat isi pastreaza
  accesul complet.
- **Scop:** blocarea accesului pentru organizatii suspendate: verificare
  `status = 'active'` in `getCurrentUser`/middleware (redirect la o pagina
  „organizatie suspendata") si, ca a doua linie de aparare, in RLS (politicile de
  scriere pe tabelele de business sau helper-ul `app.is_staff_of`/`app.org_id` —
  migrare noua). Super-adminul ramane neafectat.
- **Dependente:** Task I
- **Acceptare:** user admin/operator/client dintr-o organizatie suspendata nu mai
  poate accesa nicio ruta protejata si nicio scriere prin Data API; la reactivare
  accesul revine; teste pe guard + extindere `rls_isolation.sql`.

### Task A — Clienti

- **Ecrane:** lista clienti, detaliu/creare client, adrese de livrare, documente client.
- **Scop:** CRUD clienti firme juridice; **lookup CUI** (research spike S1) cu precompletare
  - confirmare manuala; adrese multiple; flag furnizor; upload documente.
- **Dependente:** T1.x; spike S1 (API CUI)
- **Nota contracte (decizie 2026-07: „arhivare"):** contractele semnate se **arhiveaza**
  ca documente PDF atasate clientului (infrastructura `documents` existenta) —
  platforma NU gestioneaza structurat perioade/obligatii/tarife contractuale.
  UI-ul de documente client trebuie sa faca arhivarea contractelor evidenta
  (ex. tip/eticheta „contract" la upload).
- **Acceptare:** creezi client prin CUI lookup, editezi, adaugi 2 adrese, atasezi un PDF;
  RLS izoleaza per organizatie.

### Task B — Itemi, Catalog (definitie) & Retete

- **Ecrane:** lista itemi, creare/editare item (titlu, descriere, poza, UM, flag `vandabil`,
  atasamente), **Retete** (componente in procente).
- **Scop:** CRUD itemi; editor reteta (suma procente validata informativ); fara versionare.
- **Nota (2026-07):** tipurile de abonament/serviciu PaaS (ex. Basic/Premium/Pay-per-Use/
  Flexi-Beton din cererea unui viitor client) se modeleaza ca **tip de produs/serviciu**
  in catalog (item ne-fizic sau categorie „serviciu"), nu ca modul separat de abonamente.
  Fara preturi/facturare. **Atentie schema:** `items` din T1.1 (inghetata) nu are camp
  de tip/categorie — Task B include o **migrare noua** (ex. `items.kind`:
  `physical | service`) care sustine cerinta revizuita din Anexa 1 („gestionarea
  tipurilor de produse si servicii furnizate").
- **Dependente:** T1.x
- **Acceptare:** definesti „Caramida eco" cu reteta din 3 componente; itemul cu `vandabil`
  apare in catalogul clientului (Task G).

### Task C — Stoc & Loturi + Audit (FUNDAMENT pt. D & E)

- **Ecrane:** lista loturi (mockup „Stoc"), adauga lot (provenienta: achizitie/productie/
  reciclare/retur/ajustare), blocare lot cu motiv, **Audit stoc** (listing `stock_events`
  - **export CSV/Excel**).
- **Scop:** managementul loturilor; **stock service** (vezi contracte); FIFO; toate
  miscarile scriu in `stock_events`.
- **Dependente:** T1.x
- **Acceptare:** adaugi lot, blochezi/deblochezi, consumi FIFO si vezi evenimentele in
  audit; exportul CSV contine miscarile; **publica modulul stock service**.

### Task D — Productie & Reciclare (cu Sankey)

- **Ecrane:** pornire proces — **4a output fix** (introduci cantitate output → consum FIFO
  calculat automat → confirmare → loturi noi) si **4b input fix/output variabil** (introduci
  input → output ideal pe reteta → tabel editabil → confirmare → loturi noi); istoric proces
  cu **Sankey diagram** (input loturi → proces → output loturi).
- **Scop:** ambele fluxuri; statusuri planificat→in lucru→asteapta confirmare→finalizat/anulat;
  inregistreaza randament/pierderi (nu valideaza); leaga `process_inputs`/`process_outputs`
  pentru trasabilitate.
- **Recondiționare vizibila (conformitate Anexa 1, cerinta d):** enum-urile din T1.1
  nu au valori pentru recondiționare — Task D adauga o **migrare noua**
  (`lot_provenance` += `reconditioning` si/sau categorie de proces
  `production | recycling | reconditioning`), astfel incat recondiționarea sa apara
  **distinct** in trasabilitate si in rapoarte (X3). Fluxul de retur (Task F) foloseste
  aceeasi valoare la reintrarea in stoc dupa recondiționare.
- **Dependente:** Task C (stock service), Task B (retete)
- **Acceptare:** ambele sub-fluxuri creeaza loturi noi si scad stoc corect (FIFO);
  Sankey reda fluxul; cazul „stoc insuficient" tratat.

### Task E — Comenzi (admin/operator)

- **Ecrane:** lista comenzi (mockup „Comenzi": client, produse, data livrare, status badge,
  actiuni rapide Accepta/Anuleaza, filtre+search), detaliu comanda, creare comanda in numele
  clientului (`created_by_admin`).
- **Scop:** statusuri draft→trimisa→acceptata→livrata→inchisa/anulata; **scadere stoc la
  acceptare**, refacere la anulare; fara livrari partiale; trigger notificari (Wave 3) la
  fiecare schimbare de status; trigger generare certificat la inchidere (Task Certificate).
- **Dependente:** Task C (stock service), Task A (clienti), Task B (itemi)
- **Acceptare:** acceptarea scade stocul si scrie `stock_events`; anularea reface; tranzitiile
  de status respecta masina de stari; emite evenimentele consumate de notificari & certificat.

### Task F — Retur & Garantie & Inchiriere

- **Ecrane:** pe o comanda finalizata — butoane Retur / Garantie; formular retur cu cantitati
  editabile; intrare in stoc dupa inspectie/acceptare manuala.
- **Scop:** retur (creeaza comanda legata), garantie (retur + comanda de inlocuire automata);
  inchiriere = comanda + retur cu `expected_return_date`.
- **Dependente:** Task E, Task C
- **Acceptare:** retur creeaza comanda legata cu date precompletate; dupa acceptare,
  materialele intra in stoc (lot cu provenienta „retur").

### Task G — Certificate de trasabilitate (PDF + graf)

- **Ecrane:** ecranul **Certificat** (mockup, cel mai important vizual): header logo+numar+data,
  date comanda, **graf de trasabilitate** (produs livrat → loturi → procese → loturi materie
  prima → surse), tabel „Materiale si origine" (procente per sursa), documente atasate, footer
  semnatura.
- **Scop:** la inchiderea comenzii (eveniment din Task E) → construieste snapshot-ul de
  trasabilitate parcurgand `process_inputs/outputs` + `lots`; **genereaza PDF** server-side;
  numar unic; salveaza in Supabase Storage; expune download.
- **Dependente:** Task E (eveniment inchidere), Task D (lant proces→loturi); spike S2 (standarde)
- **Acceptare:** inchiderea unei comenzi genereaza automat PDF descarcabil; graful reda lantul
  pana la sursele reciclate; template extensibil.

### Task H — Portal client

- **Ecrane:** **Catalog** (grid carduri produs, search/filtre, cos), formular comanda (adresa
  livrare, data optionala, observatii), **Comenzile mele** (lista cu status, Retur/Garantie pe
  comenzi finalizate, repeta comanda), **Documente & Certificate** (download).
- **Scop:** experienta clientului (un singur user per firma); fara preturi; client vede doar
  datele proprii; nu vede stoc/productie.
- **Dependente:** Task B (catalog/itemi `vandabil`), Task E (comenzi), Task G (certificate)
- **Acceptare:** clientul adauga in cos, trimite comanda, vede statusul, descarca certificatul;
  RLS interzice accesul la alte comenzi/clienti.

### Task I — Super-admin (management organizatii)

- **Ecrane:** lista organizatii, creare organizatie + admin initial, suspendare.
- **Scop:** administrarea platformei (peste tenant).
- **Dependente:** T1.x
- **Acceptare:** super-admin creeaza o organizatie noua cu admin; nu vede datele de business
  ca un user normal.

---

## 7. WAVE 3 — Cross-cutting & finisare (paralel, dupa verticale)

### Task X1 — Notificari email

- Sender per organizatie (white-label); template-uri pentru fiecare schimbare de status
  comanda + invitatii. Consuma evenimentele emise de Task E/Task 1.3.
- **Acceptare:** la fiecare tranzitie de status pleaca un email; testat cu un mock SMTP.

### Task X2 — Cautare globala

- Search peste comanda, client, lot, produs, certificat (mockup are bara de cautare).
- **Acceptare:** cautarea returneaza rezultate cross-entitate, respectand RLS.

### Task X3 — Dashboard, KPI & Rapoarte (obligatoriu — conformitate Anexa 1)

- Carduri KPI din mockup (comenzi active, de acceptat, livrate luna asta, certificate emise).
- **Pagina dedicata „Rapoarte"** (decizie 2026-07): rapoarte operationale pe perioada
  (comenzi, livrari, retururi, materiale reciclate reintegrate) cu **export PDF**
  (+ CSV unde are sens), antet white-label per organizatie.
- Rapoarte cerute de piata PaaS (vezi `docs/analiza-cerere-finantare-client-paas.md`):
  **„utilizat = livrat − returnat"** per client/perioada (baza pay-per-use; datele exista
  in comenzi/retururi/`stock_events`) si **% materii prime secundare** per produs/perioada
  (derivat din trasabilitate).
- **v2 (NU in acest task):** raport CO2 economisit — cere factori de emisie configurabili
  per organizatie; metodologia = raspunderea clientului.
- **Acceptare:** valorile reflecta datele reale ale tenantului; fiecare raport se exporta
  ca PDF descarcabil.

### Task X5 — Livrari, avize & integrare e-Transport (cerinta noua, v1.x)

- **Scop:** entitate `deliveries` pe comanda (data programata, transportator, nr.
  inmatriculare, sofer, ruta plecare/sosire); generare **aviz de insotire a marfii**;
  declarare in **RO e-Transport** prin **Socrate.io** (validat in S4); stocare **cod UIT**
  pe livrare; aviz PDF printabil cu UIT.
- **Nota de design:** modelul `deliveries` se proiecteaza de la inceput cu v2 in minte
  (monitorizare GPS a livrarilor — vehicul identificabil, legatura livrare ↔ transport).
  **Atentie schema:** `document_owner_type` din T1.1 este `client|order|item` — avizul
  PDF pe livrare cere fie extinderea enum-ului cu `delivery` (`ALTER TYPE ... ADD VALUE`,
  migrare noua), fie coloana proprie de path pe `deliveries`.
- **Dependente:** Task E (comenzi), spike S4
- **Acceptare:** pe o comanda acceptata se planifica o livrare, se genereaza avizul,
  declaratia e-Transport pleaca prin API-ul tert (mock/sandbox in teste), UIT-ul apare
  pe livrare si pe PDF; erorile de declarare sunt vizibile si re-incercabile.

### Task X4 — Seed data & E2E

- Date demo pt. clientul pilot (moloz, nisip reciclat, pietris, caramizi, beton, balast);
  teste Playwright pe **fluxul complet MVP** (1→9 din handoff).
- **Acceptare:** un singur test E2E parcurge: creare org → client → itemi/retete → lot →
  reciclare → productie → comanda → acceptare → livrare/inchidere → certificat.

### Task X6 — Documentatie utilizare & instruire (livrabile Anexa 1, obligatoriu)

- **Scop:** livrabilele de proiect din sectiunea 5 a Anexei 1, singurul ❌ ramas in
  [analiza-conformitate-anexa.md](../analiza-conformitate-anexa.md): **manual de
  utilizare in romana** (per rol: admin, operator, client), **ghid de administrare**
  (setari organizatie, useri, white-label, operare Supabase/Vercel) si materiale +
  programarea **sesiunilor de instruire** a utilizatorilor desemnati.
- **Dependente:** verticalele Wave 2 (documenteaza ecranele reale); se scrie la final,
  inainte de receptie.
- **Acceptare:** manualele acopera fluxul complet MVP (1→9 din handoff) cu capturi din
  aplicatia reala; ghidul de administrare permite unui admin nou sa configureze o
  organizatie de la zero; plan de instruire agreat cu Beneficiarul.

---

## 8. Research spikes (de rezolvat in paralel, deblocheaza task-uri)

| ID  | Subiect                                                                           | Deblocheaza | Output asteptat            |
| --- | --------------------------------------------------------------------------------- | ----------- | -------------------------- |
| S1 ✅ | API public lookup CUI Romania — **rezolvat: ANAF v9** (webservicesp.anaf.ro), adapter in `src/features/clients/cui-lookup.ts` | Task A | alegere sursa + adapter |
| S2  | Standarde legale RO/EU pt. certificat trasabilitate materiale reciclate           | Task G      | continut minim obligatoriu |
| S3 (Sankey) ✅ | Sankey — **decizie: SVG custom** (fara librarie; risc peer-deps React 19/Next 16, portat din mockup) in `src/features/production/sankey-*`. Abordarea PDF ramane de decis la Task G. | Task D, G | decizie + POC mic |
| S4  | Validare **Socrate.io** ca furnizor RO e-Transport (decis 2026-07, platit): acces API/sandbox, costuri, contract | Task X5 | POC adapter Socrate.io |

---

## 9. Ordinea recomandata de executie

1. ~~**Wave 0** (T0.1 → T0.2 / T0.3 in paralel) — un agent.~~ ✅ livrat
2. ~~**T1.1 schema** — review + inghetare. **Critic.**~~ ✅ livrat (schema inghetata)
3. ~~**T1.2 / T1.3** auth & tenant.~~ ✅ livrat
4. **Spikes S1–S4 pornesc ACUM**, in paralel cu Wave 2. Prioritate: **S1** (blocheaza
   Task A, pe lantul critic) si **S4** (Socrate.io — lead time extern: contract, acces
   sandbox; nu e sub controlul nostru).
5. **Wave 2:** porneste **Task C** primul (publica stock service) + **T2.0** (hardening
   RLS) devreme; apoi A, B, I in paralel; urmeaza D & E; apoi F, G, H.
6. **Wave 3** pe masura ce verticalele devin disponibile; X4 (E2E) la final.

### Prioritizare pentru termenul august 2026 (decizie 2026-07)

Timpul ramas pana la termen e scurt (~6 saptamani) pentru 10 task-uri Wave 2 +
6 task-uri Wave 3. **Lantul critic al demo-ului MVP** (fluxul 1→9 din handoff,
certificatul e selling point-ul si trebuie sa existe):

```
C (stoc) → B (itemi/retete) → A (clienti) → E (comenzi) → D (productie) → G (certificate) → H (portal)
```

- **Prioritate 1 (demo MVP):** T2.0, C, B, A, E, D, G, H + X4 (E2E pe fluxul complet).
- **Prioritate 2 (post-demo, inainte de receptie):** F (retur/garantie), I (super-admin),
  X1 (notificari), X3 (rapoarte — obligatoriu conformitate), X6 (documentatie/instruire).
- **Prioritate 3 (v1.x):** X2 (cautare), X5 (livrari/e-Transport — depinde oricum de S4).

### Tabel rezumat tasks

| Task                    | Wave | Depinde de   | Status / Paralelizabil |
| ----------------------- | ---- | ------------ | ---------------------- |
| T0.1 Scaffolding        | 0    | —            | ✅ livrat              |
| T0.2 Design system      | 0    | T0.1         | ✅ livrat              |
| T0.3 Supabase           | 0    | T0.1         | ✅ livrat              |
| T1.1 Schema+RLS         | 1    | T0.3         | ✅ livrat (inghetata)  |
| T1.2 Auth/tenant        | 1    | T1.1, T0.2   | ✅ livrat              |
| T1.3 Setari/white-label | 1    | T1.1, T1.2   | ✅ livrat              |
| T2.0 Hardening RLS      | 2    | T1.1         | ✅ livrat (mig. 0003)  |
| T2.1 Guard org suspendata | 2  | I            | de facut               |
| A Clienti               | 2    | T1.x, S1     | ✅ livrat (mig. 0006)  |
| B Itemi/Retete          | 2    | T1.x         | ✅ livrat (mig. 0005)  |
| C Stoc/Loturi           | 2    | T1.x         | ✅ livrat (mig. 0004)  |
| D Productie             | 2    | C, B, S3     | ✅ livrat (mig. 0008)  |
| E Comenzi               | 2    | T2.0, C, A, B | ✅ livrat (mig. 0007) |
| F Retur/Garantie        | 2    | E, C         | da                     |
| G Certificate           | 2    | E, D, S2, S3 | ✅ livrat (mig. 0009)  |
| H Portal client         | 2    | T2.0, B, E, G | da                    |
| I Super-admin           | 2    | T1.x         | ✅ livrat              |
| X1 Notificari           | 3    | E, T1.3      | da                     |
| X2 Cautare              | 3    | A,B,C,E,G    | da                     |
| X3 Dashboard/KPI        | 3    | E, C, G      | da                     |
| X5 Livrari/e-Transport  | 3    | E, S4        | da                     |
| X6 Documentatie/instruire | 3  | Wave 2       | inainte de receptie    |
| X4 Seed + E2E           | 3    | toate        | la final               |

> **Conformitate finantare:** proiectul trebuie sa respecte
> [Anexa 1](../anexa-1-specificatii-tehnice.md). Gap-urile din
> [analiza-conformitate-anexa.md](../analiza-conformitate-anexa.md) sunt acum
> **acoperite in plan**: contracte = arhivare documente (decizie 2026-07, Task A),
> servicii/abonamente = `items.kind` (Task B), rapoarte (X3 obligatoriu),
> recondiționare vizibila (Task D), livrari/e-Transport (X5), documentatie +
> instruire (X6). Audit log general (`activity_log`) ramane imbunatatire optionala.

---

## 10. Cum se da un task unui agent (template prompt)

```
Context: vezi docs/handoff.md, docs/design-prompt.md, docs/design/Lateris_Trace.dc.html.
Schema & tipuri: src/lib/database.types.ts (NU modifica schema; daca ai nevoie de
coloane noi, adauga o migrare noua numerotata).
Task: <ID + scop din planul de implementare, sectiunea X>.
Limiteaza-te la folderul src/features/<feature>/ si la migrarea proprie.
Livrabil: UI conform mockup + server actions + queries + teste.
Done cand: Definition of Done global din AGENTS.md + docs/plans/implementation-plan.md e indeplinit.
```
