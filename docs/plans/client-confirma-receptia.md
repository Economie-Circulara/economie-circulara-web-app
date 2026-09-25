# Portal client: confirmarea receptiei livrarii

## Cerinta
Clientul (destinatarul marfii) poate confirma din portal receptia unei livrari, ca
alternativa la confirmarea facuta de staff in `/livrari/[id]`. Inchiderea comenzii
ramane la staff (inchiderea emite certificatul de trasabilitate - atestarea
organizatiei).

## Solutie
- Migrarea `0045`: coloana `deliveries.received_via_portal` (boolean, default false) +
  RPC `client_confirm_delivery_receipt(p_order_id, p_received_by_name, p_notes)`,
  `security definer`, cu autorizare explicita (client activ, comanda proprie,
  nestearsa, organizatie activa). Atomic: scrie receptia pe livrarea ACTIVA si trece
  comanda `accepted -> delivered` (`delivered_at`). Coduri:
  - `DR001` comanda inexistenta / straina / fara livrare activa
  - `DR002` comanda nu e `accepted`
  - `DR003` receptia e deja confirmata
  - `DR004` numele persoanei lipseste
- `client_order_delivery` (0041) ramane neschimbat - pagina are deja statusul comenzii.
- App: `confirmOwnDeliveryReceiptAction` (client-portal) -> RPC, apoi
  `onOrderStatusChanged` (email "Livrată"). Formular in cardul "Transport"
  (nume + observatii), vizibil doar pe comanda `accepted` cu livrare neconfirmata.
- Staff: in `/livrari/[id]` receptia arata "confirmată de client în portal"
  (`receipt.receivedViaPortal`).

## Teste
- Unitare: actiunea (validare, apel RPC, notificare, erori), formularul.
- `business_flow.sql` B28: clientul confirma -> livrare receptionata + comanda
  `delivered`; a doua confirmare DR003; comanda altui client DR001; comanda
  neacceptata DR002.

## Impact asistent AI
`none` - asistentul clientului doar citeste; confirmarea receptiei ramane o actiune
facuta explicit in portal.
