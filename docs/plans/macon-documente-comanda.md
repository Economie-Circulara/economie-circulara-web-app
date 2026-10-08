# Documentele comenzii: trasabilitate, nota de comanda, declaratii de conformitate

Decizii din intalnirea cu Macon XCX (2026-10-08). Plan in trei parti, cate un commit
fiecare, pe aceeasi ramura.

Context: Macon lucreaza azi cu o „nota de comanda” pe hartie (formularul F-MAR-STB-02),
cu retete de laborator (Holcim) si emite **declaratie de conformitate** pentru beton. Nu
poate emite certificat de calitate (e in curs de certificare), deci documentul generat de
platforma la inchiderea comenzii nu trebuie sa se numeasca „certificat”.

## Decizii

- **Nota de comanda nu are forma fixa.** Avizul generat din livrare tine loc de nota de
  comanda; se adauga ora, pomparea si observatii libere, preluate automat in PDF.
- **Stampila si semnatura se pun manual**, pe documentul tiparit. PDF-ul are casute de
  semnatura (furnizor, delegat/sofer, beneficiar), nu o mentiune de „semnatura
  electronica”.
- **„Certificat de trasabilitate” devine „Fisa de trasabilitate”, pentru toate
  organizatiile.** Numerotarea noua foloseste prefixul `TRS-`; numerele `CRT-` emise deja
  raman neschimbate (sunt date istorice, inghetate in PDF).
- **Declaratia de conformitate o incarca organizatia** (PDF), generic, nu per comanda:
  documente la nivel de ORGANIZATIE, vizibile tuturor clientilor ei.

## Partea 1 - Redenumire certificat -> fisa de trasabilitate

1. Etichete UI, PDF, emailuri, cautare, dashboard, manual, site-urile de prezentare.
2. Rutele `/comenzi/[id]/certificat` si `/comenzile-mele/[id]/certificat` devin
   `.../trasabilitate`; vechile URL-uri raman ca redirect (linkuri din emailuri vechi).
3. Migrarea `0055_traceability_number_prefix.sql`: `generate_certificate_number` scrie
   `TRS-<an>-<seq>` (acelasi contor).
4. Identificatorii din cod si DB (`certificates`, `CertificateView`) raman - redenumirea
   e de prezentare, nu de model (acelasi principiu ca la „Abonament”).

## Partea 2 - Avizul = nota de comanda

1. Migrarea `0056_delivery_order_note.sql`: `deliveries.scheduled_time` (ora livrarii /
   inceperii turnarii), `deliveries.pumping` (text liber, ex. „Pompa furnizor 36 m”),
   `deliveries.notes` (observatii libere). Toate optionale.
2. RPC-ul `client_order_delivery` (0041) intoarce in plus `scheduled_time` si `pumping`
   (utile clientului); `notes` raman interne.
3. Formularul `/livrari/nou` + serviciul `planDelivery` (validare ora `HH:MM`).
4. PDF aviz: ora langa data, sectiune „Observatii” (observatiile comenzii + pompare +
   observatiile livrarii, doar cele completate), adresa de livrare, trei casute de
   semnatura pentru stampila/semnatura manuala.
5. Ecranul `/livrari/[id]` si cardul de livrare din portal afiseaza campurile noi.

## Partea 3 - Sectiunea „Documente” la comanda

1. Migrarea `0057_organization_documents.sql`: `document_owner_type` primeste valoarea
   `organization` (owner_id = id-ul organizatiei, impus de CHECK); clientii organizatiei
   pot CITI aceste documente (politica `documents_client_select`).
2. `documents/service.ts`: documentele de organizatie se incarca/sterg DOAR de admin;
   clientul poate incarca DOAR pe comenzile proprii (ca politica RLS de insert - azi
   upload-ul trece prin clientul admin si nu verifica tipul ownerului pentru client).
3. Setari (admin): sectiunea „Documente generale” (declaratii de conformitate, fise
   tehnice) - upload, lista, stergere; text clar ca sunt vizibile clientilor.
4. `/comenzi/[id]` (staff): butonul „Vezi certificat” e inlocuit de sectiunea
   „Documente”: aviz/nota de comanda (daca exista livrare), fisa de trasabilitate (la
   comanda inchisa), documentele generale ale organizatiei, documentele atasate comenzii
   (upload - ex. nota semnata scanata).
