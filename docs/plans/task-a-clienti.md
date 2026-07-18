# Task A — Clienți (plan de implementare)

> Referințe: `docs/plans/implementation-plan.md` (Task A, §8 spike S1),
> `AGENTS.md` (reguli de proces + regula "Contracte = arhivare").
> Model de stil: verticala livrată `src/features/stock/` + `src/app/(admin)/stoc/`.

## Scop

CRUD clienți (firme juridice) cu lookup CUI (precompletare + confirmare manuală),
adrese de livrare (CRUD, o singură adresă implicită per client), și modulul generic
de documente (infrastructură partajată, folosit acum pe clienți pentru arhivarea
contractelor — decizie 2026-07: "contracte = arhivare", fără gestiune structurată).

## Spike S1 — lookup CUI (rezolvat inline)

**Alegere:** serviciul public ANAF de verificare plătitor TVA, v9 —
`POST https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva`, body
`[{ cui: <numeric>, data: 'YYYY-MM-DD' }]`.

**De ce:** gratuit, fără cheie API/autentificare, sursă oficială (ANAF), acoperă
exact câmpurile cerute (denumire, adresă, nr. reg. com., înregistrare TVA).
Alternative respinse: agregatoare terțe (cost + dependență externă suplimentară),
scraping termeneonline.ro (fragil, contra ToS).

**Limitări cunoscute:** rate-limit ANAF (informal ~1 req/s per IP), disponibilitate
variabilă (mentenanță), fără CORS → apelul se face STRICT server-side. De aceea
lookup-ul e o precompletare opțională, nu o dependență obligatorie: dacă API-ul nu
răspunde (timeout/eroare), formularul rămâne complet editabil manual.

**Implementare:** `src/features/clients/cui-lookup.ts` — interfață
`CuiLookupProvider` (o singură metodă `lookup(cui)`), implementare
`AnafCuiLookupProvider`, normalizare CUI (strip `RO`, spații, dashuri) +
validare format (checksum CUI RO) înainte de orice apel de rețea, timeout scurt
(AbortController), erori tipate (`CuiNotFoundError`, `CuiLookupTimeoutError`,
`CuiLookupError` generică). Testele mock-uiesc `fetch` — nu ating rețeaua reală.

## Modulul documente (`src/features/documents/`)

Infrastructură partajată (reutilizabilă de alte verticale ulterior). Storage:
bucket privat `documents` (migrarea `0006_documents_storage.sql`, doar
`insert into storage.buckets ... on conflict do nothing`, FĂRĂ politici pe
`storage.objects` — bucketul rămâne inaccesibil direct, tot accesul trece prin
server actions cu clientul admin/service-role).

Model de acces:

- `uploadDocument` — verifică ownerul (client/order/item) prin clientul
  utilizatorului curent (RLS îi limitează la ce are voie să vadă), apoi
  încarcă fișierul ȘI inserează rândul `documents` prin clientul admin (necesar
  pentru că nu există politici pe `storage.objects`, iar RLS pe `documents`
  pentru insert e restrictiv — vezi `0001_core_schema.sql`).
- `listDocuments` — select simplu prin clientul utilizatorului (RLS filtrează).
- `getDownloadUrl` — verifică RLS pe rândul `documents` (select cu clientul
  userului), apoi semnează URL temporar cu clientul admin.
- `deleteDocument` — restricționat la staff (`requireRole`), citește
  `file_path` prin clientul userului, șterge obiectul din storage cu clientul
  admin, șterge rândul prin clientul userului (RLS ca linie secundară de
  apărare).

Validare upload: tip fișier (pdf, imagini, office) + mărime maximă 10MB
(`src/features/documents/validation.ts`).

Componente reutilizabile: `DocumentUpload` (formular cu etichetă opțională,
sugestie "Contract") și `DocumentList` (listă + descărcare + ștergere staff).

## Clienți (`src/features/clients/` + `src/app/(admin)/clienti/`)

- `/clienti` — listă (DataTable): denumire, CUI, contact, flag furnizor;
  search server-side (query param `q`, `ilike` pe nume/CUI).
- `/clienti/nou` — CUI + buton "Caută" (apelează server action de lookup direct,
  nu printr-un `<form>` — e o precompletare, nu un submit) → precompletează
  denumire/adresă/reg.com/TVA, editabile; salvare validează CUI unic per
  organizație (`unique(organization_id, cui)` din schema înghețată) și
  întoarce mesaj clar la duplicat (cod Postgres `23505`).
- `/clienti/[id]` — detaliu/editare + secțiuni: Adrese de livrare (CRUD,
  `is_default` exclusiv — la marcarea unei adrese ca implicită, celelalte sunt
  dezactivate în aceeași operațiune de scriere), Documente (modulul de mai
  sus, `ownerType: "client"`), Istoric comenzi — placeholder "În curând"
  (Task E), fără query-uri pe `orders`.

`organization_id` la creare (client / adresă) vine din sesiunea curentă
(`requireRole` → `user.organizationId`), consistent cu `with check
(app.is_staff_of(organization_id))` din RLS — nu există RPC nou pentru asta
(schema + `0004` sunt înghețate, singura migrare permisă în acest task e
`0006`, doar pentru bucket).

## Fișiere planificate

```
supabase/migrations/0006_documents_storage.sql

src/features/documents/
  types.ts
  validation.ts (+ .test.ts)
  service.ts (+ .test.ts)
  actions.ts (+ .test.ts)
  document-list.tsx
  document-upload.tsx

src/features/clients/
  types.ts
  cui-lookup.ts (+ .test.ts)
  queries.ts (+ .test.ts)
  service.ts (+ .test.ts)
  actions.ts (+ .test.ts)
  labels.ts
  client-table.tsx
  client-form.tsx
  address-section.tsx

src/app/(admin)/clienti/
  page.tsx
  nou/page.tsx
  [id]/page.tsx
```

## În afara scopului acestui task

- Nav-config, `database.types.ts`, migrările `0005`/`0007` — alte task-uri.
- Istoric comenzi real (Task E), politici storage pe `storage.objects`.
