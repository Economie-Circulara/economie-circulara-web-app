# Task X5 — Livrări, avize & integrare e-Transport

> Referinte: `docs/plans/implementation-plan.md` (secțiunea Task X5, spike S4),
> `docs/analiza-conformitate-anexa.md` §3 (e-Transport, GPS v2), AGENTS.md.

## Context

Livrările de agregate/beton intră sub RO e-Transport (ANAF). Integrarea reală se
face prin **Socrate.io** (furnizor terț plătit, spike S4) — la data acestui task
S4 **nu e rezolvat** (fără acces API/credențiale). Scopul: construi TOATĂ
infrastructura (livrări + aviz + adapter), cu Socrate.io ca **adapter mock/sandbox
implicit**, în spatele unei interfețe, gata de înlocuire cand vin credențialele.

## Ce s-a construit

1. **Migrare `supabase/migrations/0013_deliveries.sql`** (aditivă, exclusiv aceasta):
   - enum `delivery_declaration_status` (`not_declared|declared|failed`)
   - tabel `deliveries`: `order_id` (unique — o comandă are cel mult o livrare,
     AGENTS.md §4 "fără livrări parțiale"), `scheduled_date`, `carrier_name`,
     `vehicle_plate`, `driver_name`, `route_origin`, `route_destination`,
     `uit_code`, `declaration_status`, `declaration_error`, timestamps.
   - **Design v2 GPS**: `vehicle_plate` e câmp de sine stătător (nu îngropat în
     `carrier_name`) — cheia naturală pt. un viitor serviciu de monitorizare GPS
     (fie match pe `vehicle_plate`, fie un tabel `vehicles`/`delivery_tracking`
     nou cu FK către `deliveries.id` — comentat în migrare).
   - RLS: doar staff (`deliveries_staff_all`, ca `orders_staff_all`).
   - **Aviz PDF: NU stocat** — randat ON-DEMAND la fiecare descărcare (nu extindem
     `document_owner_type` cu `delivery`, nu adăugăm bucket nou) — evită riscul unui
     PDF stocat cu UIT vechi după o re-încercare de declarare.

2. **Adapter e-Transport** (`src/features/deliveries/e-transport.ts`):
   - interfață `ETransportProvider { declare(input): Promise<{ uit: string }> }`
   - `MockETransportProvider` (implicit, cazul actual): UIT fals determinist
     (`MOCK-UIT-<hash>`), logat, fără rețea.
   - `SocrateETransportProvider` (schelet): citește `SOCRATE_API_URL`/`SOCRATE_API_KEY`
     din env; aruncă `ETransportNotConfiguredError` cât timp lipsesc (cazul actual).
   - Selecție: `getETransportProvider()`, env `ETRANSPORT_PROVIDER` (`mock` implicit,
     `socrate` pt. a activa stub-ul).

3. **Flux + UI**:
   - `src/features/deliveries/service.ts`: `planDelivery` (validare + insert, doar
     pe comenzi `accepted`, o singură livrare/comandă), `declareETransport`
     (apelează adapterul, salvează UIT sau `failed`+`declaration_error`,
     idempotent pe succes, re-încercabil pe eșec), `renderAvizPdfBuffer`.
   - Ecrane: `/livrari` (listă), `/livrari/nou?orderId=...` (formular planificare,
     redirect la succes), `/livrari/[id]` (detaliu + panou declarare/reîncercare +
     link descărcare aviz), `/livrari/[id]/aviz` (route handler, streaming PDF).
   - Detaliul comenzii (`/comenzi/[id]`): buton „Planifică livrare" (comandă
     acceptată, fără livrare) sau „Vezi livrare" (deja planificată) — singura
     editare pe acel fișier.
   - Nav: „Livrări" în `STAFF_NAV` (icon `Truck`).

## Ce rămâne pentru S4 (Socrate.io)

- Completarea `SocrateETransportProvider.declare` cu payload-ul REAL + parsarea
  răspunsului, conform contractului Socrate.io (necunoscut încă).
- Setarea `ETRANSPORT_PROVIDER=socrate` + `SOCRATE_API_URL`/`SOCRATE_API_KEY` în
  `.env` producție, după obținerea accesului API/sandbox.
- Validarea end-to-end cu un cod UIT real (sandbox Socrate.io), nu doar mock.

## Verificări

- `pnpm typecheck`, `pnpm lint`, `pnpm test` — vezi raportul final al task-ului.
- Nu s-a putut rula `pnpm db:reset`/`pnpm gen:types` (fără Docker/Supabase local în
  acest mediu) — migrarea urmează stilul 0007/0009/0010/0011 (revizuită manual);
  tipurile din `database.types.ts` sunt adăugate manual, în stilul `certificate_counters`.

## Incertitudini / decizii asumate

- O comandă are **cel mult o livrare** (unique `order_id`) — dedus din regula
  "fără livrări parțiale" (AGENTS.md §4); dacă se dorește re-planificare (schimbare
  transportator), ar trebui adăugat un flux de editare/anulare a livrării (în afara
  scope-ului acestui task).
- RLS `deliveries` e **doar staff** — clientul NU vede livrările proprii în acest
  task (nu a fost cerut explicit); poate fi adăugat separat (portal client).
- Nu s-a atins `document_owner_type`/bucket de storage — aviz generat mereu live.