5. `/comenzile-mele/[id]` (client): aceeasi sectiune, fara aviz (avizul contine date
   interne - erori e-Transport) si fara upload.
6. `/documente` (client): documentele generale ale organizatiei, langa cele ale firmei.

## Impact asupra asistentului (regula 2.4)

- **Decizia**: `none`. Niciun tool nou sau modificat; se schimba doar textul tool-urilor
  care pomenesc „certificate” (descrierea `cauta`, mesajul de arhivare client).

## Teste

- Unit: etichete/rute trasabilitate, `planDelivery` (ora invalida, campuri noi salvate),
  PDF aviz (observatii combinate), autorizarea upload-ului (organizatie doar admin,
  client doar pe comanda proprie), sectiunea de documente.
- DB (`rls_isolation.sql`): clientul vede documentele organizatiei LUI, nu ale alteia;
  CHECK-ul owner_id = organization_id. `business_flow.sql`: numarul `TRS-`.

---

# Runda 2 (2026-10-08, dupa review)

Decizii: observatiile raman text liber cu **formatare minima** (fara editor vizual);
nota de comanda e **una singura** (`orders.notes`, vazuta si de client); cererea de
oferta NU devine comanda (nu se face nimic acolo).

## Partea 4 - Formatare minima in note

1. `src/lib/text/rich-note.ts`: parser pur - paragrafe (randurile se pastreaza), liste
   (randuri care incep cu `- ` sau `* `) si ingrosat (`**text**`). Fara HTML: textul
   ramane text, deci nimic de curatat (XSS) si acelasi rezultat pe ecran si in PDF.
2. `RichNote` (ecran) si `PdfRichNote` (PDF) randeaza blocurile parserului.
3. Folosit pe aviz (observatiile comenzii si ale livrarii), pe comanda (staff + portal)
   si pe `/livrari/[id]`. Textarea-urile au un hint cu sintaxa.

## Partea 5 - Nota de comanda editabila pe toata comanda

1. Card „Notă de comandă” pe `/comenzi/[id]`, vizibil din ciorna; staff-ul o editeaza
   in `draft`/`sent`/`accepted`/`delivered`. Dupa `closed`/`cancelled` e blocata
   (avizul se genereaza din ea; comanda inchisa e istoric).
2. `updateOrderNote` (service) verifica statusul si scrie DOAR `notes`;
   `updateOrderNoteAction` (doar staff).
3. Portalul arata nota formatata, sub acelasi titlu.

## Partea 6 - Documente pe materiale si retete, propagate la comanda

1. Sectiunea „Documente” pe `/itemi/[id]`, `/abonamente/[id]` si `/retete/[itemId]`
   (reteta = produsul ei, deci documentele produsului: ex. raportul de laborator).
   `owner_type = 'item'` exista deja (0001), inclusiv citirea de catre client pentru
   produsele VANDABILE - hint explicit in UI.
2. `OrderDocuments`: subsectiunea „Documentele produselor” = documentele itemilor de pe
   liniile comenzii (`listDocumentsForOwners`). Clientul vede doar ce permite RLS
   (produse vandabile).

## Impact asupra asistentului (regula 2.4)

- **Decizia**: `none` - nota se editeaza din ecran; tool-urile existente de comanda
  scriu deja `notes` la creare, nu se schimba.

## Teste

- `rich-note.test.ts` (paragrafe, liste, bold, cazuri limita), randarea PDF.
- `updateOrderNote` (statusuri permise/blocate), actiunea (rol).
- `listDocumentsForOwners`, `OrderDocuments` cu documentele produselor.

## Partea 7 - Transportul livrarii optional

1. Migrarea `0058`: `carrier_name`, `vehicle_plate`, `driver_name` fara `not null`.
2. `planDelivery` le accepta goale; `declareETransport` le cere pe toate trei
   (`missingTransportFields`) inainte de apelul catre provider.
3. `/livrari/[id]`: „Completează transportul” (`updateDeliveryTransport`) cat livrarea
   e nedeclarata si fara receptie; avizul, lista si portalul afiseaza „-” / ascund
   campurile goale.
4. Asistent: `planifica_livrare` v2 - transportul devine optional (decizie `write`
   existent, randerul `generic` neschimbat).
