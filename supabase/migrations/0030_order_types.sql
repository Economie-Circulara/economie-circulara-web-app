-- =============================================================================
-- Task X8 - Tipuri explicite de comanda (material / serviciu / aport)
-- =============================================================================
-- Migrare aditiva peste schema inghetata din 0001_core_schema.sql. Adauga:
--
--   1. enum nou `public.order_type` + coloana `orders.order_type` (NOT NULL)
--   2. coloana `lots.client_id` (FK nullable spre `clients`) - trasabilitatea
--      materialului adus de un client (aport), inexistenta pana acum
--   3. valoare noua in enum-ul existent `lot_provenance`: 'aport_client'
--
-- De ce (2026-09): pana acum "serviciul" exista DOAR la nivel de linie
-- (`items.kind = 'service'`), iar eligibilitatea de retur era pur statusuala
-- (orice comanda `delivered`/`closed`). Nu exista NICIUN mod prin care un client
-- sa aduca material CATRE organizatie (ex. moloz pentru reciclare) - intrarea in
-- stoc se facea doar din formularul manual, fara nicio legatura cu clientul.
--
-- Semantica celor trei tipuri:
--   material - vanzare clasica, sens organizatie -> client. Scade stocul la
--              acceptare (`accept_order` -> `consume_fifo`).
--   serviciu - inchiriere / product-as-a-service. Singurul tip pentru care
--              `expected_return_date` (coloana existenta din 0001, pana acum
--              inaccesibila din UI) are sens si poate fi completata.
--   aport    - sens INVERS: client -> organizatie (client aduce material).
--              CRESTE stocul la acceptare (`accept_intake_order`, migrarea 0031).
--
-- NOTA enum (vezi 0008_reconditioning.sql): `alter type ... add value` e permis
-- intr-o migrare tranzactionala ATATA TIMP CAT valoarea noua NU e FOLOSITA ca
-- literal in aceeasi tranzactie. Aici 'aport_client' e doar ADAUGATA; prima
-- folosire (`accept_intake_order`, care scrie literalul) sta in migrarea
-- SEPARATA 0031, aplicata dupa ce aceasta a fost deja comisa.
-- Enum-ul `order_type` e in schimb CREAT aici, deci literalul 'material' poate fi
-- folosit imediat (restrictia priveste doar valorile adaugate la un enum
-- preexistent).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. orders.order_type
-- -----------------------------------------------------------------------------
create type public.order_type as enum (
  'material', -- vanzare de bunuri fizice, organizatie -> client (sensul clasic)
  'serviciu', -- inchiriere / PaaS: bunul se intoarce (vezi expected_return_date)
  'aport'     -- client -> organizatie: material adus de client (ex. moloz)
);

-- DEFAULT 'material' are DOUA roluri, ambele deliberate:
--   a) BACKFILL: toate comenzile existente preced acest concept si sunt, prin
--      ipoteza documentata cu utilizatorul, vanzari simple de material.
--   b) COMPATIBILITATE: insert-urile care nu trec prin `createOrderWithItems`
--      (seed-uri, teste SQL, comenzile-retur/inlocuire create de
--      features/returns/service.ts) nu se rup la adaugarea coloanei NOT NULL.
-- UI-ul de creare (order-editor.tsx) cere TOTUSI o alegere explicita - default-ul
-- din DB e o plasa de siguranta, nu comportamentul asteptat al aplicatiei.
alter table public.orders
  add column order_type public.order_type not null default 'material';

comment on column public.orders.order_type is
  'Tipul comenzii: material (vanzare, org -> client, scade stocul), serviciu '
  '(inchiriere/PaaS - singurul tip cu expected_return_date), aport (client -> org, '
  'creste stocul la acceptare prin accept_intake_order). Vezi migrarea 0030.';

-- Filtrare/rapoarte pe tip, in acelasi stil ca `orders_status_idx` (0001).
create index orders_order_type_idx on public.orders (organization_id, order_type);

-- -----------------------------------------------------------------------------
-- 2. lots.client_id - trasabilitate "cine a adus materialul"
-- -----------------------------------------------------------------------------
-- Nullable si populata DOAR pe loturile create la acceptarea unei comenzi de tip
-- `aport` (migrarea 0031). Toate celelalte cai de creare a unui lot (achizitie,
-- productie interna, reciclare, recondiționare, retur, ajustare de inventar) o
-- lasa `null` - achizitia are furnizor (text liber in `source`), nu client, iar
-- returul are deja clientul prin comanda originala (`order_links`).
--
-- `on delete restrict` (ca `orders.client_id` din 0001): un client care a adus
-- material in stoc nu poate fi sters fara a rupe trasabilitatea lotului.
alter table public.lots
  add column client_id uuid references public.clients (id) on delete restrict;

comment on column public.lots.client_id is
  'Clientul care a adus materialul, DOAR pentru loturile din acceptarea unei '
  'comenzi de tip aport (provenance = aport_client). Null pentru orice alta '
  'provenienta. Vezi migrarea 0030.';

create index lots_client_id_idx on public.lots (client_id) where client_id is not null;

-- -----------------------------------------------------------------------------
-- 3. lot_provenance: 'aport_client'
-- -----------------------------------------------------------------------------
-- Distincta de 'purchase' (achizitie de la FURNIZOR, fara legatura cu un client)
-- si de 'return' (marfa care se INTOARCE dintr-o vanzare a organizatiei):
-- 'aport_client' = material pe care clientul il ADUCE pentru prima data in stoc.
alter type public.lot_provenance add value 'aport_client';
