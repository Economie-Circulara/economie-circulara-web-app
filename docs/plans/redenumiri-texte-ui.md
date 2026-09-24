# Redenumiri texte UI - limbaj mai natural

Task de redenumire text-only (fara schimbari de enum-uri DB, identificatori
TypeScript sau rute), aprobat de utilizator pe baza glosarului de mai jos.
Scop: eliminarea jargonului tehnic (input/output, item, UM, FIFO, Fizic, Draft)
din tot ce vede utilizatorul - UI, manualul in-app (`docs/manual/`) si textele
pe care asistentul AI le foloseste in raspunsuri.

## Impact asupra asistentului AI (regula 2.4 din AGENTS.md)

**Decizie: `none`.** Nu se adauga/modifica niciun tool nou si niciun tool
existent nu isi schimba comportamentul sau contractul (input/output de date).
S-au reformulat DOAR texte descriptive trimise modelului (system prompt-ul din
`src/features/assistant/prompt.ts` si descrierile catorva tool-uri de citire
din `src/features/assistant/tools/read-tools.ts`), ca terminologia pe care o
foloseste asistentul in raspunsuri sa fie consistenta cu noul glosar ("produs"
in loc de "item", etc.). Numele tool-urilor (`itemi_vandabili`, `itemi_aport`)
NU s-au schimbat - sunt identificatori, nu text afisat.

## Glosarul aprobat

| Curent | Nou |
| --- | --- |
| Direcție (rețetă) | Metodă |
| Compunere | Producție (se obține din materii prime) |
| Descompunere | Reciclare (se descompune în materii prime) |
| Componente consumate (input) | Materii prime |
| Adaugă componentă | Adaugă materie primă / Adaugă material rezultat (dupa metoda) |
| Fracții rezultate (output) | Materiale rezultate |
| Output fix – Fabricație / Output variabil – Reciclare | Fabricație / Reciclare |
| Material input | Material de reciclat |
| Cantitate output dorită | Cât vrei să produci |
| Total input / Total output | Total consumat / Total rezultat |
| Niciun input/output înregistrat | Nimic consumat / Nimic rezultat înregistrat |
| Item / Alege un item... / itemi (text UI) | Produs / Alege un produs... / produse |
| Fizic (tip item) | Material |
| Draft (status comandă) | Ciornă |
| FIFO (texte explicative) | "se folosesc întâi loturile cele mai vechi" |
| Factor conversie UM | "Câte {UM rețetă} are un {UM componentă}?" (dinamic) |
| UM identică | Aceeași unitate de măsură |

`draft: "Ciornă"` exista deja ca label in `src/features/orders/labels.ts` -
lipseau doar textele fallback `orderNumber ?? "Draft"` din UI.

Nav-ul "Materiale și servicii" ramane neschimbat (alt task il imparte in
"Materiale" si "Abonamente").

## Fisiere schimbate si textele exacte

### `src/features/recipes/labels.ts` (sursa principala pentru rețete)

- `DIRECTION_LABELS.compunere`: "Compunere (produsul se obține din componente)"
  -> "Producție (se obține din materii prime)"
- `DIRECTION_LABELS.descompunere`: "Descompunere (produsul se descompune în
  componente)" -> "Reciclare (se descompune în materii prime)"
- `DIRECTION_SHORT_LABELS`: "Compunere"/"Descompunere" -> "Producție"/"Reciclare"
- `DIRECTION_DESCRIPTIONS`: "componentele de mai jos" -> "materiile prime de
  mai jos" (ambele directii)
- `DIRECTION_PERCENTAGE_HINTS`: "componentă"/"input mai mare decât outputul" ->
  "materia primă"/"se consumă mai mult decât se produce"
- `DIRECTION_COMPONENT_ROLE`: "Componente consumate (input)" -> "Materii
  prime"; "Fracții rezultate (output)" -> "Materiale rezultate"

### `src/features/production/labels.ts`

- `PROCESS_TYPE_LABELS.output_fixed`: "Output fix (fabricație)" -> "Fabricație"
- `PROCESS_TYPE_LABELS.input_fixed`: "Input fix / output variabil (reciclare)"
  -> "Reciclare"

### `src/features/items/labels.ts`

- `KIND_LABELS.physical`: "Fizic" -> "Material"

### `src/features/production/process-wizard.tsx`

