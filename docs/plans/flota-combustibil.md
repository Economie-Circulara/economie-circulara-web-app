# Plan: Module per organizatie + modulul „Flotă” (consum combustibil)

Status: **in lucru** (2026-10-10) - etapa 1 (module per organizatie) implementata.

## Context / nevoia

Etora vrea sa stie cat combustibil consuma fiecare comanda transportata cu masinile
proprii, ca sa-si ajusteze pretul (in afara platformei). Ceilalti tenanti nu au
nevoie de asta, deci functionalitatea e un **modul activabil per organizatie**.

Decizii luate cu Bogdan (2026-10-10):

| # | Intrebare | Decizie |
|---|-----------|---------|
| 1 | Pret pe comanda? | **Informativ.** Platforma ramane fara preturi pe comenzi (regula „fara bani/facturare”). Afisam litri estimati per comanda. |
| 2 | Bazin propriu sau benzinarie? | **Benzinarie** -> jurnal de alimentari per vehicul, cu bon atasat (optional). Fara mini-stoc de motorina. |
| 3 | Km dus sau dus-intors? | **Dus-intors**, bifa bifata implicit, debifabila. |
| 4 | Pret motorina in estimare? | **Doar volum (litri)** in v1. Alimentarea are camp optional „suma platita” = portita pt. cost mai tarziu. |
| 5 | Real vs. estimat? | **Doar estimat** (km × consum). Kilometrajul la alimentare ramane optional. |
| 6 | Consum | **O singura valoare** L/100 km per vehicul. |
| 7 | Aport / preluari | Transportul poate fi facut cu **flota proprie SAU de altcineva** - si la livrari, si la aport. Daca e extern, nu calculam nimic. |
| 8 | Mai multe comenzi pe cursa | **Nu acum**: o comanda = un transport. |
| 9 | Transportator extern | Ramane posibil, **fara cost estimat**; transportator / nr. inmatriculare / sofer devin **optionale** pe livrare. |
| 10 | Sofer | **Text liber optional** (pe vehicul ca implicit + pe livrare). |
| 11 | Utilaje (concasor, excavator) | **Mai tarziu.** |
| 12 | Asistent AI | **read + write**. |

## Partea 1 - Module per organizatie (feature flags)

- Migrarea `0055_org_modules.sql`: `organizations.enabled_modules text[] not null
  default '{}'`, CHECK ca fiecare valoare e in lista cunoscuta (`'fleet'`).
- Doar super-adminul o schimba: extindem `app.enforce_platform_managed_org_fields()`
  (0045/0046) cu `enabled_modules` (altfel `organizations_update` din 0001 ar lasa
  adminul organizatiei sa-si activeze singur module).
- Helper DB `app.org_has_module(org_id uuid, module text) returns boolean`
  (security definer, stable) - folosit in RLS-ul tabelelor modulului.
- Cod: `src/features/modules/` - `MODULES` (cheie -> eticheta RO), `hasModule(org, key)`,
  `requireModule(key)` pt. rute/server actions (404 / redirect daca e dezactivat).
- UI super-admin: sectiune „Module” in `/platform/<id>` (comutatoare).
- Meniu: `NavItem.module?: ModuleKey`; itemul apare doar daca modulul e activ.
  Se adauga in `STAFF_NAV` **si** `STAFF_NAV_FLUX` (testul `nav-config.test.ts`).
- Dezactivarea unui modul **ascunde**, nu sterge datele (reactivarea le readuce).

## Partea 2 - Modulul „Flotă”

### Date (migrarea `0056_fleet.sql`)

`vehicles`
- `name` (obligatoriu, ex. „Camion 1” / cod intern), `consumption_l_per_100km`
  numeric > 0 (obligatoriu).
- Optionale: `plate`, `vehicle_type` (text), `capacity` + `capacity_unit`,
  `default_driver_name`, `fuel_type` (text), `notes`.
- `archived_at` / `archived_by` (arhivare reversibila, ca `items`; pickerele
  filtreaza `archived_at is null`). Plate unic per organizatie cand e completat.

`fuel_entries` (jurnalul de alimentari)
- `vehicle_id`, `filled_at` (data), `liters` > 0 (obligatoriu).
- Optionale: `amount` (suma platita, RON - portita pt. cost), `odometer_km`,
  `station`, `notes`, `receipt_path` (bon in Storage, imagine/PDF, max 4MB -
  regula de upload prin server action), `created_by`.
- Corectii: doar prin editare (nu se sterg).

`fleet_trips` (estimarea per comanda - sursa unica pt. rapoarte)
- `order_id` (unic pe trip-urile active - o comanda = un transport), `vehicle_id`,
  `delivery_id` nullable (null la aport), `kind` (`delivery` | `intake`).
- `distance_one_way_m`, `round_trip boolean default true`,
  `consumption_l_per_100km` = **instantaneu** al consumului vehiculului la planificare
  (editarea ulterioara a vehiculului nu rescrie istoricul).
