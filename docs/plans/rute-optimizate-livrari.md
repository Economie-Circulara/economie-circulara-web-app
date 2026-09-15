# Plan - planificare optimizată a rutelor de livrare (preview hartă + ruta recomandată)

> Referințe: răspunsul SKETON la scrisoarea de clarificări nr. 1/31905/AM/07.09.2026
> (proiect SMIS 350456, beneficiar MACON XCX SRL), `docs/anexa-1-specificatii-tehnice.md`,
> `docs/analiza-conformitate-anexa.md`, `docs/plans/task-x5-livrari-etransport.md`,
> [[eu-funding-annex-compliance]].

## Context

AM a cerut justificarea a 5 caracteristici funcționale minime din Planul de afaceri al
beneficiarului. Răspunsul trimis le-a legat de Anexa 1 și a amânat detalierea în „etapele
de analiză, proiectare și dezvoltare” (art. 2.3 din contract). Asta înseamnă că la
verificarea următoare trebuie să **existe în aplicație** ceva demonstrabil pentru fiecare.

| # | Caracteristica cerută | Ce avem | Ce trebuie |
|---|---|---|---|
| 1 | Monitorizarea fluxului de producție a betonului din deșeuri | Procese de producție (`processes` + intrări/ieșiri pe loturi), rețete | Nimic nou - **monitorizare manuală** (operatorul înregistrează etapele). De documentat maparea |
| 2 | Monitorizarea colectării deșeurilor | Loturi de intrare cu `source` (furnizor), clienți `is_supplier`, certificate de trasabilitate | Nimic nou - manual. De documentat |
| 3 | Monitorizarea procesării deșeurilor (sortare, tratare, reciclare) | Procese de transformare, recondiționare, blocare loturi | Nimic nou - manual. De documentat |
| 4 | Monitorizarea livrării + **confirmarea recepției de către client** | Livrări (X5), status comandă `delivered`, aviz PDF | **Gap mic:** nu există confirmare a recepției (vezi Etapa 5) |
| 5 | **Planificare inteligentă: optimizarea rutelor** + cicluri de retur/reutilizare | Livrări cu rută text liber (`route_origin`/`route_destination`), retururi (Task F) | **Gap real:** nu există nicio optimizare de rută - obiectul acestui plan |

## Obiectiv

La planificarea unei livrări, aplicația calculează automat **1-3 rute alternative** între
punctul de plecare (stația/depozitul organizației) și adresa de livrare a comenzii, le
afișează pe o hartă Google, marchează **ruta recomandată** („cea mai bună”) și salvează
pe livrare ruta aleasă + alternativele (dovadă auditabilă a planificării optimizate).

Nu construim un VRP (optimizare de flotă multi-vehicul) - ar fi disproporționat față de
activitate. Optimizarea multi-stop pe zi/vehicul e o etapă opțională (Etapa 6).

## Decizii (de confirmat)

1. **Furnizor: Google Maps Platform** - Routes API (`computeRoutes` cu
   `computeAlternativeRoutes: true`, `routingPreference: TRAFFIC_AWARE`) + Geocoding API.
   Motiv: cerut explicit, calitate bună a datelor RO, alternative out-of-the-box.
   *Limitare:* Google nu are profil de camion (tonaj/gabarit). Dacă restricțiile de
   tonaj contează pentru autobetoniere, alternativa este HERE Routing v8 (mod `truck`).
   Ca la e-Transport, integrarea stă în spatele unei interfețe (`RoutingProvider`), cu
   `MockRoutingProvider` implicit (teste, dev, preview fără cheie) - schimbarea
   furnizorului nu atinge UI-ul.
   *Termenii Google:* rezultatele Routes API se afișează doar pe hartă Google (nu Leaflet/OSM).
