-- =============================================================================
-- Aport: niciun item ARHIVAT pe liniile unei comenzi de aport
-- =============================================================================
-- Arhivarea (0035) opreste lucrurile NOI construite peste un item - aportul e o
-- intrare noua in stoc. `app.reject_archived_references` avea insa pe `order_items`
-- doua exceptii gandite pentru RETUR/GARANTIE: staff-ul trece mereu, iar clientul
-- trece daca itemul i-a fost deja livrat. Pe un aport niciuna nu are sens (aportul
-- nu are retur/garantie), deci liniile de aport resping itemul arhivat (AR001)
-- pentru ORICE rol. Restul functiei e identic cu 0035.
--
-- Complementar, la nivel de aplicatie: portalul valideaza liniile fata de lista
-- curenta de itemi permisi (`client-portal/actions.ts#unavailableLinesError`).
-- =============================================================================

create or replace function app.reject_archived_references()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item uuid;
begin
  if tg_table_name = 'recipe_components' then
    v_item := new.component_item_id;
  elsif tg_table_name = 'recipes' then
    v_item := new.item_id;
  elsif tg_table_name = 'order_items' then
    -- 0043: pe un APORT (material adus de client) nu exista retur/garantie
    -- (ALLOWED_RETURN_FLOWS_BY_ORDER_TYPE), deci niciun motiv pentru un item
    -- arhivat - e o intrare noua in stoc, oprita de arhivare pentru ORICE rol.
    if exists (
      select 1 from public.orders o where o.id = new.order_id and o.order_type = 'aport'
    ) then
      v_item := new.item_id;
    else
      -- Doar pentru rolul client (catalogul lui): staff-ul poate avea nevoie de
      -- itemi arhivati in fluxurile de retur/garantie.
      if app.role() is distinct from 'client' then
        return new;
      end if;
      -- Regula de business: un item arhivat POATE reveni prin retur/garantie. Clientul
      -- isi creeaza singur cererile de retur/garantie (insert-uri ca rol client), iar
      -- `order_links` se insereaza DUPA linii - deci nu putem verifica legatura aici.
      -- Criteriul echivalent: itemul a fost deja LIVRAT acestui client (apare pe o
      -- comanda proprie `delivered`/`closed`) - singurele linii returnabile (vezi
      -- `returns/service.ts#createReturnOrder`, care valideaza oricum cantitatile).
      if exists (
        select 1
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
        where oi.item_id = new.item_id
          and o.client_id = app.client_id()
          and o.status in ('delivered', 'closed')
      ) then
        return new;
      end if;
      v_item := new.item_id;
    end if;
  elsif tg_table_name = 'processes' then
    if new.recipe_id is not null and exists (
      select 1 from public.recipes r
      join public.items i on i.id = r.item_id
      where r.id = new.recipe_id
        and (r.archived_at is not null or i.archived_at is not null)
    ) then
      raise exception 'Rețeta este arhivată și nu mai poate fi folosită în producție.'
        using errcode = 'AR002';
    end if;
    return new;
  end if;

  if v_item is not null and exists (
    select 1 from public.items where id = v_item and archived_at is not null
  ) then
    raise exception 'Materialul sau serviciul este arhivat și nu mai poate fi folosit.'
      using errcode = 'AR001';
  end if;
  return new;
end;
$$;
