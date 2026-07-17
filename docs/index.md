# Economie Circulara - Documentatie

Acest folder contine toate documentele de analiza, cerinte si design pentru platforma de trasabilitate a materialelor in economia circulara.

---

## Documente principale

| Fisier                                                 | Descriere                                                                                                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [handoff.md](handoff.md)                               | **Punct de start recomandat.** Rezumat complet al tuturor deciziilor luate: stack, roluri, multi-tenant, stoc, productie, certificate, MVP.                         |
| [anexa-1-specificatii-tehnice.md](anexa-1-specificatii-tehnice.md) | **Anexa 1 — specificatiile tehnice depuse pentru finantarea europeana.** Document de referinta contractual: platforma trebuie sa le respecte.          |
| [analiza-conformitate-anexa.md](analiza-conformitate-anexa.md)     | Gap analysis Anexa 1 vs. plan: ce e acoperit / partial / lipsa, plus requirements noi (e-Transport, GPS v2).                                           |
| [anexa-1-modificari-propuse.md](anexa-1-modificari-propuse.md)     | Modificarile aplicate pe draftul Anexei 1, cu motivatia fiecareia — de validat cu echipa de proiect inainte de depunere (include intrebarea despre contracte). |
| [cerere-finantare-client-paas.pdf](cerere-finantare-client-paas.pdf) | Extras din cererea de fonduri nerambursabile a unui viitor client (depusa, in evaluare): modelul PaaS „beton ca serviciu" promis finantatorului sau.  |
| [analiza-cerere-finantare-client-paas.md](analiza-cerere-finantare-client-paas.md) | Analiza cererii clientului: diferentele fata de platforma („timp real", CO2 „automat"), maparea acum/v2 si strategia (contract de licenta + fisa tehnica). |
| [cerinte-clarificari.md](cerinte-clarificari.md)       | Document de lucru cu toate intrebarile de clarificare si raspunsurile lor, sectiune cu sectiune.                                                                    |
| [review-cerinte.md](review-cerinte.md)                 | Sumar al deciziilor si intrebarilor deschise (A-J), cu raspunsuri.                                                                                                  |
| [brain-dump.md](brain-dump.md)                         | Brain dump-ul initial al clientului - ideile brute de la care s-a pornit analiza.                                                                                   |
| [implementation-plan.md](plans/implementation-plan.md) | **Plan de implementare** impartit in task-uri individuale (waves) ce pot fi preluate de agenti AI in paralel, cu dependente si criterii de acceptare. (in `plans/`) |

## Design

| Fisier                                                           | Descriere                                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [design-prompt.md](design-prompt.md)                             | Brief de design pentru mockup-uri: ton vizual, paleta, componente, ecrane de mockat.       |
| [prompt-sesiune-requirements.md](prompt-sesiune-requirements.md) | Template de prompt pentru o sesiune noua de AI care continua analiza de cerinte.           |
| [review-cerinte.html](review-cerinte.html)                       | Formular HTML pentru colectarea raspunsurilor la intrebarile deschise (submit prin email). |

## Mockup-uri Claude Design

Folderul [`design/`](design/) contine exportul din Claude Design:

| Fisier                                                       | Descriere                                                                          |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [design/Lateris_Trace.dc.html](design/Lateris_Trace.dc.html) | Mockup-urile aplicatiei (format `.dc.html`, necesita `support.js` pentru randare). |
| [design/support.js](design/support.js)                       | Bundle dc-runtime (React-based) necesar pentru a randa fisierul `.dc.html`.        |

> Pentru a vizualiza mockup-urile, deschide `Lateris_Trace.dc.html` local intr-un browser (ambele fisiere trebuie sa fie in acelasi folder).

---

## Flux complet MVP (rezumat)

1. Creare organizatie + useri
2. Creare client (lookup CUI → precompletare → confirmare)
3. Definire itemi cu retete
4. Intrare stoc cu lot si documente
5. Proces reciclare (input → confirmare output manual → loturi noi)
6. Productie (cantitate output → consum FIFO automat → loturi noi)
7. Comanda (client sau admin)
8. Acceptare comanda → scadere stoc
9. Livrare → inchidere → generare certificat PDF automat

**Termen MVP:** august 2026
