# Analiza de conformitate — Anexa 1 vs. planul de implementare

Acest document mapează cerințele din [anexa-1-specificatii-tehnice.md](anexa-1-specificatii-tehnice.md)
(anexa tehnică pentru finanțarea europeană — **draft revizuit, nedepus**) pe planul
actual: [handoff.md](handoff.md) + [implementation-plan.md](plans/implementation-plan.md).

**De ce contează:** proiectul este finanțat din fonduri europene, deci la recepție/audit
platforma trebuie să demonstreze funcționalitățile din anexă. Secțiunea 6 din anexă oferă
flexibilitate („caracter general și orientativ”), dar lista de funcționalități din corpul
anexei este ceea ce se va verifica.

> **Update 17 iulie 2026:** anexa a fost revizuită înainte de depunere exact pentru a
> închide zonele ❌ de mai jos (vezi
> [anexa-1-modificari-propuse.md](anexa-1-modificari-propuse.md)). Tabelele din secțiunea
> 1.b păstrează **ambele stări**: textul inițial (istoric) și statusul pe textul revizuit.

Legendă: ✅ acoperit · 🟡 parțial acoperit · ❌ neacoperit

---

## 1. Tablou de conformitate

### a) Gestionarea clienților și a relațiilor comerciale

| Cerință anexă | Status | Acoperire în plan |
| --- | --- | --- |
| Evidența clienților și a datelor de contact | ✅ | Task A — CRUD clienți, lookup CUI, adrese multiple, contacte |
| Istoricul colaborărilor | ✅ | Istoric comenzi per client (Task A + Task E); detaliul client listează comenzile |
| Administrarea solicitărilor și a comenzilor | ✅ | Task E (comenzi admin) + Task H (portal client); „solicitare” = comanda trimisă de client |

### b) Gestionarea contractelor și a serviciilor — **rezolvată prin revizuirea anexei**

Textul inițial al anexei crea gap-urile de mai jos; **textul revizuit** (17 iulie 2026)
le închide prin reformulare:

| Text inițial (❌ pe plan) | Text revizuit | Status pe textul revizuit |
| --- | --- | --- |
| Evidența contractelor încheiate | „evidența și arhivarea documentelor contractuale” | ✅ infrastructura de documente pe client (Task A) |
| Gestionarea tipurilor de servicii și abonamente | „gestionarea tipurilor de produse și servicii furnizate” | ✅ catalog + tip de produs/serviciu (Task B; abonamentele PaaS = tipuri de produs, fără prețuri) |
| Urmărirea perioadelor contractuale | „urmărirea perioadelor de utilizare a produselor” | ✅ închiriere + `expected_return_date` (Task F) |
| Evidența obligațiilor asumate de părți | *(eliminat din anexă)* | — obligațiile sunt în contractele arhivate |
| Administrarea ofertelor comerciale (lista generală) | *(eliminat; „administrarea comenzilor și a documentelor contractuale”)* | ✅ comenzi (Task E/H) + documente |
| Modele de tarifare (lista generală) | *(eliminat)* | — fără prețuri/bani în platformă (decizie de scope) |

**Notă PaaS:** obiectivul PaaS al anexei rămâne neatins (legat de finanțare); în platformă
modelul e acoperit prin utilizare temporară + retur + recuperare/recondiționare/reutilizare
(Task F + procese) și prin tipurile de produs/serviciu din catalog.
**Decizie contracte (2026-07-17): ARHIVARE** — echipa de proiect a confirmat varianta
recomandată (întrebarea din [anexa-1-modificari-propuse.md](anexa-1-modificari-propuse.md)):
contractele semnate se arhivează ca documente atașate clientului (Task A); nu se
construiește gestiune structurată de perioade/obligații/tarife. Un modul light de
contracte rămâne cel mult o opțiune de produs viitoare, cerută eventual de piața PaaS
(vezi [analiza-cerere-finantare-client-paas.md](analiza-cerere-finantare-client-paas.md)),
nu o obligație de conformitate.

**Clarificare scope contracte (2026-07):** anexa spune explicit că platforma gestionează
„relațiile comerciale și operaționale dintre **Beneficiar și clienții săi**”. Beneficiarul
= firma finanțată (un tenant/organizație în aplicație), iar „clienții” = firmele care
cumpără / închiriază / aduc materiale la reciclare (entitatea `clients`). Deci modulul de
contracte se construiește **la nivel de organizație**: adminul organizației își gestionează
contractele cu clienții proprii. Relația comercială platformă ↔ organizații (multi-tenancy,
vânzarea aplicației către alți clienți) este modelul nostru de business, în afara scope-ului
anexei, și nu necesită modul în aplicație.

### c) Gestionarea produselor și a livrărilor

