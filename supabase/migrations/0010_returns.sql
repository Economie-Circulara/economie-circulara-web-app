-- =============================================================================
-- Task F — Retur & Garanție & Închiriere
-- =============================================================================
-- Migrare aditiva peste schema inghetata din 0001_core_schema.sql (tabelele
-- `orders`/`order_items`/`order_links`, enum `order_link_type` sunt deja acolo —
-- vezi AGENTS.md). Aceasta migrare adauga DOAR:
--
--   1. O politica RLS noua pe `order_links` care permite CLIENTULUI sa insereze
--      legaturi (retur/garantie/inlocuire) intre comenzile proprii — lipsea
--      complet (0001/0003 dau clientului doar SELECT pe order_links, insert
--      fiind rezervat staff-ului prin `order_links_staff_all`). Fara aceasta
--      politica, `createReturnAction` (Task F, folosit si de portalul clientului
--      in Task H) ar esua cu "permission denied" pentru rolul `client`.
--   2. RPC `accept_return_order(p_return_order_id uuid)` — accepta ATOMIC o
--      comanda-retur: creeaza cate un lot (`create_lot`, provenance 'return')
--      pentru fiecare linie + seteaza `status='accepted'`, intr-o singura
--      tranzactie (in stilul `accept_order` din 0007_orders_ops.sql). Fara acest
--      RPC, `acceptReturnAction` ar trebui sa apeleze `create_lot` secvential per
--      linie din server action — posibil ca N-1 loturi sa fie create si al
--      N-lea sa esueze (ex. item sters), lasand comanda-retur intr-o stare
--      ambigua (unele materiale in stoc, statusul inca "draft"). RPC-ul evita
--      exact acest caz.
--
-- Coduri de eroare (in stilul OR00x din 0007_orders_ops.sql, LT00x din 0004):
--   RT001 - tranzitie de status invalida (comanda-retur nu e in "draft")
--   RT002 - comanda-retur inexistenta sau fara acces (RLS)
--   RT003 - comanda data nu e o comanda-retur (nu are order_links de tip
--           return/warranty catre ea) — apara impotriva apelarii RPC-ului pe o
--           comanda de vanzare obisnuita
--   RT004 - permisiune insuficienta (operatiune rezervata staff-ului)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. order_links — INSERT pentru client, scoped la comenzile proprii
-- -----------------------------------------------------------------------------
-- Clientul poate crea o legatura doar daca ATAT comanda originala CAT SI comanda
-- legata ii apartin (client_id = app.client_id()) — createReturnAction creeaza
-- intotdeauna ambele comenzi (originala preexistenta + noua comanda-retur/
-- inlocuire) pentru acelasi client, deci verificarea dubla e suficienta si nu
-- permite legarea unor comenzi straine. Tipul legaturii (return/warranty/
-- replacement) nu e restrans aici — validarea de business (ex. doar staff/client
-- proprietar poate initia) ramane in server action (Task F, actions.ts).
create policy order_links_client_insert on public.order_links
  for insert with check (
    app.role() = 'client'
    and organization_id = app.org_id()
    and exists (
      select 1 from public.orders o
      where o.id = order_links.original_order_id and o.client_id = app.client_id()
    )
    and exists (
      select 1 from public.orders o
      where o.id = order_links.linked_order_id and o.client_id = app.client_id()
    )
  );

-- -----------------------------------------------------------------------------
-- 2. accept_return_order — draft -> accepted, creeaza loturi (provenance 'return')
-- -----------------------------------------------------------------------------
-- SECURITY INVOKER (ca toate RPC-urile din 0004/0007/0008): ruleaza in tranzactia
-- apelului -> orice eroare (item inexistent, tranzitie invalida) face ROLLBACK
-- complet, niciun lot creat partial. Rezervat staff-ului (accept manual dupa
-- inspectie — vezi AGENTS.md §4 "Recondiționarea..." si handoff-ul Task F).
--
-- Nu reutilizeaza `accept_order` (Task E): acela CONSUMA stoc via `consume_fifo`
-- (semantica unei comenzi de vanzare); o comanda-retur trebuie sa ADAUGE stoc via
-- `create_lot` (semantica inversa) — sunt operatiuni de business diferite pe
-- aceeasi structura de tabele (`orders`/`order_items`), de aici RPC separat.
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

  if v_order.status <> 'draft' then
    raise exception 'Comanda-retur % nu poate fi acceptata din statusul % (trebuie sa fie "draft").',
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
    -- a validat deja materialul — daca inspectia respinge materialul, staff-ul pur
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
