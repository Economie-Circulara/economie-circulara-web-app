# Asistent AI - actiuni noi cu card de confirmare (PR 3)

Cerut: asistentul sa poata face mai mult decat „client nou / comandă nouă / trimite /
planifică livrare” - editare client, acceptare/anulare comenzi, produse, retete,
productie. Construit peste `docs/plans/asistent-performanta-part2.md` (PR #54).

## Impact asupra asistentului (regula 2.4)

Decizie: `write` + `read`. Toate apeleaza SERVICIILE existente (aceleasi ca UI-ul),
pe sesiunea utilizatorului (RLS neschimbat), roluri `admin`/`operator`.

| Tool | Tip | Card | Serviciu |
| ---- | --- | ---- | -------- |
| `listeaza_comenzi` | read | - | `listOrders` (+ cautare toleranta) |
| `reteta_produs` | read | - | `getRecipeByItemId` (arhivatele = `null`) |
| `accepta_comanda` | write | generic (efect pe stoc explicit) | `acceptOrder` + `onOrderStatusChanged`; aport -> `acceptIntakeOrder` |
| `anuleaza_comanda` | write | generic | `cancelOrder` + `onOrderStatusChanged` |
| `sterge_ciorna` | write | generic | `deleteDraftOrder` |
| `anuleaza_livrare` | write | generic (motiv editabil) | `cancelDelivery` |
| `editeaza_client` | write | generic (valori finale editabile) | `updateClientRecord` |
| `creeaza_item` | write | generic | `createItem` |
| `editeaza_item` | write | generic | `updateItem` (fara `imageUrl` - poza neatinsa) |
| `arhiveaza` | write | generic | `setClientArchived` / `setItemArchived` / `setRecipeArchived` |
| `creeaza_reteta` | write | **dedicat `recipe_draft`** (lista materii prime + procente) | `createRecipe` + `addOrUpdateComponents` |
| `porneste_productie` | write | generic (consum calculat + FIFO, doar afisare) | `confirmProcess` (`output_fixed`) |

## Decizii

- **Acceptarea comenzii se poate face din asistent** (inainte era exclusa explicit in
  system prompt). Cardul spune ca stocul scade; prompt-ul cere sa fie propusa doar la
  cererea explicita a utilizatorului. Regula adaugata in AGENTS.md §4.
- **Productia din asistent = doar „cantitate fixa de produs”** (reteta de compunere).
  Consumul se calculeaza din reteta si se aloca FIFO, recalculat la confirmare.
  Descompunerea cere cantitatile REALE rezultate (masurate dupa proces) -> ramane in
  `/productie/nou`.
- **Fara stergere fizica** - `arhiveaza` (reversibil); restaurarea ramane in UI (read
  tool-urile nu vad arhivatele).
- Editarile (`editeaza_*`) primesc doar campurile schimbate; cardul arata valorile
  finale (vechi + propuse), editabile.

## Teste

`order-write-tools.test.ts`, `catalog-write-tools.test.ts`, `production-tools.test.ts`,
`recipe-draft-card.test.tsx`, `registry.test.ts` (roluri + randere declarate).

## Manual

`docs/manual/utilizare-admin-operator.md` §13 - tabel cu actiunile posibile.
