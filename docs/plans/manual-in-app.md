# Plan - Manual de utilizare in aplicatie (`/ajutor`)

## De ce

Documentatia de utilizare exista deja completa in `docs/manual/` (4 manuale + 28 de
capturi de ecran), dar traieste doar in repo. Un utilizator care nu stie sa foloseasca
aplicatia nu are cum sa ajunga la ea: nu exista nicio ruta `/ajutor` si nicio intrare
in sidebar.

Livrabil: sectiunea **Ajutor** in aplicatie, care randeaza markdown-ul existent (poze,
tabele, cuprins pe sectiuni). `docs/manual/*.md` ramane **sursa unica de adevar** - se
citeste in continuare pe GitHub si ramane livrabil pentru Anexa 1.

Decizii luate cu clientul inainte de implementare:

- acces **doar autentificat**, filtrat pe rol;
- iteratia 1 = renderer markdown + cuprins (fara cautare in documentatie, fara ajutor
  contextual per ecran);
- asistentul AI peste documentatie (chat/RAG, MCP) e task **separat** - vezi finalul.

## Ce se construieste

### `src/features/manual/`

| Fisier | Continut |
| --- | --- |
| `registry.ts` | catalogul documentelor + filtrarea pe rol |
| `toc.ts` | extragerea h2/h3 + slug identic cu `rehype-slug` |
| `remark-heading-id.ts` | plugin remark pentru sintaxa `{#id-explicit}` |
| `links.ts` | rescrierea `img/x.png` si `foo.md#ancora` |
| `image-path.ts` | rezolvare cale + guard de path traversal |
| `loader.ts` | citirea `.md` de pe disc, memoizata |
| `manual-content.tsx` | RSC: `<ReactMarkdown>` mapat pe design system |
| `manual-toc.tsx` | RSC: cuprinsul lateral (fara JS de client) |

Rolurile pe document:

| slug | fisier | roluri |
| --- | --- | --- |
| `cuprins` | `README.md` | admin, operator, super_admin |
| `utilizare-admin-operator` | `utilizare-admin-operator.md` | admin, operator, super_admin |
| `utilizare-client` | `utilizare-client.md` | client, admin, operator, super_admin |
| `ghid-administrare` | `ghid-administrare.md` | admin, super_admin |
| `instruire` | `instruire.md` | admin, super_admin |

Clientul vede doar manualul de client. Slug interzis sau inexistent -> `notFound()`
(acelasi raspuns, ca sa nu divulgam existenta documentului). Staff-ul vede si manualul
de client, ca sa poata da suport.

### Rute - grup nou `(help)`

`/ajutor` NU poate fi definit si in `(admin)` si in `(client)` ("two parallel pages
resolve to the same path" - din acelasi motiv cautarea e deja spartaa in `/cautare` vs
`/cauta`). Deci o singura definitie, intr-un grup propriu:

- `src/app/(help)/layout.tsx` - `requireUser()` (nu `requireRole`) + `AppShell`/`Topbar`
  cu `navForRole(user.role)`; ramura separata pentru `super_admin` (n-are organizatie si
  n-are navigatie de business) - shell minimal, ca `src/app/platform/layout.tsx`;
- `src/app/(help)/ajutor/page.tsx` - index cu cate un card per document permis rolului;
- `src/app/(help)/ajutor/[slug]/page.tsx` - documentul + cuprins sticky;
- `src/app/(help)/ajutor/img/[...path]/route.ts` - capturile de ecran.

### Imaginile: route handler, nu copiere in `public/`

`docs/manual/img/` e in afara `public/` (care nici nu exista). Sunt servite de un route
handler care citeste cu `fs` din `docs/manual/img`, dupa `requireUser()`:

- sursa unica (nu dublam 5 MB in git, nu mutam folderul - `img/x.png` ramane valid si pe
  GitHub);
- respecta cerinta "doar autentificat";
- repeta precedentul din repo: `src/lib/pdf/fonts.ts` + `outputFileTracingIncludes`.

Varianta "script `prebuild` copiaza in `public/manual/img`" a fost respinsa: cu pnpm 10
si fara `.npmrc`, scripturile `pre*`/`post*` nu ruleaza automat, iar imaginile ar deveni
publice fara autentificare.

`next/image` nu se poate folosi pe o ruta pazita (optimizatorul face fetch server-side,
fara cookie-urile userului) - randam `<img loading="lazy">`.

Nu filtram imaginile pe rol: sunt capturi pe date demo, iar maparea fiecarei imagini pe
document ar adauga complexitate fara castig real. Decizie asumata.

### Navigatie

`HELP_NAV_ITEM` este o **constanta separata**, adaugata de `navForRole()` la finalul
listei fiecarui rol. NU se pune in `STAFF_NAV`: testul "guard: clientul nu ajunge pe
ecranele staff" din `tests/e2e/routes-smoke.spec.ts` itereaza `STAFF_NAV` si cere
redirect pentru client, iar clientul are voie pe `/ajutor`.

Iconita: `BookOpen` (in lucide-react v1 `HelpCircle` a fost redenumit
`CircleQuestionMark`).

### Corecturi in documentatia existenta

1. `docs/manual/README.md` - paragraful "nu contine inca capturi de ecran" e fals
   (exista 23 de referinte `![](img/...)`); se rescrie cu locul capturilor, comanda de
   regenerare si mentiunea rutei `/ajutor`.
2. `<descriere ecran>` si `<nume item>` sunt, conform CommonMark, taguri HTML brute:
   react-markdown le arunca si textul apare trunchiat. Fix in sursa (backtick-uri),
   corect si pe GitHub.
3. Cele 3 placeholdere `[Captura de adaugat: ...]` raman (lipsa lor tine de datele de
   seed - vezi `task-manual-screenshots.md`), dar sunt randate ca nota discreta.
4. `docs/index.md` - mentiune ca manualele sunt citibile si in aplicatie.

## Teste

Unitare (colocate, mocks): `registry`, `toc`, `remark-heading-id`, `links`,
`image-path`, `loader`, plus un test de randare pentru `manual-content`.

E2E: testele pozitive din `routes-smoke.spec.ts` trec pe `navForRole(rol)`, ca `/ajutor`
sa intre automat in acoperire; `tests/e2e/ajutor.spec.ts` verifica indexul filtrat pe
rol, randarea unui document cu imagine incarcata efectiv (`naturalWidth > 0`), 404 pe
document interzis si redirect la `/login` pentru nelogat.

## Ramas de facut (nu in acest task)

- cautare full-text in documentatie si buton de ajutor contextual per ecran;
- cele 3 capturi lipsa (cer date de seed cu o comanda livrata, pentru retur);
- asistent AI: (1) chat/RAG peste `docs/manual/` cu link catre sectiunea din `/ajutor`,
  (2) agent cu tool-uri peste datele proprii (sub sesiunea userului, ca RLS sa ramana in
  vigoare), (3) server MCP read-only. Cheia LLM: la nivel de platforma sau per
  organizatie (criptata, configurabila in `/setari`) - decizie de luat la inceputul
  acelui task.
