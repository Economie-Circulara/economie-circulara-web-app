# Plan de implementare - Lateris Trace (Economie Circulara)

Acest document transforma cerintele din [`handoff.md`](handoff.md) si designul din
[`design/Lateris_Trace.dc.html`](design/) intr-un plan de implementare impartit in
**task-uri individuale, autonome, ce pot fi preluate de agenti AI in paralel**.

Scopul: livrarea MVP-ului (termen tinta: august 2025) cu un set de task-uri clar
delimitate, cu dependente explicite, contracte (interfete) intre ele si criterii de
acceptare verificabile.

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
   *un singur* fisier de migrare cu prefix ordonat (`0007_orders.sql`). Nu se editeaza
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

| Strat | Tehnologie |
|-------|-----------|
| Framework | Next.js (App Router) + TypeScript |
| UI | shadcn/ui retematizat (paleta pamant/verde, pattern subtil de fundal) |
| Auth | Supabase Auth (widgeturi out-of-the-box) |
| DB + Storage | Supabase Postgres (EU) + Supabase Storage |
| Multi-tenant | Izolare logica prin RLS pe `organization_id` |
| Diagrame | librarie React pt. Sankey (Recharts/Nivo) |
| PDF | generare server-side certificat (ex. React-PDF / Puppeteer) |
| Hosting | Vercel |

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

## 4. WAVE 0 — Foundation (blocheaza tot, un singur agent)

### T0.1 — Scaffolding proiect Next.js + tooling
- **Scop:** initializare Next.js (App Router, TS), Tailwind, ESLint/Prettier, Vitest +
  Playwright, structura de foldere `src/app`, `src/features`, `src/components/ui`,
  `src/lib`, husky/lint-staged.
- **Livrabil:** repo care porneste (`pnpm dev`), CI minimal (typecheck+lint+test).
- **Acceptare:** build verde, un test smoke trece, CI ruleaza pe PR.

### T0.2 — Design system & tema (din mockup)
- **Scop:** instalare shadcn/ui; extragerea tokenilor din `Lateris_Trace.dc.html`
  (paleta pamant/verde/ocru/slate, tipografie, pattern de fundal, badge-uri de status);
  layout shell cu **sidebar fix** + componente comune (DataTable cu sortare/paginare/hover,
  StatusBadge, EmptyState, PageHeader cu breadcrumb, FormField).
- **Dependente:** T0.1
- **Acceptare:** un Storybook/pagina de showcase reda tema; DataTable si StatusBadge
  refolosibile; suport white-label prin CSS variables (logo + culori per org).

### T0.3 — Integrare Supabase (clienti + env)
- **Scop:** proiect Supabase (regiune EU), `supabase/` cu CLI + migrari, clienti server
  & browser, helper de sesiune (`@supabase/ssr`), script `gen-types`.
- **Dependente:** T0.1
- **Acceptare:** conexiune locala functioneaza; `supabase db reset` ruleaza migrari;
  tipurile se genereaza in `src/lib/database.types.ts`.

---

## 5. WAVE 1 — Schema de date, Auth, Multi-tenant (blocheaza Wave 2)

### T1.1 — Schema completa de baza de date + RLS (CONTRACTUL COMUN)
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

### T1.2 — Auth, rutare pe roluri, context de tenant
- **Scop:** login email/parola (widget Supabase), invitatie + setare parola, reset;
  middleware Next.js care rezolva organizatia (din domeniu/white-label) si rolul; guard-uri
  de ruta `/(admin)`, `/(client)`; helper `getCurrentUser()` + `requireRole()`.