- Tab 1: "Output fix - Fabricație" + "Rețete de compunere · consum FIFO
  automat" -> "Fabricație" + "Rețete de producție · se folosesc întâi
  loturile cele mai vechi"
- Tab 2: "Output variabil - Reciclare" + "Rețete de descompunere · fracții
  reale ajustabile" -> "Reciclare" + "Rețete de reciclare · materiale
  rezultate ajustabile"

### `src/features/production/fixed-output-form.tsx`

- Hint rețetă: "Direcție: ..." -> "Metodă: ..."
- Mesaj de metoda incompatibila: reformulat cu "reciclare"/"materialul de
  reciclat"/"materialele REZULTATE" in loc de
  "descompunere"/"INTRARE"/"fracțiile REZULTATE"
- Buton: "Deschide în „Output variabil - Reciclare”" -> "Deschide în
  „Reciclare”"
- Label câmp: "Cantitate output dorită" -> "Cât vrei să produci"
- Titlu card: "Consum calculat (FIFO)" -> "Consum calculat"
- "Total intrare" -> "Total consumat"

### `src/features/production/variable-output-form.tsx`

- Label câmp: "Material input" -> "Material de reciclat"
- "Niciun item" (optiune select goala) -> "Niciun material"
- Mesaj de metoda incompatibila: reformulat cu "producție"/"materiile
  prime"/"materiale rezultate" in loc de "compunere"/"componentele
  ei"/"output"
- Buton: "Deschide în „Output fix - Fabricație”" -> "Deschide în „Fabricație”"
- Titlu sectiune: "Output real - ajustează fracțiile" -> "Rezultat real -
  ajustează fracțiile"
- Empty state: "Itemul ales nu are o rețetă de descompunere definită -
  creeaz-o din /retete (direcție „Descompunere”)..." -> "Materialul ales nu
  are o rețetă de reciclare definită - creeaz-o din /retete (metodă
  „Reciclare”)..."
- "Total output" -> "Total rezultat"

### `src/features/recipes/recipe-editor.tsx`

- Titlu card: "Direcția rețetei" -> "Metoda rețetei"
- Label câmp: "Direcție" -> "Metodă"
- Buton: "Schimbă direcția" -> "Schimbă metoda"
- Avertisment: "schimbarea direcției inversează..." -> "schimbarea metodei
  inversează..."
- Empty state componente: "Nicio componentă adăugată încă." -> dinamic, "Nicio
  materie primă adăugată încă." (compunere) / "Niciun material rezultat
  adăugat încă." (descompunere)
- "UM identică ({unit})" -> "Aceeași unitate de măsură ({unit})"
- Titlu card adaugare: "Adaugă componentă" -> dinamic, "Adaugă materie primă"
  (compunere) / "Adaugă material rezultat" (descompunere)
- Descriere: "...în UM-ul fiecărei componente..." -> "...în unitatea de
  măsură a fiecărei materii prime..."
- Label + hint câmp factor conversie: "Factor conversie UM" cu hint
  "1 {unit} = ? {unit}" -> label dinamic "Câte {UM rețetă} are un {UM
  componentă}?" (sau "Câte unități de rețetă are o unitate de materie
  primă?" cand nu s-a ales inca o materie prima), cu hint scurt
  ("Obligatoriu, unitățile de măsură diferă (...)." / "Unități de măsură
  identice, lasă 1." / "Implicit 1, dacă nu se completează.")
- Avertisment unitati diferite: "UM-ul componentei (...) diferă de UM-ul
  produsului (...)." -> "Unitatea de măsură a materiei prime (...) diferă de
  unitatea de măsură a produsului (...)."
- aria-label buton ștergere linie: "Șterge componenta" -> "Șterge"

### `src/features/recipes/recipe-new-form.tsx`

- Label câmp: "Direcție" -> "Metodă"

### `src/features/recipes/recipes-table.tsx`

- Coloana "Direcție" -> "Metodă"
- Coloana "Nr. componente" -> "Nr. materiale"

### `src/features/recipes/service.ts` + `src/app/(admin)/retete/[itemId]/page.tsx`

- Eroare "Rețetele se pot defini doar pentru materiale de tip fizic."/"itemi
  de tip fizic" -> "Rețetele se pot defini doar pentru produse, nu pentru
  servicii."

### `src/features/items/item-form.tsx`

- "Alege UM..." -> "Alege unitatea de măsură..."
- Hint tip item: "Fizic = stoc + rețetă opțională..." -> "Material = stoc +
  rețetă opțională..."
- Hint "is_tracked": "Astfel de itemi pot fi componente de rețetă..." ->
  "Astfel de materiale pot fi folosite în rețete..."

### `src/features/orders/order-editor.tsx` (+ test aferent)

- Label câmp: "Item" -> "Produs"
- Placeholder: "Alege un item..." -> "Alege un produs..."

### `src/app/(admin)/productie/[id]/page.tsx`

- "Inputuri (loturi consumate)" -> "Materii prime (loturi consumate)"
- "Niciun input înregistrat." -> "Nimic consumat încă."
- "Total input" -> "Total consumat"
- "Outputuri (loturi create)" -> "Materiale rezultate (loturi create)"
- "Niciun output înregistrat." -> "Nimic rezultat înregistrat."
- "Total output" -> "Total rezultat"
- "Diferența input - output este informativă..." -> "Diferența dintre
  cantitatea consumată și cea rezultată este informativă..."

### `src/app/(admin)/productie/nou/page.tsx` si `.../productie/page.tsx`

- "Producție (output fix) sau reciclare / recondiționare (input fix, output
  variabil)." -> "Fabricație (producție de materiale noi) sau reciclare /
  recondiționare."
