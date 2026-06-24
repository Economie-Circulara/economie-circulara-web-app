# Cerinte si clarificari - aplicatie economie circulara

Document de lucru pornit din `brain-dump.md`.

Scopul documentului:
- sumarizeaza ce am inteles din idee;
- sparge produsul in arii principale;
- noteaza intrebarile neclare sub fiecare arie;
- pastreaza raspunsurile tale ca baza pentru specificatia ulterioara.

Format de lucru:
- fiecare intrebare are un camp `Raspuns:` care se completeaza pe masura ce discutam;
- intrebarile fara raspuns raman deschise;
- dupa fiecare runda putem actualiza sectiunile cu decizii noi.

## 1. Rezumatul ideii

Aplicatia este o platforma web pentru firme care lucreaza cu materiale, produse si deseuri intr-un flux de economie circulara. Scopul principal este trasabilitatea: fiecare produs vandut sau livrat trebuie sa poata fi legat inapoi de loturile de materie prima, deseuri reciclate, furnizori, clienti, documente si procese de productie prin care a trecut.

Exemplul central este o firma de constructii care produce beton, caramizi sau alte produse. Firma poate cumpara materie prima, poate primi deseuri reciclabile de la clienti si poate transforma aceste deseuri in noi materiale. Cand firma produce un lot de caramizi, aplicatia trebuie sa retina exact ce loturi de nisip, pietris, apa, fierbeton etc. au fost consumate, inclusiv daca aceste loturi provin din deseuri reciclate.

Clientul poate comanda produse fara preturi afisate, poate vedea comenzile sale si poate descarca certificate de trasabilitate. In unele cazuri clientul poate aduce inapoi materiale, fie ca retur, garantie sau parte dintr-un model de tip product-as-a-service.

Aplicatia pare sa aiba nevoie de:
- multi-tenant / organizatii;
- autentificare si roluri;
- clienti administrati de organizatie;
- comenzi;
- stoc pe loturi;
- retete si procese de productie / reciclare;
- documente atasate;
- certificate de trasabilitate;
- dashboard pentru admin si client;
- posibil, pe viitor, o interfata agentica pentru operatiuni prin limbaj natural.

## 2. Tenant, organizatii si model comercial

Ce am inteles:
- aplicatia va fi vanduta mai multor firme;
- probabil fiecare firma este o organizatie / tenant;
- fiecare organizatie are cel putin un admin;
- fiecare organizatie are clientii sai;
- preferinta initiala pare sa fie multi-tenant intr-o singura aplicatie, nu cate o clona per client, desi ambele variante sunt posibile.

Intrebari:

1. Cine este clientul platitor al aplicatiei: firma care produce/recicleaza, clientii firmei, sau ambele?
   - Raspuns: firma care produce/recicleaza

2. O organizatie reprezinta mereu o singura firma juridica sau poate reprezenta un grup de firme / puncte de lucru?
   - Raspuns: o oranizatie reprezinta o singura firma.

3. Datele intre organizatii trebuie izolate complet, inclusiv clienti, produse, retete, stocuri si documente?
   - Raspuns: da

4. Exista scenarii in care acelasi client final lucreaza cu mai multe organizatii din platforma?
   - Raspuns: nu

5. Este acceptabil ca aceeasi baza de date sa contina mai multe organizatii daca izolarea este facuta logic, sau exista cerinte de baze de date separate per tenant?
   - Raspuns: nu stiu. e posibil ca daca va dori cineva in mod explicit, vom putea extrace un tenant intr-o baza de date separata

6. Aplicatia trebuie sa fie white-label pentru fiecare organizatie, cu logo, culori, domeniu propriu sau emailuri personalizate?
   - Raspuns: cred ca da. minimum necesar momentan

## 3. Utilizatori, roluri si autentificare

Ce am inteles:
- aplicatia are autentificare;
- metode posibile: email/parola, magic link si/sau Google;
- adminul organizatiei creeaza conturi de clienti;
- clientul primeste email de confirmare si intra in platforma;
- exista cel putin doua roluri: admin si client.

