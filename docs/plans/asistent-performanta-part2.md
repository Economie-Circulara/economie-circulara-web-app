# Asistent AI - performanta, partea 2 (PR 2 din 2)

Continuare dupa `docs/plans/asistent-performanta-quick-wins.md` (PR #53, pe care acest
PR e construit).

## Problema

Dupa quick wins raman cauzele structurale ale „nu înțelege” / „merge greu”:

1. O runda de model = un singur tool (`parallel_tool_calls: false`). O comanda cu 3
   produse inseamna 3 runde doar pentru cautarea produselor.
2. Rezultatele tool-urilor nu raman in istoric intre ture: la „da, adaugă și nisip”
   modelul nu mai are `client_id`-ul gasit in tura anterioara.
3. Cautarile sunt `ilike '%text%'` pe tot textul: „Beton SRL” nu gaseste
   „SC BETON S.R.L.”, „pietris” nu gaseste „Pietriș” - runde irosite pe cautari goale.
4. Nicio reactie vizuala in timpul unei ture lungi (fara streaming).

## Schimbari

- **Citiri paralele** (`run.ts#converse`, `provider.ts`): apelurile paralele sunt
  permise; toate citirile dintr-o runda se executa (`Promise.all`) si revin intr-un
  singur pas. Daca runda contine o scriere, DOAR prima scriere devine propunere, restul
  se ignora - regula „o actiune o data” ramane, dar e impusa in cod, nu la furnizor.
- **Date de referinta intre ture** (`facts.ts`): din rezultatele citirilor (si din
  rezultatul unei scrieri confirmate) se extrag doar campurile de identificare (`*_id`,
  denumire, UM, link, status...), plafonate la 2500 caractere, salvate ca mesaj `tool`
  in `assistant_messages` (rolul exista din 0020 si e deja ascuns in UI).
  `historyToMessages` le lipeste la urmatorul mesaj assistant (fara doua mesaje
  assistant consecutive). `HISTORY_LIMIT` 20 -> 30.
- **Cautare toleranta** (`tools/fuzzy-match.ts`): fara diacritice, majuscule,
  punctuatie si forma juridica (SC/SRL/SA/PFA...), toate cuvintele in orice ordine.
  `listeaza_clienti`/`itemi_vandabili`: filtrul din DB intai, iar daca e gol, lista
  completa filtrata tolerant. `itemi_aport`/`stoc_disponibil` filtrau deja in JS ->
  acum tolerant. Filtrele de arhivare raman neschimbate (fara `includeArchived`).
- **System prompt**: citiri multiple permise, refolosirea „Date de referință”, o
  reincercare cu termen mai scurt inainte de a intreba utilizatorul.
- **Indicator de lucru** (`pending-indicator.tsx`): textul se schimba dupa timpul scurs
  si afiseaza secundele. Streaming real (pasii reali in UI) ramane un follow-up - cere
  un route handler cu stream in locul server action-ului.

## Impact asupra asistentului (regula 2.4)

Decizie: `read` - tool-uri modificate (fara schimbare de schema/versiune):
`listeaza_clienti`, `itemi_vandabili`, `itemi_aport`, `stoc_disponibil` (cautare
toleranta). Niciun tool de scriere nou; fluxul propunere -> confirmare -> executie
neschimbat, cu test de regresie pt. runda mixta citire + scriere.

## Teste

- `facts.test.ts`, `tools/fuzzy-match.test.ts`, `pending-indicator.test.tsx` (noi).
- `run.test.ts`: citiri paralele, runda mixta -> o singura propunere, salvarea si
  retrimiterea datelor de referinta.
- `tools/read-tools.test.ts`: fallback-ul tolerant.
- `tests/e2e/asistent.spec.ts`: asteapta indicatorul dupa rol, nu dupa text.
