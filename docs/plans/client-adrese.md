# Portal client: adresele proprii + adresa ad hoc pe comanda / aport

## Problema
Clientul nu-si putea adauga adrese (doar staff-ul, din `/clienti/[id]`) si nici nu
putea da o adresa punctuala pentru o singura livrare/aport. RLS-ul permitea deja
clientului CRUD pe propriile `client_addresses` (0014/0016) - lipsea doar UI-ul.

## Solutie
- Migrarea `0046`: `client_addresses.archived_at` - adresa ASCUNSA din agenda si din
  pickere, dar pastrata pentru istoricul comenzilor (`orders.delivery_address_id` e
  `on delete set null` - o stergere fizica ar sterge adresa din comenzile vechi).
  Folosita pentru:
  - adresa **ad hoc** ("doar pentru această comandă"): creata direct arhivata;
  - **stergerea** unei adrese folosite deja pe o comanda: devine arhivare
    (`removeAddress`, si la staff); nefolosita -> stergere fizica, ca inainte.
- `listClientAddresses` / `listClientAddressesGrouped` filtreaza `archived_at is null`.
- Pagina `/adresele-mele` (meniu "Adresele mele"): aceeasi sectiune ca la staff
  (`AddressSection`, cu actiunile clientului injectate): adauga / editeaza / sterge /
  implicita.
- Formularele din portal (cos in `/catalog`, `/aport-nou`): campul de adresa
  (`DeliveryAddressField`) are optiunea "+ Adresă nouă…" (adresa, eticheta, bifa
  "Salvează în adresele mele"); adresa implicita e preselectata.
- Server (`client-portal/actions.ts`): adresa aleasa trebuie sa fie una ACTIVA a
  clientului (inainte nu se verifica); adresa noua se creeaza inainte de comanda.

## Teste
- Unitare: `resolveDeliveryAddress` (existenta / straina / noua salvata / noua ad hoc),
  actiunile clientului pe adrese, `removeAddress` (folosita -> arhivata, nefolosita ->
  stearsa), `DeliveryAddressField`.
- `business_flow.sql` B29: clientul isi adauga adresa; nu poate scrie adresa altui
  client; adresa arhivata ramane pe comanda.

## Impact asistent AI
`none`.
