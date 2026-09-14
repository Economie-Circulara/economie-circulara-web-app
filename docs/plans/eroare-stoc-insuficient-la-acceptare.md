# Eroare "stoc insuficient" la acceptarea comenzii - label + CTA

## Context

Userul a raportat mesajul de eroare afisat la acceptarea unei comenzi cand stocul
nu acopera cererea: `Stoc insuficient pentru itemul b84ed006-...: lipsesc 2.000
unitati din 2.000 cerute` - uuid brut, fara nicio actiune sugerata. Discutie: 3
imbunatatiri propuse, aprobate primele doua (a treia - link catre asistentul AI cu
prompt precompletat - ramane pentru mai tarziu).

## Impact asupra asistentului AI (regula 2.4)

**Decizie: `none`.** Schimbarile ating doar mesajul de eroare si UI-ul din
`/comenzi/:id`, nu ating niciun tool din `tools/registry.ts`.

## Implementare

### 1. Label in loc de uuid in mesaj

- `supabase/migrations/0025_insufficient_stock_error_detail.sql`: `create or
  replace function public.consume_fifo(...)` - adauga `detail = p_item_id::text`
  pe `raise exception ... using errcode = 'LT001'`, ca apelantii care nu au deja
  `item_id` in context (accept_order, confirm_process - propaga eroarea din
  `consume_fifo` neschimbata) sa il poata citi din `error.details` fara sa
  parseze textul mesajului.
- `stock/service.ts`: helper nou `buildInsufficientStockError(itemId, qty,
  message)` - rezolva titlul itemului (`getItemById`) si inlocuieste uuid-ul cu
  `"<titlu>"` in mesaj; daca lookup-ul esueaza (item sters/RLS) sau `itemId`
  lipseste, pastreaza mesajul brut. Reutilizat in 3 puncte care arunca
  `InsufficientStockError`: `consumeFIFO` (stock/service.ts, itemId deja
  cunoscut), `acceptOrder`/`cancelOrder` (orders/service.ts, itemId din
  `error.details`), `confirmProcess` (production/service.ts, idem).
- `orders/service.ts`: `throwOrderRpcError` (sincron, `never`) devine
  `orderRpcError` (async, *intoarce* eroarea) - apelantii fac `throw await
  orderRpcError(...)`, pastrand narrowing-ul TS pe `data` dupa if (un `await`
  pe o functie `never` nu mai era recunoscut de TS ca "unreachable dupa").

### 2. CTA "Adaugă stoc" din eroare

- `action-state.ts`: `OrderTransitionState` capata `insufficientStockItemId?:
  string | null`.
- `actions.ts` (`acceptOrderAction`): la `catch`, daca eroarea e
  `InsufficientStockError`, seteaza `insufficientStockItemId: err.itemId ||
  null` pe langa mesaj.
- `order-status-actions.tsx`: cand `insufficientStockItemId` e prezent, afiseaza
  un link "Adaugă stoc pentru acest item" -> `/stoc/nou?item_id=<id>`.
- `/stoc/nou` (page.tsx) + `LotForm`: prop nou `defaultItemId`, citit din
  `searchParams.item_id`, preselecteaza item-ul in formular.

## Teste

- `stock/service.test.ts`: label inlocuit cand item-ul e rezolvabil; mesaj
  brut pastrat cand nu e (item sters/RLS).
- `orders/service.test.ts`: `error.details` (din migrarea 0025) rezolvat la
  titlul itemului in `acceptOrder`.
- `orders/actions.test.ts`: `acceptOrderAction` populeaza
  `insufficientStockItemId` din `InsufficientStockError.itemId`.

## Ramane pentru mai tarziu

Punctul 3 din discutie (link catre `/asistent` cu prompt precompletat din
eroare) - `/asistent` nu are azi suport pentru prompt prefilled din URL.