2. ~~**Afișare hartă: Maps Static API servit printr-un route handler propriu**~~ -
   **Actualizare (2026-09-15):** imaginea statică a fost înlocuită cu o hartă interactivă
   client-side (Leaflet + tile-uri OpenStreetMap, `features/routing/route-map.tsx`), exact
   upgrade-ul anticipat mai jos. Motive: (a) rutele reale (Google Routes API) au polilinii cu
   sute/mii de puncte - URL-ul Maps Static depășea des limita de 8192 caractere și harta
   lipsea silențios; (b) editarea adresei cerea un nou apel server ca să vezi din nou harta -
   clunky. Datele (polilinii deja decodabile client-side) vin oricum în răspunsul serverului
   (`RouteChoiceView.polyline`), deci nu mai era nevoie de un round-trip separat pt. imagine.
   Decizia de cheie server-only rămâne validă - Leaflet/OSM nu cere nicio cheie API.
3. **Criteriul „cea mai bună”:** durata estimată cu trafic la data programată (plecare
   implicită 08:00 ora României), la egalitate (±5%) câștigă distanța mai mică. Operatorul
   poate alege altă rută; se salvează motivul selecției (`auto` / `manual`).
4. **Punctul de plecare:** tabel nou `organization_sites` (stații de betoane / depozite,
   mai multe per organizație, unul implicit) - același pattern ca `client_addresses`.
5. **Costuri:** volumul estimat (zeci de livrări/zi per tenant) ar trebui să intre în
   pragurile gratuite lunare per SKU - **de verificat** SKU-ul exact pentru alternative
   + trafic înainte de activare. Rezultatele se salvează pe livrare, deci o rută se
   calculează o singură dată (plus recalculare explicită).
6. **Adrese structurate, nu doar text liber** (decizie luată în discuția de planificare,
   legată de e-Transport/Socrate.io): `client_addresses` și `organization_sites` capătă
   componente separate (județ/cod județ, localitate, stradă, număr, cod poștal) pe lângă
   câmpul `address` (text liber, păstrat pt. afișare/aviz). Motiv dublu - geocodarea e mai
   fiabilă pe componente, iar o viitoare declarație e-Transport prin Socrate.io (S4, încă
   nerezolvat) cere probabil adresă structurată, nu text liber. Maparea exactă pe
   nomenclatorul ANAF rămâne de confirmat la S4 - `county_code` e ținut generic până atunci.
7. **Datele de rutare sunt recalculabile, nu permanente.** Coordonatele și geometria rutei
   provin de la Google și intră sub limitări de reținere din termenii platformei (verifică
   termenii curenți înainte de activare). Păstrăm permanent doar ce ține de audit (ce
   variantă s-a ales, când, automat/manual, distanță, durată) - `route_polyline`/
   `route_alternatives` sunt un instantaneu înlocuibil oricând printr-un recalcul
   („Recalculează” în UI), nu un istoric imuabil.

## Etape

### Etapa 1 - Model de date (migrare aditivă `0020_route_planning.sql`)

- `organization_sites`: `id`, `organization_id`, `name`, `address`, `lat`, `lng`,
  `is_default`, timestamps. RLS: staff al organizației (ca `client_addresses_staff_all`),
  guard pe organizație suspendată (pattern 0014/0016).
- `client_addresses`: + `lat numeric(9,6)`, `lng numeric(9,6)`, `geocoded_at timestamptz`
  (nullable - adresele existente se geocodează la prima utilizare).
- `deliveries`: + `origin_site_id` (FK nullable), `route_distance_m int`,
  `route_duration_s int`, `route_polyline text` (encoded), `route_alternatives jsonb`
  (toate variantele calculate: distanță, durată, polilinie, etichetă), `route_selected_index smallint`,
  `route_selection` (`auto`|`manual`), `route_computed_at timestamptz`.
  `route_origin`/`route_destination` (text) rămân - le folosește avizul PDF și e-Transport.
- Actualizare `database.types.ts`.

### Etapa 2 - Adapter de rutare (`src/features/routing/`)

