# Plan: date demo pentru recepție + fix randare PDF

## Context

Recepția (fonduri UE) cere demonstrarea funcționalităților pe date realiste. Producția
avea doar date minime (2 organizații de test, 0 comenzi, niciun super_admin) și rămăsese la
migrarea 0018.

## Pași

1. Aplic migrarea 0019 (`org-logos`) pe proiectul hosted (`supabase db push`).
2. `supabase/demo/seed-demo.sql` - organizație nouă `beton-circular`, izolată:
   - conturi pentru toate rolurile (parola înlocuită la rulare, necomisă);
   - ~6 luni de istoric relativ la data rulării, descris ca listă de evenimente;
   - fiecare operațiune trece prin RPC-urile reale (`create_lot`, `confirm_process`,
     `accept_order`, `cancel_order`, `accept_return_order`, `set_lot_block`,
     `consume_fifo`) cu `set local role authenticated` + JWT claims, apoi timestamp-urile
     sunt mutate în trecut;
   - verificare de consistență a stocului la final; rollback complet la eroare.
3. `supabase/demo/teardown-demo.sql` - ștergere simetrică (organizație + conturi).
4. Certificatele și documentele au nevoie de Storage: `scripts/demo/export-demo-data.sql`
   (export JSON read-only) + `scripts/demo/build-demo-artifacts.tsx` (același cod ca
   aplicația: `buildTraceabilityGraph` + `CertificatePdfDocument`), urcare cu
   `supabase storage cp`, fără chei secrete.
5. Testez întâi pe stack-ul local (rollback, apoi rulare completă + smoke Playwright pe
   ecranele cheie cu conturile demo), apoi rulez în producție și verific prin SQL.

## Descoperite pe parcurs (reparate în același PR)

- **PDF-urile (certificat, aviz) nu se mai randau** din commit-ul cu fonturi Noto
  (`41e5476`): stilul `fontStyle: "italic"` al liniei de semnătură nu avea font
  înregistrat -> `Could not resolve font for NotoSans ... italic`. Fix: variante italic
  mapate pe fișierele drepte în `src/lib/pdf/fonts.ts` + test de randare REALĂ
  (`src/lib/pdf/render.test.tsx`) - celelalte teste mock-uiesc renderer-ul.
- **Graful din certificatul PDF**: textele din `<Svg>` nu aveau `fontFamily` (diacritice
  pierdute), înălțime fixă și etichete suprapuse la lanțuri lungi. Fix: font explicit,
  înălțime după numărul de noduri (limitată la prima pagină), etichete trunchiate la
  lățimea coloanei, toate la dreapta nodului.

## Nereparate (semnalate)

- O comandă cu un item de tip `service` nu poate fi acceptată (`accept_order` consumă FIFO
  și pentru servicii -> „Stoc insuficient”).
- Graful din pagina web a certificatului (`SankeyDiagram`) are aceeași suprapunere de
  etichete la lanțuri lungi.