- "...consum FIFO și trasabilitate." -> "...trasabilitate completă, se
  folosesc întâi loturile cele mai vechi."

### `src/features/production/processes-table.tsx`

- Coloana "Output" -> "Produs"

### Fallback-uri "Draft" -> "Ciornă" (numărul comenzii nu e generat încă)

Fisiere: `src/features/orders/order-table.tsx`,
`src/features/deliveries/delivery-form.tsx`,
`src/features/deliveries/delivery-table.tsx`,
`src/features/client-portal/order-list.tsx`,
`src/features/client-portal/actions.ts` (comentariu),
`src/app/(client)/comenzile-mele/[id]/page.tsx`,
`src/app/(admin)/livrari/nou/page.tsx`, `src/app/(admin)/livrari/[id]/page.tsx`,
`src/app/(admin)/comenzi/[id]/page.tsx`,
`src/app/(admin)/comenzi/[id]/edit/page.tsx`.

### `src/features/assistant/prompt.ts` (system prompt)

- "Catalogul de itemi diferă după tipul comenzii" -> "Catalogul de produse
  diferă după tipul comenzii" (numele tool-urilor `itemi_vandabili`/
  `itemi_aport` raman neschimbate - sunt identificatori)
- "care include și itemii nevandabili" -> "care include și produsele
  nevandabile"
- "un item sau altă înregistrare din aplicație" -> "un produs sau altă
  înregistrare din aplicație"

### `src/features/assistant/tools/read-tools.ts` (descrieri de tool, trimise modelului)

- "Caută în datele platformei (clienți, comenzi, itemi, loturi, certificate)"
  -> "...produse, loturi, certificate..."
- "Listează itemii marcați ca vandabili..." -> "Listează produsele marcate ca
  vandabile..."
- "Listează itemii care pot fi ADUȘI de client... (itemi fizici trasați,
  inclusiv cei NEVANDABILI...)" -> "Listează produsele care pot fi ADUSE de
  client... (materiale fizice trasate, inclusiv cele NEVANDABILE...)"

### Manual in-app (`docs/manual/`)

- `README.md`: "itemi/rețete" -> "produse/rețete" in tabelul de cuprins;
  pasii 3 si 6 din fluxul rezumat rescrisi fara "itemi"/"input"/"output
  dorit"/"consum FIFO automat"; "itemi, rețete" -> "produse, rețete" in
  sectiunea finala.
