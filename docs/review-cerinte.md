# Review cerinte - aplicatie economie circulara

Buna ziua,

Mai jos gasesti un rezumat al discutiilor purtate pana acum despre aceasta aplicatie, impreuna cu deciziile luate si intrebarile care au ramas fara raspuns. Te rog sa citesti si sa confirmi inainte de a continua cu specificatia tehnica si implementarea.

---

## Intrebare initiala

**Confirmi cele de mai jos ca fiind corecte? Ai ceva de completat sau de schimbat fata de ce e descris aici?**

Te rog raspunde la aceasta intrebare inainte de a continua cu sectiunile de mai jos.

---

## 1. Ce face aplicatia

O platforma web pentru firme care lucreaza cu materiale, produse si deseuri in regim de economie circulara. Scopul principal este **trasabilitatea**: fiecare produs livrat unui client trebuie sa poata fi legat inapoi de loturile de materie prima, deseurile reciclate, furnizorii, procesele de productie si documentele aferente.

Exemplul concret al clientului pilot: o firma de constructii care concaseaza deseuri (moloz), obtine nisip reciclat, pietris si fierbeton, le foloseste ca materie prima pentru a produce caramizi, beton si balast, pe care le vinde clientilor impreuna cu un certificat de trasabilitate.

---

## 2. Model comercial si organizatii

- Aplicatia este vanduta firmelor producatoare / reciclatoare (nu clientilor lor finali).
- Fiecare firma cumparatoare este o **organizatie / tenant** separat.
- O organizatie = o singura firma juridica.
- Datele intre organizatii sunt izolate complet (clienti, produse, stocuri, documente).
- Multi-tenant intr-o singura aplicatie (nu clone separate per firma).
- Fiecare organizatie va putea avea white labeling minim: logo, culori, domeniu, emailuri personalizate.
- Baza de date comuna cu izolare logica, dar cu posibilitate de extragere per tenant in viitor daca e cerut explicit.

---

## 3. Utilizatori si roluri

Patru roluri:
- **Super-admin** (platforma) - administreaza organizatiile
- **Admin** (organizatie) - configureaza produse, retete, white labeling, user management; are acces la tot
- **Operator** - acces la stoc, productie, comenzi; fara configurare
- **Client** - acces la catalogul de produse, comenzile proprii, documente si certificate

Reguli:
- Adminul creeaza operatori si clienti.
- Un client = un singur utilizator (nu mai multi per firma client).
- Autentificare: email/parola; Google si magic link daca e usor de adaugat (ex. prin Supabase sau Clerk out-of-the-box).
- Clientul isi seteaza parola dupa invitatie.
- Nu exista fluxuri de aprobare intre roluri - fiecare actioneaza independent.

---

## 4. Clienti (firmele care cumpara)

- Doar firme (nu persoane fizice).
- La creare, adminul poate face lookup dupa CUI in baze de date publice din Romania (API de ales - cel mai simplu disponibil); datele se precompleaza si se confirma/editeaza manual.
- Date minime: CUI, denumire, adresa sediu, registrul comertului, TVA, email, telefon, persoana de contact.
- Un client poate avea mai multe adrese de livrare.
- Un client poate fi si furnizor de deseuri / materiale in acelasi timp.

---

## 5. Catalog si comenzi

- Produsele din catalog sunt itemii din stoc marcati cu flag "vandabil".
- Clientul vede tot catalogul organizatiei (searchable / filterable), fara preturi.
- Fara variante de produs - proprietati diferite = produs diferit.
- Clientul adauga produse in cos si trimite comanda cu adresa de livrare.
- Adminul poate crea comenzi in numele clientului (cu flag "creata de admin"); se trimit notificari la fel ca o comanda normala.
- Adminul poate accepta, anula sau edita o comanda; clientul poate modifica sau anula dupa trimitere.
- Actiuni rapide din lista de comenzi: accepta / anuleaza direct.
- Clientul este notificat prin email la schimbarea statusului comenzii.
- Stocul se scade la acceptarea comenzii (de confirmat daca e momentul potrivit).
- Statusuri posibile: draft, trimisa, acceptata, in productie, pregatita, livrata, inchisa, anulata.
- Fara livrari partiale in MVP.
- Clientul poate repeta o comanda anterioara (actiune pe comanda existenta).

---

## 6. Retur, garantie si recuperare materiale

