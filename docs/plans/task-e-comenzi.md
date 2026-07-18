# Task E — Comenzi (plan de implementare)

> Referințe: `docs/plans/implementation-plan.md` (Task E), `AGENTS.md` (regula
> „stocul se scade la acceptare, nu la livrare" — §4).
> Model de stil: verticala livrată `src/features/stock/` (contract stock service,
> Task C) + `src/features/clients/`/`src/features/items/` (Task A/B).

## Scop

Masina de stari a comenzii (`draft -> sent -> accepted -> delivered -> closed`,
plus `-> cancelled` din `draft/sent/accepted`), cu **scadere de stoc la
acceptare** (nu la livrare) și **refacere la anulare**. Ecrane staff
(admin/operator): listă, detaliu, creare în numele clientului.

## Migrare — `0007_orders_ops.sql`

Aditivă peste schema înghețată `0001_core_schema.sql`. Trei piese noi:

1. **`order_counters`** (tabel contor `organization_id, year, seq`) +
   **`generate_order_number(p_org)`** — numar secvențial per organizație/an
   (`CMD-2026-0001`), sigur la concurență prin `INSERT ... ON CONFLICT DO UPDATE
   ... RETURNING` (lock de rând implicit pe cheia `(organization_id, year)`).
   Alternativa (parsare `max(order_number)`) ar necesita `SELECT ... FOR UPDATE`
   pe un set variabil de rânduri — mult mai fragil. Trade-off acceptat: la un
   rollback după alocare, secvența „sare" un număr (comun la orice generator de
   secvență).
2. **`accept_order(p_order_id)`** — `sent -> accepted`, SECURITY INVOKER (RLS
   activ + `app.is_staff_of` explicit): pentru fiecare `order_items` apelează
   `consume_fifo` (Task C) cu `p_order_id` + `event_type='consumption'`. Atomic
   prin tranzacția implicită a apelului — stoc insuficient (LT001) sau tranziție
   invalidă (OR001) fac rollback complet, comanda rămâne `sent`.
3. **`cancel_order(p_order_id)`** — `draft/sent/accepted -> cancelled`. Dacă era
   `accepted`, parcurge `stock_events` de tip `consumption` scrise de
   `accept_order` pentru acea comandă și, pentru fiecare, readaugă cantitatea în
   lot (`remaining_qty +=`) + scrie un `stock_event` `reversal` de audit. Atomic;
   rezervat staff-ului (refacerea de stoc e o operațiune internă).

Coduri de eroare noi (stil `LT00x` din `0004_stock_service.sql`): `OR001`
(tranziție invalidă), `OR002` (comandă inexistentă/fără acces), `OR004`
(permisiune insuficientă), `OR005` (argument lipsă).

`database.types.ts` actualizat manual (fără `pnpm gen:types`, Docker blocat):
tabelul `order_counters` + funcțiile `generate_order_number`/`accept_order`/
`cancel_order` în `Functions`, poziționate lângă intrările Task C existente.

## Masina de stari (`src/features/orders/state-machine.ts`)

Modul pur, testabil fără mock-uri: `ALLOWED_TRANSITIONS` + `canTransitionOrder`/
`assertOrderTransition`. Folosit atât în `actions.ts` (validare înainte de orice
tranziție care NU trece prin RPC — `sent`/`delivered`/`closed`, unde staff-ul are
RLS `FOR ALL` fără gardă de tranziție la nivel de DB), cât și în UI
(`OrderStatusActions` afișează doar butoanele valide din statusul curent).

## Hook de notificări (`src/features/orders/notifications.ts`)

`onOrderStatusChanged(event)` — apelat după fiecare tranziție reușită din
`actions.ts`. Implementare goală/log acum; Task X1 (notificări) înlocuiește
corpul. La `toStatus === 'closed'`, e și punctul de intrare pentru Task G
(certificat de trasabilitate, generat automat la închidere — AGENTS.md §4) — nu
se implementează aici, doar hook-ul clar (comentarii `TODO(Task X1)`/`TODO(Task
G)` în cod).

