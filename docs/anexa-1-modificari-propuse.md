# Modificări propuse la Anexa 1 — de validat înainte de depunere

**Data:** 17 iulie 2026
**Destinatari:** echipa de proiect / consultantul de fonduri.
**Statut:** modificările de mai jos sunt **deja aplicate** în draftul
[anexa-1-specificatii-tehnice.md](anexa-1-specificatii-tehnice.md); acest document
explică fiecare schimbare, pentru validare înainte de depunere.

---

## 1. De ce propunem modificări

Anexa nu a fost încă depusă, deci mai poate fi ajustată. Scopul: textul depus să
descrie fidel platforma pe care o construim, ca la recepție și la audit să nu existe
funcționalități promise în scris dar neimplementate.

Contextul practic: organizațiile și clienții lor își păstrează modul actual de lucru
(înțelegeri directe, telefon, WhatsApp). Platforma este **suportul documentar și legal**
al acestor înțelegeri: comenzile se înregistrează în sistem, livrările primesc
documentele de însoțire necesare (e-Transport), iar materialele au trasabilitate
completă, cu certificate. Platforma **nu** este un magazin online / marketplace și
**nu** gestionează prețuri, facturare sau bani — stabilit de la începutul proiectului.

Cadrul Product-as-a-Service din obiectivul anexei **rămâne neatins** (este legat de
finanțare); modelul e acoperit în platformă prin utilizare temporară, retur, recuperare,
recondiționare și reutilizare.

---

## 2. Eliminări / reformulări (reduc obligațiile riscante)

| # | Text inițial | Text revizuit | De ce |
|---|---|---|---|
| 1 | „administrarea ofertelor comerciale, comenzilor și contractelor specifice modelului Product-as-a-Service" *(lista generală)* | „administrarea comenzilor și a documentelor contractuale aferente relației cu clienții" | Platforma nu gestionează prețuri, deci nu poate „administra oferte comerciale" în sens clasic. Contractele devin documente arhivate în platformă (vezi întrebarea de la punctul 4). |
| 2 | „configurarea și gestionarea diferitelor tipuri de servicii, abonamente sau modele de tarifare" *(lista generală)* | „configurarea tipurilor de produse și servicii furnizate" | **Cea mai importantă modificare.** Abonamentele și tarifarea presupun gestiune de bani/prețuri — în afara scopului aplicației. |
| 3 | „evidența contractelor încheiate" *(secțiunea 3.b)* | „evidența și arhivarea documentelor contractuale" | Contractele semnate se încarcă în platformă (PDF), atașate fiecărui client, consultabile oricând. |
| 4 | „gestionarea tipurilor de servicii și abonamente" *(secțiunea 3.b)* | „gestionarea tipurilor de produse și servicii furnizate" | Consecvent cu punctul 2 — fără abonamente. |
| 5 | „urmărirea perioadelor contractuale" *(secțiunea 3.b)* | „urmărirea perioadelor de utilizare a produselor" | Platforma urmărește perioada de utilizare și data estimată de retur a produselor — esența modelului „produs ca serviciu", exact ce construim. |
| 6 | „evidența obligațiilor asumate de părți" *(secțiunea 3.b)* | *(eliminat)* | Obligațiile părților sunt în contractele semnate, arhivate în platformă. O evidență structurată separată ar fi dezvoltare suplimentară fără beneficiu practic. |
| 7 | „monitorizarea indicatorilor operaționali și comerciali relevanți" *(lista generală)* | „monitorizarea indicatorilor operaționali relevanți" | Fără prețuri în platformă, „indicatorii comerciali" (valoare vânzări) nu pot fi calculați — formularea ar fi atacabilă la audit. Indicatorii operaționali (comenzi, livrări, cantități, materiale reciclate) rămân. |
| 8 | „evidența activităților realizate în platformă" *(secțiunea 3.f)* | „evidența principalelor operațiuni realizate asupra datelor din platformă" | Platforma ține istoricul operațiunilor relevante (mișcări de stoc, comenzi — cine/când). Formularea inițială putea fi interpretată ca jurnal complet al oricărei acțiuni, obligație disproporționată. |
| 9 | „asocierea documentelor cu clienți, contracte sau activități" *(secțiunea 3.g)* | „asocierea documentelor cu clienți, comenzi sau activități" | Consecvent cu punctul 3. |

---

## 3. Adăugiri (punctele forte reale ale platformei)

| # | Text nou | De ce |
|---|---|---|
| A | *(lista generală)* „generarea de certificate și documente de trasabilitate a materialelor și produselor livrate" | Funcționalitatea centrală a platformei — nu apărea deloc în anexa inițială. Menționarea ei ușurează recepția: demonstrăm exact ce scrie. |
| B | *(lista generală)* „generarea documentelor de însoțire a livrărilor și posibilitatea interoperabilității cu sisteme informatice naționale (ex. RO e-Transport), inclusiv prin servicii terțe" | Acoperă scopul legal real al platformei. Dacă costul serviciului terț de integrare e-Transport (Socrate.io) se decontează din fonduri, menționarea în anexă susține justificarea cheltuielii. Formularea „posibilitatea" nu creează angajament rigid. |
| C | *(secțiunea 3.a)* comenzile pot fi „înregistrate inclusiv de personalul Beneficiarului în numele clienților" | Descrie fluxul real de lucru: înțelegerea se face direct (telefon), apoi comanda se înregistrează în platformă pentru documentația completă. |

---

## 4. Întrebare pentru echipa de proiect — CONTRACTE (necesită răspuns)

> În anexa tehnică apărea „gestionarea contractelor și a serviciilor" (evidența
> contractelor, perioade contractuale, abonamente, obligațiile părților). La începutul
> proiectului am stabilit că partea de **prețuri, bani, facturare și contracte** este în
> afara scopului aplicației — aplicația documentează comenzile, livrările și
> trasabilitatea materialelor, iar înțelegerile comerciale se fac în continuare direct
> între firme, ca până acum.
>
> **Întrebarea:** pentru modelul „produs ca serviciu" finanțat, este necesar ca aplicația
> să **gestioneze** efectiv contractele (evidență structurată a perioadelor, obligațiilor,
> tarifelor — dezvoltare suplimentară care readuce în scop partea de tarifare la care am
> renunțat), sau este suficient ca aplicația să **arhiveze** contractele semnate
> (încărcate ca PDF, atașate fiecărui client, consultabile și descărcabile oricând —
> acoperit de funcționalitățile deja planificate)?
>
> **Recomandarea noastră:** varianta a doua (arhivare) — reformulările de la punctele
> 1, 3, 5, 6 și 9 de mai sus reflectă deja această variantă în draftul revizuit. Dacă
> răspunsul este „gestionare", revenim asupra textului înainte de depunere.

---

## 5. Ce rămâne neschimbat

- Obiectivul și cadrul **Product-as-a-Service** (intro + secțiunea 1) — legat de finanțare.
- Secțiunea 3.d (utilizare și reutilizare) — acoperită integral de platformă.
- Secțiunea 3.e (monitorizare și raportare) — platforma va avea pagină dedicată de
  rapoarte cu export PDF.
- Secțiunile despre utilizatori (3.f, fără punctul 8), documente (3.g, fără punctul 9),
  notificări, interoperabilitate (2, 4, 6) și livrabile (5).
