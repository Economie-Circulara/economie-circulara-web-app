# Plan - verificare functionala pre-recepție + capturi de ecran pentru manuale

> **Notă de scop:** planul a inceput ca "inlocuieste placeholder-ele de capturi din
> `docs/manual/`". Pe parcurs prioritatile s-au schimbat: **verificarea functionala a
> devenit prioritatea 1**, capturile prioritatea 3. Documentul reflecta ce s-a livrat.

## Context

Recepția proiectului (finanțare europeană) e sub 2 săptămâni. Manualele din
`docs/manual/` sunt livrabil obligatoriu din Anexa 1 și le lipseau capturile (27 de
placeholder-e). Parcurgerea fiecărui ecran pentru capturi s-a transformat în primul
smoke test manual real al aplicației - și a descoperit că aplicația nu randa deloc.

## Abordare

1. **Sweep de rute cu Playwright**, pe toate cele 4 roluri: pentru fiecare rută se
   înregistrează codul HTTP, `<h1>`, erorile de consolă/runtime și redirectările.
2. **Walkthrough pe fluxul de business** (pașii 1->9 din `docs/handoff.md`) prin UI, cu
   **verificarea efectului în date** după fiecare pas (psql direct pe `127.0.0.1:54322`),
   nu doar "UI-ul a răspuns OK".
3. **Capturile** se produc ca efect secundar al navigării, dintr-un pas dedicat
   *read-only* rulat imediat după `pnpm db:reset` (imagini cu date demo curate, fără
   entitățile create de testele de flux).

## Livrat

### Fix-uri P0

| # | Simptom | Cauză | Fix |
| --- | --- | --- | --- |
| 1 | Toate ecranele admin/operator/client -> HTTP 500 | `NavItem.icon` ducea o componentă Lucide din layout-ul server în `Sidebar` (`"use client"`); referințele de componentă nu sunt serializabile peste granița RSC | `icon` devine union strict de nume; maparea nume -> componentă trăiește în `sidebar.tsx` |
| 2 | Toate scrierile din 5 zone -> HTTP 500 la submit | Module `"use server"` care exportă și o constantă (starea inițială pt. `useActionState`) | Constantele mutate în `action-state.ts` per feature (convenția deja existentă în `orders`) |

### Plasă de siguranță

`tests/e2e/routes-smoke.spec.ts` - GET pe fiecare rută, per rol, cu aserțiuni de
randare + guard-uri de rol. Lista de rute se citește din `nav-config.ts`, deci o intrare
nouă în sidebar intră automat în acoperire.

### Seed coerent

`CMD-2026-0001` avea status `closed` cu toate timestamp-urile de tranziție NULL. Acum
au valori cronologice, iar `issued_at` al certificatului coincide cu `closed_at`.

## Rămas de făcut (în ordinea priorității)

1. **Smoke test pe SUBMIT-ul formularelor** - gaura rămasă în plasa de siguranță:
   ambele P0 au fost la scriere, iar `routes-smoke` verifică doar GET-uri. Suficient ca
   submit-ul să nu dea 5xx și să ajungă la redirect/mesaj de succes.
2. **Reparat `tests/e2e/mvp-flow.spec.ts`** - cade la login pe un selector ambiguu
   (`getByLabel("Email")` prinde și câmpul de magic-link). E la un selector distanță.
3. **Restul fluxului 1->9 neverificat prin UI**: livrare planificată + aviz +
   e-Transport, retur/garanție, acceptare retur, export PDF/CSV pe rapoarte, invitare
   utilizator, creare organizație, suspendare/reactivare.
4. **3 placeholder-e rămase** (necesită date pe care seed-ul nu le are): formularul de
   Retur/Garanție (admin și client) și detaliul comenzii client cu "Repetă comanda".

## Definition of Done

- [x] `typecheck` + `lint` + testele unitare trec
- [x] `routes-smoke` verde pe toate rolurile
- [x] intrare în `docs/prompt-log.md` (regula 1.2)
- [x] fără commit/push - modificările rămân în working tree
