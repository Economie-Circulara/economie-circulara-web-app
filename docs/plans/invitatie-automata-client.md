# Invitatie automata la crearea clientului + "Retrimite invitația"

## Cerinta

- La adaugarea unui client, daca are email, i se trimite automat invitatia in portal.
- Din pagina clientului (`/clienti/[id]`), buton de retrimitere a invitatiei.

## Decizii

- **Fara bifa**: `createClientAction` trimite invitatia (`sendClientInvite`) cand
  emailul e completat. Invitarea ramane **doar a adminului** (regula existenta,
  ca in `/setari/utilizatori`): un client creat de operator nu primeste invitatie
  automat; formularul explica asta, iar adminul o trimite din pagina clientului.
- Esecul invitatiei nu anuleaza crearea (avertisment `inviteWarning` pe detaliu).
- **Starea contului din portal** (`getClientPortalStatus`, `settings/queries.ts`):
  `none` (fara profil) / `pending` (profil creat, cont neactivat in Supabase Auth -
  `email_confirmed_at` si `last_sign_in_at` nule) / `active`. Daca verificarea in Auth
  esueaza -> `active` (conservator). Inlocuieste `clientHasPortalAccess`.
- **Retrimitere** (`resendClientInvite[Action]`, `settings/user-actions.ts`): doar
  admin, firma din organizatia lui (RLS via `getClient`), doar pentru cont
  `pending`, catre emailul contului (`profiles.email`). Supabase retrimite invitatia
  unui user neconfirmat; unul activ e refuzat cu mesaj ("Ai uitat parola?").
- UI (`invite-portal-access.tsx`): `active` -> badge; `pending` -> badge
  "Invitație trimisă - email" + "Retrimite invitația" (admin); `none` -> "Invită în
  portal" (ca pana acum).

## In afara scopului

- Schimbarea emailului unei invitatii neactivate (ar cere stergerea userului Auth
  neconfirmat + a profilului).

## Impact asistent AI (regula 2.4)

`none` - invitarea utilizatorilor nu e expusa asistentului.

## Teste

- `clients/actions.test.ts`: invitatie automata (admin+email), fara email, operator,
  esec -> avertisment.
- `settings/user-actions.test.ts`: retrimitere (gating rol, alta organizatie, flux
  fericit, fara cont, cont activ, eroare Supabase).
- `settings/queries.test.ts`: `getClientPortalStatus` (none/pending/active/fallback).
