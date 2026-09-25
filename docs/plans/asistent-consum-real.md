# Asistent AI - consum real (tokeni + cost), nu doar numar de mesaje

Status: **validat 2026-09-25** (deciziile - sectiunea 5). **Etapele 1 si 2 implementate** (sectiunile 6-7).

## 1. Ce avem azi

- Quota = **MESAJE**: 200/luna per organizatie + 20/zi per utilizator (`quota.ts`,
  `organizations.ai_*`, schimbabile doar de super-admin).
- Un mesaj al utilizatorului = 1 unitate, indiferent ce a costat.
- Tokenii se salveaza doar ca TOTAL (`assistant_usage.input_tokens / output_tokens`, pe zi
  si utilizator), din `usage.prompt_tokens / completion_tokens`. Nu separam cache hit /
  cache miss, nu stim modelul si nu calculam costul.
- Extragerea de retete din text (tab „Din text (AI)”) consuma din aceeasi quota (1 mesaj).

## 2. Ce arata datele DeepSeek (15-25 sept 2026, cheia lotculot.ro)

| Zi | Model | Request-uri | Input/request | Output/request | Cache hit | $/request | Cost |
| -- | ----- | ----------: | ------------: | -------------: | --------: | --------: | ---: |
| 20.09 | flash | 33 | 3.7k | 309 | 91% | 0.00025 | 0.0081 |
| 20.09 | v4-pro | 23 | 4.1k | 207 | 78% | 0.00107 | 0.0245 |
| 23.09 | v4-pro | 9 | 4.4k | 205 | 75% | 0.00119 | 0.0107 |
| 25.09 | v4-pro | 31 | **10.0k** | **540** | 79% | **0.00260** | 0.0807 |

Total perioada: 102 request-uri, **$0.126**.

Concluzii:

1. **Un mesaj ≠ un request.** Bucla de tool-uri face 1-12 apeluri de model per mesaj
   (cauta clientul -> cauta produsele -> propune). Un „salut” costa 1 request; un import
   din PDF (text de 12k caractere retrimis la fiecare pas) poate costa de 10-30x mai mult.
   Numarul de mesaje nu spune nimic despre cost.
2. **Costul pe request a crescut de ~2.4x** intre 20 si 25 sept (4k -> 10k tokeni input):
   mai multe tool-uri in schema, istoric mai lung, date de referinta. E normal, dar trebuie
   masurat, altfel nu-l vedem.
3. **Costul e dominat de input necache-uit (~50-60%) si output (~35-40%)**; input-ul din
   cache (~79% din tokeni!) costa doar ~7%. Deci „tokeni totali” e si el o masura proasta:
   100k tokeni din cache costa cat ~3k tokeni noi.
4. **Modelul conteaza enorm**: v4-pro ≈ 7x mai scump pe request decat flash.
5. **Preturile se schimba** (flash: pretul pe 15.09 e dublu fata de 17.09 - reduceri /
   ore off-peak). Costul trebuie calculat cu pretul din momentul consumului.
6. Ordinul de marime e mic: la ~$0.003-0.01 per mesaj (v4-pro), 200 de mesaje/luna ≈
   **$1-2 per organizatie**. Riscul real nu e media, ci cazurile extreme (PDF-uri mari,
   bucle lungi) si un utilizator care abuzeaza.

## 3. Cum ar trebui sa arate ideal

### 3.1 Masurare exacta (fundatia)

- Din raspunsul furnizorului citim tot ce da:
  - DeepSeek: `prompt_cache_hit_tokens`, `prompt_cache_miss_tokens`, `completion_tokens`,
    `completion_tokens_details.reasoning_tokens`;
  - OpenAI-compatibil generic: `prompt_tokens_details.cached_tokens` (fallback: tot input-ul
    = miss).
- **Registru per apel de model** - tabel nou `ai_usage_events` (migrare):
  `organization_id, user_id, conversation_id?, feature ('assistant' | 'recipe_extract' |
  ...), model, input_cache_hit, input_cache_miss, output, reasoning, cost_micros (USD x
  1e6), created_at`. Volumul e mic (zeci-sute de randuri/zi/org). Din el se poate raspunde
  la orice: cost per mesaj, per conversatie, per utilizator, per model.
- `assistant_usage` (agregat zilnic) primeste coloanele noi (hit/miss/cost/requests),
  actualizate atomic in acelasi RPC - quota ramane o interogare ieftina.
- **Tabel de preturi** `ai_model_prices` (model, pret per 1M: input_hit, input_miss, output,
  valabil_de_la), editabil de super-admin. Costul se calculeaza la inregistrare, cu pretul
  valabil atunci -> istoricul nu se schimba cand se schimba pretul. Model necunoscut ->
  pret implicit conservator + avertisment in log.
- Un singur punct de contorizare (`recordUsage`) folosit de ORICE apel AI (asistent,
  continuare dupa confirmare, rezumatul la limita de pasi, extragerea de retete, importul
  din PDF) - azi fiecare cheama `trackUsage` separat.

