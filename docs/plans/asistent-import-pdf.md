# Asistent AI - import de retete dintr-un PDF atasat (PR 2 din 2)

Continuare dupa `docs/plans/asistent-atasamente.md` (atasamente in chat).

Cerut: utilizatorul ataseaza un PDF cu o lista de retete (sau altceva), iar AI-ul extrage
informatia si o adauga in sistem.

## Limita modelului

DeepSeek (`deepseek-chat`) primeste doar TEXT. Deci: PDF-uri cu strat de text (exportate
din Word/Excel) - da; PDF-uri scanate / poze cu tabele - nu (ar cere OCR sau un model cu
viziune; etapa separata, cu alegerea furnizorului - ex. Mistral OCR, hosting UE).

## Schimbari

- `pdf-text.ts` - textul PDF-ului pe pagini, cu `unpdf` (pdf.js, merge serverless);
  detecteaza PDF-urile scanate (fara text).
- Tool `citeste_document` (`read`) - textul unui PDF atasat, in bucati de 12000 de
  caractere (`de_la` / `continuare`), ca documentele lungi sa poata fi citite in mai multi
  pasi. Plafon de rezultat propriu (`AssistantTool.maxResultChars`) - cel implicit (6000)
  l-ar taia. Imaginile / PDF-urile scanate intorc o eroare explicativa, nu exceptie.
  Util si pentru alte documente, nu doar retete (modelul poate raspunde din ele).
- Tool `importa_retete` (`write`, card DEDICAT `recipe_import`):
  - modelul trimite retetele cu NUMELE din document (produs, materii prime) si procente
    sau cantitati (+ cantitatea de baza) - fara ID-uri; cantitatile se transforma in
    procente la parsare;
  - cardul potriveste automat numele cu materialele organizatiei (acelasi algoritm ca
    tab-ul „Din text (AI)”, `ai-extract-match.ts`), arata ce n-a gasit („În document:
    «bitum» - alege-l din listă”), debifeaza produsele care au deja reteta si permite
    corectarea produsului, metodei si a fiecarei materii prime;
  - o SINGURA confirmare pentru tot importul (regula „o actiune o data” ramane: e o
    singura actiune), maxim 20 de retete;
  - executie secventiala: fiecare reteta e verificata INAINTE de creare (produs ales,
    fara reteta existenta, materiale alese, fara auto-referinta / duplicate) - nu raman
    retete goale; rezultatul spune ce s-a creat si ce s-a sarit si de ce.
- `recipe-components-editor.tsx` - editorul de materii prime extras din cardul
  `recipe_draft`, refolosit de `recipe_import`.
- System prompt: regula 15 (documente).

## Extra: documente text (cerut in timpul task-ului)

Pe langa PDF, se pot atasa si citi fisiere text intalnite in practica: TXT, Markdown,
CSV/TSV (export din Excel), HTML (convertit la text - fara tag-uri, scripturi, stiluri),
JSON, XML - max. 2MB. Tipul se deduce din EXTENSIE (`resolveMimeType`): browserele dau des
un tip gol (`.md`) sau gresit (`.csv` -> `application/vnd.ms-excel` pe Windows). Migrarea
`0038_assistant_text_attachments.sql` extinde bucket-ul si constrangerea din
`assistant_attachments`. `document-text.ts` alege extragerea dupa tip; BOM-ul UTF-8 al
CSV-urilor din Excel se elimina. DOCX/XLSX raman pentru mai tarziu (cer parsere dedicate).

## Impact asupra asistentului (regula 2.4)

`read`: `citeste_document`. `write`: `importa_retete`, rander dedicat `recipe_import`
(liste de retete cu liste de materii prime - n-au ce cauta intr-un card generic).
Manual §13 actualizat.

## Teste

`pdf-text.test.ts`, `tools/document-tools.test.ts` (bucati de text, erori, parse
cantitati->procente, potrivire, executie cu retete sarite), `recipe-import-card.test.tsx`,
`registry.test.ts`.
