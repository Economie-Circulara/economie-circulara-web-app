# Rețete: extragere din text cu AI (PR 2)

Stacked pe PR 1 ("Rețete: cantități reale + bară de proporții",
`docs/plans/reteta-vizuala.md`) și, tranzitiv, pe PR #47.

## Problemă

Utilizatorii au adesea rețeta gata scrisă undeva - o fișă tehnică, un tabel copiat
din Excel, o etichetă - și ar prefera să o lipească, nu să o retranscrie manual pe
materie primă. Acest PR adaugă un al treilea tab în editorul de rețetă, **"Din text
(AI)"**, care extrage structura din text și o încarcă drept CIORNĂ în tab-ul
"Cantități reale" (PR 1) - nimic nu se salvează fără trecerea explicită prin
confirmarea/salvarea de acolo.

## Design

1. **Furnizorul AI** - reutilizează `src/features/assistant/provider.ts`
   (`getChatProvider()`/`isChatProviderConfigured()`) - NU se adaugă un SDK nou.
   Fără chei configurate (`ASSISTANT_API_URL`/`ASSISTANT_API_KEY`/`ASSISTANT_MODEL`),
   tab-ul arată o stare dezactivată prietenoasă, fără să apeleze nimic.
2. **Prompt strict JSON** (`ai-extract-prompt.ts`) - cere modelului DOAR un obiect
   JSON `{batchQuantity, unit, components: [{name, quantity, unit}]}`. Textul lipit
   de utilizator e marcat explicit ca DATE DE EXTRAS, nu instrucțiuni (siguranță la
   prompt injection) - dar protecția reală e mai jos, la parsare.
3. **Parsare + validare strictă, fără încredere** (`ai-extract-parse.ts`) - respinge
   orice răspuns care nu se potrivește exact schemei (tipuri, câmpuri lipsă, prea
   multe componente, texte prea lungi). Răspunsul modelului e CITIT ca date simple,
   niciodată executat sau interpretat ca instrucțiuni - un nume de componentă care
   "arată" ca o comandă rămâne un simplu șir de caractere în UI.
4. **Potrivire fuzzy cu materialele organizației** (`ai-extract-match.ts`) - nume
   normalizate (minuscule, fără diacritice) + similaritate Levenshtein (fără
   dependință nouă). Candidații vin din `listItemOptions({kind: "physical"})` -
   RLS-ul clientului sesiunii filtrează automat la organizația curentă. Sub un prag
   (0.6), componenta rămâne nepotrivită - utilizatorul o leagă manual sau o ignoră.
   Itemii arhivați (migrarea `0035`, PR #50) sunt excluși automat -
   `listItemOptions` filtrează `archived_at is null`.
5. **Server action** `extractRecipeFromTextAction` (`ai-extract-actions.ts`) -
   orchestrează: verifică furnizorul configurat -> verifică quota (`assistant/quota.ts`,
   ACEEAȘI limită de mesaje ca asistentul - un apel AI în plus nu ocolește plafonul
   comercial) -> apelează furnizorul -> `trackUsage` -> parsează -> potrivește.
6. **UI** (`ai-extract-tab.tsx`) - textarea + buton "Extrage rețeta" + lista
   rezultatelor (potrivire + scor, sau "Nepotrivit - alege manual") + buton "Încarcă
   în Cantități reale". Apasarea butonului populează `QuantityEditor` (PR 1) cu un
   `QuantityDraft` (cantitate de bază + rânduri) - componentele nepotrivite (sau cu
   UM diferită de a rețetei - fără conversii în faza 1) intră ca rânduri
   NEREZOLVATE (`componentItemId: ""`), cu un select inline pentru alegere manuală
   sau un buton de scoatere din listă.

## Impact asistent AI (§2.4)

**Decizie: NU e un tool al asistentului** (`src/features/assistant/tools/registry.ts`
rămâne neschimbat) - e o funcționalitate AI separată, în afara conversației
asistentului:

- Nu e apelabilă de model din chat (nu are `name`/`parameters`/`execute` ca un
  `AssistantTool`) - e un buton dedicat, dintr-un ecran specific (editorul de
  rețetă), nu ceva ce utilizatorul "cere" asistentului în conversație.
- Nu produce o propunere de scriere (`assistant_tool_calls`) - salvarea rămâne
  exclusiv prin `saveQuantityComponentsAction` (PR 1), cu revizuirea explicită a
  utilizatorului în `QuantityEditor` înainte de submit; extragerea AI doar
  PRE-COMPLETEAZĂ formularul, la fel cum ar face un import CSV.
- **Consumă totuși aceeași quota** (`assistant_usage`, prin `trackUsage`) - altfel
  ar fi un canal AI gratuit, nenumărat, care ocolește plafonul comercial per
  organizație/utilizator (regula din AGENTS.md §4 despre quota).

## Testare

- `ai-extract-parse.test.ts` - schema validă, bloc markdown, text fără JSON, câmpuri
  lipsă/invalide, listă goală, prea multe componente, siguranță prompt injection
  (numele unei componente conține text "instrucțiune" - rămâne doar date).
- `ai-extract-match.test.ts` - normalizare diacritice, similaritate (exact,
  substring, fără legătură), potrivire peste/sub prag, fără candidați, prag custom.
- `ai-extract-actions.test.ts` - furnizor neconfigurat (stare dezactivată), text gol,
  quota blocată (nu apelează furnizorul), fluxul complet (extrage + potrivește +
  consumă quota), eroare de furnizor, răspuns neinterpretabil - toate cu furnizorul
  AI, quota și `listItemOptions` mock-uite (fără server real).

## Ce rămâne deschis

- Fără conversii de UM la încărcarea draft-ului - o componentă potrivită cu o UM
  diferită de a rețetei rămâne nerezolvată (utilizatorul o leagă manual, în modul
  avansat, dacă vrea conversia).
- Potrivirea e doar după nume (Levenshtein) - fără sinonime/alias-uri per
  organizație; poate fi îmbunătățită ulterior dacă apar cazuri reale de eșec.