Intrebari:

1. Ce roluri trebuie sa existe in prima versiune? De exemplu: super-admin platforma, admin organizatie, operator productie, operator stoc, client.
   - Raspuns: super-admin, admin, operator, client

2. Adminul organizatiei trebuie sa poata crea si alti admini sau operatori interni?
   - Raspuns: operatori

3. Clientii trebuie sa poata avea mai multi utilizatori pentru aceeasi firma client?
   - Raspuns: nu

4. Ce metoda de autentificare vrei pentru MVP: email/parola, magic link, Google sau combinatie?
   - Raspuns: probabil user/email. daca e usor, putem baga si google/magic link - in cazul inc are folosim supabase sau clerk - ceva out of the box

5. Clientul isi seteaza singur parola dupa invitatie sau ramane pe magic link?
   - Raspuns: nu stiu. probabil ca isi seteaza

6. Exista actiuni care trebuie aprobate de cineva anume? De exemplu acceptarea comenzilor, inchiderea productiei, emiterea certificatelor.
   - Raspuns: nu. 

## 4. Clienti si date firma

Ce am inteles:
- adminul poate crea clienti;
- daca firma client nu exista in sistem, adminul poate face lookup dupa CUI;
- sistemul ar trebui sa interogheze o baza de date publica din Romania si sa precompleteze campuri.

Intrebari:

1. Ce date minime trebuie salvate pentru o firma client? De exemplu CUI, denumire, adresa sediu, registrul comertului, TVA, email, telefon, persoana contact.
   - Raspuns: da, cele de mai sus

2. Ce sursa publica vrei folosita pentru lookup CUI? Exista deja un API preferat?
   - Raspuns: nu stiu inca. ce e mai simplu de integrat

3. Daca datele din lookup sunt gresite sau incomplete, adminul le poate edita manual?
   - Raspuns: da, va fi un pas manual de verificare/confirmare

4. Clientii pot fi si persoane fizice sau doar firme?
   - Raspuns: doar firme

5. Clientii pot avea mai multe adrese de livrare / ridicare?
   - Raspuns: probabil ca da. cred ca adresa unui client nu va coincide cu adresa de livrare a unei comenzi

6. Un client poate fi si furnizor de deseuri / materiale in acelasi timp?
   - Raspuns: da

## 5. Catalog produse si comenzi client

Ce am inteles:
- clientul poate comanda produse intr-un flux de tip ecommerce;
- nu se afiseaza preturi;
- clientul adauga produse si cantitati in cos;
- comanda are sumar produse, data si adresa de livrare;
- adminul vede comenzile in dashboard si le poate anula, accepta sau edita;
- cand comanda este acceptata, stocul de produse este scazut;
- dupa livrare, comanda se inchide si ramane in arhiva.

Intrebari:

1. Ce inseamna exact "produs" in catalog: doar produse finite vandabile sau si materii prime / deseuri?
   - Raspuns: in stoc, un tip de item va trebui sa aiba o bifa de "vandabil". daca produsul are acel flag, va aparea in catalog

2. Clientul vede tot catalogul organizatiei sau doar anumite produse disponibile pentru el?
   - Raspuns: tot catalogul. va fi siserachable/filterable

3. Produsele pot avea variante? De exemplu dimensiune, clasa betonului, culoare, format, unitate de ambalare.
   - Raspuns: nu stiu. ca sa fie simplu - nu. alte proprietati - alt produs

4. Ce statusuri trebuie sa aiba o comanda? De exemplu draft, trimisa, acceptata, in productie, pregatita, livrata, inchisa, anulata.
   - Raspuns: nu m-am gandit inca. probabil cele de. mai sus

5. Cand se scade stocul: la acceptarea comenzii, la pregatirea livrarii sau la inchiderea comenzii?
   - Raspuns: nu sunt sigur cand e mai bine

