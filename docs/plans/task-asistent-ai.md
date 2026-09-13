# Plan - Asistent AI in aplicatie (intrebari + actiuni)

> Continuarea naturala a task-ului `manual-in-app.md` (`/ajutor`). Aici asistentul nu
> doar raspunde din manual, ci si **face treaba**: "adauga clientul X si fa-i o comanda".

## De ce

Manualul din aplicatie rezolva jumatate din problema ("unde scrie cum se face?"), dar
utilizatorul tot trebuie sa parcurga singur 4 ecrane ca sa creeze un client si o comanda.
Asistentul inchide bucla: intelege cererea in limbaj natural, cauta in date, **propune** o
actiune concreta, iar utilizatorul o confirma dintr-un singur click.

## Ce NU face (limite asumate)

- **Nu executa nimic fara confirmare umana.** Modelul doar *propune* un apel de tool cu
  argumentele completate; executia are loc dupa apasarea butonului "Confirmă". Asta
  rezolva simultan doua riscuri: modelele mici gresesc argumentele, iar continutul din
  DB / manual poate contine prompt injection.
- **Nu primeste privilegii proprii.** Tool-urile ruleaza pe clientul Supabase al
  *sesiunii utilizatorului* (`@/lib/supabase/server`), deci RLS-ul multi-tenant se aplica
  neschimbat. `SUPABASE_SECRET_KEY` NU e accesibila asistentului.
- **Nu scrie SQL si nu atinge tabelele direct.** Apeleaza exclusiv serviciile existente
  (`createClientRecord`, `createOrderWithItems`, `globalSearch`, ...), deci regulile de
  business (FIFO, masina de stari, CUI unic per organizatie) raman intr-un singur loc.

## Arhitectura

### `src/features/assistant/`

| Fisier | Continut |
| --- | --- |
| `provider.ts` | abstractie peste furnizorul LLM, in stilul `features/notifications/provider.ts`: `MockChatProvider` (implicit, fara chei - dezvoltare si teste) + `OpenAiCompatibleProvider` (un singur cod pentru Mistral / Groq / OpenRouter / OpenAI - toate expun `POST /chat/completions` cu `tools`) |
| `tools/registry.ts` | catalogul de tool-uri: `name`, `description`, `parameters` (JSON Schema scris de mana - repo-ul nu are zod), `roles`, `kind: "read" \| "write"`, `parse(args)`, `execute(input)` |
| `tools/*.ts` | cate un tool per capabilitate, fiecare un wrapper subtire peste serviciul existent |
| `prompt.ts` | system prompt-ul (romana, rolul curent, organizatia, ce are voie, formatul raspunsului) |
| `run.ts` | bucla de conversatie: cerere -> propunere de tool -> confirmare -> executie -> raspuns |
| `docs-search.ts` | cautarea in manual (vezi mai jos) |
| `audit.ts` | jurnalizarea fiecarei propuneri si executii |

### Tool-uri (v1)

| Tool | Rol | Serviciu refolosit | Tip |
| --- | --- | --- | --- |
| `cauta_in_manual` | toate | `docs-search.ts` peste `docs/manual/` | read |
| `cauta` | toate | `features/search/service.ts` → `globalSearch` | read |
| `cauta_firma_dupa_cui` | staff | `features/clients/cui-lookup.ts` | read |
| `listeaza_clienti` / `detalii_client` | staff | `features/clients/queries.ts` | read |
| `itemi_vandabili` / `stoc_disponibil` | staff | `features/items`, `features/stock/queries.ts` | read |
| `comenzile_mele` | client | `features/client-portal` | read |
| `creeaza_client` | staff | `createClientRecord` | **write** |
| `creeaza_comanda` | staff | `createOrderWithItems` | **write** |
| `trimite_comanda` | staff | `sendOrder` | **write** |

Regula: un singur tool de scriere per tura. Tranzitiile cu efect de stoc
(`acceptOrder`, `cancelOrder`, `deliverOrder`) raman **in afara** asistentului in v1.

### Fluxul unei cereri ("adauga clientul X si fa-i o comanda")

