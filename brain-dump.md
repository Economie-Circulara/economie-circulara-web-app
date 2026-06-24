vreau sa fac o aplicatie web pentru economie circulara. acest document este un brain dump al cerintelor - cum le-am inteles la momentul scrierii.

aplicatia are ca scop trasabilitatea unor materiale in scopul economii circulare.
---
un use case concret:
Firma A este o firma de constructii si fabrica beton si caramizi.
este necesar ca o caramida vanduta unui client sa aiba trasabilitate a materiei prime. de ex, un client va putea afla originea nisipului folosit la caramida.
in acelasi timp, Firma A poate primi deseuri reciclabile. De exem,plu, poate primi moloz din daramaturi. Acesta va fi procesat (confirm unui config) si va rezulta 30% nisip, 10% fierbeton, 20% pietris si restul pierder (asta e un exemplu de config).  dupa ce deseul este reciclat, in baza de date, noile materiale prime rezultate au un id de trasabilitate in sistem, care vor pointa catre lotul de moloz primit (care va avea data, locatia, clientul de la care a primit si alte informatii utile).

Firma A cand face o caramida, va folosi materiale prime din stoc pe principiul FIFO, asa ca intr-un lot de caramizi poate avea nisip din mai multe surse (ex: din lotul 1 de material reciclat de la clientul A, din lotul 2 de material recuclat de la clientul B si din achizitie proprie - a cumparat nisip de la Funrizorul A). toate aceste infromarii  - si chiar lant de informatii - trebuie sa fie atasate produsului caramida. 

Cand un client comanda caramizi, comanda va avea atasata un certificat care va pune in lumina trasabilitatea "ingredientelor"

---

avem nevoie de o aplicatie web cu o baza de date. am lucrat cu vercel si supabase si a fost un flow ok, poate putem refolosi stackul. putem sa ne gandim si la o versiune self hosted (ai un vps mai ieftin care ruleaza o aplicatie next sau nuxt si un postgress local sau ceva de genul).

aplicatia va ave anevoie de autentificare. aceasta aplicatie va fi "Vanduta" mai multor firmei si cel mai probabil vom avea nevoie de organizatii (multi tenant). fiecare organizatie va avea (cel putin un) admin si clienti. este si optiunea de a instantia o clona a aplicatiei pt fiecare nou tenant, dar cred ca este mai haotic/costisitor

auth cu mail/pass, magic link si/sau google

adminul unei organizatii va crea conturi de clienti.

 - daca nu exista in sistem deja, adminul va putea face un lookup dupa cui-ul firmei. (e in romania) si sistemul va trebui sa interogheze o baza de date publica si sa precompleteze toate campurile de acolo


clinetul va primi un mail de confimare al contului pe care trebuie sa il acceseze.

odata ajuns in platforma, clientul va putea comanda anumite produse (in stil ecommerce), insa nu va avea preturi afisate. va putea "adauga in cos" produse cu diferite cantitati. apoi va face o comanda. comanda va avea, pe langa sumarul produselor, o data si o adresa de livrare.

adminul va primi comanda (o va vedea intr-un dashboard) si o va putea anula, accepta, edita. odata acceptata, stocul firmei trebuie updatat sa fie scazute produsele din comanda.

odata livrata, comanda se poate inchide si va ramane in arhiva.

----

un client poate sa cumpere, insa poate si sa aduca materiale la reciclat.
poate gasim un termen mai bun. ideea ar fi in felul urmator:

 - un client poate aduce moloz
 - un client a cumparat beton, l-a aplicat si s-a crapat. acum "in garantie" mai face o comanda de alt beton si pe cel vechi (daramturi) il aduce inapoi
 - un client cumpara (sau mai bine zis inchiriaza) dale de beton pentru un festival. dupa ce festivalul se termina, aduce dalele inapoi "la reciclat".

 cred ca idea ar fi sa fi eun fel de product as a service.

 in dashboardul lui, clienutl poate vedea comenzile sale. pentru o comanda care este finalizata, va putea avea 2 followup actions: 1. "retur" -> aduce dalele inapoi si 2. "garantie" - aduce inapoi si vrea si ceva in schimb.
 ambele optiuni nu fac decat sa creeze o noua comanda cu toate datele precompletate care este cumva legata de prima comanda in sistem (tot pentru trsabilitatea materialelor/produselor).

 important: nu tratam partea financiara (bani/preturi). pe o comanda se pot atasa documente (aviz/certificat/factura)


 ---

 stoc

 adminul va putea administra stocul.
  
in stoc, itemii pot avea titlu, descriere, poza, atasamente, "reteta" si o unitate de masura (tone/metri/litri/bucata... etc)

 cand adauga manual un item in stoc (fie produs/materie prima/deseu), va trebui sa completeze un formular cu provenienta (si factura de achizitie sau alte documente)

 dupa orice process de transformare (deseu -> materie prima sau materie prima -> produs), stocul se va updata automat cu toate datele 

 stocul va trebui sa aiba loturi, ca sa poti face trasabilitatea

 fiecare item va avea si o "reteta" pentru productie
pentru itemii care nu trebuie sa fie procesati, reteta poate fi goala
---

productie

aici avem 2 tipur de procese:
1. cu input fix (de exemplu, cand se face concasarea molozului, se poate sa iasa mai mult fierbeton in cazul A decat in cazul B.. nu e o formula fixa) - se stie ce intra, dar nu se stie exact cat/ce iese

 - aici la finalul procesului, vom avea nevoie de o confiurmare manuala a utilizatorului. conform "retetei", stim ca din materialul rezidual ar trebui sa iasa 30% pietris, dar utilizatorul trebuie sa aiba un formular cu materialele/produsele reiesite si sa poate sa confirme si/sau sa modifice procentajele/cantitatile

2. cu output fix (de exemplu, pentru fabricarea unei caramizi, se stie ca e nevoie de Xgrame de nisip si Y grame de apa) - stii ce iese (si ce intra de fapt :)

cum fiecare tip de item din stoc are o reteta, adminul poate pune in productie stocul (sa transforme stocul din materie prima in produse sau invers).   va avea nevoie de un dashboard si fiecare transformare va updata stocul (ca un fel de marketplace... "scazi" 10tone de nisip si "adaugi" 10paleti de caramizi)
---

vom avea nevoie si de un mod simplu in care adminul sa faca o comanda in numele unui client (in cazul in care clientului nu i se face onboarding si nu stie/nu vrea sa foloseasca aplicatia)

totodata, clientul, din dashboard, va putea accesa toate datele de trasabilitate ale comenzilor sale si va putea downloada certificate.


---
nice to have: o interfata agentica unde userul are un textarea si vorbeste cu un agent si il pune pe el "la treaba" sa nu mai dea clickuri prin website. de ex: "fa o comanda de 30 de grinzi de metal pentru clientul X" sau "cate caramizi pot produce cu stocul existent?"
---