# Task H — Portal client

Plan scurt (AGENTS.md §1.1) inainte de codare.

## Scop

Ecranele clientului (un singur user per firma): **Catalog** (grid + cos + trimitere
comanda), **Comenzile mele** (lista, detaliu, repeta comanda, retur/garantie pe
comenzi finalizate), **Documente & Certificate** (descarcare). Fara preturi, fara
stoc/productie vizibile.

## Reutilizare (nu reinventam)

- `src/features/orders/service.ts` — `createOrderWithItems`, `sendOrder` (client
  trimite propria comanda draft->sent, permis de RLS `orders_client_update` din
  0003_rls_hardening.sql).
- `src/features/orders/queries.ts` — `listOrders()`, `getOrderDetail(id)`,
  `getOrderStatus(id)`: RLS (`orders_client_select`) le limiteaza deja la comenzile
  clientului curent — refolosite FARA parametru suplimentar de filtrare.
- `src/features/clients/queries.ts` — `listClientAddresses(clientId)` (adresele
  propriei firme, RLS `client_addresses_self_all`).
- `src/features/certificates/service.ts` + `certificate-view.tsx` — certificat +
  link semnat de descarcare (`certificates_client_select`).
- `src/features/documents/service.ts` + `document-list.tsx` — `listDocuments`,
  `getDownloadUrl`, componenta `DocumentList` (afisare read-only, `canDelete=false`).
- Componente: `PageHeader`, `EmptyState`, `FormField`, `StatusBadge`, `Card`, `Button`.
- `src/features/items/labels.ts` — `KIND_LABELS`/`UNIT_LABELS` pentru filtrele de catalog.

## Cosul (client-side)

- `cart-logic.ts`: functii PURE, testabile fara React (`addLine`, `removeLine`,
  `setQuantity`, `totalItems`, `linesFromOrder` pt. "repeta comanda").
- `cart-context.tsx`: `CartProvider` (client component) cu `useReducer(cartReducer)`
  peste `cart-logic.ts` + sincronizare `localStorage` (cheie
  `lateris-trace:cart:v1`) — persista intre `/catalog` si `/comenzile-mele`, necesar
  pentru "repeta comanda" (populeaza cosul dintr-o comanda veche, apoi navigheaza
  la /catalog). Providerul e montat o singura data in `(client)/layout.tsx`.

## Comanda din cos

Catalogul clientului = itemi `sellable=true` din organizatia lui (interogare proprie
`listCatalogItems`, filtrata explicit `sellable=true` — desi RLS `items_client_catalog`
oricum ar restrictiona, filtrul explicit e defensiv si consistent cu
`orders/queries.ts#listSellableItemOptions`). FARA camp de pret in tip/UI.

Trimiterea comenzii (`createClientOrderAction`, server action in
`client-portal/actions.ts`, NU in `orders/actions.ts` care e rezervat staff-ului):
1. `requireRole(["client"])`, ia `clientId`/`organizationId` din sesiune.
2. `createOrderWithItems({ createdByAdmin: false, ... })` → `draft`.
3. `sendOrder(...)` → `sent` (un singur pas din UI, ca in mockup: buton unic
   „Trimite comanda"; nu expunem un ecran separat de „salveaza draft").
Adresa de livrare + data sunt optionale (camp text/select din adresele proprii).

## Retur din portal — punct de integrare cu Task F (NU importat)

Task F (`src/features/returns/`) se scrie in paralel si poate sa nu existe inca.
`src/features/client-portal/portal-return-button.tsx` randeaza butoanele
Retur/Garantie pe comenzile `delivered`/`closed`, dar handler-ul e un STUB dezactivat
(„Disponibil in curand") cu `// INTEGRARE:` comentariu — orchestratorul conecteaza
butonul la actiunea reala a Task F. Niciun import din `src/features/returns/`.

## Fisiere

- `src/features/client-portal/types.ts`
- `src/features/client-portal/cart-logic.ts` + `.test.ts`
- `src/features/client-portal/cart-context.tsx`
- `src/features/client-portal/queries.ts` + `.test.ts` (catalog)
- `src/features/client-portal/action-state.ts`
- `src/features/client-portal/actions.ts` + `.test.ts`
- `src/features/client-portal/catalog-view.tsx` (grid + cos + formular comanda)
- `src/features/client-portal/order-list.tsx` (+ `.test.tsx` daca util)
- `src/features/client-portal/repeat-order-button.tsx`
- `src/features/client-portal/portal-return-button.tsx` (stub Task F)
- `src/app/(client)/layout.tsx` (adauga `CartProvider`)
- `src/app/(client)/portal/page.tsx` (redirect la `/catalog`)
- `src/app/(client)/catalog/page.tsx`
- `src/app/(client)/comenzile-mele/page.tsx`
- `src/app/(client)/comenzile-mele/[id]/page.tsx`
- `src/app/(client)/comenzile-mele/[id]/certificat/page.tsx`
- `src/app/(client)/documente/page.tsx`

## Ramane de verificat pe DB reala

- Fluxul complet (adauga in cos → trimite comanda → apare in `/comenzile-mele`)
  nu poate fi verificat end-to-end fara Supabase local (Docker blocat in acest mediu);
  verificat static (typecheck/lint/teste) + citire RLS din migrari.
