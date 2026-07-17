# Handoff - Aplicatie Economie Circulara

Acest document este un rezumat complet al tuturor deciziilor luate pana acum, destinat unei sesiuni noi care va continua cu arhitectura tehnica si implementarea.

---

## Ce construim

O platforma web **multi-tenant** pentru **trasabilitatea materialelor in economia circulara**. Clientul platitor este firma producatoare/reciclatorare, nu clientii ei finali.

Exemplul concret (clientul pilot): firma de constructii care concaseaza moloz → obtine nisip/pietris/fierbeton reciclat → produce caramizi/beton/balast → livreaza cu certificat de trasabilitate.

**Selling point principal:** certificatul de trasabilitate care arata exact din ce loturi de materie prima (inclusiv reciclata) e facut un produs livrat.

---

## Stack tehnologic

| Ce | Decizie |
|----|---------|
| Framework | Next.js |
| Hosting | Vercel |
| Baza de date + Auth + Storage | Supabase (regiunea EU - GDPR) |
| Limba UI | Romana hardcodat |
| Limba cod sursa | Engleza |
| Portabilitate | Nu e necesara migrarea de pe Supabase |

---

## Roluri si autentificare

4 roluri:
- **super-admin** - administreaza organizatiile (platforma)
- **admin** - configureaza produse, retete, white labeling, user management; acces total
- **operator** - stoc, productie, comenzi
- **client** - catalog, comenzi proprii, certificate, documente proprii

Autentificare: email/parola. Google/magic link daca e simplu de adaugat prin Supabase.

Clientul isi seteaza parola dupa invitatie. Adminul creeaza operatori si clienti.

Un client = un singur utilizator (nu mai multi per firma).

---

## Multi-tenant si organizatii

- O organizatie = o firma juridica
- Date complet izolate intre organizatii (clienti, stoc, produse, documente)
- White labeling minim per organizatie: logo, culori, domeniu, emailuri personalizate
- Baza de date comuna cu izolare logica; extractie per tenant posibila ulterior daca e ceruta explicit

---

## Clienti (firmele care cumpara)

- Doar firme juridice (nu persoane fizice)
- La creare: lookup CUI in baze de date publice Romania → precompletare date → confirmare/editare manuala
- Date minime: CUI, denumire, adresa sediu, registrul comertului, TVA, email, telefon, persoana contact
- Pot avea mai multe adrese de livrare
- Un client poate fi si furnizor de deseuri/materiale in acelasi timp

---

## Catalog si comenzi

- Produsele din catalog = itemii din stoc cu flag `vandabil = true`
- Clientul vede tot catalogul (searchable/filterable), fara preturi
- Fara variante de produs - proprietati diferite = produs diferit
- Flux: client adauga in cos → trimite comanda cu adresa livrare si data livrare (optionala) → admin accepta/anuleaza/editeaza
- Stocul se scade la **acceptarea comenzii**; la anulare stocul se reface
- Clientul poate modifica sau anula comanda dupa trimitere
- Adminul poate crea comenzi in numele clientului (flag `creata de admin`); se trimit notificari identic
- Actiuni rapide din lista comenzi: accepta / anuleaza
- Notificari email la fiecare schimbare de status
- Fara livrari partiale
- Clientul poate repeta o comanda anterioara (actiune pe comanda existenta)

Statusuri comanda: draft → trimisa → acceptata → livrata → inchisa / anulata

---

## Retur si garantie

- Dupa o comanda finalizata, clientul (sau adminul in numele lui) poate initia:
  - **Retur** - aduce materialele inapoi
  - **Garantie** - aduce inapoi + vrea inlocuire (se creeaza automat o noua comanda de inlocuire)
- Ambele creeaza o noua comanda legata de comanda initiala, cu date precompletate
- Clientul poate modifica cantitatile la retur
- Materialele returnate intra in stoc dupa inspectie/acceptare manuala
- **Inchiriere (product-as-a-service):** simulata prin comanda + retur, cu camp optional `data_estimata_retur` pe comanda

---

## Stoc si loturi

- Adminul defineste liber tipurile de itemi (fara enum fix in sistem)
- Fiecare item are: titlu, descriere, poza, atasamente, reteta, unitate de masura, flag `vandabil`
- **Un singur UM per produs** - daca acelasi material se vinde in unitati diferite, sunt produse separate
- Fara conversii intre unitati de masura
- Un singur depozit per organizatie in MVP

### Loturi
Fiecare intrare in stoc creeaza un lot cu:
- data intrare, sursa, locatie, cantitate initiala, cantitate ramasa, documente, status calitate

Loturile pot fi **blocate** cu un motiv → ies din stocul disponibil.

