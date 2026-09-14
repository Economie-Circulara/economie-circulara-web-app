# Plan - cuprins sticky in Ajutor

## Obiectiv

Cuprinsul lateral al documentelor Markdown din `/ajutor/<slug>` ramane vizibil la
scroll pe viewport-uri desktop, fara sa afecteze cuprinsul colapsabil de pe mobil.

## Modificari

1. Ajustez shell-ul aplicatiei si layout-ul paginii de document astfel incat
   contextul de overflow sa nu limiteze sticky-ul, iar navul lateral sa aiba
   offset fata de partea de sus si scroll intern daca lista cuprinsului depaseste
   viewport-ul.
2. Adaug o verificare E2E pentru stilul `position: sticky` al navului desktop.
3. Rulez formatarea si check-urile relevante (`typecheck`, `lint`, teste unitare).

## Definition of Done

- [ ] Cuprinsul lateral are `position: sticky` pe desktop.
- [ ] Cuprinsul mobil ramane neschimbat.
- [ ] Testele si verificarile proiectului trec.
- [ ] Se adauga intrare in `docs/prompt-log.md` la commit.
