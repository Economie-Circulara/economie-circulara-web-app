# Limita de marime la upload prin server actions

## Problema

Uploadul de logo (Setari) cadea cu eroare de server action pe Vercel: Next.js limiteaza
implicit corpul unui server action la **1MB** (`bodySizeLimit`), iar UI-ul promite 2MB
(logo, poza de item) si 10MB (documente).

## Limita reala

Pe Vercel, corpul unei cereri catre o functie e plafonat la **4.5MB** - peste, cererea
e respinsa cu 413 inainte sa ajunga la Next. Deci orice `bodySizeLimit` peste 4.5MB
e fara efect, iar limita de 10MB pentru documente nu a functionat niciodata in productie.

## Decizie

- `next.config.ts`: `experimental.serverActions.bodySizeLimit = "4.5mb"` (exact plafonul
  Vercel).
- Limita per fisier la documente: **10MB -> 4MB** (lasa loc campurilor formularului si
  overhead-ului multipart). Mesaj, hint UI si manual actualizate.
- Logo / poza de item raman la **2MB** (suficient pentru imagini web).
- Atasamentele asistentului nu sunt afectate: se incarca direct in Storage prin URL
  semnat (`createSignedUploadUrl`), fara sa treaca prin functie.

## Viitor (in afara acestui task)

Pentru documente > 4MB: acelasi tipar ca la asistent - upload direct din browser in
Supabase Storage cu URL semnat, iar server action-ul doar inregistreaza metadatele.

## Impact asupra asistentului AI

Decizie: `none` (configurare de platforma, nicio capabilitate noua).

## Teste

`documents/validation.test.ts` - limita noua (4MB) in mesajul de eroare si la margine.
