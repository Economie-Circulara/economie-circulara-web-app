# AGENTS.md

Reguli generale pentru orice agent AI (sau dezvoltator) care lucreaza in acest repo.
**Citeste acest fisier inainte de a incepe orice task.** Este sursa de adevar pentru
procesul de lucru si pentru regulile de business invatate pe parcurs.

> Limba: **UI in romana, cod sursa + identificatori in engleza.** Documentele de
> proces (acest fisier, planuri, log) pot fi in romana.

---

## 1. Reguli de proces (obligatorii)

### 1.1 Planuri de implementare → `docs/plans/`
Daca un task are un plan de implementare (oricat de mic), acesta **trebuie scris ca
fisier markdown in `docs/plans/`** inainte de a incepe codarea. Numire:
`docs/plans/<nume-scurt-task>.md`. Planul ramane in repo ca referinta.

### 1.2 Prompt log la fiecare commit → `docs/prompt-log.md`
La **fiecare commit**, agentul adauga o intrare in [`docs/prompt-log.md`](docs/prompt-log.md)
care contine:
- **Data** (YYYY-MM-DD)
- **Agent / model** care a facut munca (ex. `Claude Opus 4.8`)
- **Ce s-a cerut** — un rezumat scurt al promptului/sarcinii
- **Ce s-a facut** — rezumat al modificarilor + (optional) hash-ul de commit

Intrarea se adauga in acelasi commit cu modificarile. Cele mai noi intrari sus.

### 1.3 Corectii → actualizeaza AGENTS.md
Oricand un agent este corectat pe o **regula de business** (ex. „stocul se scade la
acceptarea comenzii, nu la livrare") **sau pe o directie generica de dezvoltare**
(ex. „in teste folosim mocks, nu spies"), regula nou invatata **trebuie adaugata in
acest fisier** (sectiunile 3 sau 4, dupa caz), in acelasi commit cu corectia. Scopul:
nicio regula sa nu fie reinvatata de doua ori.

### 1.4 Un task = un commit/PR coerent
Fiecare task produce modificari mici, review-abile, cu mesaj de commit clar.

---

## 2. Reguli de cod si testare

### 2.1 Teste unitare obligatorii
**Tot codul nou trebuie sa aiba teste unitare.** Nu se cere acoperire 100%, dar
**functionalitatea principala** (logica de business, edge case-urile critice,
tranzitiile de stare) trebuie testata. Un task fara teste pentru logica lui noua nu
este „done".

### 2.2 Stil de testare
- Folosim **mocks**, nu spies. (regula de directie — vezi 1.3)
- Testele nu depind de servicii externe reale; dependentele externe se mock-uiesc.

### 2.3 Definition of Done (global)
Un task e gata doar cand:
- [ ] `typecheck` + `lint` trec
- [ ] testele unitare pentru logica noua trec
- [ ] izolarea multi-tenant (RLS) e respectata acolo unde e cazul
- [ ] UI corespunde mockup-ului relevant din `docs/design/`
- [ ] fara secrete hardcodate (totul prin `.env`)
- [ ] intrare adaugata in `docs/prompt-log.md` (regula 1.2)

---

## 3. Descrierea proiectului (crucial pentru context)

**Lateris Trace** — platforma web **multi-tenant** pentru **trasabilitatea
materialelor in economia circulara**. Clientul platitor este firma
producatoare/reciclatoare; selling point-ul este **certificatul de trasabilitate**
care arata din ce loturi de materie prima (inclusiv reciclata) e facut un produs livrat.

Stack: **Next.js (App Router) + TypeScript**, **Supabase** (Postgres + Auth + Storage,
EU), **shadcn/ui** retematizat, hosting **Vercel**. Roluri: super-admin, admin,
operator, client.

Referinte:
- Cerinte si decizii: [`docs/handoff.md`](docs/handoff.md)
- Design / mockup: [`docs/design-prompt.md`](docs/design-prompt.md),
  [`docs/design/Lateris_Trace.dc.html`](docs/design/)
- Plan de implementare: [`docs/plans/implementation-plan.md`](docs/plans/implementation-plan.md)

### 3.1 Cai catre domeniile principale & comenzi uzuale
> _De completat imediat ce proiectul este scaffold-at (Wave 0)._ Aici se vor lista:
> caile catre fiecare domeniu (`src/features/<domeniu>/`), locatia schemei/migrarilor
> Supabase, tipurile generate, si comenzile uzuale (`dev`, `build`, `test`,
> `typecheck`, `lint`, `db reset`, `gen-types`).

---

## 4. Reguli de business invatate

> Sectiune vie: se adauga reguli pe masura ce sunt clarificate/corectate (regula 1.3).
> Regulile initiale provin din [`docs/handoff.md`](docs/handoff.md).

- Stocul se scade la **acceptarea** comenzii; la anulare stocul se **reface**.
- **FIFO implicit** la consumul loturilor, cu optiune de selectie manuala la productie.
- Toate miscarile de stoc se inregistreaza in `stock_events` (audit de la inceput).
- Retetele sunt in **procente**; fara versionare (reteta noua = produs nou).
- Un **UM unic** per produs; fara conversii intre unitati.
- Un **client = un singur utilizator**; clientii sunt doar firme juridice.
- Certificatul PDF se genereaza **automat la inchiderea** comenzii.
- Clientul **nu** vede stocul si procesele interne — doar comenzile, documentele si
  certificatele proprii.
- Pierderile/randamentul la productie se **inregistreaza**, nu se **valideaza**.
- Fara livrari partiale; fara productie partiala.
