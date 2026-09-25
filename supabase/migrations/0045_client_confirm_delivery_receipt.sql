-- =============================================================================
-- Portal client: clientul confirma RECEPTIA livrarii comenzii proprii
-- =============================================================================
-- Pana acum receptia (0025: received_at / received_by_name / receipt_notes) era
-- inregistrata doar de staff, in /livrari/[id] (aviz semnat / telefon). Clientul e
-- chiar destinatarul marfii, deci o poate confirma si el din portal.
--
-- `deliveries` ramane RLS doar-staff (vezi 0041): scrierea trece printr-un RPC
-- `security definer` cu autorizare EXPLICITA - acelasi tipar ca
-- `client_order_delivery` / `delete_draft_order`. RPC-ul e si ATOMIC (receptie +
-- `accepted -> delivered` in aceeasi tranzactie), spre deosebire de fluxul staff,
-- care actualizeaza comanda best-effort dupa salvarea receptiei.
--
-- Inchiderea comenzii (-> closed, care emite certificatul) ramane la staff.
--
-- Coduri de eroare:
--   DR001 - comanda inexistenta / a altui client / fara livrare activa
--   DR002 - comanda nu e "accepted"
--   DR003 - receptia e deja confirmata
--   DR004 - numele persoanei care confirma lipseste
-- =============================================================================

alter table public.deliveries
  add column received_via_portal boolean not null default false;

comment on column public.deliveries.received_via_portal is
  'Receptia a fost confirmata de CLIENT din portal (0045, RPC client_confirm_delivery_receipt), nu de staff.';

create or replace function public.client_confirm_delivery_receipt(
  p_order_id         uuid,
  p_received_by_name text,
  p_notes            text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order    public.orders;
  v_delivery public.deliveries;
  v_name     text := nullif(btrim(coalesce(p_received_by_name, '')), '');
begin
  if v_name is null then
    raise exception 'Numele persoanei care confirmă recepția este obligatoriu.'
      using errcode = 'DR004';
  end if;

  -- FOR UPDATE pe comanda (entitatea care isi schimba statusul) - security definer,
  -- deci fara capcana RLS de la 0018; autorizarea e facuta explicit mai jos.
  select * into v_order from public.orders where id = p_order_id for update;

  if v_order.id is null
     or app.role() is distinct from 'client'
     or v_order.client_id is distinct from app.client_id()
     or v_order.deleted_at is not null
     or not app.org_is_active(v_order.organization_id) then
    raise exception 'Comanda nu există sau nu are o livrare planificată.'
      using errcode = 'DR001';
  end if;

  select * into v_delivery
  from public.deliveries
  where order_id = p_order_id and cancelled_at is null
  for update;

  if v_delivery.id is null then
    raise exception 'Comanda nu există sau nu are o livrare planificată.'
      using errcode = 'DR001';
  end if;

  if v_delivery.received_at is not null then
    raise exception 'Recepția acestei livrări a fost deja confirmată.'
      using errcode = 'DR003';
  end if;

  if v_order.status <> 'accepted' then
    raise exception 'Recepția se poate confirma doar pe o comandă confirmată (status curent: %).',
      v_order.status
      using errcode = 'DR002';
  end if;

  update public.deliveries
  set received_at         = now(),
      received_by_name    = v_name,
      receipt_notes       = nullif(btrim(coalesce(p_notes, '')), ''),
      received_via_portal = true
  where id = v_delivery.id;

  update public.orders
  set status = 'delivered', delivered_at = now()
  where id = p_order_id;
end;
$$;

revoke all on function public.client_confirm_delivery_receipt(uuid, text, text) from public;
grant execute on function public.client_confirm_delivery_receipt(uuid, text, text)
  to authenticated, service_role;
