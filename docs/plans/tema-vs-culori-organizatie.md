# Plan - Tema aleasa de super-admin vs. culorile din Setari (conflict)

## Problema

Tema vizuala (`organizations.theme`, aleasa de super-admin in `/platform`) si culorile
white-label din Setari (`primary_color` / `secondary_color`, alese de adminul
organizatiei) se aplicau AMBELE: culorile adminului suprascriau paleta temei (brand +
accent), deci tema aleasa de platforma nu se vedea.

## Decizie (2026-09-28)

**Tema are prioritate.** Culorile din Setari se aplica DOAR pe tema implicita
(„Clasic”), care devine tema „cu culori proprii”. Pe orice alta tema:

- shell-ul (sidebar, butoane), PDF-urile si harta de rute folosesc culorile temei;
- in Setari, cardul „Culori” e inlocuit de un mesaj: aspectul e dat de tema <X>,
  aleasa de echipa platformei;
- culorile salvate NU se sterg (revin daca organizatia trece inapoi pe „Clasic”) -
  actiunea de salvare nu mai scrie culorile cand campurile lipsesc din formular.

## Implementare

- `src/features/branding/brand-colors.ts#orgBrandColors(org)` - singura sursa pentru
  „ce culori ale organizatiei se aplica”: `{ brand, accent }` pe tema implicita,
  `{}` altfel. Folosit in layout-urile `(admin)`, `(client)`, `(help)`, in
  `pdfBrandFor` si la culoarea rutei recomandate (`/livrari`).
- `SettingsForm` primeste tema; `updateOrganizationAction` actualizeaza culorile doar
  daca vin in formular.
- Manual (ghid-administrare 1.2 / 3.3) actualizat.

## Impact asistent AI

`none`.

## Teste

`brand-colors.test.ts`, `pdf-brand.test.ts` (culorile org ignorate pe o tema
non-implicita), `actions.test.ts` (culorile nu se sterg cand lipsesc din formular).
