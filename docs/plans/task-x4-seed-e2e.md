# Task X4 — Seed data & E2E

> Plan scris inainte de codare (AGENTS.md §1.1). Scope: `supabase/seed.sql`,
> `tests/e2e/**`, `docs/plans/`. NU atinge: `src/features/**`, migrari,
> `database.types.ts`, `src/components/layout/topbar.tsx`, `src/features/search`
> (Task X2, in paralel). NU modifica `supabase/tests/rls_isolation.sql`.

## 1. Ce exista deja (reutilizat, nu reinventat)

- `supabase/seed.sql` — organizatia demo "Lateris Demo" (slug `demo`) + 4 conturi
  (admin/operator/client/super@demo.local, parola `password123`) + un client
  ("Client Demo SRL"). **Extins**, nu rescris.
- Schema completa (migrarile 0000-0012) + RPC-uri (`create_lot`, `consume_fifo`,
  `accept_order`, `cancel_order`, `confirm_process`, `accept_return_order`,
  `generate_order_number`, `generate_certificate_number`) — vezi AGENTS.md §3.
- Playwright configurat (`playwright.config.ts`, `tests/e2e/home.spec.ts`,
  script `pnpm test:e2e`). Chromium pre-provizionat la
  `/opt/pw-browsers/chromium` in mediul agentic.
- `supabase/tests/rls_isolation.sql` — foloseste prefixele de id `aaaa.../
  bbbb.../cccc.../1111...-6666...`; seed-ul (existent si cel nou) foloseste
  `a0.../b0.../c0...` — fara coliziune intre cele doua fisiere.

## 2. Seed bogat — decizie de implementare

RPC-urile de business (`create_lot`, `consume_fifo`, `confirm_process`,
`accept_order`) sunt `SECURITY INVOKER` si verifica `app.is_staff_of()` pe baza
`auth.uid()`. Cand `seed.sql` ruleaza (ca `postgres`, la `db reset`, fara
`set local role authenticated` + JWT claims), `auth.uid()` e `null` — RPC-urile
ar respinge orice apel. **Solutie:** insertii DIRECTE in tabele, reproducand
exact ce ar fi scris RPC-ul corespunzator (lot + `stock_event` 'intake', consum
-> `stock_event` 'consumption' + `remaining_qty` scazut, etc.) — rezultatul e
indistingibil de unul produs prin flux normal. Acelasi pattern ca
`supabase/tests/rls_isolation.sql`.