- Dupa o comanda finalizata, clientul (sau adminul in numele lui) poate initia doua tipuri de followup:
  - **Retur** - aduce materialele inapoi
  - **Garantie** - aduce materialele inapoi si vrea ceva in schimb (se creeaza automat o noua comanda de inlocuire)
- Ambele creeaza o noua comanda legata de comanda initiala, cu datele precompletate.
- Clientul poate modifica cantitatile la retur (poate aduce mai putine sau poate clasifica unele ca moloz).
- Materialele returnate intra in stoc dupa inspectie/acceptare manuala.
- Adminul poate initia retururi in numele clientului.
- Modelul de inchiriere (product-as-a-service) poate fi simulat prin doua comenzi separate - de analizat daca e suficient.

---

## 7. Stoc si loturi

- Adminul defineste liber tipurile de itemi din stoc (nu exista o lista fixa in sistem).
- Fiecare item are: titlu, descriere, poza, atasamente, reteta, unitate de masura, flag "vandabil".
- Un singur depozit per organizatie in MVP.
- Stocul este urmarit pe **loturi**. Fiecare lot are: data intrare, sursa, locatie, cantitate initiala, cantitate ramasa, documente, status calitate.
- Loturile pot fi blocate cu un motiv; odata blocate ies din stocul disponibil.
- Tipuri de provenienta la intrare manuala in stoc: achizitie, productie interna, reciclare, retur.
- Consum loturi: **FIFO ca default**, cu optiune de selectie manuala la productie.

---

## 8. Retete si productie

- Fiecare item poate avea o reteta (goala daca nu se proceseaza).
- Retetele sunt exprimate in **procente**.
- Fara versionare retete - daca reteta se schimba, se creeaza un produs nou.
- Fara alternative de materiale in reteta - acelasi item ("nisip") poate veni din loturi diferite, loturile tin minte provenienta.
- Doua tipuri de procese:
  1. **Output fix** (ex. fabricare caramida): utilizatorul introduce cantitatea de output dorita, sistemul calculeaza automat consumul din stoc.
  2. **Input fix, output variabil** (ex. reciclare moloz): utilizatorul introduce inputul, sistemul afiseaza outputul ideal conform retetei, utilizatorul ajusteaza si confirma.
- Sistemul inregistreaza pierderile si randamentul, nu le valideaza.
- Procesele au statusuri (de definit exact in design).
- Productia este doar pentru stoc, nu legata direct de o comanda.
- Fara productie partiala sau batch-uri multiple.

---

## 9. Trasabilitate si certificate

- La inchiderea unei comenzi se genereaza automat un **certificat de trasabilitate** in format PDF.
- Certificatul contine: numar unic, data emitere, logo organizatie, semnatura.
- Continutul detaliat al certificatului necesita research (ce date din lantul de trasabilitate, ce nivel de detaliu).
- Clientul vede trasabilitatea comenzilor proprii si poate descarca toate documentele.
- Stocul si procesele interne nu sunt vizibile clientului.
- Certificatul nu este public verificabil fara login (cel putin in MVP).
- Rapoarte agregate (procent reciclat, economie deseuri) - nice to have, nu in MVP.

---

## 10. Documente si atasamente

- Entitati cu documente: client, comanda, item.
- Orice tip de fisier acceptat, cu limita de dimensiune per fisier (de stabilit, ex. 10-20MB).
- Certificatul de trasabilitate este generat de aplicatie; restul documentelor sunt doar arhivate.
- Admin si operator vad toate documentele. Clientul vede documentele comenzilor proprii si descrierile produselor.
- Fara semnaturi digitale, fara versionare documente.

---

## 11. Tehnologie

- **Frontend / Backend:** Next.js
- **Hosting:** Vercel
- **Baza de date + Auth + Storage:** Supabase (regiunea EU pentru GDPR)
- Date in UE - obligatoriu (GDPR).
- Documentele atasate stocate in Supabase Storage.
- Nu este necesara portabilitatea usoara catre PostgreSQL self-hosted.

---

## 12. MVP si termen

