# Asistent AI - control si vizibilitate pe creditele organizatiilor (super-admin)

Continuare dupa `docs/plans/asistent-consum-real.md` (etapele 1-2). Cerut: super-adminul sa
vada si sa controleze creditele fiecarei organizatii (stop, top-up).

## Ce exista deja

Pe `/platform/ai`: asistent activ/oprit, buget lunar (permanent), procent zilnic; consum in
USD pe 30 de zile. Lipsesc: situatia pe LUNA CURENTA in credite, top-up punctual, istoric
al modificarilor, semnalarea organizatiilor cu probleme.

## Decizii

- **Top-up = credite extra DOAR pentru luna curenta**, peste bugetul lunar; expira la
  sfarsitul lunii (nu se reporteaza - simplu si previzibil). Motiv obligatoriu (ex. „cerere
  client, factura X”). O organizatie cu buget 0 (nelimitat) nu are nevoie de top-up.
- **Append-only**: un top-up gresit nu se sterge - se corecteaza prin bugetul lunar sau
  un nou top-up (nu exista top-up negativ).
- **Jurnal automat, in DB** (trigger-e): orice schimbare a limitelor AI ale unei
  organizatii (activ, buget, procent - inclusiv coloanele vechi de mesaje) si orice top-up
  se inregistreaza cu autorul (`auth.uid()`), valorile inainte/dupa si momentul - indiferent
  pe ce cale s-a facut schimbarea.

## Schimbari

- Migrarea `0040_ai_credit_grants.sql`:
  - `ai_credit_grants` (organizatie, luna, credite > 0, motiv, autor) - citire: staff-ul
    organizatiei (cardul de consum) si super-adminul; scriere: doar super-adminul.
  - `ai_limit_changes` (jurnal: organizatie, tip `limits` / `grant`, inainte/dupa, autor) -
    citire doar super-admin; scris DOAR de trigger-e.
- Quota (`quota.ts`): bugetul efectiv al lunii = buget + top-up-urile lunii; `QuotaStatus`
  primeste `monthlyBase` / `monthlyBonus`; cardul arata „2.000 + 500 extra luna aceasta”.
- `/platform/ai` - sectiunea „Credite pe organizații”:
  - per organizatie: credite folosite luna aceasta / buget efectiv, procent, stare (oprit /
    blocat / peste 80% / ok / nelimitat); organizatiile cu probleme primele;
  - formular de limite (existent) + formular „+ credite luna aceasta” cu motiv;
  - jurnalul ultimelor modificari (limite + top-up-uri).
- Manual (`ghid-administrare.md` §3.4) + AGENTS.md (regula top-up-ului).

## Impact asupra asistentului (regula 2.4)

`none` pe tool-uri; se schimba doar bugetul efectiv din quota.

## Teste

`ai-pricing.test.ts` (starea creditelor unei organizatii, validarea top-up-ului),
`ai-usage-queries.test.ts` (agregarea pe luna), `ai-pricing-actions.test.ts` (top-up),
`quota.test.ts` (buget + top-up), `quota-card.test.tsx`; SQL: T13 in `assistant_rls.sql`
(cine poate da top-up, jurnalul automat).