### 3.2 Unitatea aratata utilizatorului

Optiuni:

| Unitate | Pro | Contra |
| ------- | --- | ------ |
| Mesaje (azi) | simplu de inteles | nu reflecta costul (1 „salut” = 1 import PDF) |
| Tokeni | exact | nimeni nu stie ce e un token; cache-ul il face inselator |
| Lei / USD | exact | expune marja; pare „taximetru”, sperie utilizatorul |
| **Credite AI** (recomandat) | reflecta costul real, e o unitate de produs | trebuie explicat o data |

**Recomandare: credite AI.** 1 credit = un cost fix intern (ex. $0.001, configurabil).
Bugetul lunar al organizatiei e in credite (ex. 2.000 credite ≈ $2). Fiecare raspuns
consuma credite dupa costul real, rotunjit in sus (minim 1). Pe card:

- bara lunara: „Ai folosit 34% din creditele AI ale lunii (680 / 2.000)”;
- echivalent intuitiv: „≈ 250 de întrebări simple rămase” (din media reala a
  organizatiei);
- sub fiecare raspuns, discret: „3 credite” (optional, poate fi vizibil doar adminului);
- ce „costa mult” e explicat: „Importul din PDF consumă mai mult - documentul e citit în
  întregime.”

### 3.3 Limite

- **Lunar per organizatie**: buget in credite (super-admin), ca acum limita de mesaje.
- **Zilnic per utilizator**: procent din bugetul lunar (ex. 20%) in loc de numar fix -
  scaleaza automat cu planul.
- **Plafon per tura** (nou): maxim N credite / M tokeni input intr-o singura tura; la
  depasire bucla se opreste cu rezumatul existent („ce am aflat / ce lipseste”) - protejeaza
  de bucle scapate de sub control si de PDF-uri uriase.
- **Limita moale**: tura in curs se termina chiar daca depaseste bugetul (nu stim costul
  dinainte); urmatorul mesaj e blocat. Prag de avertizare la 80% (banner + email adminului
  organizatiei, prin notificarile existente).
- Pre-verificare pentru actiuni scumpe cunoscute (import PDF): estimare din marimea
  documentului („Documentul are ~40 pagini, importul va consuma ~150 credite. Continui?”).

### 3.4 Vizibilitate

- **Utilizator**: cardul de consum (credite, echivalent, azi).
- **Admin organizatie** (Setari -> AI): consum pe luna si pe utilizator, cele mai
  „scumpe” conversatii, tendinta zilnica.
- **Super-admin** (platforma): cost real USD per organizatie si per model, cost mediu per
  mesaj, rata de cache hit, marja fata de planul vandut; comparatie lunara cu factura
  DeepSeek (import manual al CSV-ului de usage, ca cele atasate - reconciliere).

### 3.5 Optimizari de cost pe care masurarea le face posibile (dupa, nu acum)

- Model „rapid” (flash, ~7x mai ieftin) pentru pasii de cautare si model „bun” (pro) doar
  pentru pasul care propune actiunea / raspunsul final.
- Prefix stabil (system prompt + schema tool-urilor neschimbate intre request-uri) ca sa
  ramana cache hit mare; schema tool-urilor filtrata dupa context (nu toate 30 la fiecare
  pas).
- Documentele PDF: rezumat / extragere intr-un apel separat, nu retrimise integral la
  fiecare pas al buclei.

## 4. Etape de implementare propuse

1. **Masurare** (fara schimbari vizibile pentru utilizatori): parsare usage complet,
   `ai_usage_events`, `ai_model_prices` + ecranul de super-admin `/platform/ai`,
   `recordUsage` unic, cost calculat. Quota ramane pe mesaje. ~1 PR.
2. **Credite + limite**: migrare `ai_monthly_credit_limit`, zilnic ca procent, plafon per
   tura, card nou, mesaje de blocare; conversie automata a planurilor existente (200 mesaje
   -> credite echivalente din media masurata in etapa 1). ~1 PR.
3. **Rapoarte**: admin organizatie + super-admin (+ import CSV DeepSeek pentru
   reconciliere). ~1 PR.
4. (Optional) optimizarile din 3.5.

Etapa 1 merita facuta oricum: dupa 1-2 saptamani de date reale stim exact cat costa un
mesaj mediu si putem alege corect valoarea creditului si bugetele.

## 5. Decizii (2026-09-25)

1. Unitatea: **credite AI** - da.
2. Buget inclus: **~$2/organizatie/luna ≈ 2.000 credite** - da (valoarea exacta a
   creditului se fixeaza dupa datele din etapa 1).
3. Costul per raspuns: **vizibil doar adminilor** - da.
4. **Limita moale** (tura curenta se termina, urmatorul mesaj e blocat) - da.
5. Preturile modelelor: **in super-admin** - design mai jos.

### 5.1 Gestionarea preturilor (super-admin)

