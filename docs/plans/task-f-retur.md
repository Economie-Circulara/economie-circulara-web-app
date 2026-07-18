# Task F — Retur & Garanție & Închiriere

> Plan de implementare (AGENTS.md §1.1). Schema (`orders`, `order_items`,
> `order_links`, enum `order_link_type`) e înghețată — vezi Task E (Comenzi) și
> Task C (Stoc), reutilizate aici.

## Domeniu de business

- **Retur**: pe o comandă finalizată (`delivered`/`closed`) se creează o comandă
  nouă (`orders`, status `draft`) legată prin `order_links` (`link_type =
  'return'`), cu cantități editabile ≤ ce mai poate fi returnat per linie.
  După acceptare manuală de staff, se creează câte un lot (`create_lot`,
  provenance `return`) per linie — materialele intră în stoc.
- **Garanție**: la fel ca returul, plus o a doua comandă nouă ("înlocuire",
  `draft`, aceleași linii/cantități) legată de comanda originală prin
  `order_links` (`link_type = 'replacement'`). Comanda de înlocuire e o comandă
  de vânzare obișnuită — parcurge fluxul normal Task E (send/accept/
  deliver/close), nu are acceptare specială.
- **Închiriere**: nu introduce cod nou — `orders.expected_return_date` există
  deja (Task E) și fluxul de retur de mai sus se aplică identic la finalul
  perioadei de închiriere (comanda de retur normală, fără distincție specială).

## Interfața publică (consumată de Task H — portal client)

```ts
// src/features/returns/actions.ts ("use server")
createReturnAction(input: {
  originalOrderId: string;
  type: "return" | "warranty";
  items: { orderItemId: string; quantity: number }[];
  notes?: string;
}): Promise<{ returnOrderId: string; replacementOrderId: string | null } | { error: string }>

acceptReturnAction(returnOrderId: string): Promise<{ error: string | null }>

getReturnableItems(orderId: string): Promise<ReturnableItem[]>
```

`createReturnAction`/`getReturnableItems` acceptă atât rolul `client` (pe
comenzile proprii — RLS impune asta) cât și staff (`admin`/`operator`, pe orice
comandă din organizație). `acceptReturnAction` e restricționat la staff.

## Migrare — `supabase/migrations/0010_returns.sql` (DA, e nevoie)

Două motive independente, ambele obligă la o migrare:

1. **Gol RLS**: `order_links` avea (0001/0003) doar `order_links_staff_all`
   (insert rezervat staff-ului) și `order_links_client_select` — clientul NU
   putea insera un rând `order_links`, deci `createReturnAction` apelat de un
   client ar fi eșuat mereu cu "permission denied". Adăugat
   `order_links_client_insert`, scoped strict la comenzi deținute de client pe
   ambele capete ale legăturii.
2. **Atomicitate la acceptare**: acceptarea presupune "creează N loturi + status
   → accepted" — dacă lotul N eșuează (ex. item șters între timp), fără RPC ar
   rămâne N-1 loturi create și comanda tot `draft` (stare ambiguă, materiale deja
   în stoc dar returul nu pare acceptat). RPC nou `accept_return_order`
   (SECURITY INVOKER, în stilul `accept_order`/`cancel_order` din
   `0007_orders_ops.sql`) face totul într-o singură tranzacție.

`accept_return_order` NU reutilizează `accept_order`: acela consumă stoc
(`consume_fifo`), semantica inversă unui retur, care trebuie să *adauge* stoc
(`create_lot`). Coduri de eroare noi (fără coliziune cu `OR00x`/`LT00x`): RT001
(tranziție invalidă), RT002 (nu există/fără acces), RT003 (comanda nu e o
comandă-retur — apărare împotriva apelării RPC-ului pe o comandă de vânzare
obișnuită), RT004 (permisiune).

`src/lib/database.types.ts` a primit manual intrarea funcției
`accept_return_order` (același pattern documentat ca la Task E/G, din lipsa
accesului la `pnpm gen:types` în acest mediu).

## Decizii de design