6. Adminul poate modifica produsele si cantitatile dintr-o comanda deja trimisa de client?
   - Raspuns: da. proniim de la ipoteza ca clientul si adminul sunt deja in contact. se stiu, vorbesc la telefon. platforma e mia mult o formalitate ca sa aiba trasabilitate si documentatie

7. Clientul trebuie notificat prin email la schimbarea statusului comenzii?
   - Raspuns: cred ca da

8. Comenzile trebuie sa suporte livrari partiale?
   - Raspuns: nu stiu. pentru simplitate - nu

9. Clientul poate anula sau modifica o comanda dupa trimitere?
   - Raspuns: probabil ca da.

## 6. Retur, garantie si product-as-a-service

Ce am inteles:
- clientul nu doar cumpara produse, ci poate aduce materiale inapoi;
- exemple: moloz, beton crapat in garantie, dale inchiriate pentru festival si returnate;
- dupa o comanda finalizata, clientul poate avea actiuni de tip retur sau garantie;
- aceste actiuni creeaza o noua comanda / cerere legata de comanda initiala;
- legatura este importanta pentru trasabilitate.

Intrebari:

1. Cum numim generic aceste fluxuri: retur, garantie, reciclare, recuperare, colectare, returnare materiale, sau alt termen?
   - Raspuns: nu stiu. sugereaza tu ceva ok

2. Returul si garantia sunt suficiente pentru MVP sau trebuie si un flux separat de inchiriere / product-as-a-service?
   - Raspuns: cred ca initial se voia inchiriere, dar m-am gandit ca se poate simula prin doua comenzi separate. e mai simplu, sau se complica de fapt?

3. Cand un client aduce materiale inapoi, sistemul trebuie sa stie exact ce produs initial a fost returnat sau poate fi o cantitate estimata?
   - Raspuns: da, dar clienul poate modifica. poate aduce mai putine dale inapoi. poate cateva s-au stricat si intra in categoria moloz

4. Materialele returnate intra automat in stoc ca deseu / material reciclabil sau trebuie inspectate si acceptate manual?
   - Raspuns: nu stiu. probabil manual.

5. Pentru garantie, trebuie creata automat o noua comanda de inlocuire sau doar o cerere care se aproba manual?
   - Raspuns: cred ca o noua comanda.

6. In cazul inchirierii, aplicatia trebuie sa urmareasca perioada de utilizare, scadenta returului si penalizari, sau doar trasabilitatea fizica?
   - Raspuns: nu stiu. e un use case care trebuie implementat cumva, dar nu cred ca va fi folosit

7. Retururile pot fi initiate de admin in numele clientului?
   - Raspuns: da

## 7. Stoc, itemi si loturi

Ce am inteles:
- adminul administreaza stocul;
- itemii pot avea titlu, descriere, poza, atasamente, reteta si unitate de masura;
- itemii pot fi produse, materii prime sau deseuri;
- orice adaugare manuala in stoc cere provenienta si documente;
- stocul se actualizeaza automat dupa procese de transformare;
- loturile sunt obligatorii pentru trasabilitate.

Intrebari:

1. Ce tipuri de itemi trebuie definite explicit? De exemplu deseu, materie prima, semifabricat, produs finit, ambalaj, serviciu.
   - Raspuns:

2. Un item poate avea mai multe unitati de masura sau doar una principala?
   - Raspuns:

3. Trebuie conversii intre unitati? De exemplu kg <-> tone, bucati <-> paleti, metri cubi <-> tone.
   - Raspuns:

4. Ce informatii minime trebuie sa aiba un lot? De exemplu data intrare, sursa, locatie, cantitate initiala, cantitate ramasa, documente, status calitate.
   - Raspuns:

5. Stocul este urmarit pe locatii / depozite diferite?
   - Raspuns:

6. Loturile pot expira, pot fi blocate sau pot fi marcate ca neconforme?
   - Raspuns:

