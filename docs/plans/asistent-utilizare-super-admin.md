# Utilizarea asistentului AI - vedere super-admin (fara continut)

## Cerinta

Super-adminul vrea sa vada cum folosesc organizatiile asistentul AI si daca il folosesc
corect, fara sa citeasca conversatiile (varianta 1 din discutie; accesul la continut ar
cere opt-in + clauza contractuala + jurnal de acces - nu face parte din acest task).

## Decizii

- **Doar metadate, niciun text.** Conversatiile raman PERSONALE prin RLS (0020). Nu
  adaugam politici de SELECT pentru super-admin pe `assistant_conversations`,
  `assistant_messages`, `assistant_tool_calls` (ar expune `content`, `arguments`,
  `result`). In schimb, migrarea `0053_ai_usage_insights.sql` adauga doua RPC-uri
  `security definer` care intorc DOAR contoare si verifica explicit
  `app.is_super_admin()` (altfel 0 randuri):
  - `platform_ai_user_activity(p_since)` - per (organizatie, utilizator): conversatii
    active, mesaje trimise de utilizator, zile active, ultima activitate.
  - `platform_ai_tool_activity(p_since)` - per (organizatie, utilizator, tool, status):
    numar de apeluri. Numele tool-ului e identificator de cod, nu date de business.
- Costul per utilizator vine din `ai_usage_events` (deja vizibil super-adminului, 0037).
- Rolul si emailul utilizatorului din `profiles` (super-adminul le citeste deja).
- Tipul tool-ului (citire/scriere) din registrul asistentului (`ASSISTANT_TOOLS`).

## Ecran

`/platform/ai/utilizare` (link din `/platform/ai`), perioada 7/30/90 zile (`?zile=`):

- sumar: utilizatori activi, conversatii, mesaje, propuneri de actiune, rata de confirmare;
- pe organizatii: utilizatori activi, conversatii, mesaje, citiri, propuneri
  (confirmate/respinse/esuate/fara raspuns), cost;
- pe utilizatori: aceleasi + zile active, ultima activitate si **semnale** (euristici
  simple, calculate pur in `ai-usage-insights.ts`):
  - multe propuneri respinse (>= 3 si >= 30%) - modelul nu intelege cererile;
  - multe esecuri (>= 3 si >= 20% din apeluri) - date/argumente gresite;
  - propuneri lasate fara raspuns (>= 3) - utilizatorul abandoneaza cardul;
  - multe mesaje, nicio actiune/citire (>= 20 mesaje, 0 tool-uri) - folosit ca chat
    generic, nu pe datele platformei;
  - cost mare per mesaj (> 3x media platformei, min. 5 mesaje).
- pe tool-uri: apeluri si rezultat, tipul (citire/scriere).

## Impact asistent (AGENTS.md 2.4)

Decizia: `none` - asistentul nu primeste tool nou; e un ecran de platforma.

## Teste

- unitare: agregarea si semnalele (`ai-usage-insights.test.ts`);
- DB: `supabase/tests/assistant_rls.sql` T14 - super-adminul primeste contoarele,
  adminul organizatiei si operatorul primesc 0 randuri.