- `estimated_liters` = coloana generata:
  `distance_one_way_m / 1000 * (case round_trip then 2 else 1) * consumption / 100`.
- `cancelled_at` (se anuleaza odata cu livrarea - `cancel_delivery`).

RLS pe toate trei: `app.is_staff_of(organization_id) and app.org_has_module(organization_id, 'fleet')`.
Clientul nu vede nimic din flota.

### Livrari (modificari)

- `deliveries.carrier_name`, `vehicle_plate`, `driver_name` devin **nullable**
  (pentru toti tenantii, la cererea lui Bogdan).
- e-Transport: validarea mutata la **declarare** - fara nr. inmatriculare
  declararea pica cu mesaj clar (salvat in `declaration_error`, re-incercabil).
- Formular `/livrari/nou` (cand modulul e activ): selector „Transport”:
  - **Flota proprie** -> dropdown vehicul; nr. inmatriculare si soferul se
    precompleteaza din vehicul (editabile), transportatorul = organizatia; bifa
    „Dus-întors” (implicit bifata); calculul de ruta devine necesar ca sa avem km
    (fara ruta calculata -> camp manual „km dus”).
  - **Transportator extern** -> campurile text optionale, ca acum; fara trip.
- La planificare cu flota proprie se creeaza `fleet_trips` in aceeasi operatie
  (RPC `plan_delivery_with_trip` sau insert secvential + compensare - de decis la
  implementare; preferat RPC pt. atomicitate). „Recalculează ruta” actualizeaza si
  `distance_one_way_m` al trip-ului.
- Pe `/livrari/[id]` si `/comenzi/[id]`: „Vehicul X · 2 × 42 km · ~25 L estimat”.

### Aport (preluare de la client)

- Pe pagina unei comenzi-aport (`sent`/`accepted`, modul activ): sectiune
  „Transport” - flota proprie (vehicul + km client -> statie, calcul cu
  `RoutingProvider` din adresa comenzii catre `organization_sites` implicit,
  dus-intors implicit) sau „adus de client / extern” (nimic de calculat).
- Nu atinge fluxul `intake` (draft -> sent -> accepted), nu creeaza livrare.

### Ecrane noi

- `/flota` - lista vehicule (+ „Arată arhivate”), creare/editare/arhivare.
- `/flota/[id]` - detaliu: date vehicul, alimentari, transporturi, totaluri pe
  perioada (litri alimentati vs. litri estimati pe comenzi - informativ).
- `/flota/alimentari` (sau tab) - jurnal global + „Adaugă alimentare” (cu bon).
- Raport „Combustibil per comanda” (perioada, vehicul): comanda, client, km,
  litri estimati; export CSV ca rapoartele existente.

### Asistent AI (regula 2.4) - decizie: **read + write**

Tool-urile apar doar daca modulul e activ pe organizatia userului (registrul
filtreaza dupa rol **si** modul - extindere `toolsForRole`).
- read `flota_vehicule` - vehicule active + consum.
- read `flota_consum` - litri estimati pe comenzi / alimentari pe o perioada,
  optional pe vehicul ori comanda.
- write `adauga_alimentare` - card `"generic"`: vehicul (nume rezolvat), data,
  litri, suma (optional), km bord (optional). Fara bon (bonul se adauga din UI).
- write `adauga_vehicul` - card `"generic"`: nume, consum, nr. inmatriculare,
  sofer implicit.
- Test de regresie propunere -> confirmare -> executie pt. fiecare write.
- Manual: `docs/manual/` - pagina „Flotă și combustibil”.

## Etape (fiecare = commit/PR coerent)

1. Module per organizatie (migrare, helper, `/platform/<id>`, meniu, teste).
2. Livrari: campuri optionale + validare e-Transport la declarare.
3. Flota: vehicule + alimentari (migrare, ecrane, bon in Storage, teste).
4. Trip-uri: livrare cu vehicul + aport cu transport propriu + afisare estimare.
5. Raport combustibil + tool-uri asistent + manual.

Teste: unitare colocate pt. calcul (`estimatedLiters`), servicii, gating de modul;
`supabase/tests/business_flow.sql` pt. trip la planificare/anulare + RLS cu modul
dezactivat (`rls_isolation.sql`).

## Decizii suplimentare (2026-10-10)

- **Vehicule si alimentari: admin SI operator** le adauga/editeaza. Arhivarea
  vehiculului: tot staff-ul (reversibila, ca la `items`).
- **Alimentarile nu se sterg, se corecteaza prin editare** (`updated_at` /
  `updated_by` pastrate pe rand).
- **Capacitatea** (cat poate cara vehiculul, ex. 20 t sau 15 mc) e optionala si doar
  informativa: numar + UM din lista `t` / `mc` / `kg` / `l`. Nu intra in calcule.