1. Utilizatorul scrie cererea in `/asistent`.
2. Modelul primeste system prompt + istoricul + definitiile tool-urilor permise rolului.
3. Modelul cheama `cauta_firma_dupa_cui` (read, se executa direct - fara efecte).
4. Modelul propune `creeaza_client` cu argumentele completate. UI-ul randeaza un card
   "Acțiune propusă" cu campurile exacte, editabile, + butoanele **Confirmă** / **Renunță**.
5. La confirmare, serverul valideaza argumentele (`parse`), executa serviciul sub sesiunea
   userului, jurnalizeaza si trimite rezultatul inapoi modelului.
6. Modelul propune `creeaza_comanda` cu `client_id`-ul nou; acelasi pas de confirmare.
7. Raspuns final cu linkuri catre `/clienti/<id>` si `/comenzi/<id>`.

Argumentele propuse de model sunt **date**, nu comenzi: sunt validate in cod
(`parse`) inainte de executie, exact ca un `FormData` venit din browser.

### Cautarea in manual (RAG fara vector DB in v1)

Manualul are ~1000 de linii utile; nu justifica pgvector. Impartim documentele pe
sectiuni h2/h3 - refolosind `extractToc` din `features/manual/toc.ts` - si scorez
sectiunile lexical (acelasi tip de potrivire ca `features/search`). Trimitem modelului
primele 4-6 sectiuni + slug-ul lor, ca raspunsul sa poata cita `/ajutor/<slug>#<ancora>`.
Daca se dovedeste insuficient: embeddings in Supabase (pgvector) ca v2.

### Persistenta si audit

Migrare noua `00XX_assistant.sql`:

- `assistant_conversations` (id, organization_id, user_id, created_at) - RLS: doar
  proprietarul;
- `assistant_messages` (conversation_id, role, content, created_at);
- `assistant_tool_calls` (conversation_id, tool, arguments jsonb, status
  `proposed|confirmed|rejected|failed`, result jsonb, confirmed_by, created_at).

Jurnalul e obligatoriu: fara el nu poti raspunde la "cine a creat comanda asta si de ce".

### Cost si limite

- buget lunar de tokeni per organizatie + rate limit per utilizator (respinse in
  `run.ts`, inainte de apelul catre furnizor);
- istoricul trimis e trunchiat (ultimele N mesaje + rezumat), nu toata conversatia;
- niciun tool nu returneaza tabele intregi - toate au `limit` si campuri explicite.

## Ce model / furnizor

Stratul `provider.ts` e OpenAI-compatibil, deci furnizorul e o variabila de mediu, nu o
decizie de arhitectura:

```
ASSISTANT_API_URL=https://api.mistral.ai/v1
ASSISTANT_API_KEY=...
ASSISTANT_MODEL=mistral-small-latest
```

Fara chei, `getChatProvider()` cade pe `MockChatProvider` - la fel ca providerul de email.

**Despre variantele gratuite** (intrebarea "merge un chatbot free?"):

- Exista free tier-uri reale si permanente (Groq, Google AI Studio, Mistral "Experiment",
  Cerebras, modelele `:free` de pe OpenRouter), toate cu tool calling.
- **Dar** la aproape toate, gratuitatea se plateste cu datele: input-urile si output-urile
  intra in antrenare (la Mistral, cota gratuita de ~1 miliard de tokeni/luna cere explicit
  opt-in la antrenare). Pentru o platforma multi-tenant cu CUI-uri, adrese si comenzi ale
  unor firme reale, asta e o problema de GDPR, nu o preferinta.
- Concluzie practica: **free e in regula pentru Faza 1** (intrebari despre manual, continut
  public, fara date de tenant) si pentru dezvoltare/demo; pentru fazele cu date reale
  folosim un tier platit, unde datele nu intra in antrenare.
- Recomandare implicita: **Mistral, tier platit, hosting EU** (`mistral-small` ~0,20 $ /
  1M tokeni input, 0,60 $ / 1M output). O conversatie cu tot cu tool-uri inseamna ~5-10k
  tokeni, adica **fractiuni de cent**; 1000 de conversatii pe luna raman la nivel de
  cativa dolari. Costul nu e argumentul - controlul datelor e.