Tipuri de provenienta la intrare manuala:
- achizitie, productie interna, reciclare, retur, ajustare inventar

Consum loturi: **FIFO implicit**, cu optiune de selectie manuala la productie.

### Audit trail stoc
- Tabela `stock_events` cu toate miscarile (cine, cand, ce cantitate, ce lot, ce motiv)
- Expus in UI ca listing cu **export CSV/Excel**
- Se face de la inceput (mult mai greu de adaugat ulterior)

---

## Retete si productie

- Fiecare item poate avea o reteta (goala daca nu se proceseaza)
- Retetele sunt exprimate in **procente**
- Fara versionare - reteta noua = produs nou
- Fara alternative de materiale in reteta (acelasi item, loturi diferite)

### Doua tipuri de procese

**1. Output fix** (ex. fabricare caramida):
- Utilizatorul introduce cantitatea de output dorita
- Sistemul calculeaza automat consumul din stoc (FIFO)
- Sistemul creeaza loturi noi de output

**2. Input fix, output variabil** (ex. reciclare moloz):
- Utilizatorul introduce inputul
- Sistemul afiseaza outputul ideal conform retetei
- Utilizatorul ajusteaza cantitatile si confirma
- Sistemul creeaza loturi noi rezultate

Pierderile/randamentul se **inregistreaza**, nu se valideaza.

Statusuri proces: planificat → in lucru → asteapta confirmare → finalizat / anulat

Productia este **doar pentru stoc**, nu legata direct de comenzi. Fara productie partiala.

---

## Trasabilitate si certificate

- La inchiderea unei comenzi se genereaza automat un **certificat PDF**
- Certificatul contine: numar unic, data emitere, logo organizatie, semnatura
- Continut minim: originea materialelor, sursa, documente atasate
- Template flexibil - continutul se poate extinde pe parcurs
- Clientul vede trasabilitatea comenzilor proprii si descarca toate documentele
- Stocul si procesele interne NU sunt vizibile clientului
- Verificare publica prin QR/link - **nice to have, post-MVP**
- Standarde legale pentru certificat - **OPEN QUESTION**, necesita research

---

## Documente si atasamente

- Entitati cu documente: **client, comanda, item**
- Orice tip de fisier, cu limita de dimensiune per fisier (de definit, ex. 10-20MB)
- Storage: Supabase Storage
- Certificatul e generat de aplicatie; restul sunt doar arhivate
- Admin si operator vad tot; clientul vede documentele comenzilor proprii + descrieri produse
- Fara semnaturi digitale, fara versionare documente

---

## Dashboard admin

Ecrane principale: **comenzi, procese, clienti, stoc**

- Actiuni rapide din lista comenzi: accepta / anuleaza
- Cautare globala (comanda, client, lot, produs, certificat)
- KPI-uri pe dashboard - nice to have
- Interfata unica pentru admin si operator; adminul are in plus: configurare produse/retete, white labeling, user management

---

## Dashboard client

- Vede doar comenzile proprii
- Poate repeta o comanda (actiune pe comanda existenta)
- Descarca toate documentele comenzilor proprii
- Vede statusul livrarii (nu productia sau stocul)
- Nu poate trimite mesaje pe comanda
- Nu exista flux fara cont

---

## MVP - termen si flux

**Termen:** august 2026

**Flux complet MVP** (nimic nu e manual, totul automatizat):
1. Creare organizatie + useri
2. Creare client (lookup CUI → precompletare → confirmare)
3. Definire itemi cu retete
4. Intrare stoc cu lot si documente
5. Proces reciclare (input → confirmare output manual → loturi noi)
6. Productie (cantitate output → consum FIFO automat → loturi noi)
7. Comanda (client sau admin)
8. Acceptare comanda → scadere stoc
9. Livrare → inchidere → generare certificat PDF automat

**Client pilot:** firma de constructii - moloz, nisip reciclat, pietris, caramizi, beton, balast, deseuri umplutura

**Prioritati:** viteza de livrare > corectitudinea trasabilitatii > conformitate legala

---

## Integrari (adaugat 2026-07)

### e-Transport / avize (necesar, v1.x)

Livrarile trebuie sa suporte fluxul de **aviz de insotire a marfii + declarare in
RO e-Transport (ANAF)** pentru transporturile care depasesc pragurile legale:

- integrare prin **Socrate.io** (furnizor tert platit, API peste SPV/ANAF), nu direct cu SPV — validare in spike S4
- flux: comanda acceptata → planificare livrare (data, transportator, nr. inmatriculare)
  → generare aviz → declarare e-Transport → cod UIT stocat pe livrare → aviz PDF cu UIT