- `provider.ts`: interfața `RoutingProvider { geocode(address), computeRoutes({ origin, destination, departureTime }) }`,
  `GoogleRoutingProvider` (fetch către Routes API v2 + Geocoding, cu field mask minimal),
  `MockRoutingProvider` (rute deterministe din coordonate), `getRoutingProvider()` pe env
  `ROUTING_PROVIDER` (`mock` implicit) + `GOOGLE_MAPS_API_KEY` (doar server).
- `rank.ts`: funcție pură `rankRoutes(routes) -> { ranked, bestIndex }` cu criteriul din
  decizia 3 - **teste unitare** (egalități, o singură rută, zero rute, toleranța de 5%).
- `static-map.ts`: construiește URL-ul Maps Static (markere origine/destinație, polilinii,
  culori: recomandată = culoarea primară a tenantului, alternative = gri) - teste pe URL.
- Erori tipate (`RoutingNotConfiguredError`, `AddressNotFoundError`) → mesaje RO în UI.

### Etapa 3 - Setări: puncte de plecare

- `/setari` → secțiune „Puncte de plecare” (stații/depozite): listă + adăugare/editare,
  geocodare la salvare, marcare implicit. Reutilizează componentele din
  `features/clients/address-section.tsx` unde se poate.

### Etapa 4 - UI rute

- **Componentă `RoutePreview`** (`features/routing/route-preview.tsx`): imaginea hărții +
  lista variantelor (distanță km, durată, badge „Recomandată”), selecție radio opțională.
- **Detaliu comandă** (`/comenzi/[id]`, comandă cu adresă de livrare): card „Rută estimată”
  read-only (stația implicită → adresa comenzii), calculat on-demand.
- **Planificare livrare** (`/livrari/nou`): selector punct de plecare (implicit preselectat),
  destinația precompletată din adresa comenzii, buton „Calculează rute” → `RoutePreview`
  cu selecție; la submit se salvează varianta aleasă + toate alternativele.
  `route_origin`/`route_destination` se completează automat din site/adresă (editabile).
- **Detaliu livrare** (`/livrari/[id]`): harta rutei alese + distanță/durată + „Recalculează”.
- Route handler `/livrari/[id]/harta` (și un echivalent pentru preview-ul pe comandă) care
  proxy-ază imaginea Static Maps (cheia nu ajunge în HTML). Verificare RLS: doar staff.
- Fără cheie configurată: mock în dev; în producție mesaj „Planificarea rutelor nu este
  configurată” - formularul de livrare funcționează în continuare manual.

### Etapa 5 - Confirmarea recepției (gap #4, mic)

- Pe livrare: `received_at`, `received_by_name` (numele persoanei care a recepționat),
  `receipt_notes`. Acțiune „Confirmă recepția” pentru staff (înregistrare manuală, ex. după
  aviz semnat) și, opțional, pentru client în portal (`/comenzile-mele/[id]`).
- Afișare în detaliul comenzii/livrării și în certificat/rapoarte unde are sens.
- De decis: e plan separat (`docs/plans/confirmare-receptie.md`) sau intră aici.

### Etapa 6 (opțional, întărește #5) - Planificarea zilei pe vehicul

- Ecran `/livrari/planificare?data=...`: livrările unei zile grupate pe `vehicle_plate`;
  pentru un vehicul cu mai multe opriri (inclusiv ridicări de retur - ciclul PaaS),
  Routes API cu `intermediates` + `optimizeWaypointOrder: true` propune ordinea optimă.
- Relevant mai ales pentru prefabricate (mai multe opriri/cursă); la betonul marfă o
  cursă e de regulă stație → șantier → stație. Decidem după Etapa 4.

### Etapa 7 - Documentație & conformitate

- `docs/analiza-conformitate-anexa.md`: secțiune nouă cu maparea celor 5 caracteristici
  din scrisoarea de clarificări → module/ecrane (tabelul din Context, actualizat).