7. FIFO este regula obligatorie pentru toate consumurile sau doar default-ul care poate fi suprascris manual?
   - Raspuns:

8. La adaugare manuala in stoc, ce tipuri de provenienta exista? De exemplu achizitie, productie interna, retur client, reciclare, ajustare inventar.
   - Raspuns:

9. Trebuie audit trail pentru toate modificarile de stoc?
   - Raspuns:

## 8. Retete si procese de productie / reciclare

Ce am inteles:
- fiecare item poate avea o reteta;
- reteta poate fi goala pentru itemii care nu se proceseaza;
- exista doua tipuri mari de proces:
  - input cunoscut, output variabil: de exemplu reciclarea molozului, unde rezultatele se confirma manual;
  - output cunoscut, input calculabil/fix: de exemplu fabricarea unei caramizi dupa reteta;
- la finalul procesului se actualizeaza stocul;
- procesul consuma loturi de input si creeaza loturi noi de output.

Intrebari:

1. Cum ar trebui modelate retetele: procente, cantitati fixe per unitate de output, intervale estimate sau o combinatie?
   - Raspuns:

2. O reteta poate avea alternative de materiale? De exemplu nisip reciclat sau nisip cumparat.
   - Raspuns:

3. Retetele trebuie versionate? De exemplu daca reteta se schimba, produsele vechi raman legate de versiunea veche.
   - Raspuns:

4. La productia cu output fix, utilizatorul introduce cantitatea dorita de produs, iar sistemul calculeaza consumul?
   - Raspuns:

5. La reciclarea cu output variabil, utilizatorul introduce intai inputul, apoi confirma manual cantitatile rezultate?
   - Raspuns:

6. Sistemul trebuie sa valideze pierderile / randamentul fata de reteta sau doar sa le inregistreze?
   - Raspuns:

7. Procesele de productie au statusuri? De exemplu planificat, in lucru, asteapta confirmare, finalizat, anulat.
   - Raspuns:

8. Productia poate fi legata direct de o comanda client sau este doar productie pentru stoc?
   - Raspuns:

9. Trebuie suport pentru productie partiala sau batch-uri multiple pentru aceeasi comanda?
   - Raspuns:

## 9. Trasabilitate si certificate

Ce am inteles:
- produsul livrat trebuie sa aiba atasat lantul de provenienta al ingredientelor;
- un lot de produs poate contine materii prime din mai multe loturi sursa;
- lantul poate merge inapoi prin reciclare, achizitii, retururi, furnizori si clienti;
- clientul poate vedea trasabilitatea comenzilor sale si poate descarca certificate.

Intrebari:

1. Ce trebuie sa contina certificatul de trasabilitate pentru o comanda?
   - Raspuns:

2. Certificatul este generat automat ca PDF la inchiderea comenzii sau la cerere?
   - Raspuns:

3. Certificatul trebuie sa aiba numar unic, data emitere, semnatura, logo organizatie sau QR code?
   - Raspuns:

4. Cat de detaliat trebuie prezentat lantul de trasabilitate clientului? Loturi exacte, procente, furnizori, documente, locatii?
   - Raspuns:

5. Exista date care sunt vizibile intern, dar ascunse clientului?
   - Raspuns:

6. Certificatul trebuie sa fie public verificabil prin link / QR code fara login?
   - Raspuns:

7. Trebuie generate rapoarte agregate, de exemplu procent material reciclat pe comanda sau economie de deseuri?
   - Raspuns:

8. Exista standarde, norme sau cerinte legale dupa care trebuie structurat certificatul?
   - Raspuns:

## 10. Documente si atasamente

Ce am inteles:
- pe comenzi se pot atasa documente precum aviz, certificat, factura;
- la intrari manuale in stoc se pot atasa facturi de achizitie sau alte documente;
- itemii pot avea atasamente.

Intrebari:

1. Ce entitati pot avea documente atasate? Client, comanda, lot, item, proces de productie, certificat?
   - Raspuns:

