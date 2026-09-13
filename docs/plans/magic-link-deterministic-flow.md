# Flux magic link determinist

## Context

Magic link-urile Supabase ajung in productie pe domeniul canonic
`https://www.lotculot.eu`, dar ultimele incercari au alternat intre callback PKCE cu
`code` si verificare directa cu `token_hash`. Originea callback-ului este dedusa acum
din headerul `Host`, ceea ce face fluxul dependent de domeniul de pe care a fost cerut
linkul si de allowlist-ul hosted Supabase.

## Obiectiv

Pastram autentificarea prin magic link, dar folosim un flux predictibil:

- toate emailurile Auth folosesc originea canonica configurata;
- template-ul Magic Link trimite direct `token_hash` la callback-ul aplicatiei;
- callback-ul lasa diagnostic sigur in loguri fara sa expuna tokenuri;
- configurarea hosted necesara este documentata si verificabila.

## Implementare

1. Adaugam `NEXT_PUBLIC_SITE_URL` in configurarea documentata si un helper comun care
   normalizeaza URL-ul canonic, cu fallback la host doar in mediile unde variabila nu
   este setata.
2. Folosim helper-ul comun pentru magic link, OAuth, resetarea parolei si invitatii,
   eliminand implementarile duplicate ale `siteOrigin()`.
3. Instrumentam `/auth/callback` cu loguri structurate pentru modul de verificare,
   codul/statusul erorii Supabase si erorile de lookup ale profilului. Nu logam query
   string-ul, `code`, `token_hash`, emailul sau cookie-urile.
4. Documentam configurarea de productie:
   - Site URL si Redirect URL exacte pentru `https://www.lotculot.eu`;
   - template Magic Link bazat pe `{{ .RedirectTo }}`, `{{ .TokenHash }}` si
     `type=magiclink`;
   - click tracking dezactivat in providerul email.
5. Adaugam teste unitare pentru normalizarea originii canonice, folosirea ei in
   actiunea de magic link si diagnosticul callback-ului.
6. Pastram compatibilitate cu emailurile deja generate prin fluxul implicit Supabase.
   Un bridge client-side detecteaza fragmentul `#access_token=...`, il elimina imediat
   din bara de adrese, valideaza perechea access/refresh prin `setSession()` si continua
   spre dashboard sau setarea parolei. Tokenurile nu sunt trimise catre server si nu
   sunt logate.

## Verificare

- teste unitare tintite pentru helper, actiuni Auth si callback;
- `pnpm typecheck`;
- `pnpm lint`;
- `pnpm test`;
- verificare operationala in productie cu un link nou, generat dupa salvarea
  template-ului hosted.
