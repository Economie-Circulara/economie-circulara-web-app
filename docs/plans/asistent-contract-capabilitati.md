# Plan - contract viu și UX tipat pentru capabilitățile asistentului AI

> Referințe: `src/features/assistant/`, `docs/plans/task-asistent-ai.md` (planul original
> al asistentului), `AGENTS.md` §2.3 (Definition of Done).

## Bug-ul raportat (confirmat în cod, nu doar în UX)

`ActionCard` (`action-card.tsx`) randează **fiecare** câmp al unei propuneri ca
`<Input>` de text, inițializat din `action.fields` (`{name,label,value:string}[]`).
La `creeaza_comanda`, câmpul `linii` e un array serializat de `fields()` ca text
(`"item1 x 2, item2 x 3"`). La "Confirmă", `values` (toate câmpurile, inclusiv cele
neatinse) se trimit ca `overrides: Record<string,string>` către
`confirmAssistantActionAction`, care în `run.ts#confirmAction` face
`{ ...proposal.arguments, ...overrides }` - **suprascrie necondiționat** array-ul
real cu string-ul afișat. `tool.parse` (care cere `Array.isArray(raw.linii)`) aruncă
`InvalidToolArgumentsError`, iar `confirmAction` marchează propunerea **`failed`**
(consumată definitiv - nu se mai poate reîncerca din același card).

