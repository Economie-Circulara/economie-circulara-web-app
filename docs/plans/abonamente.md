# Abonamente: ecran și meniu separat de Materiale

## Context

`items.kind` are doar `physical` | `service` (fără modificări de DB/enum în acest
task - opțiunea A, aprobată de utilizator). Ambele tipuri erau afișate pe un singur
ecran `/itemi` ("Materiale și servicii"). Cerința: în UI, "serviciu" pentru un item
devine "Abonament" (product-as-a-service), cu ecran + rută + intrare de meniu
separate de Materiale. Enum-urile DB (`item_kind.service`, `order_type.serviciu`)
NU se ating - doar etichetele RO și organizarea ecranelor.

## Plan

1. **Rute noi `/abonamente`** (grup `(admin)`), oglindind `/itemi`:
   - `/abonamente/page.tsx` - listă filtrată `kind = "service"` (fără selector de
     tip, fixat de ecran), reutilizează `listItems`/`ItemsTable`.
   - `/abonamente/nou/page.tsx` - `ItemForm` cu `kind` fixat pe `"service"`, fără
     selector de tip vizibil pe formular (nici pe `/itemi/nou`).
   - `/abonamente/[id]/page.tsx` - `ItemForm` de editare, `notFound()` dacă itemul
     nu e `kind = "service"` (nu poți edita un material din ecranul de abonamente).
   - `ItemForm` primește un prop `fixedKind?: ItemKind` - când e dat, ascunde
     selectorul de tip și îl fixează prin `<input type="hidden">`.
2. **`/itemi` rămâne doar Materiale**: filtrează `kind = "physical"` implicit (nu
   mai e opțional în UI), titlu "Materiale", fără selectorul de tip (devenit inutil
   - ecranul e deja filtrat). Ruta rămâne `/itemi` (breaking-change minim).
3. **Helper `itemHref(item)`** în `src/features/items/labels.ts` (sau fișier nou
   `item-links.ts`) - `kind === "service" ? /abonamente/${id} : /itemi/${id}`.
   Înlocuiește toate `` `/itemi/${id}` `` care pot ținti un item de tip `service`:
   `items-table.tsx`, `search/service.ts` (`searchItems`), `assistant/tools/read-tools.ts`
   (`itemiVandabili`, `itemiAport`).
4. **Nav** (`nav-config.ts` + `sidebar.tsx`): grup "Stoc" -> "Materiale" (href
   `/itemi`) + intrare nouă "Abonamente" (href `/abonamente`, icon nou
   `NavIconName = "subscriptions"`, mapat în `sidebar.tsx` la `Repeat` din
   `lucide-react`). Respectă regula RSC 4.2 (identificator, nu componentă).
5. **Etichete**: `KIND_LABELS.service` -> `"Abonament"`, `.physical` -> `"Material"`
   (`src/features/items/labels.ts`). `ORDER_TYPE_LABELS.serviciu` -> `"Abonament"`,
   `ORDER_TYPE_DESCRIPTIONS.serviciu` -> `"Abonament (product-as-a-service), cu dată
   estimată de retur."` (`src/features/orders/labels.ts`) - doar eticheta, valoarea
   enum `serviciu` (DB, tool-uri asistent) rămâne neschimbată.
6. Text UI cu "serviciu"/"servicii" (referitor la kind item, nu la enum/business
   term generic) -> "abonament"/"abonamente": `retete/[itemId]/page.tsx`,
   `retete/nou/page.tsx` (link + label breadcrumb -> "Materiale"), `itemi/*`,
   `comenzi/nou/page.tsx`, `assistant/assistant-page-content.tsx`,
   `assistant/tools/*` (descrieri, NU valorile enum trimise ca literal JSON schema).
7. Catalogul clientului (`client-portal/catalog-view.tsx`) reutilizează deja
   `KIND_LABELS` - se actualizează automat.
8. **`tests/e2e/routes-smoke.spec.ts`** ia rutele din `STAFF_NAV` automat - noua
   rută `/abonamente` intră fără modificări acolo (dar verificăm manual că
   randerul nu pică - fixture-uri de test dacă e nevoie).
9. Teste unitare noi/actualizate: `itemHref`, filtrarea `/itemi` pe `physical`,
   pagina `/abonamente` (dacă există teste de pagină similare pt. `/itemi`),
   `KIND_LABELS`/`ORDER_TYPE_LABELS` (dacă sunt testate direct), `sidebar.test.tsx`
   (icon nou).
10. `docs/manual/` - actualizează secțiunea despre catalogul de materiale/servicii
    dacă există, cu mențiune despre ecranul separat de Abonamente.

## Impact asistent AI (regula 2.4)

**Decizie: `none`** pe partea de capabilități (nu se adaugă/schimbă tool-uri) -
tool-urile existente (`itemi_vandabili`, `itemi_aport`, `creeaza_comanda`) rămân
funcțional identice, RPC-urile/serviciile pe care le apelează nu se ating.
Modificare doar de:
- **wording** în descrierile de tool-uri (`serviciu` -> `abonament` unde e text
  liber, NU valoarea enum `tip_comanda = "serviciu"` din schema JSON) și în
  `prompt.ts`/`assistant-page-content.tsx`.
- **linkurile** întoarse de `itemi_vandabili`/`itemi_aport` (`link: /itemi/${id}`)
  trec prin `itemHref()` ca să țintească `/abonamente/${id}` pentru itemii
  `kind = "service"` - fix de corectitudine a linkului afișat omului, nu o
  capacitate nouă.

Niciun card de confirmare nou, niciun tool nou - fără modificări la
`tools/registry.ts`/`registry.test.ts`.

## Regulă nouă de business/naming (AGENTS.md §3 sau §4)

De adăugat la commit: în UI, itemii `kind = "service"` se numesc "Abonament" (nu
"Serviciu") - denumirea de produs-ca-serviciu (PaaS) e mai clară pentru
utilizatorii platformei decât termenul generic. Enum-ul DB (`item_kind.service`,
`order_type.serviciu`) rămâne neschimbat - e cost de migrare, nu regulă de business;
schimbarea e strict de etichetare (label), ecran (`/abonamente` separat de
`/itemi`) și navigare.
