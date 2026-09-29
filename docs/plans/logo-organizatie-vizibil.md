# Logo-ul organizatiei vizibil si adaptat (sidebar, login, homepage)

## Problema

- Sidebar: logo-ul era fortat intr-un patrat de 28px (`size-7`) langa nume - un logo
  orizontal (simbol + nume) devenea o dunga ilizibila.
- Login (`h-12`) si homepage (`h-8`): la fel de mic.
- Logo-urile generate vin pe panze mari (1254x1254, 1983x793) cu mult spatiu alb in
  jur, deci desenul ocupa doar o parte din spatiul alocat.

## Solutie

1. **`OrgBrand`** (`src/components/org-brand.tsx`, client): afiseaza logo-ul + numele,
   cu forma detectata din dimensiunile naturale ale imaginii (`onLoad`):
   - **orizontal** (latime/inaltime >= 2): logo-ul ocupa latimea disponibila, numele
     ramane doar pentru cititoare de ecran (logo-ul il contine deja);
   - **compact** (patrat / simbol): logo marit + numele scris langa / sub el;
   - **fara logo**: numele (in sidebar si initialele, ca inainte).
   Variante: `sidebar` (max 56px inaltime), `header` (homepage, max 48-56px),
   `login` (max 112px). Logo-ul primeste o placa alba discreta (`.org-logo`), ca sa
   ramana lizibil pe sidebar-uri inchise si in tema dark.
2. **Decupare automata la upload** (`trimLogo`, `src/features/settings/logo-processing.ts`,
   `sharp` - dependinta directa acum): marginile uniforme din PNG/JPEG/WEBP se taie;
   SVG/GIF raman neatinse; la eroare se incarca fisierul original.
3. Setari: previzualizare dreptunghiulara + recomandarea variantei orizontale.

Logo-urile deja incarcate NU sunt decupate retroactiv - se re-incarca din Setari.

## Impact asistent AI (regula 2.4)

- Decizia: `none` - strict prezentare.

## Teste

- `org-brand.test.tsx`: praguri de forma, afisare nume per forma, heading pe login.
- `logo-processing.test.ts`: decupare PNG/WEBP/JPEG, SVG neatins, fallback la eroare.
