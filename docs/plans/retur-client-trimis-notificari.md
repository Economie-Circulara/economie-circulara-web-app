# Retur/garantie din portal: trimise, nu ciorne + notificari aport/retur

## Probleme (gasite in auditul client/admin din 2026-09-25)
1. Cererile de retur/garantie ale clientului ramaneau `draft` ("Ciornă"), fara numar -
   clientul le putea si sterge; staff-ul le accepta din draft.
2. "Repetă comanda" aparea in portal si pe o cerere de retur/garantie (ar fi recomandat
   exact marfa returnata).
3. La acceptarea unui aport (si a unui retur) clientul nu primea email, desi la anulare
   primea.

## Solutie
- `createReturnAction`: pentru rolul client, trimite comanda-retur (si inlocuirea, la
  garantie) - `sendOrder`, `draft -> sent`. Staff-ul ramane pe `draft`.
- Migrarea `0044`: `accept_return_order` accepta din `draft` sau `sent`; garda de
  anulare din 0042 extinsa la retur/garantie acceptate (RT005).
- `orders/state-machine.ts`: `OrderFlow` (`sale` / `intake`), `orderFlowOf`,
  `canTransitionOrderInFlow` (inlocuieste `canTransitionOrderOfType`), `canAcceptIntake`.
  `OrderStatusActions` primeste `flow`; tabelul si detaliul staff folosesc fluxul
  (retur: "Acceptă retur" + "Anulează" din draft/sent; fara "Planifică livrare").
  `INTAKE_JOURNEY` = draft -> sent -> accepted pentru aport si retur.
- Portal `/comenzile-mele/[id]`: pe cerere de retur/garantie fara "Repetă comanda" si
  fara livrare; mentiune "Retur/Garanție pentru comanda originală".
- Notificari: `OrderEmailKind` (`order` / `intake` / `return`) in template-uri;
  `acceptIntakeAction`, `acceptReturnAction` si asistentul (`accepta_comanda` pe aport)
  trimit emailul de acceptare cu formularea potrivita; anularea unui aport foloseste
  formularea de cerere.

## Teste
- Unitare: fluxuri (`orderFlowOf`, `canTransitionOrderInFlow`, `canAcceptIntake`),
  trimiterea returului/garantiei din portal (si eroarea), notificarile la acceptare
  (aport, retur, asistent), template-urile pe `kind`.
- `business_flow.sql` B27: retur client draft -> sent, acceptat din sent, RT005,
  respingere retur trimis.

## Impact asistent AI
`write` (existent): `accepta_comanda` pe aport trimite acum si notificarea clientului;
`anuleaza_comanda` primeste RT005/AP005 din DB pe un intake acceptat. Randerul ramane
`generic`.