- **Tabel versionat, append-only** `ai_model_prices` (model, pret per 1M tokeni pentru
  input din cache / input nou / output, `valid_from`, cine l-a introdus, nota). Un pret nou
  NU modifica randul vechi - adauga o versiune; costul fiecarui apel se calculeaza la
  inregistrare cu versiunea valabila atunci si se salveaza (`cost_micros`) -> istoricul si
  rapoartele nu se schimba retroactiv cand DeepSeek isi schimba preturile.
- **Modelul se ia din raspunsul furnizorului** (`payload.model`, ex. `deepseek-v4-pro`),
  nu din `ASSISTANT_MODEL` - numele din raspuns e cel din factura (vezi CSV-urile).
- **Pret implicit (`*`)**: folosit pentru un model fara pret propriu, setat conservator
  (preturile celui mai scump model). Ecranul de super-admin arata explicit „modele folosite
  fara pret propriu” ca sa fie completate.
- **Calculul se face in DB** (RPC `security definer`): tenantii nu pot citi preturile si
  nici scrie costuri - pot doar raporta tokenii propriului apel.
- **Ecran `/platform/ai`**: preturile curente + istoric, formular „pret nou” (cu
  `valid_from`, implicit acum), consumul pe ultimele 30 de zile pe organizatie (request-uri,
  tokeni cache/nou/output, cost USD, cost mediu per mesaj) si pe model.
- Mai tarziu (etapa 3): import CSV DeepSeek (cele atasate) pentru reconciliere - diferenta
  dintre costul calculat si cel facturat (ex. reduceri off-peak).

## 6. Etapa 1 - ce s-a implementat

- Migrarea `0037_ai_usage_metering.sql`: `ai_model_prices` (seed: `deepseek-v4-pro`,
  `deepseek-flash`, `*`), `ai_usage_events`, coloane noi pe `assistant_usage`
  (`requests`, `input_cache_hit`, `cost_micros`), RPC `assistant_record_usage`.
- `provider.ts#parseUsage`: cache hit/miss (DeepSeek + OpenAI), tokeni de rationament,
  modelul din raspuns.
- `quota.ts#recordUsage` inlocuieste `trackUsage` - folosit de asistent (mesaj, fiecare
  pas, rezumatul la limita de pasi, continuarea dupa confirmare) si de extragerea de
  retete din text.
- `/platform/ai` (super-admin): totaluri, pe organizatii, pe modele, preturi + istoric,
  formular de pret nou, avertisment pentru modele fara pret propriu.
- Quota ramane pe mesaje (neschimbata pentru utilizatori).

## 7. Etapa 2 - credite AI (implementata)

- Migrarea `0039_ai_credits.sql`:
  - `ai_platform_settings` (un singur rand): `credit_micros` (valoarea unui credit, implicit
    1000 = $0.001) si `turn_credit_limit` (plafon per tura, implicit 100 credite; 0 = fara
    plafon). Citire: orice utilizator autentificat (quota se calculeaza pe sesiunea lui);
    scriere: doar super-admin.
  - `organizations.ai_monthly_credit_limit` (implicit 2000 ≈ $2) si
    `ai_daily_user_credit_percent` (implicit 20%; 0 = fara plafon zilnic). Garda
    `app.enforce_ai_limits` acopera si coloanele noi. Coloanele vechi de mesaje raman
    (nefolosite de quota), mesajele se numara in continuare pentru statistici.
- Quota (`quota.ts`): credite folosite = `ceil(sum(cost_micros) / credit_micros)` - lunar pe
  organizatie, zilnic pe utilizator; limita zilnica = procent din bugetul lunar; avertizare
  de la 80%; estimare „≈ N întrebări rămase” din costul mediu per mesaj al organizatiei
  in luna curenta.
- Limita moale: se verifica INAINTE de tura; tura in curs se termina.
- Plafon per tura: `recordUsage` intoarce costul apelului (din RPC); bucla se opreste cand
  tura depaseste `turn_credit_limit` si raspunde cu rezumatul „ce am aflat / ce lipseste”.
- Cost per raspuns vizibil doar adminilor: `AssistantTurn.turnCredits` (doar pentru rolurile
  admin / super-admin), afisat discret sub raspuns.
- UI: cardul „Credite AI luna aceasta” cu explicatie (buton „i” cu panou: ce e un credit, de
  ce consuma diferit, bugetul comun, plafonul zilnic, resetarea), bara, procent, estimarea
  de intrebari ramase, consumul de azi.
- Super-admin `/platform/ai`: valoarea creditului + plafonul per tura; limitele fiecarei
  organizatii (credite/luna, procent zilnic, activ).
- Amanate: email de avertizare la 80%, estimarea inainte de un import PDF mare, rapoartele
  pentru adminul organizatiei (etapa 3).

## Impact asupra asistentului (regula 2.4)

`none` pe tool-uri; se schimba contorizarea si quota.
