-- =============================================================================
-- Clonează CATALOGUL + stocul curent dintr-o organizație în alta (ex. Macon -> Etora).
-- =============================================================================
-- Copiază: itemuri (ne-arhivate), rețete (ne-arhivate) cu componente și direcție, plus
-- stocul curent ca LOT DE DESCHIDERE per item (prin RPC-ul real `create_lot`, deci cu
-- stock_events + coduri de lot). NU copiază: clienți, comenzi, livrări, procese, loturi
-- istorice, documente, imagini (date reale / referințe de Storage ale altui tenant).
-- Istoricul operațional pentru demo vine din seed-demo.sql (vezi README).
--
-- Placeholder-e (sed la rulare): __SOURCE_SLUG__ (ex. maconxcx), __TARGET_SLUG__ (etora),
-- __TARGET_ADMIN_EMAIL__ (adminul organizației țintă - autorul loturilor).
-- Refuză dacă ținta are deja itemi/rețete/loturi. Atomic (un singur bloc DO).
-- =============================================================================
do $$
declare
  c_src   constant text := '__SOURCE_SLUG__';
  c_tgt   constant text := '__TARGET_SLUG__';
  c_admin constant text := '__TARGET_ADMIN_EMAIL__';
  v_src uuid; v_tgt uuid; v_user uuid;
  v_map jsonb := '{}'::jsonb;
  r record; c record; v_id uuid; v_n_items int := 0; v_n_rec int := 0; v_n_lots int := 0;
begin
  select id into v_src from public.organizations where slug = c_src;
  select id into v_tgt from public.organizations where slug = c_tgt;
  if v_src is null or v_tgt is null or v_src = v_tgt then
    raise exception 'Organizatie sursa/tinta invalida (% -> %).', c_src, c_tgt;
  end if;
  if exists (select 1 from public.items where organization_id = v_tgt)
     or exists (select 1 from public.recipes where organization_id = v_tgt)
     or exists (select 1 from public.lots where organization_id = v_tgt) then
    raise exception 'Organizatia tinta "%" are deja itemi/retete/loturi - nu clonez peste date existente.', c_tgt;
  end if;
  select id into v_user from public.profiles
  where organization_id = v_tgt and email = c_admin and role = 'admin';
  if v_user is null then
    raise exception 'Nu exista adminul % in organizatia %.', c_admin, c_tgt;
  end if;

  -- Itemi (fara image_url: fisierele din Storage apartin altui tenant).
  for r in select * from public.items where organization_id = v_src and archived_at is null loop
    insert into public.items (organization_id, title, description, unit, kind, sellable, is_tracked)
    values (v_tgt, r.title, r.description, r.unit, r.kind, r.sellable, r.is_tracked)
    returning id into v_id;
    v_map := v_map || jsonb_build_object(r.id::text, v_id);
    v_n_items := v_n_items + 1;
  end loop;

  -- Retete + componente (doar daca itemul retetei si toate componentele s-au copiat).
  for r in
    select * from public.recipes
    where organization_id = v_src and archived_at is null and v_map ? item_id::text
  loop
    if exists (select 1 from public.recipe_components rc
               where rc.recipe_id = r.id and not (v_map ? rc.component_item_id::text)) then
      continue;
    end if;
    insert into public.recipes (organization_id, item_id, direction)
    values (v_tgt, (v_map ->> r.item_id::text)::uuid, r.direction)
    returning id into v_id;
    for c in select * from public.recipe_components where recipe_id = r.id loop
      insert into public.recipe_components (organization_id, recipe_id, component_item_id, percentage, conversion_factor)
      values (v_tgt, v_id, (v_map ->> c.component_item_id::text)::uuid, c.percentage, c.conversion_factor);
    end loop;
    v_n_rec := v_n_rec + 1;
  end loop;

  -- Stoc de deschidere: cate un lot per item, cu cantitatea curenta din sursa.
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  for r in
    select l.item_id, sum(l.remaining_qty) as qty
    from public.lots l join public.items i on i.id = l.item_id
    where l.organization_id = v_src and l.cancelled_at is null and l.remaining_qty > 0
      and i.kind = 'physical' and i.is_tracked and v_map ? l.item_id::text
    group by l.item_id
  loop
    perform public.create_lot(
      p_item_id => (v_map ->> r.item_id::text)::uuid, p_quantity => r.qty,
      p_provenance => 'purchase', p_source => 'Stoc de deschidere (demo)',
      p_entry_date => current_date, p_quality_status => 'passed', p_reason => 'Stoc de deschidere (demo)');
    v_n_lots := v_n_lots + 1;
  end loop;
  execute 'reset role';

  raise notice 'Clonat % -> %: % itemi, % retete, % loturi de deschidere.', c_src, c_tgt, v_n_items, v_n_rec, v_n_lots;
end $$;