| Cerință anexă | Status | Acoperire în plan |
| --- | --- | --- |
| Evidența produselor și serviciilor furnizate | ✅ | Task B (itemi/catalog) + Task C (stoc/loturi) |
| Planificarea și urmărirea livrărilor | 🟡 | Comanda are `delivery_date` + status „livrata”, dar nu există modul de planificare livrări (programare, aviz de însoțire, transport). Se închide prin **avize + integrare e-Transport** (vezi §3) și, în v2, monitorizare GPS |
| Monitorizarea stadiului comenzilor și activităților operaționale | ✅ | Mașina de stări comenzi (Task E) + statusuri procese (Task D) |

### d) Gestionarea utilizării și reutilizării produselor

| Cerință anexă | Status | Acoperire în plan |
| --- | --- | --- |
| Evidența produselor destinate utilizării în fluxurile interne | ✅ | Loturi cu proveniență + flag `vandabil` (Task B, C) |
| Urmărirea retururilor și a recuperării acestora | ✅ | Task F — retur/garanție/închiriere, lot cu proveniență „retur” |
| Evidența activităților de verificare, recondiționare și reintroducere în utilizare | 🟡 | Inspecția manuală la retur + procesele de reciclare (Task D) acoperă conceptual fluxul, dar „recondiționarea” nu apare ca activitate distinctă/etichetată. De rezolvat ieftin: tip de proces sau motiv de proveniență „recondiționare”, ca să fie vizibil și raportabil |

### e) Monitorizare și raportare

| Cerință anexă | Status | Acoperire în plan |
| --- | --- | --- |
| Generarea de rapoarte operaționale și comerciale | 🟡 | Doar export CSV/Excel pe auditul de stoc (Task C); nu există modul de rapoarte comenzi/livrări/retururi |
| Evidența indicatorilor relevanți | 🟡 | X3 Dashboard/KPI este marcat „nice-to-have” — pentru conformitate trebuie promovat la obligatoriu |
| Exportul informațiilor în formate uzuale | 🟡 | CSV doar pe stoc; de generalizat (export pe comenzi, clienți, retururi) |

### f) Administrarea utilizatorilor

| Cerință anexă | Status | Acoperire în plan |
| --- | --- | --- |
| Definirea rolurilor și drepturilor de acces | ✅ | 4 roluri + RLS (T1.1, T1.2) |
| Gestionarea conturilor de utilizator | ✅ | T1.3 — invitații, creare operatori/clienți |
| Evidența activităților realizate în platformă → *revizuit:* „evidența principalelor operațiuni realizate asupra datelor” | ✅ | Textul revizuit e acoperit de `stock_events` + istoricul comenzilor/proceselor (cine/când). Un `activity_log` general rămâne îmbunătățire opțională (recomandarea 7) |

### g) Gestionarea documentelor

| Cerință anexă | Status | Acoperire în plan |
| --- | --- | --- |
| Încărcarea și arhivarea documentelor | ✅ | Documente pe client/comandă/item, Supabase Storage |
| Asocierea documentelor cu clienți, comenzi sau activități *(text revizuit)* | ✅ | Asociere cu clienți/comenzi/itemi există în plan; documentele contractuale se atașează clientului |
| Consultarea și descărcarea documentelor | ✅ | Task H + ecranele admin |

### Cerințe transversale (lista generală din anexă)

| Cerință anexă | Status | Acoperire în plan |
| --- | --- | --- |
| Transmiterea de notificări și informări | ✅ | X1 — notificări email la schimbări de status + invitații |
| Integrare/interoperabilitate cu alte sisteme | 🟡 | Nimic planificat până acum. Se închide prin lookup CUI (S1) + **integrarea e-Transport** (§3); GPS în v2 o întărește |
| Interfață intuitivă, echipamente uzuale | ✅ | Next.js + shadcn/ui, design system (T0.2), responsive |
| Caracter modular și extensibil | ✅ | Arhitectura pe feature-uri (`src/features/<feature>/`), migrări aditive |

### Livrabile (secțiunea 5 din anexă) — obligații de proiect, nu de cod

| Livrabil | Status | Observații |
| --- | --- | --- |
| Platformă funcțională + instalare/configurare | ✅ | Acoperit de plan (deploy Vercel + Supabase) |
| Instruirea utilizatorilor desemnați | ✅ | Planificat ca **Task X6** (sesiuni de training la livrare) |
| Documentația de utilizare și administrare | ✅ | Planificat ca **Task X6** (manual utilizator RO + ghid administrare) |
| Predarea codului-sursă | ✅ | Repo-ul este livrabilul; de clarificat modalitatea contractuală |
| Suport în perioada de garanție | — | Clauză contractuală, nu ține de plan |

---

## 2. Rezumat gap-uri și recomandări

