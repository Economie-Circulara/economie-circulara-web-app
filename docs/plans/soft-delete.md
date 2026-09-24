# Arhivare / ștergere logică (soft-delete)

> Plan scris conform regulii 1.1 din [`AGENTS.md`](../../AGENTS.md). Lista de
> entități și comportamentul fiecăreia au fost aprobate de utilizator înainte de
> implementare.

## Problema

Utilizatorii nu pot șterge nimic creat din greșeală (un material cu titlu greșit, o
ciornă de comandă, un lot introdus de două ori, un client duplicat, un operator
plecat din firmă). O ștergere fizică ar rupe trasabilitatea: loturile, comenzile,
rețetele și certificatele referă itemii/clienții, iar `stock_events` e audit
append-only.

## Soluția - comportament per entitate

| Entitate                      | Comportament                                                                                                                                                                                                                        | De ce                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| items (Materiale/servicii)    | **Arhivare** (`archived_at`, `archived_by`), reversibilă ("Restaurează"). Ascunse din lista `/itemi` (comutator "Arată arhivate") și din TOATE selecturile. Paginile de istoric le afișează în continuare.                         | referite de loturi, comenzi, rețete                    |
| recipes (rețeta întreagă)     | **Arhivare**, același tipar; o rețetă arhivată (sau a unui item arhivat) nu mai poate fi folosită în producție.                                                                                                                     | azi se puteau șterge doar componente                   |
| clients                       | **Arhivare** + blocarea logării utilizatorului-client legat; restaurarea îl deblochează.                                                                                                                                           | comenzile/certificatele rămân                          |
| orders - DOAR `draft`         | **Ștergere logică** (`deleted_at`), ascunse peste tot (prin RLS).                                                                                                                                                                  | anularea există deja pentru stările ulterioare         |
| lots introduse din greșeală   | **"Anulează lotul"** doar dacă nu s-a consumat nimic: eveniment de corecție în `stock_events`, `remaining_qty = 0`, lot marcat anulat.                                                                                             | auditul de stoc nu se șterge niciodată                 |
| deliveries                    | **Anulare înainte de plecare** = nedeclarată la e-Transport (fără UIT) și fără recepție confirmată. Ascunsă prin RLS; comanda poate fi replanificată.                                                                             | `deliveries` nu are status propriu - vezi mai jos      |
| users (profiles, staff)       | **Dezactivare** (`profiles.status = 'suspended'`, coloană existentă din 0001). Utilizatorul dezactivat nu se mai poate loga; adminul îl poate reactiva. Adminul nu se poate dezactiva singur.                                      | sunt autori în audit                                   |
| NICIODATĂ ștergibile          | `stock_events`, certificate, procese confirmate/finalizate, comenzi livrate/închise - nu se adaugă nicio cale nouă.                                                                                                                 | trasabilitate                                          |

### "Înainte de plecare" la livrări

`deliveries` nu are o coloană de status. Stările reale sunt: planificată
(`declaration_status` = `not_declared`/`failed`, fără UIT) -> declarată la
e-Transport (`declared`, cod UIT = transportul e legal pe drum) -> recepționată
(`received_at`). Anularea e permisă doar în prima stare.

## DB - migrarea `0035_soft_delete.sql`

> Paralel pot exista alte PR-uri cu o migrare `0035` - la merge poate fi nevoie de
> renumerotare.

- `items`/`recipes`/`clients`: `archived_at`, `archived_by` (FK `profiles`), index
  parțial pe rândurile active; trigger `app.stamp_archive` completează `archived_by`
  din `auth.uid()` (nu din input). Doar staff-ul are politici de scriere pe aceste
  tabele (clientul are doar SELECT), deci clientul nu poate arhiva/restaura.
- A doua linie de apărare (`app.reject_archived_references`, erori `AR001`/`AR002`):
  nu se pot adăuga itemi arhivați în rețete noi / componente noi / comenzi ale
  clientului, și nu se poate porni un proces cu o rețetă arhivată. Deliberat NU pe
  `lots`/`order_items` de staff: retururile unui item deja arhivat trebuie să poată
  intra în stoc.
- `orders`: `deleted_at`, `deleted_by`. Politica `orders_staff_all` spartă pe
  operații; SELECT/UPDATE cer `deleted_at is null`, iar WITH CHECK pe UPDATE cere
  `deleted_at is null` => singura cale de ștergere e RPC-ul
  `delete_draft_order(p_order_id)` (security definer, verifică explicit staff +
  `status = 'draft'`, eroare `OD001`). Clientul: aceleași politici + `deleted_at is null`.
- `lots`: `cancelled_at`, `cancelled_by`, `cancel_reason`; RPC `cancel_lot(p_lot_id,
  p_reason)` (security invoker, ca `set_lot_block`). Refuză: lot deja anulat
  (`LT007`), lot consumat (`LT008` - `remaining_qty <> initial_qty`, input de proces
  sau orice eveniment în afară de intrare/blocare/deblocare), lot născut dintr-un
  flux - output de proces, retur, aport (`LT009`). Scrie un eveniment `adjustment`
  cu `-initial_qty`. Trigger `app.guard_lot_cancellation`: coloanele de anulare se
  scriu doar prin RPC (`LT010`), iar un lot anulat nu-și mai schimbă cantitatea.
- `deliveries`: `cancelled_at`, `cancelled_by`, `cancel_reason`; `unique(order_id)`
  devine index unic PARȚIAL pe livrările active; politica FOR ALL spartă (ascunde
  anulatele); RPC `cancel_delivery(p_delivery_id, p_reason)` (security definer,
  `DL001` dacă a plecat, `DL002` inexistentă, `DL003` fără motiv).