- `utilizare-admin-operator.md`:
  - "Fizic (material)" -> "Material"; toate mentiunile "(Fizic/Serviciu)" ->
    "(Material/Serviciu)"
  - sectiunea 4.2 Rețete: adaugat un mic tabel "Producție"/"Reciclare" pentru
    metoda, in loc de "compunere"/"descompunere" nedefinite; "doar pentru
    materiale de tip Fizic" -> "doar pentru materiale"
  - 5.4 "Consumul de stoc (FIFO)" -> "Consumul de stoc", "FIFO implicit" ->
    "implicit în ordinea intrării"
  - 6.1: "Output fix - Fabricație" -> "Fabricație", "Output variabil -
    Reciclare" -> "Reciclare", "cantitatea de output dorită" -> "cât vrei să
    produci", "input"/"output" -> "consumat"/"rezultat" in text si in
    denumirea capturii de ecran
  - 6.2: "Inputuri (loturi consumate)"/"Outputuri (loturi create)" ->
    "Materii prime (loturi consumate)"/"Materiale rezultate (loturi
    create)"; "total input/output" -> "total consumat/rezultat"; "diferența
    input - output" -> "diferența dintre cantitatea consumată și cea
    rezultată"
  - 7.1: "consum FIFO" -> "se folosesc întâi loturile cele mai vechi";
    "orice itemi fizici" -> "orice materiale"
  - toate mentiunile "Draft" (mașina de stări, exemple) -> "Ciornă"
  - 7.2: "consum FIFO din loturile disponibile" -> "se folosesc întâi
    loturile cele mai vechi, pentru fiecare linie a comenzii"
- `utilizare-client.md`: "(Fizic/Serviciu)" -> "(Material/Serviciu)"
- `instruire.md`: "Fizic/Serviciu" -> "Material/Serviciu"; "regula FIFO" ->
  "regula «se consumă întâi loturile cele mai vechi»"; "Output fix -
  Fabricație vs. Output variabil - Reciclare" -> "Fabricație vs. Reciclare";
  "Draft -> Trimisă -> ..." -> "Ciornă -> Trimisă -> ..."; "acceptarea scade
  stocul (FIFO)" -> "acceptarea scade stocul (se consumă întâi loturile cele
  mai vechi)"; "Creează un item" -> "Creează un produs"; checklist "Pornește
  un proces «Output fix» și unul «Output variabil»" -> "«Fabricație» și unul
  «Reciclare»"
- `ghid-administrare.md`: nicio mentiune de schimbat (verificat).

### Teste actualizate

- `src/features/recipes/service.test.ts`, `src/features/recipes/actions.test.ts`:
  mesajul de eroare asteptat actualizat la noul text ("nu pentru servicii").
- `src/features/orders/order-editor.test.tsx`: `getByLabelText("Item")` ->
  `getByLabelText("Produs")`.
- `tests/e2e/manual-screenshots.spec.ts`: tab "Output variabil" -> "Reciclare",
  label-uri "Material input"/"Cantitate output dorită" -> "Material de
  reciclat"/"Cât vrei să produci", assertii "Inputuri"/"Outputuri" ->
  "Materii prime"/"Materiale rezultate".
- `tests/e2e/mvp-flow.spec.ts`: `label(page, "Item")` -> `label(page,
  "Material")` (formularele de rețetă/stoc afișau deja "Material", nu "Item"
  - testul era desincronizat de UI dinainte de acest task); tab "Output
  variabil" -> "Reciclare"; label-uri "Material input"/"Cantitate output
  dorită" -> "Material de reciclat"/"Cât vrei să produci"; comentarii
  actualizate.

## Ce NU s-a schimbat (intentionat)

- Enum-uri DB (`recipes.direction` ramane `compunere`/`descompunere`,
  `process_type` ramane `output_fixed`/`input_fixed`, `items.kind` ramane
  `physical`/`service`, `orders.status` ramane `draft`).
- Identificatori TypeScript (`RecipeDirection`, `DIRECTION_LABELS`,
  `ItemOption`, `outputItemId`, etc.) si numele tool-urilor asistentului
  (`itemi_vandabili`, `itemi_aport`).
- Rute (`/itemi`, `/retete`, `/productie`).
- Nav-ul "Materiale și servicii" (alt task).
- Abrevierea "UM" in capete de tabel/carduri mici cu spatiu limitat
  (`items-table.tsx`, `reports/format.ts`, `catalog-view.tsx`) - pastrata ca
  eticheta scurta uzuala; s-a extins doar acolo unde era intr-o propozitie
  cu spatiu suficient (label-uri de formular, hint-uri, texte de manual).

## Verificare

`pnpm typecheck && pnpm lint && pnpm test && pnpm format:check` - toate trec
(850 teste unitare, 0 erori typecheck/lint, 0 diferente prettier pe fisierele
atinse de acest task; 3 fisiere neatinse de task au deja diferente prettier
pre-existente pe `main`, in afara scopului acestui task).