Alte două probleme confirmate în cod:
- `fields()` afișează ID-uri brute (`client_id`, `item_id x cantitate`), nu denumiri.
- După `confirmAction`, răspunsul e o linie sintetică (`"Gata: ... Rezultat: {json}"`),
  fără să se mai apeleze modelul - un plan multi-pas ("creează clientul X apoi o
  comandă cu Y") se oprește la primul pas, utilizatorul trebuie să ceară explicit pasul următor.

## Decizii de scop (simplificări asumate față de spec)

1. **Doi rendere, nu unul generic + N bespoke**: `"generic"` (câmpuri tipate -
   text/boolean, editabile sau doar-afișare, cu valoare RESOLVATĂ - nu ID brut) și
   `"order_draft"` (editor structurat, reutilizat de `/comenzi/nou`). Acoperă toate
   cele 3 tool-uri de scriere existente:
   - `creeaza_client` → `generic` (câmpurile text existente + `platitor_tva` ca
     boolean editabil, lipsă azi din `fields()`).
   - `trimite_comanda` → `generic`, UN SINGUR câmp **doar-afișare** cu eticheta
     comenzii rezolvată (număr + client), nu `order_id` brut.
   - `creeaza_comanda` → `order_draft` (singurul care are nevoie structural de o
     listă de linii cu add/remove + select-uri cascadate client→adresă).
2. **Continuarea automată după confirmare rulează DOAR pe furnizorul real**
   (`provider.name !== "mock"`). Motiv: `MockChatProvider` decide ce tool să cheme
   uitându-se la ULTIMUL mesaj `user` (cuvinte cheie) - nu înțelege un rezultat de
   tool și ar produce mereu `MOCK_INTRO` ("Rulez pe furnizorul de test...") ca
   "continuare", o regresie vizibilă față de linia deterministă de azi. Linia
   deterministă de confirmare ("Gata: ...") rămâne mereu prima; continuarea reală
   (text sau propunere nouă) se adaugă DUPĂ, doar cu provider real.
3. **`tool_version` pornește de la 1 pentru toate tool-urile** (nu există o "v1"
   istorică în date - coloana e nouă). Se incrementează manual când schema
   parametrilor sau comportamentul unui tool se schimbă în viitor.
4. **Enforcement-ul "orice tool de scriere declară renderer" e prin test unitar**
   (`registry.test.ts`), nu prin tipuri TypeScript condiționate de `kind` - array-ul
   `ASSISTANT_TOOLS` amestecă read/write într-un singur tip generic
   (`AssistantTool<never>[]`); un discriminated union ar cere restructurarea
   registrului fără beneficiu proporțional.

## Implementare

### 1. `AGENTS.md` - checklist Definition of Done

Adaugă la §2.3 (sau o subsecțiune nouă) obligația: orice task nou verifică explicit
impactul asupra asistentului - `none | read | write`, iar pentru `write`: tool +
renderer + intrare în manual + caz de regresie testat.

### 2. Migrare `0024_assistant_capabilities_contract.sql` (aditivă)

- `assistant_tool_calls`: extinde `check (status in (...))` cu `'executing'` (status
  tranzitoriu, revendicat atomic înainte de execuție - vezi §6).
- `assistant_tool_calls.tool_version integer not null default 1`.
- `assistant_tool_calls.provider_call_id text` - id-ul tool-call-ului dat de
  FURNIZORUL LLM (`ProviderToolCall.id`), necesar pt. a reconstrui perechea de
  mesaje `assistant(tool_calls)`/`tool(result)` la continuarea conversației (§6) -
  azi nu se persistă, doar se folosește efemer în `run.ts`.
- Rulează `pnpm db:reset && pnpm gen:types` (stack local disponibil) - **elimină**
  `src/features/assistant/db.ts` (workaround-ul `any`, lăsat explicit "de șters
  după gen:types" în comentariul original) în favoarea clientului tipat normal.

### 3. Registru de tool-uri → manifest versionat (`tools/types.ts`, `tools/registry.ts`)

- `AssistantTool`: + `version: number`, înlocuiește `fields?(input)` cu
  `presentation?(input, ctx): Promise<CardPresentation>` (poate citi DB - rezolvă
  ID-uri, încarcă opțiuni pt. `order_draft`).
- `CardPresentation` (`tools/presentation-types.ts`):
  ```ts
  type CardPresentation =
    | { renderer: "generic"; fields: PresentationField[] }
    | { renderer: "order_draft"; draft: OrderDraftValue; options: OrderDraftOptions };
  interface PresentationField {
    name: string; label: string; displayValue: string;
    editable: boolean; kind: "text" | "boolean"; value?: string | boolean;
  }
  ```
- Scheme JSON: `additionalProperties: false` pe fiecare obiect (inclusiv `items` din
  `linii`), `minItems`/`maxItems` pe `linii`. Validarea reală rămâne `tool.parse`
  (server-side) - schema e doar ghidaj pt. model.
- `registry.test.ts`: fiecare tool `write` are `renderer`+`presentation`+`summary`
  definite (înlocuiește verificarea veche pe `fields`).

### 4. Editor de comandă partajat (`src/features/orders/order-editor.tsx`, nou)

- Extrage din `OrderForm` un component controlat `OrderEditor` (client select,
  adresă de livrare, dată, note, linii cu add/remove) - `value`/`onChange`, plus
  `nativeFormFields?: boolean` (păstrează `name=...` pe controale pt. submit prin
  `FormData` la `/comenzi/nou`; asistentul citește direct starea controlată, fără
  form nativ).
- `OrderForm` devine un wrapper subțire peste `OrderEditor` (păstrează
  `useActionState`/`createOrderAction`, comportament identic pt. utilizator).
- `creeaza_comanda`: + parametru `adresa_livrare_id` (opțional) → `parse` →
  `createOrderWithItems({ ..., deliveryAddressId })` (parametrul exista deja în
  `CreateOrderInput`, doar nu era expus tool-ului).
- `presentation()` pt. `creeaza_comanda` reutilizează `listClients()`,
  `listClientAddressesGrouped()`, `listSellableItemOptions()` (deja existente,
  folosite azi de pagina `/comenzi/nou`) - zero query-uri noi.

### 5. Card de confirmare tipat (`action-card.tsx` rescris + `order-draft-card.tsx` nou)

- `ActionCard` dispatch pe `presentation.renderer`: `"generic"` → randare per-câmp
  (text editabil / checkbox pt. boolean / text needitabil pt. `editable:false`,
  cu `displayValue` rezolvat); `"order_draft"` → `OrderDraftCard` (folosește
  `OrderEditor` cu `value` inițializat din `draft`, opțiuni din `options`).
- La "Confirmă": overrides devin TIPATE (boolean rămâne boolean, `linii` rămâne
  array) - fixul direct al bug-ului raportat.
- **Eroare recuperabilă, propunere nepierdută**: `AssistantChat#apply` NU
  înlocuiește `pending` orbește - dacă `turn.pendingAction.toolCallId` e IDENTIC cu
  cel curent, păstrează `presentation`-ul local (editările utilizatorului) și
  actualizează doar `error`; cardul (`OrderDraftCard` inclusiv) își ține starea în
  `useState`, montat o singură dată per `toolCallId` (React nu-l remontează).

### 6. Orchestrare: revendicare atomică + continuare automată (`run.ts`, `service.ts`)

- `service.ts#claimProposal(toolCallId)`: `update ... set status='executing' where
  id=? and status='proposed'` (o singură instrucțiune SQL - atomică prin MVCC
  Postgres, fără tranzacție explicită). Întoarce `false` dacă 0 rânduri afectate
  (deja revendicată de o cerere concurentă).
- `confirmAction`: `parse` întâi (eroare → propunerea RĂMÂNE `proposed`, se
  întoarce cardul neschimbat + `error`, FĂRĂ `resolveProposal` - fix pt. "erorile
  de validare consumă propunerea"); apoi `claimProposal` (eșec → mesaj "deja
  procesată", fără execuție dublă); apoi `execute` + `resolveProposal('confirmed')`
  + **continuare** (doar provider real - decizia 2): reconstruiește mesajele
  (`system` + `listMessages` + `assistant(toolCalls:[{id:provider_call_id, ...}])`
  + `tool(result)`) și reapelează `converse()` - răspunsul modelului (text sau
  o nouă propunere) se adaugă după linia deterministă "Gata: ...".
- `provider.ts` (`OpenAiCompatibleProvider`): `parallel_tool_calls: false` în body
  (produsul permite o singură propunere de scriere o dată).
- `prompt.ts`: regulă nouă - după rezultatul unei acțiuni confirmate, continuă
  automat spre obiectivul cerut inițial, fără să aștepte un mesaj nou de la
  utilizator.

## Teste

- `write-tools.test.ts`: schema strictă (`additionalProperties:false`), `linii`
  cu `minItems`, `adresa_livrare_id` opțional trece prin la `createOrderWithItems`.
- `order-editor.test.tsx` (nou, `@testing-library/react`): add/remove linie,
  select client→adresă cascadat.
- `action-card.test.tsx` (nou): câmp boolean → checkbox, overrides tipate; câmp
  needitabil nu produce input; `order_draft` → overrides cu `linii` ca array.
- `run.test.ts`: parse-eroare la confirmare → propunerea rămâne `proposed` +
  `error` întors, fără `resolveProposal`; claim dublu → a doua confirmare
  primește "deja procesată", `execute` chemat o singură dată; continuare cu
  provider real → a doua propunere înlănțuită; provider mock → FĂRĂ apel suplimentar.
- `provider.test.ts`: body-ul cererii conține `parallel_tool_calls: false`.
- `supabase/tests/assistant_rls.sql`: statusul `executing` e acceptat de
  constrângere; un `update ... where status='proposed'` pe un rând deja
  `executing` afectează 0 rânduri (proxy pt. atomicitate, fără concurență reală
  în psql).
- `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`,
  `pnpm db:reset`, `pnpm db:test`, `pnpm db:test:assistant`.

## Documentație

- `docs/manual/utilizare-admin-operator.md` / `utilizare-client.md`: actualizare
  scurtă a secțiunii de asistent (card tipat, adresă de livrare disponibilă la
  comanda propusă de asistent).
- `docs/prompt-log.md`: o intrare per commit (regula 1.2).

---

## Extensie - aport corect + planificarea livrării (AGENTS.md §2.4: `read` + `write`)

### Bug confirmat: `creeaza_comanda` cu `tip_comanda = "aport"`

`presentation()` încărca DOAR `listSellableItemOptions()`, indiferent de tip, iar
`OrderDraftCard` nu trimitea `intakeItemOptions` mai departe către `OrderEditor`. O
comandă de aport propusă cu un item **nevandabil** (ex. moloz - există tocmai ca să fie
ADUS, nu vândut) ajungea într-un card care nu-i știa denumirea (`"-"`, fără UM) și nu-l
mai putea re-adăuga din selector. Fix: `presentation()` încarcă **ambele** cataloage
(`listSellableItemOptions` + `listIntakeItemOptions`, ca `/comenzi/nou`),
`OrderDraftOptions.intakeItemOptions` le duce în card, iar `OrderEditor` comută deja
singur pe tip. Ambele, nu doar cel al tipului propus: tipul e editabil în card.
Regresie: `write-tools.test.ts` - "presentation() trimite si catalogul de APORT".

### Tool-uri noi

| Tool | Rol | Renderer card | Serviciu refolosit |
| --- | --- | --- | --- |
| `itemi_aport` | staff | - (read) | `orders/queries.ts#listIntakeItemOptions` |
| `context_livrare` | staff | - (read) | `routing/site-queries.ts#listSites`, `orders/queries.ts#getOrderDetail`, `deliveries/queries.ts#getDeliveryByOrderId` |
| `planifica_livrare` | staff | `generic` | `deliveries/service.ts#planDelivery`, `routing/route-service.ts#computeRouteBetween` |

- `itemi_aport` completează golul lăsat de `itemi_vandabili` (filtrează `sellable`):
  fără el modelul nu putea afla `item_id`-ul unui item de aport, deci fluxul
  aport nu era parcurgibil cap-coadă.
- `context_livrare` (opțional `order_id`) întoarce punctele de plecare ale
  organizației + starea comenzii: `poate_fi_planificata` aplică aceeași regulă ca
  butonul "Planifică livrare" din `/comenzi/[id]` - status `accepted`
  (`PLANNABLE_ORDER_STATUS`, acum exportată din `deliveries/service.ts`) și fără
  livrare existentă.
- `planifica_livrare(order_id, data_programata, transportator, nr_inmatriculare,
  sofer, punct_plecare_id?, punct_plecare?, punct_sosire?)` → `planDelivery`.
  Câmpurile pe care modelul n-are de unde să le știe se completează ca în
  `/livrari/nou`: punctul de plecare din stația implicită (`getDefaultSite`), cel
  de sosire din adresa de livrare a comenzii. Cardul `generic` le arată editabile,
  cu `order_id` doar-afișare (ca la `trimite_comanda`).

### Decizii de scop (planificarea rutelor, Task X7)

1. **Se expune calculul rutei, NU selecția manuală de variantă.** Cu
   `punct_plecare_id` prezent, `execute` calculează rutele și păstrează varianta
   recomandată (`pickBestRouteIndex` prin `computeRouteBetween`, `selection:
   "auto"`) - exact scopul redus al lui `recalculateDeliveryRoute`. Alegerea
   manuală dintre alternative rămâne în UI (`RoutePreview`, ecranul `/livrari/nou`):
   un card de confirmare cu hartă și N variante ar cere un renderer nou, fără
   beneficiu proporțional.
2. **Calculul rutei e BEST-EFFORT.** Dacă furnizorul nu e configurat
   (`RoutingNotConfiguredError`) sau adresa nu se geocodează, livrarea se
   planifică oricum cu text liber (comportamentul de dinainte de X7), iar motivul
   se întoarce modelului în rezultat (`ruta_calculata`, `ruta_eroare`), ca
   utilizatorul să afle - nu se pierde silențios.
3. **Nu se expun** acceptarea comenzii, declararea e-Transport, confirmarea
   recepției și recalcularea rutei: tranzițiile cu efect de stoc / apelurile către
   ANAF rămân în afara asistentului (regula din `task-asistent-ai.md`).

### Teste

- `read-tools.test.ts`: `itemi_aport` folosește catalogul de aport și filtrează
  după denumire; `context_livrare` - planificabilă / livrare deja existentă /
  status greșit.
- `write-tools.test.ts`: câmpuri obligatorii + format dată; `presentation()`
  completează plecarea/sosirea; `execute()` trimite ruta calculată la
  `planDelivery`; eșecul furnizorului de rute nu blochează planificarea.
- `registry.test.ts`: tool-urile noi apar la staff și NU la rolul `client`.
