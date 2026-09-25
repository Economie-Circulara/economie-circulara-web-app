# Portal client: fara itemi arhivati / scosi din catalog pe comenzi si aporturi

## Problema
Clientul putea trimite un material arhivat:
- **Comanda din catalog**: "Repetă comanda" si cosul din `localStorage` pun in cos liniile
  vechi fara verificare; DB-ul accepta un item arhivat de la client daca i-a fost deja
  livrat (exceptia pentru retur/garantie din `app.reject_archived_references`, 0035),
  iar RLS nu verifica `sellable`.
- **Aport**: aceeasi exceptie se aplica si aportului; un formular deschis inainte de
  arhivare trimitea itemul. Staff-ul nu are deloc restrictie pe `order_items`.

## Solutie
- Server (`client-portal/actions.ts`): `unavailableLinesError` - liniile trebuie sa fie
  in `listCatalogItems()` (comanda) / `listIntakeItemOptions()` (aport), ambele fara
  arhivate. Logica pura in `cart-logic.ts#splitAvailableLines`.
- `/catalog`: liniile indisponibile din cos nu se afiseaza/trimit; mesaj cu titlurile +
  buton "Scoate din coș".
- Migrarea `0043`: pe liniile unei comenzi `aport`, item arhivat -> AR001 pentru orice
  rol (restul functiei identic cu 0035; returul clientului ramane permis).

## Teste
- Unitare: `splitAvailableLines`; actiunile resping itemi indisponibili fara sa creeze
  comanda (catalog si aport).
- `business_flow.sql` B26: aport cu item arhivat respins pt. staff si pt. client (chiar
  livrat anterior); B23 (retur cu item arhivat livrat) ramane verde.

## Impact asistent AI
`none` - asistentul clientului doar citeste comenzi; tool-urile staff de creare
comanda folosesc deja listele fara arhivate, iar garda 0043 acopera aportul si acolo.
