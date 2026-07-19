# Ghid de administrare — Lateris Trace

Acest ghid este destinat:

- **Administratorului unei organizații** — configurarea identității, personalizării
  (white-label), domeniului, emailului și managementul utilizatorilor organizației
  (secțiunile 1–2).
- **Super-adminului platformei** — administrarea organizațiilor (secțiunea 3),
  rol distinct, folosit de echipa care operează platforma Lateris Trace (nu de
  clienții platitori).
- **Echipei tehnice** — operarea infrastructurii (Supabase, Vercel, migrări,
  backup) — secțiunea 4.

---

## 1. Setări organizație (rol Administrator)

Din meniul lateral, secțiunea **„Setări"** (vizibilă doar rolului Administrator)
deschide ecranul **„Setări organizație"**, cu formularul de configurare:

### 1.1 Identitate

- **„Nume organizație"** (obligatoriu) — numele afișat în aplicație (sidebar,
  ecranul de autentificare, antetul certificatelor și rapoartelor PDF).
- **„URL logo"** — adresa publică a unei imagini (PNG/SVG), afișată pe ecranul de
  autentificare și în interfață.

### 1.2 Culori (white-label)

- **„Culoare principală (brand)"** — valoare CSS validă (ex. `#1f5e3a` sau
  `oklch(...)`), aplicată în sidebar și pe butoanele principale.
- **„Culoare accent"** — a doua culoare, folosită pe elemente secundare (ex.
  `#c8862b`).

### 1.3 Domeniu & email

- **„Domeniu personalizat"** — ex. `trace.firma.ro`; domeniul propriu al
  organizației, folosit ca **punct de intrare** dedicat (login + tot restul
  aplicației). Configurarea DNS/Vercel a domeniului se face **separat**, de
  echipa tehnică (vezi secțiunea 4.3) — acest câmp doar înregistrează domeniul
  în platformă, pentru identificarea organizației la accesarea lui.
- **„Nume expeditor email"** și **„Adresă expeditor email"** — identitatea cu
  care organizația trimite notificările automate (confirmare comandă, schimbări
  de status etc.) către clienții ei.

Apasă **„Salvează setările"** pentru a confirma modificările.

> 📷 **[Captură de adăugat: ecranul „Setări organizație" complet]**

---

## 2. Managementul utilizatorilor organizației (rol Administrator)

Din ecranul „Setări organizație", apasă butonul **„Utilizatori"** (colțul din
dreapta sus) → ecranul **„Utilizatori"**.

### 2.1 Invitarea unui operator sau administrator

Formularul **„Invită un membru"**:

1. Completează **Email** (obligatoriu) și, opțional, **Nume**.
2. Alege **Rol**: **Operator** sau **Administrator**.
3. Apasă **„Invită"** — persoana primește un email de invitație (prin Supabase
   Auth); la deschiderea linkului, ajunge pe ecranul „Setează parola" și devine
   activă în organizație imediat ce își setează parola.

Lista de mai jos arată toți membrii organizației, cu **Nume**, **Email**, **Rol**
și **Status** (Activ/Suspendat).

> 📷 **[Captură de adăugat: ecranul „Utilizatori" cu formularul de invitare]**

### 2.2 Gap cunoscut: invitarea unui client {#gap-cunoscut-invitarea-unui-client}

**La data redactării acestui ghid, ecranul „Utilizatori" permite doar invitarea
de Operatori și Administratori — nu există încă un formular dedicat pentru
crearea contului de logare (rol `client`) al unei firme client**, deși structura
de date (schema bazei de date) suportă rolul client, legat de o firmă din
„Clienți". Fluxul de business intenționat (conform `docs/handoff.md`) este:

- Adminul creează firma client în „Clienți" (secțiunea 3 din manualul
  admin/operator).
- Adminul invită contul de logare al persoanei de contact a firmei respective,
  cu rol `client`, legat de acea firmă (`client_id`).
- Clientul primește emailul de invitație și își setează parola, la fel ca un
  operator.

**Până când acest formular este livrat în interfață**, crearea unui cont de
client se poate face doar tehnic, de către echipa de dezvoltare/operare, direct
prin Supabase (invitație `auth.admin.inviteUserByEmail` + inserare manuală a
rândului `profiles` cu `role='client'` și `client_id` = firma corespunzătoare din
tabela `clients`). Contactează echipa tehnică pentru fiecare cont de client
necesar, până la livrarea acestei funcționalități în UI.

---

## 3. Super-admin — administrarea organizațiilor platformei

Rolul **super-admin** nu aparține niciunei organizații — este rolul echipei care
operează platforma Lateris Trace pentru toți clienții ei (organizațiile). Ecranul
**„Organizații"** (`/platform`) este disponibil doar acestui rol.

### 3.1 Lista organizațiilor

Coloane: Nume, Slug/acces (subdomeniul sau calea de acces + link-ul complet),
Domeniu custom, Status (Activ/Suspendat), Data creării, Număr de utilizatori.

### 3.2 Crearea unei organizații noi

1. Apasă **„+ Organizație nouă"** → ecranul **„Organizație nouă"**.
2. Completează **„Nume organizație"** (ex. „Acme Recycling SRL") — se generează
   automat un **„Slug"** (folosit în URL: subdomeniu sau cale `/slug`; doar
   litere mici, cifre și cratime), editabil manual dacă e nevoie.
3. Completează **„Email admin inițial"** — persoana care va primi invitația de
   administrator al noii organizații.
4. Apasă **„Creează organizația"** — se creează organizația și pleacă automat
   invitația către adminul inițial (email cu link de setare a parolei).

