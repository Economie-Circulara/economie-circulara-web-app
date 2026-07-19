# Follow-ups rămase din review (handoff §8)

> Plan pentru cele două follow-up-uri de cod rămase după review-ul tehnic
> (vezi `docs/handoff-continuare.md` §8, „Follow-ups de cod"). Branch:
> `claude/docs-handoff-agents-6t0trb`, PR către `main`.

## 1. KPI „Livrate luna curentă" pe `delivered_at` (aceeași clasă de fix ca F3)

**Problema:** `getDashboardKpis` (`src/features/reports/dashboard-queries.ts`)
numără comenzile `delivered` din luna curentă filtrând pe `updated_at` — orice
update ulterior al comenzii (ex. editare notă) o „mută" în luna curentă.

**Fix:** filtrare pe momentul REAL al livrării, cu exact același lanț de fallback
ca `deliveredAtIso` din `calculations.ts` (F3):
`delivered_at ?? delivery_date ?? updated_at` — comenzile livrate înainte de
migrarea 0015 nu au `delivered_at`. În PostgREST, un singur `.or(...)`:

```
delivered_at.gte.<monthStartIso>,
and(delivered_at.is.null,delivery_date.gte.<monthStartDate>),
and(delivered_at.is.null,delivery_date.is.null,updated_at.gte.<monthStartIso>)
```

(`delivery_date` e `date` → comparăm cu `YYYY-MM-DD`; coloanele `timestamptz`
cu ISO complet, ca până acum.)

**Teste:** `dashboard-queries.test.ts` — builder-ul fals primește metoda `or`;
asertăm că filtrul conține `delivered_at` și fallback-urile.

## 2. Migrarea `0017_cancel_order_deleted_lot.sql` — refacerea stocului când lotul a fost șters

**Problema:** `cancel_order` (0007) reface stocul parcurgând evenimentele
`consumption` cu `lot_id is not null`. `stock_events.lot_id` e
`on delete set null` — dacă lotul consumat a fost șters între acceptare și
anulare, evenimentul e sărit și stocul NU se reface (dispare tăcut).

**Fix (recomandarea din handoff):** la anulare, pentru evenimentele `consumption`
orfane (`lot_id is null`), creează un **lot de ajustare** per articol:

- agregare `sum(abs(quantity))` per `item_id` peste evenimentele orfane;
- `insert into lots` cu `provenance = 'inventory_adjustment'`,
  `initial_qty = remaining_qty = total`, `source` care indică anularea
  (auditabil: de ce a apărut lotul);
- un `stock_event` de tip `reversal` (cantitate pozitivă, agregată) pe lotul nou,
  legat de comandă — suma evenimentelor lotului = `remaining_qty` (consistent cu
  restul audit-trail-ului; fără `intake`, ca să nu numere dublu).

Funcția se recreează integral (`create or replace`), byte-identică în rest —
doar bucla nouă + comentariul aferent. Semnătura nu se schimbă → nimic de
actualizat în `database.types.ts`.

**Teste:** `supabase/tests/rls_isolation.sql` — TEST 20: acceptă o comandă (stoc
scăzut), șterge lotul (ca `postgres`), anulează comanda ca staff → există un lot
nou `inventory_adjustment` cu cantitatea consumată + eveniment `reversal` pe el.
Validare doar în CI (`db.yml`) — fără Docker local.

## Ordine & livrare

1. Commit 1: fix KPI + teste + intrare prompt-log.
2. Commit 2: migrarea 0017 + test rls_isolation + intrare prompt-log.
3. Push, PR către `main`, așteaptă check-urile `verify` + `migrations` (blocante).