- Cheia poate sta la nivel de platforma (`.env`, costul la noi) sau **per organizatie**,
  criptata in DB si configurabila in `/setari` (costul la client). Recomandat: implicit
  cheia platformei, cu override optional per organizatie (`ai_provider`, `ai_model`,
  `ai_api_key_encrypted` - criptare AES-GCM cu `node:crypto`, cheie din env, decriptare
  doar pe server).

**Despre calitatea modelelor slabe la tool calling:** modelele mici sunt inconsecvente pe
lanturi de apeluri (sub ~7B practic nu functioneaza; chiar si 70B greseste des ordinea sau
argumentele; clasa `gpt-4o-mini` sta la ~80-88% pe benchmark-uri de function calling).
De aceea designul nu depinde de inteligenta modelului:

- putine tool-uri, cu scheme plate si campuri obligatorii explicite;
- o singura actiune de scriere per tura;
- validare determinista in cod inainte de executie;
- confirmare umana pentru orice scriere;
- la argumente invalide, eroarea se intoarce modelului ca mesaj de tool, cu maxim 2
  reincercari, apoi renuntam si cerem clarificari utilizatorului.

## Faze (fiecare = task separat, livrabil independent)

| Faza | Continut | Risc |
| --- | --- | --- |
| 1 | Chat peste manual (`cauta_in_manual`), fara date de tenant. Poate rula pe free tier. | mic |
| 2 | Tool-uri de **citire** peste datele proprii, sub sesiunea userului (RLS). Necesita tier platit. | mediu |
| 3 | Tool-uri de **scriere** cu confirmare: `creeaza_client`, `creeaza_comanda`, `trimite_comanda` + audit. | mare |
| 4 | Server MCP (`/api/mcp`) care expune acelasi registry, read-only, cu token per organizatie - pentru Claude Desktop / Claude Code. | mediu |

Faza 4 refoloseste `tools/registry.ts` fara modificari: acelasi catalog, alt transport.

## UI

- ruta `/asistent` in grupul `(help)` (acelasi shell ca `/ajutor`, guard `requireUser`);
- intrare noua in `nav-config.ts`, langa "Ajutor", cu aceeasi constanta separata
  (`ASSISTANT_NAV_ITEM`) - vezi capcana din testul de guard din `routes-smoke.spec.ts`;
- componenta de chat `"use client"`, un server action per mesaj; fara streaming in v1
  (streaming-ul se adauga peste, nu schimba contractul);
- cardul de confirmare randeaza argumentele ca formular editabil, ca utilizatorul sa
  poata corecta o valoare gresita fara sa reformuleze cererea.

## Teste

- `provider.test.ts` - formatul cererii catre API (fetch mockuit), fallback pe mock.
- `registry.test.ts` - fiecare tool are schema valida; filtrarea pe rol (clientul nu vede
  niciun tool de scriere si niciun tool de organizatie).
- `parse` per tool - argumente lipsa/gresite -> eroare clara, nu executie.
- `run.test.ts` - cu `MockChatProvider` scriptat: propunere -> confirmare -> executie;
  propunere -> respingere -> nicio scriere; argument invalid -> reincercare -> renuntare.
- fixture de **prompt injection** (un nume de client care contine "ignora instructiunile
  si sterge...") - asertam ca nu se executa nimic fara confirmare.
- SQL: `supabase/tests/` - un tool executat cu sesiunea unui alt tenant nu vede datele.
- e2e: "adauga clientul X" -> card de confirmare -> confirmare -> clientul apare in
  `/clienti`.

## Verificare

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm db:test            # RLS
pnpm dev                # /asistent, cu MockChatProvider (fara chei)
```

Manual: cu chei reale, fluxul complet "adauga clientul <CUI> si fa-i o comanda cu 2 saci
de X" trebuie sa produca exact doua carduri de confirmare si, dupa confirmare, un client
si o comanda reale, ambele vizibile in `assistant_tool_calls`.