- **Dependente:** T1.1, T0.2
- **Acceptare:** login functional (mockup „Autentificare"); rolul determina layout-ul;
  acces neautorizat redirectat; teste pe guard-uri.

### T1.3 — Setari organizatie & white labeling (admin)
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

### Task A — Clienti
- **Ecrane:** lista clienti, detaliu/creare client, adrese de livrare, documente client.
- **Scop:** CRUD clienti firme juridice; **lookup CUI** (research spike S1) cu precompletare
  + confirmare manuala; adrese multiple; flag furnizor; upload documente.
- **Dependente:** T1.x; spike S1 (API CUI)
- **Acceptare:** creezi client prin CUI lookup, editezi, adaugi 2 adrese, atasezi un PDF;
  RLS izoleaza per organizatie.

### Task B — Itemi, Catalog (definitie) & Retete
- **Ecrane:** lista itemi, creare/editare item (titlu, descriere, poza, UM, flag `vandabil`,
  atasamente), **Retete** (componente in procente).
- **Scop:** CRUD itemi; editor reteta (suma procente validata informativ); fara versionare.
- **Dependente:** T1.x
- **Acceptare:** definesti „Caramida eco" cu reteta din 3 componente; itemul cu `vandabil`
  apare in catalogul clientului (Task G).

### Task C — Stoc & Loturi + Audit (FUNDAMENT pt. D & E)
- **Ecrane:** lista loturi (mockup „Stoc"), adauga lot (provenienta: achizitie/productie/
  reciclare/retur/ajustare), blocare lot cu motiv, **Audit stoc** (listing `stock_events`
  + **export CSV/Excel**).
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

### Task X3 — Dashboard & KPI (nice-to-have)
- Carduri KPI din mockup (comenzi active, de acceptat, livrate luna asta, certificate emise).
- **Acceptare:** valorile reflecta datele reale ale tenantului.

### Task X4 — Seed data & E2E
- Date demo pt. clientul pilot (moloz, nisip reciclat, pietris, caramizi, beton, balast);
  teste Playwright pe **fluxul complet MVP** (1→9 din handoff).
- **Acceptare:** un singur test E2E parcurge: creare org → client → itemi/retete → lot →
  reciclare → productie → comanda → acceptare → livrare/inchidere → certificat.

---

## 8. Research spikes (de rezolvat in paralel, deblocheaza task-uri)

| ID | Subiect | Deblocheaza | Output asteptat |
|----|---------|-------------|-----------------|
| S1 | API public lookup CUI Romania (cel mai simplu de integrat) | Task A | alegere sursa + adapter |
| S2 | Standarde legale RO/EU pt. certificat trasabilitate materiale reciclate | Task G | continut minim obligatoriu |
| S3 | Librarie Sankey React (Recharts vs Nivo) si abordare PDF (React-PDF vs Puppeteer) | Task D, G | decizie + POC mic |

---

## 9. Ordinea recomandata de executie

1. **Wave 0** (T0.1 → T0.2 / T0.3 in paralel) — un agent.
2. **T1.1 schema** — review + inghetare. **Critic.**
3. **T1.2 / T1.3** auth & tenant.
4. **Spikes S1–S3** pornesc imediat, in paralel cu Wave 1.
5. **Wave 2:** porneste **Task C** primul (publica stock service), apoi A, B, I in paralel;
   urmeaza D & E; apoi F, G, H.
6. **Wave 3** pe masura ce verticalele devin disponibile; X4 (E2E) la final.

### Tabel rezumat tasks

| Task | Wave | Depinde de | Paralelizabil |
|------|------|-----------|---------------|
| T0.1 Scaffolding | 0 | — | nu (primul) |
| T0.2 Design system | 0 | T0.1 | cu T0.3 |
| T0.3 Supabase | 0 | T0.1 | cu T0.2 |
| T1.1 Schema+RLS | 1 | T0.3 | nu (contract) |
| T1.2 Auth/tenant | 1 | T1.1, T0.2 | cu T1.3 |
| T1.3 Setari/white-label | 1 | T1.1, T1.2 | cu T1.2 |
| A Clienti | 2 | T1.x, S1 | da |
| B Itemi/Retete | 2 | T1.x | da |
| C Stoc/Loturi | 2 | T1.x | da (pornit primul) |
| D Productie | 2 | C, B, S3 | da |
| E Comenzi | 2 | C, A, B | da |
| F Retur/Garantie | 2 | E, C | da |
| G Certificate | 2 | E, D, S2, S3 | da |
| H Portal client | 2 | B, E, G | da |
| I Super-admin | 2 | T1.x | da |
| X1 Notificari | 3 | E, T1.3 | da |
| X2 Cautare | 3 | A,B,C,E,G | da |
| X3 Dashboard/KPI | 3 | E, C, G | da |
| X4 Seed + E2E | 3 | toate | la final |

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
