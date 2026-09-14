-- -----------------------------------------------------------------------------
-- Adauga item_id ca DETAIL structurat pe exceptia LT001 (stoc insuficient) din
-- consume_fifo, ca apelantii care nu au deja item_id in context (accept_order,
-- confirm_process - vezi 0007/0008) sa poata rezolva un label prietenos pentru
-- eroare, fara sa parseze textul mesajului.
-- -----------------------------------------------------------------------------

create or replace function public.consume_fifo(
  p_item_id        uuid,
  p_qty            numeric,
  p_manual_lot_ids uuid[] default null,
  p_event_type     public.stock_event_type default null,
  p_order_id       uuid default null,
  p_process_id     uuid default null,
  p_reason         text default null
)
returns table (lot_id uuid, qty numeric)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org         uuid;
  v_remaining   numeric;
  v_take        numeric;
  v_event_type  public.stock_event_type := coalesce(p_event_type, 'consumption');
  v_lot_ids     uuid[] := '{}';
  v_qtys        numeric[] := '{}';
  r             record;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Cantitatea de consumat trebuie sa fie mai mare ca zero.'
      using errcode = 'LT005';
  end if;
  v_remaining := p_qty;

  select organization_id into v_org from public.items where id = p_item_id;
  if v_org is null then
    raise exception 'Item inexistent: %', p_item_id
      using errcode = 'LT003';
  end if;

  if not app.is_staff_of(v_org) then
    raise exception 'Nu ai permisiunea de a consuma stoc pentru aceasta organizatie.'
      using errcode = 'LT004';
  end if;

  -- Loturile candidate (nelocate, cu stoc) folosesc `lots_fifo_idx`. Cand se cere
  -- selectie manuala, ordinea e data de pozitia in `p_manual_lot_ids`; altfel FIFO
  -- strict pe `entry_date` (tie-break pe `created_at`).
  for r in
    select l.id, l.remaining_qty
    from public.lots l
    where l.item_id = p_item_id
      and l.organization_id = v_org
      and l.is_blocked = false
      and l.remaining_qty > 0
      and (p_manual_lot_ids is null or l.id = any (p_manual_lot_ids))
    order by
      case when p_manual_lot_ids is not null then array_position(p_manual_lot_ids, l.id) end asc nulls last,
      l.entry_date asc,
      l.created_at asc
    for update
  loop
    exit when v_remaining <= 0;

    v_take := least(r.remaining_qty, v_remaining);

    update public.lots set remaining_qty = remaining_qty - v_take where id = r.id;

    insert into public.stock_events (
      organization_id, item_id, lot_id, event_type, quantity, reason, order_id, process_id, created_by
    )
    values (
      v_org, p_item_id, r.id, v_event_type, -v_take, p_reason, p_order_id, p_process_id, auth.uid()
    );

    v_lot_ids := array_append(v_lot_ids, r.id);
    v_qtys := array_append(v_qtys, v_take);
    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then
    raise exception 'Stoc insuficient pentru itemul %: lipsesc % unitati din % cerute.',
      p_item_id, v_remaining, p_qty
      using errcode = 'LT001', detail = p_item_id::text;
  end if;

  return query select unnest(v_lot_ids), unnest(v_qtys);
end;
$$;
