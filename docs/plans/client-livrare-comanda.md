# Portal client: detaliile livrarii pe comanda

## Problema
In `/comenzile-mele/[id]` clientul vedea doar adresa/data din comanda; livrarea
planificata de staff (transportator, vehicul, sofer, data programata) nu aparea.
Cauza: `deliveries` are RLS doar pentru staff (0013, 0035).

## Solutie
- Migrarea `0041_client_order_delivery.sql`: RPC `client_order_delivery(p_order_id)`,
  `security definer`, cu autorizare explicita (client activ, comanda proprie,
  nestearsa, organizatie activa, livrare neanulata). Intoarce doar: data programata,
  transportator, vehicul, sofer, destinatie, cod UIT, receptie (data + cine).
  NU o politica de SELECT pe `deliveries` - ar expune tot randul (erori e-Transport,
  ruta calculata, punctul de plecare, notele de receptie).
- `getClientOrderDelivery` (`src/features/client-portal/queries.ts`).
- Card "Transport" (`client-delivery-card.tsx`) langa cardul "Livrare"; nu se
  interogheaza pentru comenzile `aport`.
- `database.types.ts` actualizat manual cu semnatura RPC-ului (fara `gen:types` in mediu).

## Teste
- Unitare: maparea RPC-ului, null fara livrare, eroare; randarea cardului (UIT, receptie).
- `business_flow.sql` B24: clientul vede livrarea proprie; nu pe a altui client;
  nu una anulata; nu citeste direct `deliveries`; staff-ul primeste 0 randuri.

## Impact asistent AI
`none` - asistentul clientului nu are tool de livrari; staff-ul are deja ecranul /livrari.