- Manual utilizator (`docs/manual/`): planificarea rutelor + confirmarea recepției, cu capturi.
- `.env.example`: `ROUTING_PROVIDER`, `GOOGLE_MAPS_API_KEY`.
- `AGENTS.md`: regula „rezultatele Google Routes se afișează doar pe hartă Google”.

## Verificări

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (rank, static-map URL, service cu provider mock).
- `pnpm db:reset` + `pnpm db:test` (RLS pe `organization_sites` și coloanele noi).
- E2E: planificare livrare cu `ROUTING_PROVIDER=mock` - rute afișate, recomandata
  preselectată, selecție manuală salvată.
- Test manual cu cheie reală Google pe 2-3 adrese din județul Iași.

## Întrebări deschise

- Google vs HERE (profil camion) - contează restricțiile de tonaj pentru MACON? (implementăm
  cu Google acum, adapterul e înlocuibil - vezi Etapa 2)
- Cine deține contul Google Cloud / facturarea (noi per platformă sau fiecare tenant cu cheia
  lui)? - implicit: o cheie la nivel de platformă (`GOOGLE_MAPS_API_KEY`), de revizuit dacă
  volumul unui tenant depășește pragurile gratuite.

## Status implementare

- ✅ Etapa 1 (model de date): migrare `0024_route_planning.sql` + `database.types.ts`
  regenerat cu `pnpm gen:types` (stack local Supabase disponibil în acest mediu).
- ✅ Etapa 2 (adapter de rutare): `src/features/routing/` - provider Google/mock,
  clasificare rute, URL hartă statică, encoder/decoder polilinie.
- ✅ Etapa 3 (puncte de plecare): CRUD `organization_sites` + ecran `/setari/statii`.
- ✅ Etapa 4 (UI rute) + ✅ Etapa 5 (confirmarea recepției) - implementate ÎMPREUNĂ
  (ambele mici, aceeași zonă de ecran): `/livrari/nou` (selector punct de plecare +
  "Calculează rute" + selecție variantă), `/livrari/[id]` (hartă + distanță/durată +
  "Recalculează" + confirmare recepție), coloană "Rută" în `/livrari`. Verificat
  manual în browser, end-to-end, cu `ROUTING_PROVIDER=mock` (planificare cu selecție
  manuală a alternativei + recalculare cu auto-selecție + confirmare recepție -
  toate persistă corect).
  **Simplificare asumată:** cardul "Rută estimată" read-only pe `/comenzi/[id]`
  (menționat inițial la Etapa 4) NU a fost construit - planificarea/afișarea rutei
  rămâne la nivelul livrării (unde există deja transportul), nu al comenzii;
  recalcularea de pe `/livrari/[id]` nu oferă un pas de reselecție manuală (alege
  automat cea mai rapidă variantă) - dacă se dorește alt transportator/rută dupa
  recalculare, se poate replanifica manual câmpurile text.
- Etapa 6 (planificarea zilei pe vehicul) rămâne opțională/follow-up, neinclusă în acest pas.
- ✅ Etapa 7 (documentație): `docs/analiza-conformitate-anexa.md` (secțiune nouă §4 -
  maparea celor 5 caracteristici), `docs/manual/utilizare-admin-operator.md` (secțiunea
  9 rescrisă cu pașii reali din UI, înlocuind avertismentul "în curs de implementare"
  rămas de la Task X5), `AGENTS.md` (regula Google Maps: rezultate afișate doar pe
  hartă Google, cheia nu ajunge în browser), `.env.example` (deja la Etapa 2),
  `docs/plans/implementation-plan.md` (rând nou X7 în tabelul de tracking).
- Adresele structurate (decizia 6) NU au fost expuse în UI (nici la `client_addresses`,
  nici la `organization_sites`) - geocodarea folosește exclusiv câmpul `address` (text
  liber) în acest pas; coloanele structurate rămân pregătite (nullable) pt. o viitoare
  nevoie reală (formular structurat sau cerință exactă de la Socrate.io/S4).