- **Statusul unei comenzi-retur**: creată `draft`; acceptarea o duce direct la
  `accepted` (nu trece prin `sent`/`delivered` — o comandă-retur nu are livrare,
  fluxul de 5 stări al Task E nu i se aplică 1:1).
- **`onOrderStatusChanged` NU e apelat** la acceptarea unei comenzi-retur:
  acel hook (Task G) generează automat certificatul de trasabilitate la
  `toStatus === 'closed'` — nu are sens pentru o comandă-retur (nu e o vânzare
  livrată clientului). Accept-ul de retur își face propriul UPDATE direct
  (`status='accepted'`, prin RPC), fără să treacă prin hook-ul de comenzi.
- **`quality_status = 'passed'`** pe loturile de retur create la acceptare:
  se presupune că inspecția manuală (făcută de staff înainte de a apăsa
  "Acceptă retur") a validat deja materialul. Nu există un flux de
  "retur parțial respins" în acest task.
- **Cantitate returnabilă** (`getReturnableItems`) = cantitatea liniei
  originale minus suma cantităților din TOATE comenzile-retur/garanție legate
  care nu sunt `cancelled` (indiferent dacă sunt încă `draft` sau deja
  `accepted`) — o cerere de retur încă neacceptată blochează deja cantitatea,
  ca să nu se poată cere de două ori concurent același material.
- **Comenzile-retur/înlocuire apar în lista generală `/comenzi`**: sunt rânduri
  obișnuite în tabela `orders`, nu există (în acest task) un ecran/filtru
  dedicat care să le separe — în afara scope-ului ([`src/app/(admin)/comenzi/page.tsx`]
  nu a fost atins). Cunoscut, documentat ca limitare.
- **`OrderStatusActions` (Task E) ascuns pe comenzile de tip
  `return`/`warranty`**: dacă ar rămâne vizibil, un staff ar putea apăsa
  "Acceptă" din fluxul generic, care apelează `accept_order`/`consume_fifo` —
  greșit pentru o comandă-retur (ar CONSUMA stoc în loc să creeze). Comenzile de
  tip `replacement` (înlocuire) NU sunt afectate — acelea rămân comenzi de
  vânzare normale, cu fluxul Task E intact.

## Fișiere noi

- `src/features/returns/types.ts`, `labels.ts`
- `src/features/returns/queries.ts` — `getReturnableItems`, `getReturnLinkForOrder`
- `src/features/returns/service.ts` — `loadOriginalOrderForReturn`,
  `createReturnOrder`, `acceptReturnOrder` + erori tipizate
- `src/features/returns/actions.ts` ("use server") — interfața publică
- `src/features/returns/return-actions.tsx`, `accept-return-button.tsx` —
  componente client (apel direct al server actions din `onClick`/`useTransition`,
  NU `useActionState`/`<form>`, pentru că `createReturnAction`/`acceptReturnAction`
  iau obiecte simple, nu `FormData` — contract fixat pt. Task H)
- Teste colocate: `queries.test.ts`, `service.test.ts`, `actions.test.ts`

## Editări minime

- `src/app/(admin)/comenzi/[id]/page.tsx`: adăugate importuri + butoane
  Retur/Garanție (`ReturnActions`) pe comenzi finalizate, `AcceptReturnButton`
  pe comenzi-retur `draft`, un mic banner "Retur/Garanție/Înlocuire pentru
  comanda originală" — restul paginii (inclusiv link-ul "Vezi certificat" din
  Task G) neatins.

## Incertitudini / lăsat pentru Task H sau clarificare ulterioară

- Nu există ecran dedicat de listare a retururilor/garanțiilor (doar butoane pe
  detaliul comenzii originale/comenzii-retur) — dacă e nevoie de un ecran
  separat, nu e în scope-ul acestui task.
- Nu există flux de "respingere" a unui retur (doar acceptare) — un retur
  netrimis spre acceptare rămâne `draft` la nesfârșit; se poate anula prin
  `cancelOrderAction` generic (butonul dispare totuși de pe UI-ul dedicat retur,
  dar comanda tot poate fi anulată din lista generală `/comenzi`, fluxul
  generic Task E nefiind restricționat acolo).
