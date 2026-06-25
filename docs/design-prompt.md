# Design Prompt - Aplicatie Economie Circulara

## Context

Aplicatie web pentru trasabilitatea materialelor in economia circulara. Firmele producatoare/reciclatatoare o folosesc pentru a gestiona stocuri pe loturi, procese de productie/reciclare si comenzi ale clientilor lor, livrate cu certificate de trasabilitate.

Utilizatorii principali sunt administratori si operatori de firma (desktop, birou sau hala de productie). Clientii firmei au si ei acces la un portal mai simplu. Aplicatia trebuie sa mearga si pe mobil, dar targetul principal este desktop.

---

## Stack si componente

- **Framework:** Next.js
- **Componente UI:** shadcn/ui ca baza (reutilizabile, accesibile, customizabile)
- **Auth UI:** widgeturi Supabase Auth (login, invite, reset parola) - refolosit out-of-the-box, fara redesign custom
- **Diagrame:** o librarie compatibila cu React pentru Sankey diagram si alte vizualizari (ex. Recharts, Nivo sau similar)

---

## Ton vizual si identitate

- **Nu clasic alb/gri corporate.** Aplicatia nu trebuie sa semene cu un SaaS generic.
- **Background cu pattern subtil** - textura geometrica, grid, noise sau motiv inspirat din materiale (granulatie, beton, structura moleculara) - ceva care da caracter fara sa oboseasca ochiul.
- **Paleta:** poate explora tonuri de pamant, verde inchis, ocru, sau slate cu accent viu - orice evoca materiale, natura, industrie curata. Nu albastru corporate clasic.
- **Sidebar lateral fix** pentru navigatia principala (admin/operator au multe sectiuni).
- **Dark mode:** nu este prioritar, dar daca paleta aleasa se preteaza, poate fi mentionat ca optiune viitoare.
- Componentele shadcn se pot rethema complet - nu trebuie sa ramana in skin-ul lor implicit.

---

## Structura aplicatiei (pentru context)

**Roluri:**
- **Admin** - acces total: comenzi, stoc, productie, clienti, retete, audit, setari organizatie
- **Operator** - acces la: comenzi, stoc, productie
- **Client** - portal separat: catalog, comenzile proprii, certificate, documente

**Navigatie sidebar admin/operator:**
- Comenzi
- Stoc
- Productie
- Clienti
- Retete
- Audit stoc
- Setari (doar admin)

**Navigatie portal client:**
- Catalog
- Comenzile mele
- Documente & Certificate

---

## Ecrane de mockat

### 1. Login
- Widget Supabase Auth integrat in pagina cu identitatea vizuala a aplicatiei
- Logo organizatie (white label), background cu pattern

### 2. Dashboard admin - Lista comenzi
- Tabel cu comenzile recente: client, produse, data livrare, status
- Status badge colorat (trimisa / acceptata / livrata / inchisa / anulata)
- Actiuni rapide inline: Accepta / Anuleaza
- Filtre si search

### 3. Stoc - Lista loturi
- Tabel cu loturile din stoc: item, cantitate ramasa, provenienta, data intrare, status
- Badge pentru loturi blocate
- Buton "Adauga lot" → formular cu: item, cantitate, UM, provenienta (dropdown: achizitie / productie / reciclare / retur / ajustare inventar), data, documente atasate

### 4. Productie - Pornire proces
Acesta este un ecran cheie - doua sub-fluxuri:

**4a. Output fix (fabricatie - ex. caramizi):**
- Selectie reteta/produs
- Input: cantitate dorita de output
- Sistem calculeaza si afiseaza automat loturile consumate (FIFO) cu cantitatile
- Confirmare si start proces

**4b. Output variabil (reciclare - ex. moloz):**
- Selectie material input + cantitate
- Sistem afiseaza outputul ideal conform retetei (procente)
- Tabel editabil cu outputurile reale: utilizatorul ajusteaza cantitatile
- Confirmare si finalizare

**Elementul wow:** un **Sankey diagram** care vizualizeaza fluxul de materiale: loturile de input → procesul → loturile de output rezultate. Util atat la confirmare cat si in istoricul unui proces finalizat.

### 5. Catalog client
- Grid de produse (card cu poza, titlu, UM, buton "Adauga in cos")
- Search si filtre
- Cos lateral sau pagina cos separata
- Formular comanda: adresa livrare, data livrare (optionala), observatii

### 6. Comenzile mele - portal client
- Lista comenzi cu status
- Pe o comanda finalizata: butoane "Retur" si "Garantie"
- Sectiune documente: lista fisiere atasate + buton download certificat

### 7. Certificat de trasabilitate
Acesta este **cel mai important ecran vizual** al produsului - trebuie sa impresioneze.

Structura certificat (pagina A4 / export PDF):
- Header cu logo organizatie, numar certificat, data emitere
- Datele comenzii: client, produse livrate, cantitati
- **Elementul wow: graf/diagram de trasabilitate** - un arbore sau Sankey diagram care arata lantul complet: produs livrat → loturi produs → procese → loturi materie prima → surse (furnizori / deseuri reciclate / retururi). Fiecare nod are tooltip cu detalii.
- Sectiune "Materiale si origine" - tabel cu procentele din fiecare sursa
- Sectiune documente atasate (lista cu linkuri)
- Footer cu semnatura organizatie

---

## Note pentru design

- Aplicatia este folosita zilnic de operatori - **claritatea si viteza** sunt mai importante decat decoratia.
- Tabelele sunt omniprezente - trebuie sa fie lizibile, cu row hover, sortare vizibila, paginare clara.
- Formularele de adaugare lot / pornire productie sunt fluxuri critice - trebuie sa fie ghidate si fara ambiguitate.
- Certificatul este documentul care ajunge la clientii finali ai firmei - **trebuie sa arate profesionist si de incredere.**
- Diagrama Sankey / graful de trasabilitate este elementul diferentiator vizual al produsului - merita atentie speciala.
- White labeling: logo-ul si culorile organizatiei apar in header sidebar si in certificat. Designul trebuie sa accommodeze asta.
