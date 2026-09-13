-- Exportă (read-only) datele organizației demo necesare pentru
-- scripts/demo/build-demo-artifacts.tsx: comenzile închise fără certificat + tot lanțul
-- de trasabilitate + țintele pentru documentele demo. Un singur rând, coloana `data`.
-- Vezi supabase/demo/README.md.
with org as (
  select id, name, primary_color, secondary_color from public.organizations where slug = 'beton-circular'
)
select json_build_object(
  'organization', (select row_to_json(org) from org),
  'adminUserId', (select p.id from public.profiles p, org where p.organization_id = org.id and p.role = 'admin' order by p.created_at limit 1),
  'closedOrders', (
    select coalesce(json_agg(json_build_object(
      'id', o.id, 'number', o.order_number, 'closedAt', o.closed_at,
      'clientName', c.name, 'clientCui', c.cui
    ) order by o.closed_at), '[]'::json)
    from public.orders o join public.clients c on c.id = o.client_id, org
    where o.organization_id = org.id and o.status = 'closed'
      and not exists (select 1 from public.certificates ct where ct.order_id = o.id)
  ),
  'existingCertificates', (select count(*) from public.certificates ct, org where ct.organization_id = org.id),
  'consumptions', (
    select coalesce(json_agg(json_build_object(
      'orderId', se.order_id, 'lotId', se.lot_id, 'itemId', se.item_id,
      'itemTitle', i.title, 'unit', i.unit, 'quantity', se.quantity
    )), '[]'::json)
    from public.stock_events se join public.items i on i.id = se.item_id, org
    where se.organization_id = org.id and se.event_type = 'consumption' and se.order_id is not null
  ),
  'lots', (
    select coalesce(json_agg(json_build_object(
      'id', l.id, 'itemId', l.item_id, 'itemTitle', i.title, 'unit', i.unit,
      'provenance', l.provenance, 'source', l.source, 'entryDate', l.entry_date
    )), '[]'::json)
    from public.lots l join public.items i on i.id = l.item_id, org
    where l.organization_id = org.id
  ),
  'processes', (
    select coalesce(json_agg(json_build_object('id', p.id, 'type', p.type, 'completedAt', p.completed_at)), '[]'::json)
    from public.processes p, org where p.organization_id = org.id
  ),
  'processOutputs', (
    select coalesce(json_agg(json_build_object('processId', po.process_id, 'lotId', po.lot_id, 'quantity', po.quantity)), '[]'::json)
    from public.process_outputs po, org where po.organization_id = org.id
  ),
  'processInputs', (
    select coalesce(json_agg(json_build_object('processId', pi.process_id, 'lotId', pi.lot_id, 'quantity', pi.quantity)), '[]'::json)
    from public.process_inputs pi, org where pi.organization_id = org.id
  ),
  'existingDocuments', (select count(*) from public.documents d, org where d.organization_id = org.id),
  'clients', (
    select coalesce(json_object_agg(c.cui, json_build_object('id', c.id, 'name', c.name, 'createdAt', c.created_at)), '{}'::json)
    from public.clients c, org where c.organization_id = org.id
  ),
  'items', (
    select coalesce(json_object_agg(i.title, json_build_object('id', i.id, 'createdAt', i.created_at)), '{}'::json)
    from public.items i, org where i.organization_id = org.id
  ),
  -- Comenzi-țintă pentru documentele atașate comenzilor, identificate structural.
  'orderTargets', json_build_object(
    'firstClosed', (
      select json_build_object('id', o.id, 'number', o.order_number, 'at', o.delivered_at)
      from public.orders o, org where o.organization_id = org.id and o.status = 'closed'
      order by o.closed_at limit 1
    ),
    'warrantyOriginal', (
      select json_build_object('id', o.id, 'number', o.order_number, 'at', ol.created_at)
      from public.order_links ol join public.orders o on o.id = ol.original_order_id, org
      where ol.organization_id = org.id and ol.link_type = 'warranty' limit 1
    ),
    'firstRental', (
      select json_build_object('id', o.id, 'number', o.order_number, 'at', o.delivered_at)
      from public.orders o, org where o.organization_id = org.id and o.expected_return_date is not null
      order by o.created_at limit 1
    ),
    'largestDelivery', (
      select json_build_object('id', o.id, 'number', o.order_number, 'at', o.delivered_at)
      from public.orders o join public.order_items oi on oi.order_id = o.id, org
      where o.organization_id = org.id and o.status = 'closed'
      group by o.id order by sum(oi.quantity) desc limit 1
    )
  )
) as data;
