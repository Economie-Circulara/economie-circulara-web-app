-- =============================================================================
-- Task X5 — Livrari, avize & integrare e-Transport
-- =============================================================================
-- Migrare aditiva peste schema inghetata din 0001_core_schema.sql (NU modifica
-- niciun tabel/enum existent). Adauga:
--
--   public.delivery_declaration_status -> enum ('not_declared' | 'declared' | 'failed')
--   public.deliveries                  -> planificarea livrarii unei comenzi ACCEPTATE
--                                          (transportator, vehicul, sofer, ruta) +
--                                          starea declaratiei RO e-Transport (cod UIT)
--
-- Context (docs/analiza-conformitate-anexa.md §3.1, docs/plans/implementation-plan.md
-- Task X5): livrarile de agregate/beton intra sub RO e-Transport (ANAF). Fluxul:
-- comanda acceptata -> planificare livrare -> generare aviz PDF -> declarare
-- e-Transport (prin adapterul din src/features/deliveries/e-transport.ts, Socrate.io
-- ca furnizor tert — spike S4, credentiale INCA indisponibile, vezi acel fisier) ->
-- cod UIT stocat pe livrare + pe aviz.
--
-- Aviz PDF: NU extindem enum-ul `document_owner_type` (T1.1: 'client'|'order'|'item')
-- cu o valoare noua ('delivery') — varianta explicit lasata deschisa in
-- analiza-conformitate-anexa.md §3.1 ("fie extinderea enum-ului cu delivery, fie
-- coloana proprie de path pe deliveries"). Am ales sa NU stocam deloc PDF-ul in
-- Storage: continutul avizului (in special cod UIT / status declaratie) se poate
-- schimba dupa generare (re-incercare declarare), deci PDF-ul se randeaza ON-DEMAND
-- la fiecare descarcare (vezi src/app/(admin)/livrari/[id]/aviz/route.ts), mereu cu
-- datele curente — fara risc de PDF stocat cu UIT vechi/gresit. Simplifica si migrarea
-- (fara bucket nou de storage).
--
-- RLS: DOAR staff (admin/operator) al organizatiei, ca la orders_staff_all — planificarea
-- livrarii + declararea e-Transport sunt operatiuni interne, nu expuse portalului
-- client in acest task (X5 nu cere vizibilitate client; poate fi adaugata separat).
--
-- Nota design v2 (GPS, docs/analiza-conformitate-anexa.md §3.2): `vehicle_plate`
-- (nr. inmatriculare) e cheia naturala de legatura livrare <-> transport/vehicul —
-- un viitor serviciu de monitorizare GPS a flotei se poate lega de `deliveries` fie
-- prin `vehicle_plate` (match text, cel mai simplu), fie printr-un tabel nou
-- `vehicles`/`delivery_tracking` cu FK explicit catre `deliveries.id`. Nu adaugam
-- acum acele structuri (in afara scope-ului X5) — doar pastram `vehicle_plate` ca
-- un camp de sine statator (nu inglobat in `carrier_name`), usor de indexat/legat
-- ulterior.
-- =============================================================================

create type public.delivery_declaration_status as enum (
  'not_declared', -- inca nedeclarata la e-Transport (livrare planificata, fara UIT)
  'declared',     -- declaratie reusita, cod UIT disponibil
  'failed'        -- ultima incercare de declarare a esuat (vezi declaration_error) — re-incercabila
);

create table public.deliveries (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  -- O singura livrare per comanda (AGENTS.md §4: "Fara livrari partiale") — planificarea
  -- unei a doua livrari pe aceeasi comanda e respinsa de constrangerea unique de mai jos;
  -- service.ts (`planDelivery`) verifica explicit si intoarce o eroare de business clara
  -- inainte de a lovi constrangerea (acelasi pattern ca `certificates` unique(order_id)).
  order_id              uuid not null references public.orders (id) on delete cascade,
  scheduled_date        date not null,               -- data programata a livrarii
  carrier_name          text not null,                -- transportator
  vehicle_plate         text not null,                -- nr. inmatriculare vehicul (cheie v2 GPS, vezi nota de mai sus)
  driver_name           text not null,                -- sofer
  route_origin          text not null,                -- ruta: punct de plecare (text liber)
  route_destination     text not null,                -- ruta: punct de sosire (text liber)
  uit_code              text,                          -- cod UIT (RO e-Transport) — null pana la declarare reusita
  declaration_status    public.delivery_declaration_status not null default 'not_declared',
  declaration_error     text,                          -- mesajul ultimei erori de declarare (null daca declared/not_declared)
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (order_id)
);

create index deliveries_organization_id_idx on public.deliveries (organization_id);
create index deliveries_order_id_idx on public.deliveries (order_id);
create index deliveries_declaration_status_idx on public.deliveries (organization_id, declaration_status);

create trigger deliveries_touch_updated_at before update on public.deliveries
  for each row execute function app.touch_updated_at();

alter table public.deliveries enable row level security;

-- Doar staff (admin/operator) al organizatiei, sau super-admin — acelasi model ca
-- `orders_staff_all`/`certificates_staff_all` (0001_core_schema.sql). Fara politica de
-- client in acest task (vezi nota RLS de mai sus).
create policy deliveries_staff_all on public.deliveries
  for all using (app.is_staff_of(organization_id))
  with check (app.is_staff_of(organization_id));

grant select, insert, update on public.deliveries to authenticated;
grant select, insert, update on public.deliveries to service_role;
