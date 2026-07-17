# Analiza de conformitate — Anexa 1 vs. planul de implementare

Acest document mapează cerințele din [anexa-1-specificatii-tehnice.md](anexa-1-specificatii-tehnice.md)
(documentația tehnică depusă pentru finanțarea europeană) pe planul actual:
[handoff.md](handoff.md) + [implementation-plan.md](plans/implementation-plan.md).

**De ce contează:** proiectul este finanțat din fonduri europene, deci la recepție/audit
platforma trebuie să demonstreze funcționalitățile din anexă. Secțiunea 6 din anexă oferă
flexibilitate („caracter general și orientativ”), dar lista de funcționalități din corpul
anexei este ceea ce se va verifica. Zonele ❌ de mai jos trebuie acoperite măcar la nivel
minimal înainte de recepție.

Legendă: ✅ acoperit · 🟡 parțial acoperit · ❌ neacoperit

---

## 1. Tablou de conformitate

### a) Gestionarea clienților și a relațiilor comerciale

| Cerință anexă | Status | Acoperire în plan |
| --- | --- | --- |
| Evidența clienților și a datelor de contact | ✅ | Task A — CRUD clienți, lookup CUI, adrese multiple, contacte |
| Istoricul colaborărilor | ✅ | Istoric comenzi per client (Task A + Task E); detaliul client listează comenzile |
| Administrarea solicitărilor și a comenzilor | ✅ | Task E (comenzi admin) + Task H (portal client); „solicitare” = comanda trimisă de client |

### b) Gestionarea contractelor și a serviciilor — **zona cea mai slabă**

| Cerință anexă | Status | Acoperire în plan |
| --- | --- | --- |
| Evidența contractelor încheiate | ❌ | Nu există entitate `contracts` în schemă sau plan |
| Gestionarea tipurilor de servicii și abonamente | ❌ | Planul nu are servicii/abonamente; catalogul are doar produse fizice |
| Urmărirea perioadelor contractuale | ❌ | Nu există perioade contractuale; doar `expected_return_date` pe comandă |
| Evidența obligațiilor asumate de părți | ❌ | Nu există |
| Administrarea ofertelor comerciale (din lista generală) | ❌ | Planul exclude explicit prețurile („fara preturi”); nu există entitate ofertă |
| Modele de tarifare (din lista generală) | ❌ | Idem — fără prețuri/tarifare în MVP |

**Notă PaaS:** anexa definește platforma ca instrument pentru modelul *Product-as-a-Service*.
În planul actual, PaaS este simulat doar prin comandă + retur cu `expected_return_date`
(handoff, secțiunea „Retur si garantie”). Fără contracte/abonamente/tarifare, componenta
PaaS este subreprezentată față de cum e descrisă în anexă. **Aceasta este prioritatea #1
de închis** — vezi recomandările din secțiunea 2.

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
| Evidența activităților realizate în platformă | 🟡 | `stock_events` acoperă doar stocul. Pentru „evidența activităților” e nevoie de un **audit log la nivel de platformă** (login, modificări clienți/comenzi/setări) — măcar minimal |

### g) Gestionarea documentelor

| Cerință anexă | Status | Acoperire în plan |
| --- | --- | --- |
| Încărcarea și arhivarea documentelor | ✅ | Documente pe client/comandă/item, Supabase Storage |
| Asocierea documentelor cu clienți, contracte sau activități | 🟡 | Asociere cu clienți/comenzi/itemi există; asocierea cu **contracte** depinde de introducerea entității contract (vezi b) |
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
| Instruirea utilizatorilor desemnați | ❌ | Neplanificat — de programat sesiuni de training la livrare |
| Documentația de utilizare și administrare | ❌ | Neplanificat — de adăugat ca task de finalizare (manual utilizator RO + ghid administrare) |
| Predarea codului-sursă | ✅ | Repo-ul este livrabilul; de clarificat modalitatea contractuală |
| Suport în perioada de garanție | — | Clauză contractuală, nu ține de plan |

---

## 2. Rezumat gap-uri și recomandări

### ❌ Neacoperit — trebuie adăugat pentru conformitate

1. **Modul Contracte** (cerința b) — **la nivel de organizație** (vezi clarificarea de
   scope din secțiunea 1.b): entitate `contracts` per client — număr, tip
   (vânzare / PaaS-închiriere / abonament), dată început/sfârșit, obligațiile părților
   (câmp text/listă), documente atașate (folosește infrastructura existentă de documente),
   alerte la apropierea expirării. Comenzile pot referenția opțional un contract.
   *Efort estimat: mic-mediu — un vertical nou de tip Task A.*
2. **Servicii, abonamente și modele de tarifare** (cerința b): la nivel minim — tipuri de
   serviciu/abonament definibile per organizație (denumire, periodicitate, tarif) atașabile
   contractului. Nu implică facturare automată în MVP; doar evidență. Reconsiderat decizia
   „fără prețuri” măcar la nivel de contract/ofertă (poate rămâne ascuns în portalul client).
3. **Oferte comerciale** (lista generală) — **interpretare aleasă (2026-07):** oferta
   comercială = portofoliul organizației, adică **catalogul** de produse vandabile plus
   materialele acceptate la reciclare, **fără prețuri**. Interpretarea e acoperită de
   caracterul „general și orientativ” al anexei (secțiunea 6). Pentru a o susține la audit:
   (1) flag nou pe item, „acceptat la reciclare”, ca oferta să acopere ambele direcții
   (vânzare + preluare la reciclare); (2) opțional și ieftin — buton „Generează ofertă PDF”
   din catalog (listă de itemi selectați, antet white-label), care produce un document
   de ofertă tangibil, demonstrabil la recepție.
4. **Livrabile de proiect:** documentație de utilizare/administrare + instruire utilizatori —
   de adăugat ca task-uri de finalizare în plan.

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
   distinct în trasabilitate și rapoarte (cerința d).

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
