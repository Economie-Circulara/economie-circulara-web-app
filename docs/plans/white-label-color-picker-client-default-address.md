# White-label colors + adresa implicita client

## Obiectiv

- In setari white-label, adminul poate alege culorile prin color picker si teme prestabilite.
- La creare client, daca lookup-ul dupa CUI completeaza adresa sediului, aceasta devine adresa de livrare implicita.
- Curatare caractere speciale tipografice generate de LLM in fisiere text, inlocuite cu variante uzuale ASCII unde nu sunt necesare.

## Implementare

1. Extind `SettingsForm` cu inputuri `type=color`, preseturi de tema si campuri text sincronizate pentru valorile salvate.
2. La `createClientAction`, dupa crearea clientului, creez automat o adresa de livrare implicita din `hqAddress`, cand exista.
3. Adaug/actualizez teste unitare pentru crearea adresei implicite.
4. Rulez script de verificare pentru caractere tipografice si inlocuiesc in fisierele text relevante.
5. Rulez testele tintite, apoi `typecheck` si `lint`.
