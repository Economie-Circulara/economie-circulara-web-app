-- =============================================================================
-- Retur / garantie cerute din portal: `draft -> sent`, acceptate din `sent`
-- =============================================================================
-- Acelasi tipar ca aportul (0042): cererea de retur/garantie creata de CLIENT e,
-- pentru el, trimisa spre aprobare - nu o ciorna. Portalul o trece `draft -> sent`
-- (cu numar); comanda de inlocuire a unei garantii e o vanzare obisnuita si e
-- trimisa la fel. Returul creat de staff se accepta in continuare direct din `draft`.
--
--   1. `accept_return_order` accepta din `draft` SAU `sent` (restul identic cu 0010).
--   2. Garda din 0042 extinsa: nici o comanda-RETUR/GARANTIE acceptata nu se
--      anuleaza (RT005) - si ea a CREAT loturi, iar `cancel_order` reface doar
--      consumul.
-- =============================================================================

create or replace function public.accept_return_order(p_return_order_id uuid)
returns public.orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders;
  v_item  record;
begin
  -- FOR UPDATE: blocheaza randul comenzii-retur pana la commit (ca la accept_order).
  select * into v_order from public.orders where id = p_return_order_id for update;
  if v_order.id is null then
    raise exception 'Comanda-retur inexistenta sau fara acces: %', p_return_order_id
      using errcode = 'RT002';
  end if;

  if not app.is_staff_of(v_order.organization_id) then
    raise exception 'Doar personalul poate accepta o comanda-retur.'
      using errcode = 'RT004';
  end if;

  if not exists (
    select 1 from public.order_links
    where linked_order_id = p_return_order_id
      and link_type in ('return', 'warranty')
  ) then
    raise exception 'Comanda % nu este o comanda-retur (fara legatura return/warranty).',
      p_return_order_id
      using errcode = 'RT003';
  end if;

  -- 0044: si din `sent` - cererea de retur/garantie trimisa din portalul clientului.
  if v_order.status not in ('draft', 'sent') then
    raise exception 'Comanda-retur % nu poate fi acceptata din statusul % (trebuie sa fie "draft" sau "sent").',
      p_return_order_id, v_order.status
      using errcode = 'RT001';
  end if;

  -- FOR UPDATE pe order_items: blocheaza liniile pe durata acceptarii.
  for v_item in
    select item_id, quantity
    from public.order_items
    where order_id = p_return_order_id
    for update
  loop
    -- Un lot nou per linie returnata, proveniență 'return' (AGENTS.md: materialele
    -- intra in stoc la acceptarea manuala a returului). `quality_status = 'passed'`:
    -- acceptarea presupune ca inspectia (facuta de staff inainte de a apasa butonul)
    -- a validat deja materialul - daca inspectia respinge materialul, staff-ul pur
    -- si simplu nu accepta returul (nu exista inca un flux de retur partial-respins,
    -- in afara scope-ului Task F).
    perform public.create_lot(
      p_item_id        => v_item.item_id,
      p_quantity       => v_item.quantity,
      p_provenance     => 'return'::public.lot_provenance,
      p_source         => null,
      p_entry_date     => null,
      p_location       => null,
      p_quality_status => 'passed'::public.quality_status,
      p_reason         => 'Acceptare retur ' || coalesce(v_order.order_number, p_return_order_id::text)
    );
  end loop;

  update public.orders set status = 'accepted' where id = p_return_order_id returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.accept_return_order(uuid) from public;
grant execute on function public.accept_return_order(uuid) to authenticated, service_role;

create or replace function app.reject_accepted_intake_cancel()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'accepted' and new.status = 'cancelled' then
    if old.order_type = 'aport' then
      raise exception 'Un aport acceptat nu poate fi anulat: materialul a intrat deja in stoc.'
        using errcode = 'AP005';
    end if;
    if exists (
      select 1 from public.order_links l
      where l.linked_order_id = old.id and l.link_type in ('return', 'warranty')
    ) then
      raise exception 'Un retur acceptat nu poate fi anulat: produsele au intrat deja in stoc.'
        using errcode = 'RT005';
    end if;
  end if;
  return new;
end;
$$;
