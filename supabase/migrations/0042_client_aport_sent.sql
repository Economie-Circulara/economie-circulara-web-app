-- =============================================================================
-- Aport trimis din portal: `draft -> sent`, acceptat din `sent`
-- =============================================================================
-- Problema (2026-09-25): cererea de aport creata de client din /aport-nou ramanea
-- `draft` ("Ciornă") - si pentru client, si pentru staff - desi pentru client e
-- TRIMISA spre aprobare. Acum portalul o trimite (`draft -> sent`, cu numar de
-- comanda), exact ca o comanda din catalog.
--
--   1. `accept_intake_order` accepta din `draft` (aport creat de staff) SAU `sent`
--      (aport trimis din portal). Restul corpului e identic cu 0031.
--   2. Garda noua (AP005): un aport ACCEPTAT nu se poate anula. `cancel_order`
--      reface doar CONSUMUL de stoc (evenimente `consumption`), dar aportul a
--      CREAT loturi - anularea l-ar marca "Anulat" cu materialul inca in stoc.
--      UI-ul nu ofera butonul; garda acopera Data API si asistentul
--      (`anuleaza_comanda`). Trigger pe `orders`, nu o modificare a lui
--      `cancel_order`, ca sa prinda orice cale de scriere.
--
-- RLS-ul clientului permitea deja `draft -> sent` pe orice tip de comanda
-- (`orders_client_update`, 0035) - nicio schimbare de politici.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. accept_intake_order - draft|sent -> accepted
-- -----------------------------------------------------------------------------
create or replace function public.accept_intake_order(p_order_id uuid)
returns public.orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders;
  v_item  record;
begin
  -- FOR UPDATE: blocheaza randul comenzii pana la commit (ca la accept_order).
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Comanda inexistenta sau fara acces: %', p_order_id
      using errcode = 'AP002';
  end if;

  if not app.is_staff_of(v_order.organization_id) then
    raise exception 'Doar personalul poate accepta un aport.'
      using errcode = 'AP004';
  end if;

  if v_order.order_type <> 'aport' then
    raise exception 'Comanda % nu este de tip aport (tip curent: %).',
      p_order_id, v_order.order_type
      using errcode = 'AP003';
  end if;

  -- 0042: si din `sent` - aportul trimis din portalul clientului (draft -> sent
  -- la trimitere, ca orice comanda de client); `draft` ramane pt. aportul creat
  -- de staff, acceptat direct.
  if v_order.status not in ('draft', 'sent') then
    raise exception 'Aportul % nu poate fi acceptat din statusul % (trebuie sa fie "draft" sau "sent").',
      p_order_id, v_order.status
      using errcode = 'AP001';
  end if;

  -- FOR UPDATE pe order_items: blocheaza liniile pe durata acceptarii.
  for v_item in
    select item_id, quantity
    from public.order_items
    where order_id = p_order_id
    for update
  loop
    perform public.create_lot(
      p_item_id        => v_item.item_id,
      p_quantity       => v_item.quantity,
      p_provenance     => 'aport_client'::public.lot_provenance,
      p_source         => null,
      p_entry_date     => null,
      p_location       => null,
      p_quality_status => 'unchecked'::public.quality_status,
      p_reason         => 'Acceptare aport ' || coalesce(v_order.order_number, p_order_id::text),
      p_client_id      => v_order.client_id
    );
  end loop;

  -- `accepted_at` se seteaza (ca in accept_order, 0015) - e momentul intrarii
  -- efective a materialului in stoc. Comanda-aport se opreste AICI: nu intra in
  -- traseul sent -> delivered -> closed (nu se livreaza nimic clientului), exact
  -- ca o comanda-retur acceptata prin `accept_return_order`.
  update public.orders
  set status = 'accepted', accepted_at = now()
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.accept_intake_order(uuid) from public;
grant execute on function public.accept_intake_order(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. Garda: aportul acceptat nu se anuleaza (AP005)
-- -----------------------------------------------------------------------------
create or replace function app.reject_accepted_intake_cancel()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.order_type = 'aport' and old.status = 'accepted' and new.status = 'cancelled' then
    raise exception 'Un aport acceptat nu poate fi anulat: materialul a intrat deja in stoc.'
      using errcode = 'AP005';
  end if;
  return new;
end;
$$;

create trigger orders_reject_accepted_intake_cancel
  before update of status on public.orders
  for each row execute function app.reject_accepted_intake_cancel();