- **Termen tinta:** august 2025
- **Flux complet in MVP:** creare organizatie → creare client (cu lookup CUI) → definire itemi si retete → intrare stoc cu lot si documente → proces reciclare cu confirmare output → productie cu consum FIFO → creare comanda → acceptare comanda → livrare → generare certificat trasabilitate
- **Nimic nu este manual** - totul trebuie automatizat de la inceput.
- **Client pilot:** firma de constructii - materiale de lucru pentru demo: caramizi, beton, balast, deseuri de umplutura, reciclare moloz.
- **Prioritati:** viteza de livrare > corectitudinea trasabilitatii > conformitate legala.

---

## 13. Post-MVP (de amanat)

- Interfata agentica (chatbot pentru admin care propune actiuni confirmate de user)
- Rapoarte agregate si KPI-uri
- Verificare publica certificate prin QR / link

---

## Intrebari deschise - te rog sa raspunzi

Acestea sunt punctele care au ramas neclare si au nevoie de decizia ta inainte de a continua implementarea:

**A. Unitate de masura si ambalare**
Cum se vand produsele - la bucata, la tona, la metru patrat, la palet? Daca acelasi produs se poate vinde in unitati diferite, e nevoie de produse separate sau un singur produs cu mai multe unitati? Aceasta decizie influenteaza modelul de date al stocului.
- Raspuns: Un singur UM per produs. Daca acelasi material se vinde in unitati diferite, sunt produse separate.

**B. Conversii intre unitati de masura**
Trebuie sa poti converti intre unitati (ex. kg <-> tone, bucati <-> paleti)? Exista un use case concret?
- Raspuns: Nu, fara conversii pentru MVP.

**C. Audit trail pentru stoc**
Trebuie un log cu toate modificarile de stoc (cine, cand, ce a schimbat)? Exista cerinte legale sau operationale pentru asta?
- Raspuns: Da, se face de la inceput. Tabela de events cu toate miscarile de stoc. Se expune in UI ca listing cu export CSV/Excel.

**D. Nivelul de detaliu al certificatului de trasabilitate**
Ce trebuie sa vada clientul in certificat? Doar originea materialelor la nivel de furnizor/lot, sau si procente exacte, documente sursa, locatii, toate procesele intermediare? Aceasta este functia centrala a produsului si are nevoie de o decizie clara.
- Raspuns: Template flexibil, populat dinamic. Minim: originea materialelor, sursa, documente. Restul se adauga pe parcurs.

**E. Verificare publica a certificatului**
Clientii tai vor vrea sa trimita certificatul unui tert (ex. un beneficiar final, un auditor) care sa il poata verifica fara cont in platforma? Un QR code pe certificat care deschide o pagina publica ar rezolva asta.
- Raspuns: Nice to have, post-MVP.

**F. Limba aplicatiei**
Aplicatia va fi in romana hardcodat sau construim cu suport i18n (texte in fisiere separate, usor de tradus)? Recomandam i18n de la inceput - costul este mic acum si evita o refacere daca apare un client strain sau o cerinta de engleza.
- Raspuns: UI in romana hardcodat. Codul sursa in engleza.

**G. Modelul de inchiriere (product-as-a-service)**
Clientul aduce dale de beton la festival, le returneaza dupa. Poate fi simulat prin doua comenzi separate (comanda initiala + retur). Este suficient sau trebuie un flux dedicat de inchiriere cu perioada, scadenta si penalizari?
- Raspuns: Comanda + retur, cu un camp optional "data estimata retur" pe comanda pentru vizibilitate minima.

**H. Ajustare inventar**
La intrarea manuala in stoc, pe langa achizitie / productie / reciclare / retur, mai avem nevoie de un tip "ajustare inventar" (pentru corectii manuale dupa inventariere)? Exista un use case concret?
- Raspuns: Da, se adauga ca tip de provenienta - util pentru corectii dupa inventariere fizica.

**I. Momentul scaderii stocului**
Stocul se scade la acceptarea comenzii sau la livrare/inchidere? La acceptare - stocul reflecta imediat ce e rezervat, dar comanda poate fi anulata dupa. La livrare - stocul e mai precis, dar intre timp poti "vinde" acelasi lot de doua ori.
- Raspuns: La acceptarea comenzii. La anulare, stocul se reface.

**J. Standardele pentru certificat**
Exista standarde, norme sau cerinte legale (romanesti sau europene) dupa care trebuie structurat un certificat de trasabilitate pentru materiale de constructii reciclate? Daca da, ce standard?
- Raspuns: OPEN QUESTION - de investigat inainte de finalizarea template-ului certificatului.

---

Multumesc, astept raspunsurile tale.