### ❌ Neacoperit — trebuie adăugat pentru conformitate

> Punctele 1–3 din versiunea inițială a acestei analize (modul contracte, abonamente/
> tarifare, oferte comerciale) au fost **rezolvate prin revizuirea anexei** (vezi
> secțiunea 1.b și [anexa-1-modificari-propuse.md](anexa-1-modificari-propuse.md)) —
> nu mai sunt obligații de conformitate. Modulul light de contracte rămâne pe masă ca
> **decizie de produs** (cerut de piața PaaS), nu ca cerință a anexei.

4. **Livrabile de proiect:** documentație de utilizare/administrare + instruire utilizatori —
   ✅ **adăugat în plan ca Task X6** (2026-07-17). Nu mai există ❌ fără task.

### 🟡 Parțial — de întărit în planul existent

5. **Planificarea livrărilor + avize:** modul de livrare pe comandă (dată programată,
   vehicul/transportator, aviz de însoțire) + **integrare e-Transport** — vezi §3.
6. **Rapoarte — decizie (2026-07):** pagină dedicată **Rapoarte** cu **export PDF**
   (+ CSV unde are sens): comenzi pe perioadă, livrări, retururi, materiale reciclate
   reintegrate — acesta din urmă e și un KPI de economie circulară valoros pentru
   raportarea către finanțator. X3 (Dashboard/KPI) promovat din „nice-to-have” în
   obligatoriu și extins cu această pagină.
7. **Audit log platformă:** extinderea conceptului `stock_events` la un `activity_log`
   general (cine, când, ce acțiune, pe ce entitate). Ieftin de făcut din server actions.
8. **Recondiționare vizibilă:** tip de proces / proveniență „recondiționare” ca să apară
   distinct în trasabilitate și rapoarte (cerința d). ✅ **Alocat Task-ului D** (2026-07-17):
   migrare nouă care extinde enum-urile din T1.1 (`lot_provenance` / categorie de proces).

### ✅ Acoperite solid de planul actual

Clienți, comenzi, stoc/loturi, producție/reciclare, retur/garanție/închiriere,
trasabilitate + certificate, documente, notificări, roluri + RLS, white-label,
arhitectură modulară.

---

## 3. Integrări (requirements noi — 2026-07)

### 3.1 e-Transport (avize) — necesar, prioritate v1.x

Livrările de agregate/elemente din beton intră sub incidența sistemului RO e-Transport
(ANAF) pentru transporturile rutiere care depășesc pragurile legale. Platforma trebuie
să susțină fluxul de **aviz de însoțire a mărfii + declarare e-Transport (cod UIT)**.

- **Abordare — decizie (2026-07):** integrare prin **Socrate.io** (furnizor terț plătit,
  API peste SPV/ANAF), nu integrare directă cu SPV — reduce efortul de certificate
  digitale și mentenanță. Spike-ul **S4** devine validare Socrate.io: acces API/sandbox,
  costuri, contract, POC adapter.
- **Flux țintă:** comandă acceptată → planificare livrare (dată, vehicul, transportator,
  număr înmatriculare) → generare aviz → declarare e-Transport prin API terț → stocare
  cod UIT pe livrare → aviz PDF printabil cu UIT.
- **Date noi necesare:** entitate `deliveries` (sau extensie pe `orders`): transportator,
  nr. înmatriculare, șofer, rută (punct plecare/sosire), cod UIT, status declarație.
- Integrarea aceasta **închide simultan** cerința „planificarea și urmărirea livrărilor”
  (c) și cerința de „interoperabilitate cu alte sisteme” din anexă.

### 3.2 Monitorizare GPS — v2 (follow-up)

- Integrare cu un serviciu de monitorizare GPS a flotei/transporturilor pentru urmărirea
  în timp real a livrărilor (poziție vehicul pe livrările active, ETA, istoricul rutei).
- Se construiește peste entitatea `deliveries` din 3.1 — de aceea modelul de livrare
  trebuie proiectat de la început cu găzduirea acestor date în minte (vehicul identificabil,
  legătură livrare ↔ transport).
- Nu face parte din scope-ul finanțat obligatoriu; este extensie v2 permisă de secțiunea 4
  din anexă („dezvoltare ulterioară”).

---

## 4. Poziționare față de terminologia anexei

Anexa vorbește despre „elemente din beton” și PaaS pentru Beneficiar; platforma este
construită multi-tenant, pentru mai mulți clienți plătitori (2 deja în așteptare).
Nu este un conflict: anexa nu interzice multi-tenancy, iar caracterul „modular și
flexibil” o susține. La recepție, demonstrația se face pe organizația Beneficiarului
cu date din domeniul lui (elemente din beton / agregate), acoperind funcționalitățile
listate.