2. Ce tipuri de fisiere trebuie acceptate? PDF, imagini, Excel, Word?
   - Raspuns:

3. Documentele sunt doar pentru arhiva sau unele trebuie generate automat de aplicatie?
   - Raspuns:

4. Cine poate vedea fiecare tip de document: admin, operator, client?
   - Raspuns:

5. Trebuie semnaturi digitale sau validare speciala pentru documente?
   - Raspuns:

6. Trebuie pastrate versiuni ale documentelor?
   - Raspuns:

## 11. Dashboard admin

Ce am inteles:
- adminul are dashboard pentru comenzi;
- adminul administreaza clienti, stoc, itemi, retete, productie si documente;
- adminul poate face comenzi in numele clientilor.

Intrebari:

1. Care sunt cele mai importante 3 ecrane pentru admin in MVP?
   - Raspuns:

2. Dashboardul admin trebuie sa arate indicatori / KPI-uri? De exemplu stoc critic, comenzi noi, procese in asteptare, materiale reciclate.
   - Raspuns:

3. Adminul trebuie sa poata cauta global dupa comanda, client, lot, produs sau certificat?
   - Raspuns:

4. Ce actiuni trebuie sa poata face adminul rapid din lista de comenzi?
   - Raspuns:

5. Comanda facuta de admin in numele clientului trebuie sa trimita notificare clientului?
   - Raspuns:

6. Operatorii interni au nevoie de interfete simplificate pentru stoc/productie, separate de admin?
   - Raspuns:

## 12. Dashboard client

Ce am inteles:
- clientul vede comenzile sale;
- pentru comenzi finalizate poate initia retur / garantie;
- clientul poate accesa datele de trasabilitate ale comenzilor;
- clientul poate descarca certificate.

Intrebari:

1. Clientul trebuie sa vada doar comenzile proprii sau si comenzile tuturor utilizatorilor din firma sa?
   - Raspuns:

2. Clientul poate repeta o comanda anterioara?
   - Raspuns:

3. Clientul poate descarca toate documentele atasate unei comenzi sau doar certificatul de trasabilitate?
   - Raspuns:

4. Clientul poate vedea statusul productiei / livrarii in timp real?
   - Raspuns:

5. Clientul poate trimite mesaje / observatii pe comanda?
   - Raspuns:

6. Clientul poate avea un flux fara cont, prin link securizat, pentru descarcarea certificatelor?
   - Raspuns:

## 13. Tehnologie, hosting si arhitectura

Ce am inteles:
- ai lucrat cu Vercel si Supabase si flow-ul a fost ok;
- se poate refolosi stackul;
- exista si varianta self-hosted pe VPS cu Next/Nuxt si PostgreSQL local;
- aplicatia are nevoie de baza de date relationala si autentificare.

Intrebari:

1. Pentru MVP preferi Vercel + Supabase sau self-hosted de la inceput?
   - Raspuns:

2. Ai o preferinta intre Next.js si Nuxt?
   - Raspuns:

3. Aplicatia trebuie gandita de la inceput sa poata fi mutata usor de pe Supabase pe PostgreSQL self-hosted?
   - Raspuns:

4. Documentele atasate vor fi stocate in Supabase Storage / S3-like storage / filesystem local?
   - Raspuns:

5. Exista cerinte de backup, audit, GDPR sau locatie a datelor in UE?
   - Raspuns:

6. Trebuie suport pentru limba romana doar, sau si alte limbi?
   - Raspuns:

## 14. Interfata agentica - nice to have

Ce am inteles:
- pe viitor ar fi utila o interfata in care userul scrie comenzi in limbaj natural;
- agentul poate executa actiuni precum creare comanda sau raspunsuri de analiza stoc;
- exemple: "fa o comanda de 30 de grinzi de metal pentru clientul X", "cate caramizi pot produce cu stocul existent?".

Intrebari:

1. Interfata agentica este exclusa din MVP sau vrei macar o baza tehnica pentru ea?
   - Raspuns:

2. Agentul are voie sa execute actiuni direct sau doar sa propuna actiuni care sunt confirmate de user?
   - Raspuns:

3. Ce actiuni ar fi cele mai valoroase pentru agent in prima versiune?
   - Raspuns:

4. Agentul trebuie sa functioneze doar pentru admin sau si pentru client?
   - Raspuns:

5. Raspunsurile agentului trebuie sa fie auditate / logate ca actiuni oficiale?
   - Raspuns:

## 15. MVP si prioritizare

Ce am inteles:
- produsul are mai multe module mari, dar pentru constructie trebuie probabil delimitat un MVP;
- nucleul pare sa fie stoc pe loturi + productie + comenzi + certificate de trasabilitate.

Intrebari:

1. Care este demonstratia minima care ar convinge un prim client?
   - Raspuns:

2. Ce flux trebuie sa functioneze cap-coada in MVP? Exemplu: creare client -> intrare stoc -> productie -> comanda -> certificat.
   - Raspuns:

3. Ce poate fi manual in MVP, chiar daca ulterior va fi automatizat?
   - Raspuns:

4. Ce module pot fi amanate clar dupa MVP?
   - Raspuns:

5. Exista un termen tinta pentru demo sau lansare?
   - Raspuns:

6. Exista deja un client pilot sau un domeniu concret de materiale pe care trebuie sa-l modelam prima data?
   - Raspuns:

7. Ce riscuri sunt cele mai importante: corectitudinea trasabilitatii, usurinta de folosire, costul hostingului, conformitatea legala, viteza de livrare?
   - Raspuns:

## 16. Observatii de produs

Acestea sunt interpretari initiale, nu decizii finale:

- Entitatea centrala nu este doar "produsul", ci "lotul". Trasabilitatea reala se construieste prin miscari de loturi: intrare, consum, transformare, iesire, retur.
- O comanda nu ar trebui sa scada doar o cantitate abstracta de produs, ci sa rezerve sau consume loturi concrete, probabil FIFO by default.
- Retetele trebuie probabil separate de procesele efective. Reteta este planul; procesul este executia reala, cu cantitati confirmate.
- Certificatele se pot genera din graful de trasabilitate: comanda -> loturi produs -> procese -> loturi input -> surse/documente.
- Pentru MVP, partea financiara poate fi exclusa, dar documentele atasate trebuie totusi modelate suficient de flexibil.
- Multi-tenant-ul pare mai potrivit decat clonarea aplicatiei per firma, dar trebuie clarificat nivelul de izolare si customizare.

## 17. Flux MVP posibil

Un flux minim coerent ar putea fi:

1. Adminul creeaza organizatia si utilizatorii.
2. Adminul creeaza clientul, eventual prin lookup CUI.
3. Adminul defineste itemi: deseu moloz, nisip reciclat, pietris, caramida.
4. Adminul defineste retete:
   - reciclare moloz -> nisip/pietris/fierbeton/pierdere;
   - productie caramida -> consum nisip/pietris/alte materiale.
5. Adminul inregistreaza o intrare de deseu sau materie prima in stoc, cu lot si documente.
6. Adminul porneste un proces de reciclare si confirma outputurile.
7. Sistemul creeaza loturi noi rezultate din reciclare.
8. Adminul porneste productia de caramizi, sistemul consuma FIFO loturi de input.
9. Sistemul creeaza lot de caramizi.
10. Clientul sau adminul creeaza o comanda.
11. Adminul accepta comanda si sistemul aloca / consuma loturi de produs.
12. La livrare/inchidere se genereaza certificatul de trasabilitate.

Intrebari:

1. Acest flux MVP este corect ca directie?
   - Raspuns:

2. Ce pas lipseste sau este gresit?
   - Raspuns:

3. Pentru primul demo, vrei sa folosim exemplul cu caramizi si moloz sau alt exemplu mai apropiat de clientul real?
   - Raspuns:

