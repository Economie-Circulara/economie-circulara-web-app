# Task X8 - Tipuri explicite de comandă (material / serviciu / aport)

> Plan scris conform regulii 1.1 din [`AGENTS.md`](../../AGENTS.md). Arhitectura a
> fost discutată și aprobată cu utilizatorul înainte de implementare.

## Problema

Până acum `orders` nu avea niciun tip: "serviciul" exista doar la nivel de linie
(`items.kind = 'service'`), eligibilitatea de retur era pur statusuală (orice comandă
`delivered`/`closed`), iar un client **nu avea nicio cale** de a aduce material către
organizație (ex. moloz pentru reciclare) - intrarea în stoc se făcea doar din
formularul manual, fără nicio legătură cu clientul (`lots` nu avea `client_id`).

## Soluția

### DB (migrări aditive `0030` + `0031`)

- `0030_order_types.sql`
  - enum nou `public.order_type` = `material | serviciu | aport`;
  - `orders.order_type` NOT NULL, default `material` (backfill pentru rândurile
    existente + plasă de siguranță pentru insert-urile care nu trec prin formular);
  - `lots.client_id` (FK nullable spre `clients`, `on delete restrict`) + index parțial;
  - valoare nouă în `lot_provenance`: `aport_client`.
- `0031_aport_intake.sql` (fișier separat - Postgres interzice folosirea unei valori
  de enum adăugate în aceeași tranzacție)
  - `create_lot` recreată (DROP + CREATE, semnătură nouă) cu `p_client_id` (default
    null), pasat în `lots.client_id`;
  - `accept_intake_order(p_order_id)` - `draft -> accepted` pentru comenzile `aport`:
    un lot per linie, provenance `aport_client`, `client_id` = clientul comenzii,
    `quality_status = 'unchecked'`. Coduri de eroare `AP001..AP004`;
  - `accept_order` recreată cu o gardă: refuză o comandă `aport` (fluxul de vânzare
    ar CONSUMA stoc, exact invers).

### Aplicație

- `orders`: tip în `types.ts`/`labels.ts`, selector obligatoriu în `OrderEditor`
  (radio + descrieri), `expected_return_date` editabilă DOAR la `serviciu`, catalog
  de itemi comutat pe tip (`listIntakeItemOptions` - itemi fizici, inclusiv
  nevandabili - pentru `aport`), `acceptIntakeOrder`/`acceptIntakeAction` +
  `AcceptIntakeButton` (pattern identic cu `AcceptReturnButton`).
- `returns`: `ALLOWED_RETURN_FLOWS_BY_ORDER_TYPE` - inițial retur pur doar pe
  `serviciu`, garanție pe `material`+`serviciu`, nimic pe `aport`. **Update
  ulterior**: regula relaxată să permită retur pur și pe `material` - datele demo
  (RT2/RT3/RT4) conțineau exceptii reale (retur ambalaje/paleți EURO, surplus
  nefolosit) pe care regula inițială le-ar fi respins; vezi AGENTS.md §4 pentru
  motivația completă. Impus în `loadOriginalOrderForReturn` (server) și reflectat
  în butoanele `ReturnActions`.
- Comenzile-retur și cele de înlocuire moștenesc `order_type` de la comanda originală.

### Ciclul de viață al unei comenzi `aport`

`draft -> accepted`, prin `accept_intake_order`, și se oprește acolo - **nu** intră în
mașina de stări de vânzare (`sent/delivered/closed`), exact ca o comandă-retur
acceptată prin `accept_return_order`. De aceea `state-machine.ts` rămâne neschimbat
(el descrie doar traseul de vânzare), iar ecranul de detaliu afișează pentru aport un
traseu scurtat și butonul dedicat în locul `OrderStatusActions`.

## Impactul asupra asistentului AI (regula 2.4)

- **Decizia: `write` (modificare de compatibilitate, fără capabilitate nouă).**
- Tool modificat: `creeaza_comanda` (v1 -> **v2**) - parametri noi `tip_comanda`
  (opțional, implicit `material`, ca apelurile de dinaintea acestui task să rămână
  valide) și `data_retur_estimata`.
- Randerul cardului rămâne `order_draft` (editorul partajat arată acum și selectorul
  de tip, deci utilizatorul poate corecta propunerea înainte de execuție).
- Un tool dedicat "creează aport" NU e în scope (follow-up).

## Rămas în afara scope-ului (follow-up-uri)

- Portal client: cerere de aport self-service (azi aportul e inițiat de staff).
- Tool de asistent dedicat pentru aport.
- Dimensiunea comercială a aportului (tarife/plăți către client) - acest task e
  exclusiv stoc + trasabilitate.
- Editarea tipului/datei de retur pe o comandă `draft` deja creată (nu există încă un
  ecran de editare a comenzii; tipul se alege la creare).
