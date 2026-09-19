-- =============================================================================
-- Aport client self-service: RLS pentru catalogul de itemi de aport al clientului
-- =============================================================================
-- Pana acum, `items_client_catalog` (0001, redefinita in 0014) limiteaza SELECT-ul
-- clientului pe `items` la randurile `sellable = true` - suficient pentru /catalog
-- (vanzare), dar aportul (client -> organizatie) foloseste EXACT itemii fizici pe
-- care catalogul de vanzare ii ascunde (materie prima nevandabila, ex. moloz de
-- demolare - vezi `listIntakeItemOptions` din 0030_order_types.sql). Fara o politica
-- suplimentara, un client care cere un aport din portal (Task nou: /aport-nou) nu
-- ar vedea NICIUN item in select-ul de materiale, desi RPC-ul `accept_intake_order`
-- (0031) si `orders_client_insert`/`order_items_client_insert` (0003/0012) permit deja
-- comenzi `aport` initiate de client.
--
-- Migrare aditiva: o a doua politica de SELECT pe `items`, ADITIVA fata de
-- `items_client_catalog` (RLS combina politicile permisive cu OR, deci clientul
-- vede reuniunea celor doua seturi). Acelasi tipar de filtrare ca
-- `listIntakeItemOptions`: `kind = 'physical'` (serviciile nu au stoc, deci nu pot
-- fi "aduse") si `is_tracked = true` (itemii netrasati, ex. apa, nu au sens ca
-- aport). Nu se expune nimic sensibil: tabela `items` nu are coloane de
-- pret/cost/stoc (acelea traiesc in `lots`, ramas needisponibil clientului).
create policy items_client_intake on public.items
  for select using (
    app.role() = 'client'
    and kind = 'physical'
    and is_tracked = true
    and organization_id = app.org_id()
    and app.org_is_active(organization_id)
  );
