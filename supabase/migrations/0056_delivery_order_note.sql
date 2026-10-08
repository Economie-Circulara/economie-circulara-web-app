-- =============================================================================
-- 0056 - Avizul livrarii tine loc de „nota de comanda”
-- =============================================================================
-- Decizie 2026-10-08 (intalnirea cu Macon XCX, docs/plans/macon-documente-comanda.md):
-- nota de comanda nu are forma fixa; avizul generat din livrare o inlocuieste, cu
-- ce lipsea: ora livrarii (inceperea turnarii la beton), pomparea si observatii
-- libere. Toate optionale - livrarile existente raman valide.
--
-- Clientul primeste in plus ora si pomparea prin RPC-ul `client_order_delivery`
-- (0041: tabelul `deliveries` ramane RLS doar-staff; orice camp nou expus clientului
-- trece prin RPC). Observatiile livrarii raman interne.
-- =============================================================================

alter table public.deliveries
  add column scheduled_time time,
  add column pumping text,
  add column notes text;

comment on column public.deliveries.scheduled_time is
  'Ora livrarii / inceperii turnarii (optional). Apare pe aviz langa data.';
comment on column public.deliveries.pumping is
  'Pomparea, text liber (ex. „Pompa furnizor 36 m”, „Pompa beneficiar”). Apare pe aviz si in portal.';
comment on column public.deliveries.notes is
  'Observatii libere ale livrarii, preluate pe aviz. Interne - nu se expun in portal.';

-- Tipul intors se schimba, deci functia se recreeaza (create or replace nu poate
-- schimba coloanele unui `returns table`).
drop function public.client_order_delivery(uuid);

create function public.client_order_delivery(p_order_id uuid)
returns table (
  scheduled_date    date,
  scheduled_time    time,
  carrier_name      text,
  vehicle_plate     text,
  driver_name       text,
  route_destination text,
  pumping           text,
  uit_code          text,
  received_at       timestamptz,
  received_by_name  text
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.scheduled_date, d.scheduled_time, d.carrier_name, d.vehicle_plate, d.driver_name,
         d.route_destination, d.pumping, d.uit_code, d.received_at, d.received_by_name
  from public.deliveries d
  join public.orders o on o.id = d.order_id
  where d.order_id = p_order_id
    and d.cancelled_at is null
    and app.role() = 'client'
    and o.client_id = app.client_id()
    and o.deleted_at is null
    and app.org_is_active(o.organization_id)
$$;

revoke all on function public.client_order_delivery(uuid) from public;
grant execute on function public.client_order_delivery(uuid) to authenticated, service_role;