- `profiles`: trigger `app.enforce_profile_deactivation` (`US001` - nu te poți
  dezactiva singur); trigger `app.sync_client_profile_status` pe `clients`:
  arhivarea clientului => profilul client `suspended`, restaurarea => `active`.
- `app.role()` redefinită: întoarce `null` pentru un profil `suspended` sau pentru
  un utilizator-client al unui client arhivat => toate politicile RLS care cer un
  rol cad automat (a doua linie, ca `app.org_is_active` din 0012). Propriul profil
  rămâne citibil (pagina "cont dezactivat").

## Aplicație

- `src/components/confirm-action-button.tsx` - dialog de confirmare reutilizabil
  (Radix Dialog), text românesc simplu, câmp opțional de motiv; folosit de TOATE
  acțiunile distructive noi.
- items: `archiveItem`/`restoreItem` (service + actions), `listItems({ includeArchived })`,
  `listItemOptions` exclude arhivatele, badge "Arhivat" în tabel, comutator
  "Arată arhivate" pe `/itemi`, butoane pe `/itemi/[id]`.
- Toate selecturile filtrate: `listSellableItemOptions`, `listIntakeItemOptions`,
  catalogul clientului (`client-portal/queries.ts`), stoc nou
  (`stock/queries.ts#listItemOptions({ activeOnly })`), producție (rețete + itemi),
  rețete (`listPhysicalItemsWithoutRecipe`, componente), căutarea globală. Filtrele
  de istoric (`/stoc`, `/stoc/audit`) păstrează și itemii arhivați.
- recipes: `archiveRecipe`/`restoreRecipe`, `listRecipes({ includeArchived })`
  (rețeta e "arhivată" și când itemul ei e arhivat), `RecipeDetail.archivedAt`;
  producția (`getRecipeForItem`) refuză o rețetă arhivată.
- clients: `archiveClient`/`restoreClient`, `listClients({ includeArchived })`,
  comutator pe `/clienti`, butoane pe `/clienti/[id]`.
- orders: `deleteDraftOrder` (RPC), buton "Șterge ciorna" pe `/comenzi/[id]` (doar
  draft), redirect la `/comenzi`. Garda de server `assertActiveOrderReferences`
  (în `createOrderWithItems`/`updateOrder`) refuză un client/item arhivat trimis
  direct prin ID (formular vechi, asistent); ecranul de editare avertizează când o
  ciornă veche folosește referințe arhivate.
- rapoarte/dashboard: loturile anulate nu intră în raportul de materiale
  reintegrate și nici în stocul din dashboard.
- lots: `cancelLot` (RPC), buton "Anulează lotul" (cu motiv) pe `/stoc/loturi/[id]`,
  afișat doar când lotul e anulabil (regula pură `canCancelLot` în `stock/cancel.ts`,
  testată); badge "Anulat"; loturile anulate nu mai apar în lista de stoc disponibil.
- deliveries: `cancelDelivery` (RPC), buton "Anulează livrarea" (cu motiv) pe
  `/livrari/[id]` doar înainte de plecare (`canCancelDelivery`, testată).
- users: `deactivateUserAction`/`reactivateUserAction` pe `/setari/utilizatori`
  (doar admin, doar staff, nu pe sine); plus ban în Supabase Auth (best-effort) ca
  logarea să fie refuzată direct.
- Gardă de sesiune: `profiles.status = 'suspended'` => middleware + `requireUser`
  redirecționează la `/cont-dezactivat` (pagină nouă, cu delogare), la fel ca
  `/organizatie-suspendata`.
- `database.types.ts` actualizat manual (gen:types necesită Docker).

## Impactul asupra asistentului AI (regula 2.4)

- **Decizia: `read` (doar excludere), fără capabilitate nouă.**
- Tool-urile de citire (`listeaza_clienti`, `itemi_vandabili`, `itemi_aport`,
  `cauta`, `stoc_disponibil`) și cataloagele din `creeaza_comanda` merg prin
  aceleași interogări partajate (`listClients`, `listItems`,
  `listSellableItemOptions`, `listIntakeItemOptions`, `globalSearch`, `listLots`),
  care acum exclud implicit arhivatele / loturile anulate - deci asistentul nu mai
  poate propune comenzi pe itemi/clienți arhivați. Ciornele șterse și livrările
  anulate sunt ascunse prin RLS, deci invizibile și pentru asistent.
- **NU** se adaugă tool-uri de scriere pentru arhivare/ștergere/anulare/dezactivare:
  sunt operații distructive de întreținere, rare, care trebuie făcute conștient din
  UI (cu dialogul de confirmare), nu propuse de model. Registrul de tool-uri rămâne
  neschimbat.
- Test de regresie: `read-tools.test.ts` verifică faptul că tool-urile de catalog
  cer interogările fără arhivate (fără `includeArchived`).

## Teste

- Unitare: servicii (arhivare/restaurare/ștergere/anulare cu RPC mock-uit), reguli
  pure (`canCancelLot`, `canCancelDelivery`, `canDeactivateUser`), acțiuni (roluri,
  validări), `ConfirmActionButton`, garda de sesiune.
- SQL: `supabase/tests/business_flow.sql` B15-B21 (arhivare + AR001/AR002, ștergere
  ciornă + RLS, anulare lot + audit, anulare livrare + replanificare, dezactivare +
  RLS, arhivare client + blocare utilizator).

## Manual

`docs/manual/utilizare-admin-operator.md` (arhivare, ștergere ciornă, anulare lot,
anulare livrare) și `docs/manual/ghid-administrare.md` (dezactivare utilizatori).
