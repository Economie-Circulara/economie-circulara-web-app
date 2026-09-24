# Rețetă vizuală: cantități reale + bară de proporții (PR 1)

Stacked pe PR #47 (branch `claude/serene-fermat-avrce6`).

## Problemă

Rețetele se stochează în procente (`recipe_components.percentage` +
`conversion_factor`, AGENTS.md §4). Utilizatorii non-tehnici gândesc în cantități
reale ("la 1 tonă beton: 150 kg ciment, 200 kg apă, 650 kg nisip") și greșesc des
conversia manuală la procente. Stocarea rămâne procente - se schimbă doar UX-ul de
input.

## Decizie de scop (faza 1)

- Modul nou de input **"Cantități reale"** lucrează DOAR cu componente în **aceeași
  UM ca rețeta** (fără conversii). O componentă cu UM diferită e afișată dezactivată
  în selectul de adăugare, cu indicație să folosească modul clasic ("Procente
  (avansat)"), unde conversia rămâne disponibilă ca azi.
- Modul clasic ("Procente (avansat)") rămâne neschimbat funcțional - același
  formular adaugă/actualizează o componentă cu procent + factor de conversie.
- Salvarea din modul de cantități scrie exact aceleași date (`percentage`,
  `conversion_factor = 1`) prin `service.ts` existent (funcție nouă
  `addOrUpdateComponents`, care reapelează `addOrUpdateComponent` per rând - aceeași
  validare, fără cod nou de validare).

## Calcul (modul pur, testat izolat)

`src/features/recipes/quantity-calc.ts`:

- `distributeExact` - rotunjire "largest remainder" ca suma rotunjită să fie mereu
  exactă (nu doar suma rotunjirilor independente).
- `quantitiesToPercentages` / `percentagesToQuantities` - conversie cantități UM
  rețetă <-> procente, folosind `distributeExact`.
- `computeSegmentWidths` - lățimile (in %) ale segmentelor barei, normalizate la
  suma procentelor curente (poate fi >100% la Producție cu pierderi, <100% la
  Reciclare - AGENTS.md §4, fără validare a sumei).
- `applyDividerDrag` - mută granița dintre două segmente adiacente, transferă
  puncte procentuale între ele, respectă blocarea (`locked`).
- `scaleQuantities` - calculatorul "Pentru [X] {unitate}".

## UI

- `recipe-editor.tsx`: tab-uri "Cantități reale" (implicit) / "Procente (avansat)".
- `quantity-editor.tsx`: cantitate de bază + rânduri (material + cantitate reală),
  bară de proporții, buton "Salvează rețeta".
- `proportion-bar.tsx`: bară stivuită 100% lățime, un segment colorat per
  componentă, cu granițe trăgabile (pointer + tastatură - săgeți stânga/dreapta,
  Shift = pas fin) și buton de blocare per segment.

## Impact asistent AI (§2.4)

**Decizie: `none`.** PR-ul schimbă doar UX-ul de editare a rețetelor (input în
cantități reale în loc de procente) - nu adaugă date noi, nu expune un tool nou de
citire/scriere pentru `src/features/assistant/tools/registry.ts`. Asistentul
continuă să vadă rețetele exact ca înainte (procente + factor de conversie).

## Testare

- `quantity-calc.test.ts`: conversii cantități<->procente, rotunjire cu sumă
  exactă, batch zero/gol, procente >100% (Producție cu pierderi) și <100%
  (Reciclare), `applyDividerDrag` (blocare, clamp la 0), `scaleQuantities`.
- `service.test.ts`: `addOrUpdateComponents` reapelează validarea existentă per
  rând.
