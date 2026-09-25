# Aport din portalul clientului: trimis, nu ciorna

## Problema
Cererea de aport creata de client din `/aport-nou` ramanea `draft` ("Ciornă") - si in
portal, si la staff - desi pentru client e trimisa spre aprobare.

## Solutie
- `createClientAportAction` trimite comanda dupa creare (`sendOrder`: `draft -> sent`
  + numar), prin acelasi helper ca `createClientOrderAction` (`sendCreatedOrder`).
- Migrarea `0042_client_aport_sent.sql`:
  - `accept_intake_order` accepta din `draft` (aport creat de staff) SAU `sent`;
  - garda AP005 (trigger pe `orders`): un aport `accepted` nu mai poate fi anulat -
    `cancel_order` reface doar consumul, aportul a creat loturi.
- Staff (`/comenzi/[id]`, tabelul `/comenzi`): pe aport doar "Acceptă aport"
  (draft/sent) + "Anulează" (draft/sent), prin `canTransitionOrderOfType` /
  `canAcceptIntake` (`orders/state-machine.ts`). Inainte tabelul arata butoanele de
  vanzare ("Înaintează", "Livrează", "Planifică livrare") si pe aport - eliminate.
- Traseul de status al aportului: `APORT_JOURNEY` = draft -> sent -> accepted.

## Teste
- Unitare: actiunea de aport trimite comanda (si eroarea de trimitere);
  `canTransitionOrderOfType`, `canAcceptIntake`.
- `business_flow.sql` B25: client draft -> sent; accept din sent (lot aport_client);
  anulare aport acceptat -> AP005; anulare aport trimis -> ok.

## Impact asistent AI
`write` (existent, modificat): `accepta_comanda` - descrierea spune acum ca aportul se
accepta din Ciornă sau Trimisă (executia trece deja prin `accept_intake_order`).
`anuleaza_comanda` primeste AP005 din DB pe un aport acceptat. Randerul ramane `generic`.