Dacă invitația eșuează după ce organizația a fost deja creată, formularul
comută automat în mod „re-încercare": numele și slug-ul devin needitabile
(organizația există deja), doar emailul poate fi corectat înainte de a apăsa
**„Retrimite invitația"**.

> 📷 **[Captură de adăugat: ecranul „Organizație nouă"]**

### 3.3 Suspendarea și reactivarea unei organizații

Din lista de organizații, coloana „Acțiuni":

- Pe o organizație activă, apasă **„Suspendă"** → confirmă cu **„Confirmă"**
  (sau renunță cu **„Anulează"**).
- Pe o organizație suspendată, apasă **„Reactivează"** → confirmă la fel.

**Efectul suspendării:** toți utilizatorii organizației suspendate (admin,
operator, client) sunt blocați la următoarea cerere/sesiune — sunt
redirecționați automat către o pagină dedicată („Organizația este suspendată"),
care le arată mesajul și opțiunea de delogare. Blocarea este impusă pe **două
niveluri**: în aplicație (middleware) și în baza de date (politici de acces),
deci nu poate fi ocolită direct prin API. **Doar super-adminul poate reactiva**
o organizație suspendată.

> 📷 **[Captură de adăugat: lista de organizații cu butonul Suspendă/Reactivează]**

---

## 4. Operare tehnică (echipa de dezvoltare/operare)

Această secțiune este tehnică — se adresează persoanei/echipei care menține
infrastructura (nu utilizatorilor de business).

### 4.1 Stack și referințe

- **Framework:** Next.js (App Router) + TypeScript.
- **Backend:** Supabase (Postgres + Auth + Storage), regiune **EU** (GDPR).
- **Hosting:** Vercel.
- Ghidul complet pas-cu-pas de configurare este în
  [`docs/setup.md`](../setup.md) — nu se duplică aici, doar se rezumă punctele
  esențiale de operare curentă.

### 4.2 Migrări de schemă (Supabase)

Schema bazei de date se modifică **doar prin migrări versionate**, în
`supabase/migrations/` (o migrare per task, prefix numerotat). Pentru a aplica
migrările noi pe proiectul cloud (producție):

```bash
pnpm supabase link --project-ref <REF>   # o singura data, daca nu e deja legat
pnpm supabase db push                    # aplica migrarile locale pe proiectul cloud
```

După orice modificare de schemă, regenerează tipurile TypeScript:

```bash
pnpm gen:types    # regenereaza src/lib/database.types.ts din schema
```

Pentru dezvoltare/testare locală, stack-ul Supabase local rulează în Docker:

```bash
pnpm db:start     # porneste Postgres/Auth/Storage local
pnpm db:reset      # reaplica toate migrarile pe DB-ul local
pnpm db:test       # ruleaza testele de izolare RLS (supabase/tests/rls_isolation.sql)
```

### 4.3 Domeniu custom pe Vercel

Câmpul „Domeniu personalizat" din „Setări organizație" (secțiunea 1.3) doar
înregistrează domeniul în baza de date, pentru ca aplicația să identifice
organizația la accesarea acelui domeniu. **Configurarea propriu-zisă a
domeniului** (DNS + adăugarea lui în proiectul Vercel) se face separat, de
echipa tehnică, din Vercel → Project Settings → Domains.

### 4.4 Backup și recuperare

Supabase (regiunea EU) gestionează backup-urile automate ale bazei de date la
nivel de proiect cloud (vezi planul Supabase folosit pentru proiect, în
dashboard-ul Supabase → Project Settings → Backups, pentru frecvență și
politica de retenție exactă a proiectului). Documentele (fișiere din Storage —
documente de client, contracte arhivate, certificate PDF) sunt stocate în
Supabase Storage, cu aceeași regiune și politică de backup ca baza de date.

Recomandare operațională: înainte de orice migrare cu risc (ex. modificare de
tip pe o coloană cu date existente), verifică disponibilitatea unui backup
recent din dashboard-ul Supabase.

### 4.5 Roluri de acces (rezumat tehnic)

| Rol | Domeniu de acces | Impus de |
| --- | --- | --- |
| `super_admin` | Toate organizațiile (fără organizație proprie) — doar `/platform` | `requireRole(["super_admin"])` + RLS |
| `admin` | Organizația proprie — tot (business + setări + utilizatori) | `requireRole(["admin", ...])` + RLS pe `organization_id` |
| `operator` | Organizația proprie — operațiuni (stoc, producție, comenzi, clienți), fără setări | `requireRole(["admin", "operator"])` + RLS |
| `client` | Doar datele proprii (comenzile firmei lui, documentele ei, certificatele comenzilor ei) | `requireRole(["client"])` + politici RLS „conștiente de status" pe `orders`/`order_items`/`documents` |

Izolarea multi-tenant este impusă **la nivel de bază de date** (Row Level
Security), nu doar în interfață — orice extindere a aplicației care adaugă un
tabel nou trebuie să respecte aceleași politici de izolare (vezi
[`AGENTS.md`](../../AGENTS.md) §2.3, Definition of Done).

O organizație suspendată (`organizations.status = 'suspended'`) blochează
accesul tuturor userilor ei, impus atât în aplicație cât și în baza de date
(vezi secțiunea 3.3).

### 4.6 CI/CD

| Workflow | Ce face | Declanșator |
| --- | --- | --- |
| `.github/workflows/ci.yml` | typecheck + lint + teste unitare | Pull request, push pe `main` |
| `.github/workflows/db.yml` | pornește Supabase, aplică migrările, generează tipurile | PR care atinge `supabase/**`, manual |

Deployment-ul de producție se face automat de Vercel la push pe `main` (sau
manual, `vercel --prod`, dacă e nevoie de un deploy imediat).
