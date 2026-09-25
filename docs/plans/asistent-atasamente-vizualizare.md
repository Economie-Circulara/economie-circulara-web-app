# Asistent AI - vizualizare / descarcare atasamente din chat

Cerut: in chatul asistentului, atasamentele sa poata fi vazute (sau macar descarcate).

## Decizii

- **Ruta autentificata** `GET /asistent/atasamente/[id]` (`?descarca=1` pentru descarcare):
  `requireUser` + `getAttachment` (RLS pe sesiune - doar atasamentele proprii, ca si
  conversatiile), apoi **redirect 307 catre un URL semnat de 60s** (bucket-ul ramane privat).
- **Redirect, nu streaming prin server**: raspunsurile functiilor Vercel sunt limitate la
  4.5MB (PDF-urile pot avea 10MB), iar un HTML atasat nu e servit de pe originea
  aplicatiei (fara risc XSS pe domeniul nostru).
- Descarcarea foloseste `createSignedUrl(..., { download: fileName })` - numele original.
- UI: in bula utilizatorului, numele fisierului e link (tab nou - imaginile si PDF-urile se
  afiseaza in browser), iconita de langa il descarca. Componenta separata in
  `user-bubble-content.tsx`.

## Impact asistent (regula 2.4)

`none` - strict UI + ruta; niciun tool nou.

## Teste

`attachment-route.test.ts` (404 pe atasament strain, redirect, mod download, 502),
`attachments.test.ts` (`attachmentSignedUrl`), `attachment-rules.test.ts` (`attachmentHref`),
`user-bubble-content.test.tsx` (linkuri).

## Manual

`docs/manual/utilizare-admin-operator.md` - paragraful despre atasamente.
