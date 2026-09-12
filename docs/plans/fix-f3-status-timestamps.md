# Fix F3 (review) — Timestamp-uri per tranzitie de status pe comenzi

> Plan scris inainte de codare (AGENTS.md §1.1). Scope: migrarea
> `supabase/migrations/0015_order_status_timestamps.sql`, `src/features/orders/**`
> (doar setarea timestamp-urilor pe tranzitii, fara schimbari de masina de stari),
> `src/features/reports/**`, `src/lib/database.types.ts` (doar cele 3 coloane noi pe
> `orders`). NU ating: alte migrari, `rls_isolation.sql`, settings, search, CI,
> notifications, `docs/plans/implementation-plan.md`.

## 1. Problema (finding F3 de review)

`orders` nu are timestamp per tranzitie de status — doar `created_at`/`updated_at`
(generice) + `delivery_date` (data PLANIFICATA, optionala, introdusa manual la
creare). Rapoartele (`src/features/reports/calculations.ts#resolveDeliveryReferenceDate`)
aproximau "livrat in perioada" cu `delivery_date ?? updated_at` — imprecis:
`updated_at` se schimba la orice tranzitie ulterioara (ex. `delivered -> closed`),
nu doar la momentul livrarii.

## 2. Migrarea 0015 (aditiva)

- 3 coloane noi, nullable, pe `orders`: `accepted_at`, `delivered_at`, `closed_at`.
  Nullable pentru ca istoricul existent (comenzi deja acceptate/livrate/inchise
  inainte de migrare) nu poate primi o valoare retroactiv corecta — ramane `null`,
  iar rapoartele cad pe vechea aproximare pentru acele randuri (fallback explicit,
  nu eliminat).
- `create or replace function public.accept_order` — corp IDENTIC cu
  `0007_orders_ops.sql#accept_order` (aceleasi verificari OR001/OR002/OR004,
  acelasi `FOR UPDATE`, aceeasi bucla `consume_fifo`), SINGURA schimbare fiind
  `update ... set status = 'accepted', accepted_at = now() ...` in UPDATE-ul
  final. Nicio logica de FIFO/rollback atinsa.
- `cancel_order` ramane NESCHIMBAT — anularea nu e o tranzitie de timeline
  pozitiva, nu are coloana proprie de timestamp (decizie explicita din task).

## 3. Aplicatie — delivered/closed (fara RPC dedicat)

`delivered`/`closed` sunt tranzitii "plain" (fara efecte de stoc), facute direct
prin `UPDATE` in `src/features/orders/service.ts#setOrderStatus` (apelat din
`deliverOrderAction`/`closeOrderAction` in `actions.ts`, prin `runPlainTransition`,
care valideaza deja masina de stari inainte de a apela `setOrderStatus`). Fix:
`setOrderStatus` adauga `delivered_at`/`closed_at` (`new Date().toISOString()`) in
acelasi `UPDATE`, in functie de statusul tinta — fara sa schimbe validarea sau
tranzitiile permise.

## 4. Rapoarte

`resolveDeliveryReferenceDate` devine `deliveredAt ?? deliveryDate ?? updatedAt`
(prioritate pe momentul real al tranzitiei, cu acelasi fallback ca inainte pentru
istoricul fara `delivered_at`). `repository.ts#fetchDeliveredOrdersWithItems` aduce
si `delivered_at`; `types.ts#DeliveredOrderInput` primeste campul `deliveredAt`.
Raportul 2 (Livrari) si latura "livrat" a Raportului 5 (PaaS) devin mai exacte
pentru comenzile livrate DUPA aceasta migrare.

Nota: `dashboard-queries.ts#getDashboardKpis` ("Livrate luna curenta") foloseste
tot `updated_at` ca aproximare si NU a fost atins in acest fix (nu a fost cerut
explicit in scope) — ramane un follow-up posibil, documentat aici pentru
continuitate (acelasi tip de imprecizie, aceeasi solutie: `delivered_at` cu
fallback).

## 5. Teste

- `orders/service.test.ts` — `setOrderStatus` seteaza `delivered_at`/`closed_at`
  doar pentru statusurile respective, neschimbat pentru alte statusuri.
- `reports/calculations.test.ts` — `resolveDeliveryReferenceDate` prioritizeaza
  `deliveredAt`, cade pe `deliveryDate`, apoi pe `updatedAt`.
  `filterDeliveredOrdersInRange` verifica aceeasi prioritate.
- `reports/repository.test.ts` — `fetchDeliveredOrdersWithItems` aduce si mapeaza
  `delivered_at` -> `deliveredAt`.
