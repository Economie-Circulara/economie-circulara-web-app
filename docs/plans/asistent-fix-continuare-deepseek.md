# Asistent AI - fix continuare dupa confirmare (DeepSeek) + actiuni anuntate

## Problema (raportata)

Conversatie: „adaugă clientul cu CUI X și fă o comandă de test”.

1. Modelul a raspuns „…Propun mai întâi crearea clientului:” FARA sa apeleze tool-ul;
   cardul a aparut abia dupa inca un mesaj al utilizatorului („well?”).
2. Dupa confirmarea cardului, clientul s-a creat, dar in chat a aparut eroarea bruta
   DeepSeek: „The reasoning_content in the thinking mode must be passed back to the API”.

## Cauze

1. Comportament al modelului: incheie runda anuntand actiunea. Bucla trata orice raspuns
   fara tool call ca raspuns final.
2. `messagesForContinuation` construia: istoric (… user „well?”, assistant „Am pregătit
   acțiunea…”) + assistant(tool_calls, CoT) + tool. In thinking mode DeepSeek cere
   `reasoning_content` pe FIECARE mesaj assistant de dupa ultimul mesaj user - raspunsul-
   text al propunerii nu il avea -> 400. Iar `ChatProviderError` purta mesajul brut al
   furnizorului, lipit direct dupa „Gata: …”.

## Schimbari

- `run.ts#messagesForContinuation`: mesajele assistant de la coada istoricului (textul
  propunerii + datele de referinta) devin `content` al mesajului assistant(tool_calls),
  care are CoT-ul - un singur mesaj assistant dupa ultimul user.
- `provider.ts`: in thinking mode, un mesaj assistant cu tool_calls fara CoT (ex.
  propunere salvata cu thinking oprit) primeste `reasoning_content: ""` (plasa de
  siguranta).
- `ChatProviderError`: `message` = text in romana pentru utilizator (dupa status: 429,
  401/403, altele); eroarea bruta in `detail` + `console.error`, nu in chat.
- Continuarea dupa confirmare: daca furnizorul pica, raspunsul ramane „Gata: …” + „Nu am
  putut continua automat… scrie «continuă»”.
- `run.ts#converse`: `looksLikeAnnouncedAction` (text terminat in „:” sau „propun /
  pregătesc…”, fara intrebare) -> un singur impuls in aceeasi tura („apelează tool-ul
  acum”); textul anuntului se pastreaza in raspuns. + regula 2b in system prompt.

## Impact asupra asistentului (regula 2.4)

`none` - registrul de tool-uri neschimbat; se schimba bucla si furnizorul.

## Teste

`provider.test.ts` (mesaj afisabil vs detail, CoT gol), `run.test.ts` (ordinea mesajelor
la continuare, eroare la continuare, impuls o singura data, recunoasterea anuntului).
