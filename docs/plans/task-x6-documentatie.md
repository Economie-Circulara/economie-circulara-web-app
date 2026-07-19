# Plan — Task X6: Documentatie utilizare & instruire

> Plan scris inainte de redactare, conform AGENTS.md §1.1. Task de documentatie
> (livrabil de conformitate Anexa 1, sectiunea 5) — fara cod, fara migrari, fara teste.

## Scop

Livrabilele „manual de utilizare" + „ghid de administrare" + „plan de instruire"
cerute de Anexa 1 (singurul ❌ ramas in `docs/analiza-conformitate-anexa.md`),
in `docs/manual/`, pe baza ecranelor **reale** existente in `src/app/` (nu inventate).

## Surse verificate inainte de redactare

- `AGENTS.md` (reguli, roluri, reguli de business §4).
- `docs/handoff.md` (fluxul complet 1→9, reguli de business, roluri).
- `docs/plans/implementation-plan.md` §Task X6 (cerinte exacte livrabile).
- Rutele reale din `src/app/(admin)`, `src/app/(auth)`, `src/app/(client)`,
  `src/app/platform`, `src/app/organizatie-suspendata` — citite fisier cu fisier
  pentru titluri de ecran (`PageHeader`), etichete de buton exacte si campuri de
  formular (`FormField`/`Input`/`select`).
- `src/components/layout/nav-config.ts` — denumirile exacte din sidebar.
- `docs/setup.md` — referinta tehnica pentru ghidul de administrare (Supabase, Vercel, CI).

## Constatari importante (pentru onestitate in text)

- **Task X5 (livrari/aviz/e-Transport) NU e livrat inca** — nu exista ruta `/livrari`
  in `src/app/`. Sectiunea corespunzatoare din manualul admin/operator si din
  raportul „Livrari" e descrisa pe baza planului (Task X5 din implementation-plan.md),
  marcata explicit „in curs de implementare" — nu se inventeaza ecrane.
- **Nu exista in acest moment un formular de invitare a unui utilizator cu rol `client`**
  in `/setari/utilizatori` (`InviteStaffForm` are doar optiunile Operator/Administrator).
  Schema (`profiles.client_id`) suporta rolul, dar UI-ul de invitare a unui client
  (creare cont de logare legat de o firma din `/clienti`) nu e construit inca. Manualul
  descrie fluxul intentionat (client = un user, invitat, seteaza parola) conform
  `docs/handoff.md`, cu o nota clara in ghidul de administrare despre acest gap curent.
- Pagina `/rapoarte` are 6 rapoarte livrate (`comenzi`, `livrari`, `retururi`,
  `materiale-reciclate`, `paas-utilizare`, `materii-secundare`) + o sectiune
  „CO2 economisit" marcata explicit „in pregatire (v2)" in cod — documentata ca atare.

## Livrabile

1. `docs/manual/README.md` — cuprins, pentru cine e fiecare document, nota screenshot-uri.
2. `docs/manual/utilizare-admin-operator.md` — ghid pas-cu-pas pe ecranele reale.
3. `docs/manual/utilizare-client.md` — ghid pas-cu-pas portal client.
4. `docs/manual/ghid-administrare.md` — setari organizatie, useri, super-admin, operare tehnica.
5. `docs/manual/instruire.md` — plan de sesiuni de instruire pe roluri.
6. Actualizare `docs/index.md` (sectiune Manual) + `docs/plans/implementation-plan.md` (marcaj X6 livrat).

## Ce NU face acest task

Nu atinge cod, migrari, `database.types.ts`, teste sau `src/`/`supabase/` — acelea
sunt in lucru in paralel (Task X5). Nu genereaza screenshot-uri reale (marcate ca
TODO pentru echipa, dupa ce aplicatia e accesibila).
