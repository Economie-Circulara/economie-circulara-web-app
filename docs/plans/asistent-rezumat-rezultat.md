# Asistent AI - rezumatul rezultatului unei actiuni

Cerut: dupa executia unei actiuni confirmate, un mesaj clar - „Am adăugat clientul Y,
click aici ca să-l vezi” sau „Nu s-a putut adăuga comanda X, pentru că… încearcă din nou”.

## Schimbari

- `AssistantTool.resultSummary(input, result)` (nou, obligatoriu pe tool-urile `write` -
  verificat in `registry.test.ts`): ce s-a intamplat, la timpul trecut, cu datele din
  rezultat (denumire, numar comanda, distanta rutei…).
- `result-summary.ts`: `successMessage` = „✅ <resultSummary> [Vezi clientul](/clienti/…)” -
  linkul vine din `result.link` (doar rute interne), eticheta dupa ruta;
  `failureMessage` = „⚠️ Nu am reușit: <summary>. **Motiv:** … Nu s-a modificat nimic.
  Spune-mi ce să corectez și propun din nou acțiunea.”
- `run.ts#confirmAction` foloseste cele doua in locul „Gata: …” / „Acțiunea nu a putut
  fi executată: …”. Mesajul e determinist (nu depinde de model); continuarea automata a
  modelului se adauga dupa el, ca pana acum.
- Rezultate imbogatite: `accepta_comanda`/`anuleaza_comanda` intorc `numar`,
  `anuleaza_livrare` intoarce link catre comanda.

## Impact asupra asistentului (regula 2.4)

`none` ca permisiuni (niciun tool nou); se schimba doar mesajul de dupa executie al
tool-urilor `write` existente.

## Teste

`result-summary.test.ts`, `run.test.ts` (succes cu link, esec), `registry.test.ts`,
`order-write-tools.test.ts`.
