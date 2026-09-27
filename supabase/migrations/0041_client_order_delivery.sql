-- =============================================================================
-- Portal client: detaliile LIVRARII unei comenzi proprii
-- =============================================================================
-- Problema: in /comenzile-mele/[id] clientul vedea doar adresa/data din comanda,
-- nu si livrarea planificata de staff - `deliveries` are RLS DOAR pentru staff
-- (0013, 0035), deci orice citire a clientului intorcea 0 randuri.
--
-- De ce RPC si nu o politica de SELECT pe `deliveries`: RLS filtreaza RANDURI, nu
-- coloane. O politica de client ar expune tot randul prin Data API - erori de
-- declarare e-Transport, geometria/alternativele rutei, punctul de plecare intern,
-- notele de receptie. RPC-ul intoarce DOAR ce e util clientului: data programata,
-- transportatorul, vehiculul, soferul, destinatia, codul UIT (documentul de
-- transport) si confirmarea receptiei.
--
-- Autorizare explicita (security definer => RLS NU se aplica in corp):
--   - apelantul e client activ (`app.role() = 'client'` - null pt. profil
--     suspendat / client arhivat, 0035);
--   - comanda e a firmei lui (`client_id = app.client_id()`), nestearsa, intr-o
--     organizatie activa (aceleasi conditii ca `orders_client_select`);
--   - livrarea e ACTIVA (`cancelled_at is null`).
-- Altfel: 0 randuri (fara eroare - nu dezvaluie existenta comenzii altcuiva).
-- =============================================================================

create or replace function public.client_order_delivery(p_order_id uuid)
returns table (
  scheduled_date    date,
  carrier_name      text,
  vehicle_plate     text,
  driver_name       text,
  route_destination text,
  uit_code          text,
  received_at       timestamptz,
  received_by_name  text
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.scheduled_date, d.carrier_name, d.vehicle_plate, d.driver_name,
         d.route_destination, d.uit_code, d.received_at, d.received_by_name
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
