# Task B — Itemi, Catalog (definiție) & Rețete (plan de implementare)

> Referințe: `docs/plans/implementation-plan.md` (Task B), `AGENTS.md` (reguli de
> proces + regulă „Rețetele sunt în procente; fără versionare").
> Model de stil: verticala livrată `src/features/stock/` + `src/app/(admin)/stoc/`.

## Scop

CRUD itemi (produse fizice + servicii/abonamente PaaS) și editor de rețete
(componente în procente, sumă informativă). Migrare nouă `items.kind` pentru a
susține cerința revizuită Anexa 1 („gestionarea tipurilor de produse și servicii
furnizate") — vezi nota PaaS din plan.

## Migrare — `0005_item_kind.sql`

Aditivă peste schema înghețată `0001_core_schema.sql`: enum nou `public.item_kind`
(`physical | service`) + coloană `items.kind not null default 'physical'` + index
`items_kind_idx (organization_id, kind)`. Fără prețuri (contract deja luat:
platforma nu gestionează tarife/facturare).

**Decizie de design — restricția „rețetă doar pentru itemi fizici":** nu se
impune printr-un `CHECK` inter-tabel (Postgres nu suportă CHECK-uri care citesc
alt tabel fără trigger) ci la nivel de aplicație, în
`src/features/recipes/service.ts#createRecipe` — se citește `items.kind` din DB
înainte de a crea rândul `recipes` și se respinge cu eroare clară dacă itemul e
`service`. Editorul de rețete (`/retete/[itemId]`) arată direct un mesaj
informativ (fără formular) dacă itemul e serviciu, în loc să permită o cerere
care oricum ar fi respinsă de service.

`database.types.ts` actualizat manual (fără `pnpm gen:types`, Docker blocat în
mediul agentic): enum `item_kind` adăugat în `Enums`/`Constants`, coloana `kind`
adăugată în `items.Row/Insert/Update`, poziționate alfabetic ca restul schemei
generate.

## Itemi (`src/features/items/` + `src/app/(admin)/itemi/`)

- `/itemi` — listă (DataTable): titlu (link), tip (badge fizic/serviciu, propriul
  `Badge` — nu `STATUS_REGISTRY` partajat, ca să nu ating un fișier comun folosit
  de alte verticale), UM, vandabil (da/nu), are rețetă (da/nu — derivat dintr-un
  query separat pe `recipes.item_id`, agregat în JS, la fel ca restul
  aggregărilor din task). Filtre: tip, vandabil; căutare (`ilike` pe titlu).
- `/itemi/nou` și `/itemi/[id]` — același `ItemForm`, acțiune diferită
  (`createItemAction` / `updateItemAction`) după prezența prop-ului `item`:
  titlu, descriere (textarea simplă — nu există primitivă `Textarea` în
  `src/components/ui/`, stil identic cu select-urile inline din
  `stock/lot-form.tsx`), UM (select enum), tip (select `item_kind`), vandabil
  (checkbox), URL poză (`image_url`, câmp text simplu — FĂRĂ upload de fișiere,
  modulul de documente e alt task).
- `organization_id` la creare vine din sesiune (`requireRole` →
  `user.organizationId`), consistent cu politica `items_staff_all`.

## Rețete (`src/features/recipes/` + `src/app/(admin)/retete/`)

Cheie de navigare: **item, nu recipe id** (`/retete/[itemId]`) — reflectă
`unique(item_id)` din schemă (o rețetă per item) și evită un pas suplimentar de
lookup recipe→item în UI.

- `/retete` — listă agregată: item, nr. componente, sumă procente (badge
  ok/warn). Agregare în JS din două query-uri simple (`recipes` +
  `recipe_components`), fără embed-uri Supabase pe 2 niveluri (nefolosite încă
  în alte verticale — risc de tipare fragile cu `database.types.ts` întreținut
  manual).
- `/retete/nou` — alege un item fizic fără rețetă încă
  (`listPhysicalItemsWithoutRecipe`) → creează rândul `recipes` (gol) →
  redirect la editor.
- `/retete/[itemId]` — dacă itemul nu are încă rețetă, arată doar butonul
  „Creează rețeta"; altfel editor complet: listă componente + ștergere +
  formular adăugare/actualizare (`component_item_id` + `percentage`, `upsert`
  pe `unique(recipe_id, component_item_id)` — re-selectarea unui item deja
  prezent îi actualizează procentul, fără pas separat de „editare").
- **Suma procentelor e strict informativă** (`validation.ts#isPercentageSumComplete`):
  badge de avertisment dacă diferă de 100%, dar salvarea NU e blocată — regula
  vine din handoff („Rețetele sunt în procente; fără versionare") și e
  confirmată explicit în task (nu blochează salvarea).
- **Auto-referință interzisă**: un item nu poate fi componenta propriei rețete.
  Verificare cu `item_id`-ul rețetei citit din DB (nu din input-ul formularului),
  la fel ca `recordStockEvent` din `stock/service.ts` (nu se are încredere în
  organization_id/relații venite din client).
- Validările pure (`validatePercentage`, `validateNotSelfReference`,
  `sumPercentages`, `isPercentageSumComplete`) sunt izolate în `validation.ts`
  pentru testare fără mock-uri de Supabase.

## Fișiere livrate

```
supabase/migrations/0005_item_kind.sql

src/features/items/
  types.ts, labels.ts
  queries.ts (+ .test.ts)
  service.ts (+ .test.ts)
  actions.ts (+ .test.ts)
  item-form.tsx, items-table.tsx

src/features/recipes/
  types.ts
  validation.ts (+ .test.ts)
  queries.ts (+ .test.ts)
  service.ts (+ .test.ts)
  actions.ts (+ .test.ts)
  recipe-editor.tsx, recipe-new-form.tsx, create-recipe-button.tsx, recipes-table.tsx

src/app/(admin)/itemi/
  page.tsx, nou/page.tsx, [id]/page.tsx

src/app/(admin)/retete/
  page.tsx, nou/page.tsx, [itemId]/page.tsx
```

`database.types.ts` — doar adăugirile `item_kind`/`items.kind` (vezi diff).
`nav-config.ts` — doar intrarea „Itemi" (icon `Package`), înainte de „Rețete".

## În afara scopului acestui task

- `src/features/clients/`, `src/features/documents/`, `src/features/platform/`,
  migrările `0006`/`0007+` — alte task-uri paralele (Task A, Task I).
- Upload de imagine pentru item (doar câmp `image_url` text) — modulul de
  documente e alt task.
- Versionare de rețete — explicit exclusă de handoff.
