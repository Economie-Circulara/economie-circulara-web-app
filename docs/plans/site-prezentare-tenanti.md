# Site de prezentare per tenant (apex `etora.ro`, `maconxcx.ro`)

## Context

Aplicatia ruleaza pe subdomeniile tenantilor (`circular.etora.ro`,
`abonamente.maconxcx.ro` - `docs/setup.md` 3.1). Pe domeniul radacina (apex) al fiecarui
client trebuie o pagina de prezentare one-page (scroll), separata de aplicatie,
hostata pe Vercel.

## Decizii (2026-09-29)

- **Monorepo**: site-ul sta in `sites/prezentare/`, cu `package.json` + lockfile
  proprii (fara pnpm workspaces - aplicatia de la radacina nu se muta).
- **Un cod, doua deploy-uri**: doua proiecte Vercel in ACELASI cont cu aplicatia
  (`etora-site`, `maconxcx-site`), Root Directory `sites/prezentare`, diferentiate
  prin `SITE_TENANT`. Repo-ul ramane public; Vercel Hobby.
- **Static** (`output: "export"`): fara server, fara formular (contact prin
  `mailto:`/`tel:` - fara date personale colectate, fara banner de cookies).
- **Tema = cea din aplicatie**: aceleasi 4 teme (`default`/`teren`/`industrial`/
  `ciclu`), tokenii copiati din `src/app/globals.css` + `src/app/themes.css`
  (doar light). La build, daca sunt setate `SUPABASE_URL` +
  `SUPABASE_PUBLISHABLE_KEY`, site-ul citeste `org_branding(p_domain = <domeniul
  aplicatiei>)` (RPC anonim, 0045) si ia **tema, numele si logo-ul** setate de
  super-admin in `/platform` - fara copiere manuala. Fara variabile sau la eroare:
  valorile din fisierul de continut.
- **Continut per tenant** in `sites/prezentare/content/<tenant>.json`, validat la
  build (`parseSiteContent`) - un camp lipsa opreste build-ul, nu publica o pagina
  goala. `draft: true` pune `noindex` pana vin textele reale de la client.
- Butoanele "Intră în cont" duc la `https://<domeniul aplicatiei>/login`.

## Sectiuni

Hero (logo, slogan, CTA) · Despre · Servicii/materiale · Trasabilitate (certificatul,
3 pasi) · Portal clienti · Contact · Footer legal (+ mentiunea finantarii UE, daca e
completata).

## Pasi

1. Scheletul `sites/prezentare` (Next static, fonturi `@fontsource` - fara retea la
   build), continut placeholder pentru Etora si Macon XCX.
2. Logica testata (vitest): validarea continutului, rezolvarea brandingului
   (RPC mock-uit: succes, eroare, fara env), clasele de tema.
3. Radacina ignora `sites/` la typecheck; ESLint + Prettier le acopera.
   CI: job separat (install, typecheck, test, build pentru ambii tenanti).
4. `docs/setup.md` 3.1.3: proiectele Vercel, Ignored Build Step, DNS apex.

## Impactul asupra asistentului AI (regula 2.4)

**Decizia: `none`** - site static, separat de aplicatie, fara date de business.

## De cerut de la client

Logo (SVG / PNG transparent), slogan, descriere 2-4 fraze, 3-6 servicii, contact,
denumire legala + CUI + Reg. Com., mentiunea obligatorie a finantarii UE (sigle, cod
SMIS), optional fotografii si cifre.