Al doilea bloc `do $$ ... $$` adaugat in `seed.sql` (dupa cel existent,
nemodificat) acopera clientul pilot din handoff ("firma de constructii care
concaseaza moloz -> nisip/pietris/fierbeton reciclat -> caramizi/beton/balast"):

| Entitate | Continut |
| --- | --- |
| Clienti | +2 (Bravo Construct SRL, Edilamo Trading SRL) — pe langa Client Demo SRL existent |
| Adrese livrare | 1 (Bravo Construct SRL) |
| Itemi | 7 fizice (moloz, nisip reciclat, pietris reciclat, balast reciclat, carami­zi eco, beton reciclat, deseuri umplutura) + 1 serviciu (abonament preluare deseuri — demonstreaza `item_kind`) |
| Retete | 3 — moloz (descompunere reciclare: nisip 45% / pietris 35% / balast 15%), caramizi (60/30/10), beton (50/30/20) |
| Loturi | 9 — proveniente: achizitie (moloz), reciclare (nisip/pietris/balast), recondiționare (pietris recondiționat, distinct de reciclare conform AGENTS.md §4), productie interna (caramizi, beton), retur (umplutura), + 1 lot BLOCAT (beton, quality_status='failed', demonstreaza `set_lot_block`) |
| Procese | 4 — 1 reciclare (input_fixed, moloz -> nisip/pietris/balast), 1 recondiționare (input_fixed, pietris -> pietris recondiționat), 2 productie (output_fixed: caramizi, beton), toate cu `process_inputs`/`process_outputs` complete pentru trasabilitate |
| Comenzi | 2 — CMD-2026-0001 (Bravo Construct, **inchisa**, cu certificat CRT-2026-0001 generat), CMD-2026-0002 (Client Demo SRL, doar **trimisa**) |
| Contoare | `order_counters`/`certificate_counters` sincronizate (seq=2, resp. seq=1) — urmatoarea comanda/certificat creat din UI continua numerotarea fara coliziune |

Cantitatile de-a lungul lantului (achizitie -> reciclare -> recondiționare ->
productie -> comanda) sunt calculate manual ca sa fie **consistente**
(`remaining_qty` fiecarui lot reflecta exact consumul insumat din procesele/
comenzile ulterioare) — verificat linie cu linie la scriere (vezi comentariile
din `seed.sql`).

**Idempotenta:** seed-ul ruleaza o singura data, imediat dupa migrari, pe o
baza de date proaspata (`supabase db reset`) — la fel ca seed-ul existent, NU
foloseste `ON CONFLICT` (nu e nevoie; `db reset` sterge si recreeaza schema).

## 3. E2E — decizie de scop

Testul acopera fluxul complet MVP (handoff.md, pasii 1-9), CU O EXCEPTIE
deliberata: **pasul 1 ("Creare organizatie + useri") nu e condus prin UI.**
Motiv: ar necesita fluxul super-admin -> creare organizatie -> invitatie email
-> setare parola (Supabase Auth), care depinde de livrare reala de email — in
afara scope-ului unui test E2E rulat fara provider de email configurat in CI.
Testul porneste cu login ca admin al organizatiei demo deja provizionate de
seed (echivalentul "am organizatia si userii").

Pasii 2-9 sunt conduse 100% prin UI, cu date NOI (nu cele din seed), ca sa
exercite logica reala de business (nu doar sa verifice date seedate):

1. Login admin.
2. Client nou (`/clienti/nou`).
3. 3 itemi noi (materie prima nevandabila -> reciclat vandabil -> produs finit
   vandabil) + 2 retete (descompunere reciclare 100%, compozitie productie 100%).
4. Intrare stoc — lot nou (`/stoc/nou`, proveniență achizitie).
5. Proces reciclare (`/productie/nou`, tab "Output variabil") — consuma materia
   prima, creeaza lot de material reciclat.
6. Proces productie (`/productie/nou`, tab "Output fix") — consuma materialul
   reciclat conform retetei, creeaza lot de produs finit.
7. Comanda noua in numele clientului (`/comenzi/nou`).
8. Trimite -> Acceptă (scade stocul FIFO, real, prin `accept_order` RPC).
9. Livrează -> Închide (genereaza automat certificatul — hook real din
   `src/features/orders/notifications.ts`, NU date seedate) -> vizualizare
   certificat (`/comenzi/[id]/certificat`).

Un singur `test()` (cerinta din implementation-plan.md: "un singur test E2E
parcurge..."), impartit logic cu `test.step()` per etapa, `test.describe.serial`
ca sa fie clar ca pasii sunt secventiali/dependenti (aceeasi `page`, acelasi
`RUN_ID` unic per rulare in titluri/CUI, ca testul sa poata rula repetat pe
aceeasi baza fara coliziuni de unicitate).

**Selectori:** rol/text in romana (`getByRole('button', {name: 'Trimite'})`,
`getByRole('heading', ...)`) pentru navigare/verificari; `getByLabel` (cu
`exact: false`, tolerant la asteriscul câmpurilor obligatorii adaugat de
`FormField`) pentru completarea formularelor. Doua locuri scopate explicit
(`getByRole('table').getByText(...)`, `.first()`) unde un filtru select de pe
aceeasi pagina ar produce o potrivire ambigua ("strict mode violation") —
documentat inline in test.

## 4. NOTA MEDIU — ce NU s-a putut rula

Mediul de agent Claude Code in care s-a scris acest task **nu are Docker/
Supabase local** (cf. AGENTS.md §3.2, notă mediu). Testul E2E **nu a putut fi
rulat efectiv** aici. Verificat static:

- `pnpm typecheck` — trece.
- `pnpm lint` — trece.
- `pnpm exec playwright test --list` — listeaza ambele teste (`home.spec.ts` +
  `mvp-flow.spec.ts`), deci fisierul compileaza si selectorii sunt sintactic
  valizi.
- `supabase/seed.sql` — verificat static (paranteze/blocuri `do $$`/`end $$;`
  balansate, cantitati/FK-uri consistente linie cu linie); NU a putut fi rulat
  prin `supabase db reset` (fara Docker in acest mediu).

**Ruleaza complet** cu `pnpm test:e2e` intr-un mediu cu Supabase local pornit
(`pnpm db:start && pnpm db:reset && pnpm test:e2e`) sau in CI dedicat cu acces
la imaginile `ghcr.io/supabase/*`.

## 5. Verificari efectuate

- `pnpm typecheck` — trece.
- `pnpm lint` — trece.
- `pnpm test` (Vitest, fara E2E) — 534 teste, toate trec (niciun cod din
  `src/` atins de acest task).
- `pnpm exec prettier --check tests/e2e/mvp-flow.spec.ts` — trece.
- Niciun helper nou de seed/util introdus in `src/` — nu sunt necesare teste
  Vitest suplimentare (regula AGENTS.md §2.1); testul E2E in sine e "testul"
  cerut de acceptance criteria.