- necesita entitate `deliveries` (transportator, vehicul, sofer, ruta, cod UIT, status declaratie)
- inchide cerintele din Anexa 1: „planificarea si urmarirea livrarilor" + „interoperabilitate"

### Monitorizare GPS (v2, follow-up)

- integrare cu serviciu de monitorizare GPS pentru urmarirea in timp real a livrarilor
  (pozitie vehicul, ETA, istoric ruta)
- se construieste peste entitatea `deliveries` — modelul de livrare se proiecteaza de la
  inceput cu asta in minte

---

## Constrangere: conformitate cu Anexa 1 (finantare europeana)

Proiectul este finantat din fonduri europene; platforma trebuie sa respecte
[anexa-1-specificatii-tehnice.md](anexa-1-specificatii-tehnice.md). **Anexa NU e inca
depusa** — draftul a fost revizuit (17 iulie 2026) ca sa descrie fidel platforma
construita; modificarile si motivatia lor sunt in
[anexa-1-modificari-propuse.md](anexa-1-modificari-propuse.md) (de validat cu echipa de
proiect). Maparea anexa ↔ plan e in
[analiza-conformitate-anexa.md](analiza-conformitate-anexa.md).

Decizii de interpretare/scope (2026-07):

- **Contractele si serviciile** din anexa = relatia **organizatie ↔ clientii ei**
  (Beneficiarul finantat isi gestioneaza contractele cu firmele care cumpara/aduc la
  reciclare). NU se refera la relatia platforma ↔ organizatii (multi-tenancy-ul e
  modelul nostru de business, in afara scope-ului anexei).
- **Contracte** = documente arhivate pe client (fara modul de gestiune structurata);
  in asteptarea confirmarii echipei non-tehnice (intrebarea din anexa-1-modificari-propuse.md).
- **Oferte comerciale** — eliminate din anexa revizuita; catalogul (fara preturi) ramane
  „oferta" de facto; flag „acceptat la reciclare" pe item = nice-to-have de produs.
- **Rapoarte** = pagina dedicata cu export PDF (Task X3, promovat la obligatoriu).
- **e-Transport** = integrare prin Socrate.io (platit).

---

## Context real de utilizare & model comercial (clarificat 2026-07)

- Aplicatia **NU e marketplace**: organizatiile si clientii lor isi pastreaza procesul
  actual (telefon/WhatsApp); platforma e **suportul documentar si legal** (comenzi
  inregistrate, avize e-Transport, trasabilitate + certificate).
- Fluxul dominant: **personalul organizatiei inregistreaza comenzile in numele
  clientului** (`created_by_admin`); portalul client ramane — unii clienti se logheaza singuri.
- **Model comercial:** SaaS multi-tenant cu **entry point per client** (subdomeniu sau
  domeniu propriu, cu tot cu login) — aliniat cu white-label + rezolvarea organizatiei
  din domeniu (T1.2/T1.3).
- **Piata mixta:** si IMM-uri cu finantari nerambursabile proprii (care isi demonstreaza
  modelul PaaS prin platforma — vezi
  [analiza-cerere-finantare-client-paas.md](analiza-cerere-finantare-client-paas.md)),
  si clienti fara finantare → produsul ramane generic, feature-urile de
  conformitate/raportare sunt diferentiator.
- **Regula de scope pentru cerintele clientilor:** ce se muleaza pe ce avem → acum
  (ex. abonamente ca tip de produs, raport „utilizat = livrat − returnat", % materii
  secundare); ce e complet nou → v2 (ex. CO2 economisit, GPS). Nimic specific unui
  client nesemnat nu se construieste inainte de semnare/aprobarea finantarii lui.

---

## Post-MVP (de amanat)

- Interfata agentica (agent care propune actiuni confirmate de user; doar pentru admin)
- ~~Rapoarte agregate si KPI-uri~~ → mutat in scope (pagina Rapoarte cu export PDF, Task X3 — cerinta Anexa 1)
- Verificare publica certificate prin QR / link
- Conversii intre unitati de masura
- Monitorizare GPS a livrarilor (v2 — vezi Integrari)

---

## Intrebari inca deschise

1. **Standarde certificat** - exista norme legale romanesti/europene pentru certificatul de trasabilitate materiale constructii reciclate? Necesita research.
2. **API lookup CUI** - ce sursa publica se foloseste? De ales cel mai simplu de integrat.

---

## Ce urmeaza

Urmatorul pas: **arhitectura tehnica si modelul de date** (schema baza de date, structura Next.js, flow autentificare multi-tenant, modelul de loturi si trasabilitate).