## Ecrane (`src/app/(admin)/comenzi/`)

- `/comenzi` — listă (`OrderTable`, DataTable): număr comandă (link), client,
  rezumat produse, dată livrare, `StatusBadge`, acțiuni rapide
  (`OrderStatusActions` — Trimite/Acceptă/Livrează/Închide/Anulează, doar cele
  valide din statusul curent). Filtre: status (select) + căutare (client sau
  număr comandă, filtrată în JS după fetch — la fel ca agregările din Task B).
- `/comenzi/[id]` — detaliu: client, adresă/dată livrare, linii, „istoric
  status" derivat din masina de stari (fără tabel de audit dedicat — schema 0001
  e înghețată; un istoric cu timestamp per tranziție ar cere un tabel nou, în
  afara scope-ului), butoane de tranziție.
- `/comenzi/nou` — creare în numele clientului (`created_by_admin=true`):
  `OrderForm` (client component) — alege client, adresă de livrare (dependentă de
  client, din `addressesByClient` precalculat server-side, evită N interogări),
  dată livrare opțională, apoi „coș" local de linii (item vandabil + cantitate)
  trimis o singură dată ca perechi repetate `item_id`/`quantity` în FormData
  (parsate prin poziție în `actions.ts#readLines`).

## Service layer (`src/features/orders/service.ts`)

- `generateOrderNumber`/`acceptOrder`/`cancelOrder` — wrapper-e RPC subțiri, în
  stilul `stock/service.ts`. Coduri de eroare RPC mapate la clase TS
  (`OrderNotFoundError`, `OrderTransitionError`, `OrderPermissionError`) +
  reutilizează `InsufficientStockError` din `features/stock/service.ts` (parte
  din contractul public al stock service, Task C) pentru LT001.
- `sendOrder` — alocă numărul (RPC) apoi UPDATE `status='sent' + order_number`
  într-un singur pas; **doi apeluri separate**, nu o singură tranzacție SQL —
  trade-off documentat (vezi migrare) în loc de un RPC dedicat suplimentar
  (task-ul cere explicit doar `generate_order_number`/`accept_order`/
  `cancel_order`).
- `setOrderStatus` — UPDATE simplu, fără efect de stoc (`delivered`/`closed`).
- `createOrderWithItems` — două insert-uri (`orders`, `order_items`); dacă al
  doilea eșuează, șterge comanda deja creată (compensare best-effort, în stilul
  `uploadDocument` din `features/documents/service.ts`).

## Fișiere livrate

```
supabase/migrations/0007_orders_ops.sql

src/features/orders/
  types.ts, labels.ts, action-state.ts
  state-machine.ts (+ .test.ts)
  notifications.ts (+ .test.ts)
  queries.ts (+ .test.ts)
  service.ts (+ .test.ts)
  actions.ts (+ .test.ts)
  order-table.tsx, order-status-actions.tsx, order-form.tsx

src/app/(admin)/comenzi/
  page.tsx, nou/page.tsx, [id]/page.tsx
```

`database.types.ts` — doar adăugirile `order_counters`/`generate_order_number`/
`accept_order`/`cancel_order` (vezi diff). `nav-config.ts` — NEATINS (intrarea
„Comenzi" era deja acolo). `status-badge.tsx` — NEATINS: toate cele 6 chei pentru
statusul de comandă existau deja în `STATUS_REGISTRY.order` (mapare DB->cheie
registru în `orders/labels.ts#ORDER_STATUS_BADGE_STATUS`, la fel ca
`PROVENANCE_BADGE_STATUS` din Task C).

## În afara scopului acestui task

- Portalul clientului (`/comenzile-mele` — trimitere/anulare proprie prin RLS,
  Task H) — Task E livrează doar ecranele staff.
- Retur/garanție/închiriere (`order_links`, `expected_return_date`) — Task F.
- Generarea efectivă a certificatului la închidere — Task G (doar hook-ul).
- Trimiterea efectivă a notificărilor — Task X1 (doar hook-ul).
