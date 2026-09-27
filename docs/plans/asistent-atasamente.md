# Asistent AI - atasamente in chat (imagini / PDF) + imagine pe produs (PR 1 din 2)

Cerut: upload de documente in chat. Cazul 1 (acest PR): o imagine atasata devine poza
unui produs. Cazul 2 (PR urmator, `asistent-import-pdf.md`): un PDF cu retete din care
AI-ul extrage datele si le adauga in sistem.

## Decizii

- **Upload direct din browser in Storage, cu URL semnat** (`createSignedUploadUrl`), nu
  prin server action: Vercel limiteaza corpul unei cereri la 4.5MB, iar un PDF poate fi
  mai mare. Server action-ul doar valideaza (tip, marime), inregistreaza atasamentul si
  emite URL-ul semnat.
- **Bucket PRIVAT `assistant-attachments`** (documentele pot contine date ale clientilor),
  path `${organization_id}/${user_id}/${attachment_id}`. Fara politici pe
  `storage.objects` - upload prin URL semnat, citire prin clientul admin DUPA ce randul
  din `assistant_attachments` a fost citit pe sesiunea utilizatorului (RLS).
- **Tabel `assistant_attachments`** (migrarea 0036): metadate + RLS `user_id = auth.uid()
  and app.is_staff_of(organization_id)` - asistentul (care ruleaza pe sesiunea
  utilizatorului) nu poate folosi atasamentul altcuiva, chiar daca modelul ghiceste un ID.
- **Referinta in mesaj**: mesajul utilizatorului se salveaza cu linii
  `📎 [nume.pdf](attachment:<id>)` - modelul vede ID-ul in istoric (si in turele
  urmatoare), UI-ul le afiseaza ca etichete de fisier.
- Tipuri: PNG/JPEG/WEBP/GIF (max 2MB - limita pozei de produs) si PDF (max 10MB).
  Doar staff (admin/operator): clientul nu are tool-uri care sa foloseasca atasamente.
- DeepSeek nu primeste imagini/PDF: modelul vede doar numele si tipul fisierului.

## Tool nou (regula 2.4)

`write` - `seteaza_imagine_produs { item_id, attachment_id }`, card **generic** cu un camp
nou de tip `image` (previzualizare prin URL semnat, doar afisare). Executie: descarca
atasamentul, revalideaza (tip/marime ca la formularul de produs), il urca la
`item-images/${itemId}/image` (acelasi helper ca formularul, mutat in
`items/image-storage.ts`) si seteaza `items.image_url`.

## Teste

`attachments.test.ts` (validare, referinte in mesaj), `attachment-write-tools.test.ts`,
`action-card.test.tsx` (camp imagine), `registry.test.ts`. RLS: test nou in
`supabase/tests/assistant_rls.sql`.

## Manual

`docs/manual/utilizare-admin-operator.md` §13 - atasamente.

## Extra (cerut in timpul task-ului)

Campul de mesaj devine `textarea` (`chat-input.tsx`, creste pana la ~6 randuri): Enter
trimite, Shift+Enter adauga rand nou, Enter in timpul compunerii IME nu trimite.
