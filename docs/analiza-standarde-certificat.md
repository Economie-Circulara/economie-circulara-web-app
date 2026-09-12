# Analiza standarde legale pentru certificatul de trasabilitate

> **Spike S2** din [`plans/implementation-plan.md`](plans/implementation-plan.md) §8 -
> "Standarde legale RO/EU pentru certificatul de trasabilitate materiale reciclate -
> output asteptat: continut minim obligatoriu". Deblocheaza Task G (certificate).
>
> **Data cercetarii:** 2026-09-12. **Autor:** agent AI (Claude Opus 5), pe baza de surse
> publice online.
>
> ⚠️ **Acest document NU este consultanta juridica.** Este un research tehnic, facut din
> surse publice, menit sa orienteze decizia de produs. Afirmatiile marcate
> **[DE CONFIRMAT]** trebuie validate de un jurist / consultant de mediu / organism de
> certificare inainte de a fi folosite in comunicarea comerciala sau in documentele de
> recepție. Textele de standarde armonizate (EN 12620, EN 206, EN 933-11) sunt cu acces
> platit si **nu au fost citite integral** - continutul lor e reconstituit din ghiduri
> publice si din comentarii ale organismelor nationale de standardizare.

---

## 1. Concluzia in 10 rânduri

1. **Certificatul nostru de trasabilitate nu are niciun temei legal obligatoriu** in RO sau
   UE. Nu exista, in acest moment, un act normativ care sa impuna un "certificat de
   trasabilitate a materialelor reciclate" cu un continut minim prescris. Este un document
   **voluntar, informativ, comercial**.
2. Ce **este** obligatoriu la livrarea acestor materiale sunt **alte** documente, emise de
   **organizatia-client (producatorul/reciclatorul)**, nu de platforma: declaratia de
   performanta + marcajul CE (pentru agregate), documentele de evidenta a deseurilor,
   documentele de transport (formular de incarcare-descarcare pentru deseuri, aviz/UIT
   e-Transport pentru produse), iar pentru beton bonul de livrare conform SR EN 206 /
   NE 012/1-2022.
3. Riscul real al platformei nu e "lipsa unui standard", ci **confuzia**: un PDF care arata
   ca un certificat si e intitulat "Certificat de trasabilitate" poate fi interpretat ca
   atestare de performanta/conformitate. De aici necesitatea unui **disclaimer explicit**
   (§8) - protejeaza si clientul (care nu trebuie sa creada ca a primit DoP) si noi.
4. Exista totusi un **corp de cerinte de continut** pe care ne putem alinia voluntar si
   care da credibilitate certificatului: trasabilitatea de la generare la destinatia finala
   (OUG 92/2021), clasificarea constituentilor agregatului reciclat (EN 933-11, ceruta de
   EN 12620 pentru agregate reciclate), regulile de declarare a conținutului reciclat
   (ISO 14021 / EN 45557) si modelul de bon de livrare din EN 206. §5 si §6 traduc asta in
   campuri concrete.

---

## 2. Ce genereaza platforma acum (punct de pornire)

Certificatul este generat automat la inchiderea comenzii
(`src/features/orders/notifications.ts` -> `generateCertificateForOrder`), iar PDF-ul e
randat din `src/features/certificates/pdf.tsx` peste snapshot-ul inghetat in
`certificates.traceability_snapshot` (vezi `src/features/certificates/types.ts`
`TraceabilitySnapshot`, versiune 1).

Continut actual al PDF-ului:

| Zona PDF                   | Date folosite                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| Header stanga              | `orgName` (`organizations.name`) + textul fix "Materiale de construcții circulare"        |
| Header dreapta             | "Nr. `{snapshot.order.number}` · CRT", "Emis: `{snapshot.generatedAt}`"                   |
| Banda info (3 coloane)     | `snapshot.order.clientName`, `snapshot.order.clientCui`, `snapshot.order.number`, `snapshot.deliveredItems[]` (`itemTitle`, `quantity`, `unit`) |
| "Lanț de trasabilitate"    | `snapshot.graph` (Sankey SVG, noduri `source`/`lot`/`process`/`delivery`)                  |
| "Materiale și origine"     | `snapshot.materials[]` -> `material`, `origin` (`PROVENANCE_LABELS`), `source`, `percentage` |
| Footer                     | "Certificat generat automat", "Graful reflectă trasabilitatea inregistrată în platformă la data emiterii.", caseta de semnatura cu `orgName` + "Semnătură & ștampilă electronică", banda "{orgName} · trasabilitate emisă de Lot cu Lot" |

Numerotarea: `certificates.number` in format `CRT-<an>-<seq>`, unic per organizatie
(`public.generate_certificate_number`, migrarea
[`0009_certificates_storage.sql`](../supabase/migrations/0009_certificates_storage.sql));
PDF stocat in bucketul privat `certificates`.

---

## 3. Ce e OBLIGATORIU legal (si de cine e emis)

### 3.1 Primul filtru: materialul este deseu sau produs?

Toate obligatiile se bifurca in functie de statutul juridic al materialului. Cadrul e
**O.U.G. nr. 92/2021 privind regimul deseurilor** (transpune Directiva 2008/98/CE):

- **art. 5** - subprodus (nu a fost niciodata deseu);
- **art. 6** - **incetarea statutului de deseu** ("end-of-waste"): deseul care a trecut
  printr-o operatiune de valorificare **inceteaza sa fie deseu** daca, **cumulativ**:
  (a) substanta/obiectul urmeaza sa fie utilizat in scopuri specifice; (b) exista o piata
  sau o cerere; (c) indeplineste cerintele tehnice pentru scopurile specifice si respectA
  legislatia si standardele aplicabile produselor; (d) utilizarea nu produce efecte
  globale nocive asupra mediului sau sanatatii.
  Criteriile detaliate (inclusiv valori-limita pentru poluanti, sistem de management al
  calitatii/automonitorizare si **cerinte pentru emiterea unei declaratii de conformitate**
  - art. 6 alin. (5) lit. e)) se adopta **prin ordin de ministru**.
  ([text oficial](https://legislatie.just.ro/Public/DetaliiDocumentAfis/245846),
  [varianta consolidata](https://envirocons.ro/oug-92-din-2021-privind-regimul-deseurilor/))
- **art. 27** - obligatia de **asigurare a trasabilitatii "de la locul de generare la
  destinatia finala"**. Atentie: in textul consultat aceasta obligatie apare in contextul
  deseurilor periculoase. **[DE CONFIRMAT]** daca se extinde si la deseurile nepericuloase
  (codurile 17 xx - beton, caramizi, pamant si pietris) - e cel mai apropiat "cârlig" legal
  de ceea ce face platforma si merita verificat exact.

**Consecinta practica:** la nivel **UE** exista criterii de incetare a statutului de deseu
doar pentru **fier/otel/aluminiu** (Reg. 333/2011), **sticla** (Reg. 1179/2012) si **cupru**
(Reg. 715/2013). **Pentru agregate NU exista criterii UE** - se decide **caz cu caz**, la
nivel national / prin autorizatia de mediu a operatorului
([Comisia Europeana - End of Waste](https://ec.europa.eu/environment/waste/framework/end_of_waste.htm),
[studiu EoW agregate inerte in statele membre, ECN](https://publicaties.ecn.nl/PdfFetch.aspx?nr=ECN-E--17-010)).

**[DE CONFIRMAT - important]** Nu am identificat un **ordin de ministru romanesc care sa
stabileasca criterii de incetare a statutului de deseu pentru agregatele reciclate din
DCD**. Daca un astfel de ordin nu exista, statutul de produs al agregatului reciclat rezulta
din **autorizatia de mediu a operatorului** (operatiunea de valorificare autorizata) plus
respectarea standardului de produs - de validat cu consultantul de mediu al clientului
pilot. Aceasta e cea mai importanta incertitudine a documentului: determina daca la livrare
trebuie completat formular de deseuri (3.2) sau documente de produs (3.3).

### 3.2 Cat timp materialul e deseu

| Document / obligatie                                                       | Temei                                                  | Emis de                                   |
| -------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------- |
| **Autorizatie de mediu** pentru operatiunea de tratare/valorificare        | OUG 92/2021                                            | APM / ANPM (autoritate), deținuta de operator |
| **Evidenta gestiunii deseurilor** (registru, cantitati, coduri de deseu, raportare anuala) | OUG 92/2021 (evidenta) + H.G. nr. 856/2002 (lista deseurilor si registrele) | operatorul economic                       |
| **Formular de incarcare-descarcare deseuri nepericuloase** - insoteste fiecare transport, completat de expeditor in **3 exemplare** (expeditor / transportator / destinatar) | **H.G. nr. 1061/2008**, anexa nr. 3 ([model](https://lege5.ro/Gratuit/geytenzvgi/formular-de-incarcare-descarcare-deseuri-nepericuloase-model-hotarare-1061-2008), [act](https://legislatie.just.ro/Public/DetaliiDocument/97706)) | expeditorul deseului                      |
| **Document de identificare** pentru transferul de deseuri periculoase      | OUG 92/2021 art. 29 alin. (2) + Reg. (CE) 1013/2006 anexa IB | expeditorul                           |

Codurile relevante pentru clientul pilot (lista deseurilor - H.G. 856/2002 anexa 2 /
Decizia 2014/955/UE): `17 01 01` beton, `17 01 02` caramizi, `17 01 07` amestecuri de
beton/caramizi/tigle fara substante periculoase, `17 05 04` pamant si pietre, `17 09 04`
amestecuri de deseuri din construcții si demolari. **[DE CONFIRMAT]** maparea exacta pe
fluxurile clientului.

### 3.3 Cand materialul e produs pentru construcții: declaratia de performanta + marcajul CE

Acesta este **regimul obligatoriu, reglementat**, fata de care trebuie sa ne delimitam
explicit.

**Cadru UE - atentie, s-a schimbat recent:**

- **Regulamentul (UE) nr. 305/2011 (CPR)** a fost **inlocuit de Regulamentul (UE) 2024/3110**,
  publicat in JO la **18 decembrie 2024**, intrat in vigoare **7 ianuarie 2025**, cu
  aplicarea majoritatii dispozitiilor de la **8 ianuarie 2026** si cu **tranzitie lunga**
  (standardele armonizate existente sub vechiul CPR ramân aplicabile pe masura ce sunt
  inlocuite; perioade de tranzitie citate pana in jurul **2039-2040**).
  ([EUR-Lex 2024/3110](https://eur-lex.europa.eu/eli/reg/2024/3110/oj/eng),
  [DIBt](https://www.dibt.de/en/news/whats-new/news-detail/meldung/das-warten-hat-ein-ende-die-novellierte-bauproduktenverordnung-ist-bekanntgemacht),
  [FPS Economy BE](https://economie.fgov.be/en/themes/enterprises/specific-sectors/construction/construction-products/construction-products))
  **[DE CONFIRMAT]** regimul exact aplicabil agregatelor **astazi** (septembrie 2026):
  practic, pentru agregate se aplica inca standardele armonizate emise sub 305/2011, dar
  data exacta de comutare per familie de produs depinde de actele delegate/standardele noi.
- Sub noul CPR: **art. 19** - producatorul intocmeste **declaratia de performanta si de
  conformitate**; **art. 20** - declaratiile pot fi combinate si furnizate digital, cu
  condiția sa fie "unamendable, human and machine readable"; **art. 21** - **marcajul CE se
  aplica numai produselor pentru care exista aceasta declaratie**; **art. 36** - produse
  **remanufacturate**; **art. 40** - declararea **performantei de sustenabilitate
  ambientala**; **art. 67-68** - **pasaportul digital al produsului** pentru construcții,
  aliniat cu ESPR (Reg. (UE) 2024/1781), plus dictionar comun de date.
  -> Relevant strategic: **DPP-ul din noul CPR este direcția in care se indreapta piata**, iar
  certificatul nostru poate fi pozitionat ca pregatire pentru el - **dar nu ca DPP**, care
  va fi reglementat prin acte delegate inexistente inca.

**Transpunere RO:** **H.G. nr. 668/2017** privind stabilirea condițiilor pentru
comercializarea produselor pentru construcții (in vigoare din 18 noiembrie 2017) - stabileste
masurile nationale de aplicare a CPR: marcajul CE se aplica produselor pentru care
producatorul a intocmit declaratie de performanta pe baza unei specificatii tehnice
armonizate; pentru **sistemul 2+**, declaratia de performanta se emite de **producator**, pe
baza **certificatului de conformitate a controlului producției in fabrica** emis de un
**organism notificat**.
([act](https://legislatie.just.ro/Public/DetaliiDocument/193282),
[sinteza](https://www.universuljuridic.ro/stabilirea-conditiilor-pentru-comercializarea-produselor-pentru-constructii-hg-668-2017-intra-in-vigoare-18-noiembrie-2017/))

**Pe familii de produs (fluxul clientului pilot):**

| Produs                                              | Standard                                                                 | Marcaj CE + DoP?                        | Observatii                                                                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Agregate pentru beton** (nisip, pietris reciclat) | **EN 12620** (versiunea citata in JO: `EN 12620:2002+A1:2008`)            | **DA** - obligatoriu                    | AVCP **sistem 2+** pentru agregatele vandute producatorilor de beton (istoric sistem 4 pentru restul); evaluare/FPC conform **EN 16236**         |
| **Agregate nelegate / legate hidraulic** (balast, umpluturi, drumuri) | **EN 13242** (`EN 13242:2002+A1:2007`)                  | **DA** - obligatoriu                    | idem, sistem 2+/4 in functie de utilizare                                                                                                       |
| **Beton gata de utilizare**                         | **SR EN 206+A2:2021** - **NU este standard armonizat**                    | **NU** - nu exista marcaj CE pentru beton | Conformitatea se controleaza national: **NE 012/1-2022** "Cod de practica pentru producerea betonului" ([act](https://legislatie.just.ro/Public/DetaliiDocument/264439)), care a inlocuit CP 012/1-2007. Documentul de livrare obligatoriu e **bonul de livrare** cu continut minim prevazut de EN 206 (cap. 7) - **[DE CONFIRMAT]** continutul exact, standard cu acces platit |
| **Caramizi / elemente de zidarie**                  | familia **EN 771** (EN 771-1 argila arsa, EN 771-3 beton)                 | **DA** - obligatoriu                    | **[DE CONFIRMAT]** care parte din EN 771 se aplica produsului concret al clientului                                                             |

Surse: [ghid irlandez SR 16 pe EN 12620](https://irishconcrete.ie/wp-content/uploads/2017/04/SR-16-Guidance-March-2017.pdf),
[ghid producatori agregate reciclate (John Barritt)](https://www.johnbarritt.co.uk/wp-content/uploads/2016/04/Recycled-aggregates-Guidance-v1.pdf),
[EN 16236 (SIS)](https://www.sis.se/en/produkter/construction-materials-and-building/construction-materials/mineral-materials-and-products/ss-en-162362018/),
[MPA - utilizarea agregatelor reciclate in beton](https://cement.mineralproducts.org/MPACement/media/Cement/Publications/Fact-Sheets/2023-02-09_FS_6-Use_of_recycled_aggs_in_concrete.pdf).

**Elementul cel mai util pentru noi:** pentru agregatele **reciclate**, EN 12620 cere ca
**proportiile constituentilor** sa fie determinate conform **EN 933-11** si **declarate** pe
categoriile din standard: `Rc` (beton, produse din beton, mortar), `Ru` (agregat nelegat,
piatra naturala, agregat legat hidraulic), `Rb` (elemente de zidarie din argila/silico-
calcare), `Ra` (materiale bituminoase), `Rg` (sticla), `X` (altele/coezive), `FL` (particule
plutitoare, in cm³/kg).
([EN 933-11](https://standards.iteh.ai/catalog/standards/cen/b071a56c-697f-4b08-861c-ac39a16142f0/en-933-11-2009),
[ghid](https://www.johnbarritt.co.uk/wp-content/uploads/2016/04/Recycled-aggregates-Guidance-v1.pdf))

-> Aceasta este **singura "clasificare a conținutului reciclat" cu statut normativ** in
lumea agregatelor. Certificatul nostru **nu o poate calcula** (e rezultat de incercare de
laborator, pe sita 4-63 mm), dar **poate face loc declararii ei** ca date introduse de
operator (vezi §6, grupul F, si §7 delta).

### 3.4 Documente de livrare si fiscale (se aplica indiferent de "reciclat" sau nu)

- **Aviz de insotire a marfii** - cand transportul nu e insotit de factura; temei: normele
  privind documentele financiar-contabile (O.M.F.P. nr. 2634/2015). **[DE CONFIRMAT]** cu
  contabilul organizatiei - obligatia e de natura contabila, nu de mediu.
- **RO e-Transport (cod UIT)** - **relevant direct**: bunurile cu risc fiscal ridicat includ
  **"sare, sulf, pamanturi si pietre, ipsos, var si ciment" la codurile NC 2505 si NC 2517**
  (O.P.A.N.A.F. nr. 802/2022, in baza O.U.G. nr. 41/2022). **NC 2517 acopera pietrisul,
  pietricelele si piatra concasata de tipul folosit ca agregat pentru betoane** - deci
  **agregatele (inclusiv reciclate) intra in monitorizarea e-Transport** peste praguri.
  Praguri pentru transport national: vehicul cu masa tehnica admisibila **≥ 2,5 t** si
  incarcatura **peste 500 kg** / **peste 10.000 lei**.
  ([OPANAF 802/2022](https://static.anaf.ro/static/10/Anaf/legislatie/OPANAF_802_2022.pdf),
  [sinteza Accace](https://www.accace.ro/sistemul-ro-transport/),
  [ghid MF e-Transport](https://mfinante.gov.ro/static/10/Mfp/GhidROe-Transport.pdf))
  **[DE CONFIRMAT]** daca pragurile sunt **cumulative** ("si") sau alternative ("sau") -
  sursele publice consultate formuleaza diferit; textul OUG 41/2022 e arbitrul.
  -> Confirma valoarea modulului `deliveries` + `uit_code` (migrarea
  [`0013_deliveries.sql`](../supabase/migrations/0013_deliveries.sql)) si justifica afisarea
  UIT-ului pe certificat ca element de legatura cu documentele oficiale.

### 3.5 Legislatie DCD specifica: inca in lucru

Exista de ani un **proiect de lege privind gestionarea deseurilor din activitatile de
construire si desfiintare** (trecut prin Senat), care ar introduce obligatii noi pentru
titularii autorizatiilor de construire/desfiintare: **plan de gestionare a deseurilor**,
**sistem de trasabilitate a deseurilor generate**, informatii pre-desfiintare (audit),
tinta de **70% valorificare materiala**.
([proiect, FPSC](https://federatiaconstructorilor.ro/attachments/article/254/proiect-lege-deseuri-constructii.pdf),
[pagina proiectului](https://federatiaconstructorilor.ro/legislatie/proiecte-legislative/proiect-legislativ-privind-gestionarea-deseurilor-provenite-din-activitatile-de-construire-si-desfiintare),
[comentariu](https://arenaconstruct.ro/deseurile-din-constructii-obligatii-noi-pentru-titularii-autorizatiilor-si-pentru-autoritati/))

**[DE CONFIRMAT - critic pentru marketing]** La data acestui research **nu am putut confirma
ca proiectul a fost promulgat** si publicat in Monitorul Oficial. Articolul verificat
descrie in mod explicit o **propunere legislativa**, nu o lege in vigoare.
**Nu folosim "conform legii X" in materiale comerciale pana la confirmarea numarului si a
datei publicarii.** Daca legea intra in vigoare cu obligatia de "sistem de trasabilitate a
deseurilor", ea devine cel mai puternic argument de vanzare al platformei - merita
monitorizata activ.

### 3.6 Sinteza: cine emite ce

| Document                                                          | Obligatoriu? | Emitent                                            | Platforma il poate genera? |
| ----------------------------------------------------------------- | ------------ | -------------------------------------------------- | -------------------------- |
| Declaratie de performanta (DoP) + marcaj CE (agregate, zidarie)   | DA           | **producatorul** (pe baza certificatului FPC de la organism notificat) | **NU** - nu avem date de incercare, nici FPC. Putem doar **referi** numarul DoP. |
| Certificat de conformitate a controlului producției in fabrica    | DA (sistem 2+) | **organism notificat**                            | NU                         |
| Rapoarte de incercari (granulozitate, EN 933-11, substante periculoase) | DA (suport pentru DoP) | laborator / producator               | NU - doar arhivare ca `documents` |
| Bon de livrare beton (EN 206 / NE 012/1-2022)                     | DA           | producatorul de beton                              | Parțial - **[DE CONFIRMAT]** continutul minim din EN 206 cap. 7 |
| Formular incarcare-descarcare deseuri nepericuloase (HG 1061/2008) | DA (cat e deseu) | expeditorul                                     | Nu e implementat (posibil v2) |
| Evidenta gestiunii deseurilor (HG 856/2002)                       | DA           | operatorul                                         | Parțial - `stock_events` + Rapoarte (Task X3) sunt suport, nu inlocuitor |
| Aviz de insotire a marfii                                         | DA (cand nu e factura) | furnizorul                               | Da (Task X5)               |
| Declarare RO e-Transport + cod UIT                                | DA peste praguri | declarantul (furnizor/transportator)            | Da (Task X5, Socrate.io)   |
| **Certificat de trasabilitate (al nostru)**                       | **NU**       | **organizatia**, prin platforma                     | **DA** - e produsul nostru |

---

## 4. Ce e VOLUNTAR: scheme si standarde cu care ne putem alinia

| Schema / standard                                                  | Ce atesta                                                                 | Elemente de continut cerute, relevante pentru noi                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **ISO 14021** (declaratii de mediu auto-declarate)                  | conținut reciclat declarat de producator, fara terta parte               | definitii **pre-consumer / post-consumer**, claim verificabil, metoda de calcul declarata, fara afirmatii vagi       |
| **EN 45557**                                                        | metoda generala de calcul a **proportiei de material reciclat** la nivel de produs | calcul la nivel de produs finit cand se combina materiale/componente; bilant de masa documentat              |
| **Certificari de conținut reciclat de terta parte** (SCS Global SCS-103, TÜV SÜD, GreenCircle, SGS) | conținut reciclat **verificat**                    | audit pe **bill of materials**, achizitii de materie prima, lanț de aprovizionare, producție; separare pre/post-consumer; trasabilitatea fluxurilor de material |
| **EPD conform EN 15804** (declaratie de mediu a produsului)         | performanta de mediu pe ciclu de viata, verificata                        | date de inventar pe modul (A1-A3 etc.), reguli de categorie de produs (PCR), verificare independenta                 |
| **CSC - Concrete Sustainability Council**, **modulul R**            | beton cu **≥ 10% agregat reciclat**                                       | cere plant certificat CSC-Silver+; **chain of custody** pe furnizorii de ciment/agregate (certificate de furnizor CSC) |
| **Protocolul UE de gestionare a deseurilor din construcții si demolari** (actualizat 2024) | bune practici, nu obligatii                     | insista explicit pe **trasabilitate, audit pre-demolare, certificare pe tot lanțul** ca premisa a calitatii materialului reciclat |
| **Pasaport digital al produsului** (CPR 2024/3110 art. 67-68; ESPR Reg. (UE) 2024/1781) | viitoare obligatie, inca nereglementata in detaliu | date structurate, lizibile si de om si de masina, dictionar comun de date                                    |

Surse: [SCS Recycled Content](https://www.scsglobalservices.com/services/recycled-content-certification),
[SCS-103 standard (PDF)](https://cdn.scsglobalservices.com/files/standards/scs_stn_recycledcontent_v7-0_070814.pdf),
[TÜV SÜD](https://www.tuvsud.com/en/services/product-certification/recycled-content-certification),
[GreenCircle](https://www.greencirclecertified.com/recycled-content-certification),
[SGS - certificarea conținutului reciclat pentru materiale de construcții (PDF)](https://www.sgs.com/-/media/sgscorp/documents/corporate/flyers-and-leaflets/presentations/sgs-ie-webinar-certification-of-recycled-content-for-building-materials-an-introduction-2023-en.cdn.en.pdf),
[CSC - certificare](https://csc.eco/certification/),
[CSC Technical Manual v3.0 (PDF)](https://csc.eco/wp-content/uploads/2024/03/Technical-Manual-CSC-Technical-Manual-Version-3.0_rev.3.pdf),
[Protocolul UE DCD 2024 (PDF)](https://build-up.ec.europa.eu/system/files/2024-10/eu%20construction%20&%20demolition%20waste%20management%20protocol-ET0224753ENN.pdf).

**Concluzia de produs:** certificatul nostru, asa cum e, este o **declaratie auto-declarata
de tip ISO 14021** (fara verificare de terta parte). Daca in viitor un client vrea sa-si
certifice conținutul reciclat cu o terta parte, datele din platforma (loturi, `stock_events`,
`process_inputs`/`process_outputs`, snapshot-ul inghetat) sunt exact **probele de audit**
cerute de astfel de scheme. Acesta e un argument de vanzare corect si sustenabil, care **nu
pretinde** un statut pe care nu il avem.

---

## 5. Pozitionarea corecta a certificatului nostru

| Certificatul NOSTRU **este**                                                 | Certificatul nostru **NU este**                                  |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| document voluntar, emis de organizatie pe propria raspundere                  | declaratie de performanta (DoP) in sensul CPR / HG 668/2017       |
| reconstituire a lanțului de loturi inregistrat in platforma pentru o comanda   | marcaj CE, sau vreun document care insoteste marcajul CE          |
| declaratie auto-declarata de origine/conținut secundar (tip ISO 14021)         | certificare de conținut reciclat de terta parte                   |
| proba de audit pentru scheme voluntare si pentru finantatori                   | dovada incetarii statutului de deseu (art. 6 OUG 92/2021)         |
| document informativ, insotitor, pentru clientul final                          | inlocuitor al formularului de transport deseuri, avizului sau UIT |
| snapshot imuabil la data emiterii                                              | rezultat de incercare de laborator; EPD; pasaport digital (DPP)   |

---

## 6. Continutul minim recomandat - lista de campuri

Legenda: **M** = minim recomandat (ar trebui sa fie mereu pe certificat), **R** =
recomandat, **O** = opțional / v2.

### Grup A - Identificarea documentului

| # | Camp                                | Niv. | Sursa in platforma                                   |
| - | ----------------------------------- | ---- | ---------------------------------------------------- |
| A1 | Titlu explicit: "Certificat de trasabilitate a materialelor (document voluntar)" | M | text fix |
| A2 | Numar unic al certificatului        | M    | `certificates.number` (`CRT-<an>-<seq>`)             |
| A3 | Data si ora emiterii                | M    | `certificates.issued_at`                             |
| A4 | Versiunea structurii de date / a template-ului | R | `TRACEABILITY_SNAPSHOT_VERSION`              |
| A5 | Numarul de pagini / paginare        | M    | exista                                               |
| A6 | Cod de verificare (URL + QR) si amprenta (hash) a snapshot-ului | O (v2) | de adaugat (`snapshot_hash`)          |

### Grup B - Emitentul (cine raspunde de afirmatii)

| #  | Camp                                            | Niv. | Sursa                                  |
| -- | ----------------------------------------------- | ---- | -------------------------------------- |
| B1 | Denumire juridica completa                       | M    | `organizations.name`                   |
| B2 | **CUI / cod de identificare fiscala**            | M    | **lipseste in schema**                 |
| B3 | **Nr. registrul comertului**                     | R    | **lipseste in schema**                 |
| B4 | **Adresa sediului social** + **adresa punctului de lucru / instalatiei** care a produs materialul | M | **lipseste in schema** |
| B5 | Contact (email, telefon)                         | R    | `organizations.email_from_address` (nu e gandit pentru asta) |
| B6 | **Nr. si emitentul autorizatiei de mediu** pentru operatiunea de valorificare | R | **lipseste in schema** |
| B7 | Persoana care a emis documentul (nume + functie) | R    | `profiles.full_name` al userului care a inchis comanda (exista `orders.created_by`, dar nu "closed_by") |

> B2-B4 sunt esentiale: un document fara identificarea fiscala a emitentului nu e utilizabil
> ca document comercial si nu poate fi prezentat la un audit.

### Grup C - Destinatarul si tranzactia

| #  | Camp                                   | Niv. | Sursa                                               |
| -- | -------------------------------------- | ---- | --------------------------------------------------- |
| C1 | Denumirea clientului                   | M    | `snapshot.order.clientName` ✅                        |
| C2 | CUI client                             | M    | `snapshot.order.clientCui` ✅                         |
| C3 | Numarul comenzii                       | M    | `snapshot.order.number` ✅                            |
| C4 | Data livrarii                          | M    | `orders.delivered_at` / `orders.delivery_date` / `deliveries.scheduled_date` - **nu e in snapshot** |
| C5 | Adresa / punctul de livrare            | M    | `orders.delivery_address_id` -> `client_addresses` - **nu e in snapshot** |
| C6 | Referinte documente de transport: nr. aviz, **cod UIT e-Transport**, transportator, nr. vehicul | R | `deliveries.uit_code`, `carrier_name`, `vehicle_plate` - **nu sunt in snapshot** |

### Grup D - Produsul livrat

| #  | Camp                                                    | Niv. | Sursa                                              |
| -- | ------------------------------------------------------- | ---- | -------------------------------------------------- |
| D1 | Denumirea produsului                                     | M    | `snapshot.deliveredItems[].itemTitle` ✅            |
| D2 | Cantitatea + unitatea de masura                          | M    | `.quantity`, `.unit` ✅                              |
| D3 | **Numarul / identificatorul lotului livrat**              | M    | `lots.id` - **nu apare in PDF**                    |
| D4 | Data producerii lotului livrat                            | R    | `lots.entry_date` / `processes.completed_at`        |
| D5 | Standardul de produs declarat de producator (ex. SR EN 12620, SR EN 13242, SR EN 206) | R | **lipseste** (ar trebui pe `items`) |
| D6 | **Referinta la declaratia de performanta (nr. DoP) si/sau la bonul de livrare** | R | **lipseste** (ar trebui pe `items`) - legatura esentiala cu documentul obligatoriu |
| D7 | Statusul de calitate al lotului                           | O    | `lots.quality_status` (`unchecked`/`passed`/`failed`) |

### Grup E - Lanțul de trasabilitate (nucleul documentului)

| #  | Camp                                                                      | Niv. | Sursa                                             |
| -- | ------------------------------------------------------------------------- | ---- | ------------------------------------------------- |
| E1 | Graf / diagrama lanțului de la sursa la livrare                            | M    | `snapshot.graph` ✅                                 |
| E2 | Tabel materiale: material, origine (categorie de provenienta), sursa, cantitate, pondere | M | `snapshot.materials[]` ✅                |
| E3 | **Identificatorii loturilor-sursa** (nu doar denumirea itemului)            | M    | `lots.id` - **nu apare**                           |
| E4 | Data intrarii fiecarui lot-sursa                                            | R    | `RawLot.entryDate` - in date, **nu e afisat**      |
| E5 | **Tipul si data fiecarui proces** de transformare (reciclare / producție / recondiționare) | M | `RawProcess.type`, `RawProcess.completedAt` - in date, **nu sunt afisate** (eticheta e doar "Proces <8 hex>") |
| E6 | **Codul de deseu** al materialului de intrare (ex. `17 01 01`), cand materialul a provenit din deseu | R | **lipseste in schema** |
| E7 | Furnizorul / generatorul deseului                                           | R    | `lots.source` ✅ (text liber)                       |
| E8 | Locatia de depozitare / instalatia                                          | O    | `lots.location`                                    |

### Grup F - Conținut reciclat / materii prime secundare

| #  | Camp                                                                            | Niv. | Sursa                                                   |
| -- | ------------------------------------------------------------------------------- | ---- | ------------------------------------------------------- |
| F1 | **Procent total de materii prime secundare** (reciclare + recondiționare + retur), ca o singura cifra | M | de calculat - logica exista deja in `reports/calculations.ts` (`SECONDARY_PROVENANCES`) dar **nu e in certificat** |
| F2 | Defalcare pe categorii de provenienta                                            | R    | derivabil din `snapshot.materials[].origin` ✅ (parțial) |
| F3 | **Metoda de calcul declarata** ("bilant de masa proporțional pe lanțul de loturi inregistrat; fara incercari de laborator") | M | **lipseste** - cerinta de baza ISO 14021 / EN 45557 |
| F4 | **Baza de calcul a procentelor** (masa? bucati? pe ce UM?) si avertisment cand se amesteca UM diferite | M | **lipseste** - vezi riscul din §7.2 |
| F5 | Separare pre-consumer / post-consumer                                            | O    | nu exista in model (ar cere un camp nou pe `lots`)      |
| F6 | Clasificarea constituentilor agregatului reciclat (EN 933-11: `Rc`/`Ru`/`Rb`/`Ra`/`Rg`/`X`/`FL`) | O | nu exista; s-ar introduce manual de operator, ca date de incercare |

### Grup G - Limite, raspundere, disclaimer

| #  | Camp                                                                 | Niv. | Stare   |
| -- | -------------------------------------------------------------------- | ---- | ------- |
| G1 | **Disclaimer legal** (text din §8)                                    | M    | **lipseste complet** |
| G2 | Nota de metoda / limite ale datelor                                   | M    | parțial ("Graful reflectă trasabilitatea inregistrată în platformă la data emiterii.") |
| G3 | Nota de raspundere: datele sunt introduse de emitent; furnizorul platformei nu le valideaza | M | **lipseste** |
| G4 | Semnatura / aprobarea - formulata corect juridic                      | M    | exista, dar **formulare riscanta** (vezi §7.2) |

---

## 7. DELTA - ce avem vs. ce trebuie adaugat

### 7.1 Tabel de delta

| Camp recomandat                          | Stare actuala                                                       | Ce trebuie facut                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A2 numar certificat                      | ❌ **BUG** - PDF-ul afiseaza "Nr. `{snapshot.order.number}` · CRT", adica **numarul comenzii**, nu `certificates.number`. `CertificatePdfProps` nici nu primeste numarul certificatului (`pdf.tsx`, props: `snapshot`, `orgName`, `brandColor`, `accentColor`); `number` e generat in `service.ts` **dupa** snapshot si nu e pasat la randare. | adauga `certificateNumber: string` in `CertificatePdfProps` si paseaza-l din `renderCertificatePdf` |
| A3 data emiterii                         | ⚠️ foloseste `snapshot.generatedAt`, nu `certificates.issued_at`     | paseaza `issuedAt` explicit (practic identice, dar sursa de adevar e randul DB)                        |
| A4 versiune template/snapshot            | ❌ nu apare in PDF (exista in date)                                  | afiseaza discret in footer: `v{snapshot.version}`                                                      |
| A6 verificare QR/hash                    | ❌                                                                   | post-MVP (deja marcat "nice to have" in `handoff.md`)                                                  |
| B2 CUI emitent                           | ❌ **`organizations` nu are coloana `cui`**                           | migrare noua: `organizations.cui`, `reg_com`, `address`, `contact_email`, `contact_phone`               |
| B4 adresa emitent / instalatie           | ❌ idem                                                              | idem + eventual `facility_address`                                                                      |
| B6 autorizatie de mediu                  | ❌                                                                   | `organizations.environmental_permit_no` + `environmental_permit_issuer` + `environmental_permit_valid_until` |
| B7 emis de (persoana)                    | ❌ nu exista `orders.closed_by`                                       | opțional: coloana `closed_by` pe `orders` sau `issued_by` pe `certificates`                             |
| C4 data livrarii                         | ❌ nu e in `TraceabilitySnapshotOrder`                                | extinde snapshot: `deliveredAt`                                                                         |
| C5 adresa de livrare                     | ❌                                                                   | extinde snapshot: `deliveryAddress` (string denormalizat din `client_addresses`)                        |
| C6 UIT / transportator / vehicul          | ❌ - datele EXISTA in `deliveries` (`uit_code`, `carrier_name`, `vehicle_plate`, `scheduled_date`), dar `certificates/repository.ts` nu le citeste | extinde snapshot: `delivery: { uitCode, carrierName, vehiclePlate, scheduledDate }` |
| D3 lot livrat                            | ❌ `TraceabilitySnapshotItem` are doar `itemId`, `itemTitle`, `unit`, `quantity` | adauga `lotIds: string[]` sau `lotRefs: {id, label}[]` (datele sunt deja in `DeliveredLotLine.lotId`) |
| D5 standard de produs                    | ❌                                                                   | coloana noua pe `items` (ex. `product_standard`), introdusa de admin                                    |
| D6 referinta DoP                         | ❌                                                                   | coloana noua pe `items` (ex. `dop_reference`) + afisare ca **referinta**, nu ca atestare                |
| E3 id-uri loturi-sursa                   | ⚠️ nodurile Sankey afiseaza doar `itemTitle` + cantitate; `lotId` nu ajunge in `SankeyNode` | adauga un identificator scurt in `sublabel` sau o coloana "Lot" in tabelul de materiale |
| E4 data intrarii lotului-sursa            | ⚠️ `RawLot.entryDate` e incarcat si **ignorat** la construirea nodului | adauga in `MaterialOriginRow` un camp `entryDate`                                                      |
| E5 tip + data proces                     | ⚠️ `RawProcess.type` si `completedAt` sunt incarcate si **nefolosite**; eticheta nodului e `Proces {first 8 chars of uuid}` (`processLabel` in `traceability.ts`), iar `sublabel` e provenienta lotului de output, nu tipul procesului | foloseste `PROCESS_TYPE_LABELS` + `completedAt` in label/sublabel |
| E6 cod de deseu                          | ❌ nu exista nicaieri in schema                                       | coloana noua pe `lots` (ex. `waste_code`) si/sau pe `items`; **[DE CONFIRMAT]** cat de mult ajuta la recepție |
| F1 procent total materii secundare        | ❌ certificatul are doar ponderi per rand (`materials[].percentage`)   | calculeaza `secondarySharePct` in `buildTraceabilityGraph` reutilizand setul `SECONDARY_PROVENANCES` din `reports/calculations.ts`, si afiseaza-l ca cifra evidenta |
| F3 metoda de calcul                      | ❌ (documentata doar in comentariul din `traceability.ts`)             | scoate textul pe certificat (vezi §8, nota de metoda)                                                   |
| F4 baza de calcul / UM mixte              | ❌ **risc real** - vezi §7.2                                          | fie restrange procentul la loturi cu acelasi UM, fie eticheteaza explicit ca estimare                   |
| G1 disclaimer                            | ❌ **complet absent**                                                 | adauga blocul din §8 - **cea mai importanta modificare a acestui spike**                                |
| G4 semnatura                             | ⚠️ "Semnătură & ștampilă electronică" sub numele organizatiei, fara nicio semnatura reala | reformulare (vezi §7.2)                                                                     |
| Atasamente / documente insotitoare        | ❌ `handoff.md` promite "documente atasate" in continutul minim; `documents` exista pe `order`/`item`, dar certificatul nu le listeaza | lista de documente atasate comenzii (nume + data), fara continut |

### 7.2 Doua riscuri de formulare, nu doar de campuri

1. **"Semnătură & ștampilă electronică"** (`pdf.tsx`, caseta de semnatura) - PDF-ul **nu
   este** semnat electronic in sensul Regulamentului (UE) nr. 910/2014 (eIDAS): nu exista
   nici semnatura electronica avansata, nici calificata, nici sigiliu electronic. Formularea
   sugereaza un statut pe care documentul nu il are.
   **Propunere:** inlocuieste cu "Emis electronic de `{orgName}`, fara semnatura olografa" +
   opțional numele si functia persoanei responsabile. Daca se doreste semnatura reala, e un
   task separat (sigiliu electronic calificat pe PDF).
   **[DE CONFIRMAT cu jurist]** formularea finala.
2. **Procentele peste unitati de masura diferite** - `traceability.ts` normalizeaza
   `materials[].percentage` la totalul cantitatilor atribuite, dar platforma are prin decizie
   **un UM unic per produs si fara conversii** (AGENTS.md §4). Daca lanțul unui produs
   combina loturi in UM diferite (ex. `to` si `buc`), **"Pondere %" insumeaza marimi
   neomogene** - o afirmatie greșita pe un document care pretinde trasabilitate.
   **Propunere:** la generare, daca `new Set(materials.map(m => m.unit)).size > 1`, fie se
   ascunde coloana de procente, fie se afiseaza cu nota "ponderi calculate pe cantitati
   exprimate in unitati de masura diferite - valoare strict indicativa". Este o modificare de
   cod (Task G follow-up), **descrisa aici, nu implementata in acest task**.

### 7.3 Propunere de modificare a template-ului (descriere, nu implementare)

Ordinea recomandata a blocurilor in PDF, cu minimul de intervenție pe cod:

1. **Header** - numar **certificat** (A2, bug-fix), data emiterii, versiune.
2. **Banda "Emitent"** (nou) - denumire, CUI, reg. com., adresa punctului de lucru,
   autorizatie de mediu. Necesita migrarea de coloane pe `organizations`.
3. **Banda "Destinatar si livrare"** - client, CUI, comanda, data livrarii, adresa de livrare,
   cod UIT / aviz.
4. **Banda "Produs livrat"** - item, cantitate, UM, **lot**, standard de produs declarat,
   referinta DoP (cu eticheta "declarat de emitent").
5. **Caseta evidenta: "Materii prime secundare: X%"** (F1) + metoda (F3) - acesta e selling
   point-ul, merita sa fie vizibil, **dar numai insotit de metoda**.
6. **"Lanț de trasabilitate"** - graful existent, cu etichete de proces reparate (E5).
7. **"Materiale și origine"** - tabelul existent + coloane `Lot` si `Data intrarii`.
8. **"Documente insotitoare"** (nou, lista de nume) - opțional.
9. **Bloc "Limite si raspundere"** - disclaimerul din §8, in corp de litera mic dar lizibil
   (≥ 7 pt), **pe prima pagina**, nu doar in footer.
10. **Caseta de emitere** - reformulata (§7.2 punct 1).
11. **Footer** - "Document voluntar de trasabilitate - nu inlocuieste declaratia de
    performanta (DoP) sau marcajul CE" + paginare.

Impact estimat: o migrare noua (coloane pe `organizations`, opțional `items`, opțional
`lots.waste_code`), extinderea `TraceabilitySnapshot` la **versiunea 2** (cu citire
retro-compatibila a v1, pentru certificatele deja emise - mecanismul e deja anticipat de
`TRACEABILITY_SNAPSHOT_VERSION`), modificari in `repository.ts`, `traceability.ts`,
`service.ts`, `pdf.tsx`, `certificate-view.tsx` + teste.

---

## 8. Disclaimer recomandat

### 8.1 Bloc principal (de pus pe prima pagina a certificatului)

> **Limite si raspundere**
>
> Prezentul document este o **declarație voluntară de trasabilitate**, emisă de
> **{DENUMIRE_EMITENT}, CUI {CUI_EMITENT}**, pe propria răspundere, pe baza datelor
> înregistrate de emitent în platforma Lot cu Lot. Descrie lanțul de loturi de materiale
> înregistrat pentru comanda {NUMAR_COMANDA}, la data emiterii.
>
> Acest document **NU este declarație de performanță** și **NU însoțește marcajul CE** în
> sensul Regulamentului (UE) 2024/3110 și al Regulamentului (UE) nr. 305/2011, astfel cum
> sunt aplicate prin H.G. nr. 668/2017. **Nu atestă** performanța produsului, conformitatea
> cu un standard armonizat de produs, aptitudinea pentru o utilizare anume, **și nu
> constituie dovada încetării statutului de deșeu** în sensul art. 6 din O.U.G. nr. 92/2021.
>
> Acest document **nu înlocuiește** documentele obligatorii care însoțesc materialul:
> declarația de performanță și marcajul CE (unde sunt aplicabile), rapoartele de încercări,
> bonul de livrare, avizul de însoțire a mărfii, declarația RO e-Transport, formularele și
> evidențele de gestiune a deșeurilor. Acestea rămân în responsabilitatea exclusivă a
> emitentului și se furnizează separat.
>
> Ponderile și procentele sunt **estimate prin bilanț de masă proporțional** pe lanțul de
> loturi înregistrat, presupunând amestec omogen la fiecare transformare. Nu provin din
> încercări de laborator și **nu constituie o declarație de conținut reciclat verificată de
> o parte terță** (de exemplu conform ISO 14021 sau EN 45557).
>
> Responsabilitatea pentru exactitatea, completitudinea și actualitatea datelor aparține
> integral emitentului. Lot cu Lot este furnizorul platformei software; **nu verifică, nu
> validează și nu garantează** datele introduse de emitent și nu are calitatea de organism
> de certificare, de evaluare a conformității sau de laborator de încercări.

### 8.2 Varianta scurta (footer, o linie)

> Document voluntar de trasabilitate. Nu este declarație de performanță și nu înlocuiește
> marcajul CE sau documentele legale obligatorii care însoțesc materialul.

### 8.3 Nota de metoda (lângă cifra de materii prime secundare)

> Procent calculat prin bilanț de masă proporțional pe lanțul de loturi înregistrat în
> platformă, pe baza provenienței declarate a loturilor (reciclare, recondiționare, retur).
> Pierderile de proces se înregistrează, nu se validează. Valoare indicativă, fără încercări
> de laborator.

### 8.4 Reguli de comunicare (pentru marketing si pentru UI)

- ✅ "certificat de trasabilitate", "declaratie voluntara de trasabilitate", "document de
  trasabilitate a materialelor"
- ❌ "certificat de conformitate", "certificat de calitate", "declaratie de performanta",
  "certificat CE", "certificat de conținut reciclat", "pasaport digital al produsului",
  "conform standardului EN 12620" (standardul se respecta de produs, nu de PDF-ul nostru)
- ❌ "conform legii privind deseurile din construcții" - **atât cât acea lege nu e
  promulgata** (§3.5)

---

## 9. Incertitudini care cer confirmare (lista pentru jurist / consultant de mediu)

| #  | Intrebare                                                                                                               | Impact daca raspunsul e altul                                                 |
| -- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Q1 | Exista un **ordin de ministru RO** cu criterii de incetare a statutului de deseu pentru agregate reciclate din DCD? Dacă nu, pe ce baza circula materialul ca produs la clientul pilot (autorizatie de mediu? decizie caz-cu-caz a APM?) | Schimba ce documente insotesc livrarea (3.2 vs. 3.3) si ce putem afirma pe certificat |
| Q2 | Obligatia de trasabilitate din **art. 27 OUG 92/2021** acopera si deseurile **nepericuloase** (coduri 17 xx)?            | Daca da, platforma are un cârlig legal real, utilizabil in vanzare             |
| Q3 | **Proiectul de lege DCD** a fost promulgat? Numar si data publicarii in MO?                                              | Determina dacă putem invoca obligatia de "sistem de trasabilitate"             |
| Q4 | Pentru produsele concrete ale clientului pilot (caramizi, beton, balast, nisip/pietris reciclat) - care au **DoP + CE obligatoriu** si ce standard armonizat se aplica fiecaruia? | Determina textul exact al delimitarii si eventualele campuri `product_standard`/`dop_reference` |
| Q5 | **Continutul minim al bonului de livrare de beton** conform SR EN 206+A2:2021 cap. 7 si NE 012/1-2022                    | Poate genera o cerinta de produs noua (generare bon de livrare)                |
| Q6 | Pragurile **e-Transport** sunt cumulative sau alternative (>500 kg **si/sau** >10.000 lei)?                              | Logica de "trebuie declarat" din modulul de livrari                            |
| Q7 | Formularea acceptabila pentru caseta de semnatura, in lipsa unei semnaturi eIDAS                                         | Risc de inducere in eroare                                                     |
| Q8 | Regimul aplicabil **astazi** agregatelor: inca sub standardele armonizate din 305/2011, sau deja sub 2024/3110?           | Ce regulament se citeaza in disclaimer (propunerea de la §8 citeaza ambele, intenționat) |

---

## 10. Surse

**Legislatie RO**

- [O.U.G. nr. 92/2021 privind regimul deseurilor - Portal Legislativ](https://legislatie.just.ro/Public/DetaliiDocumentAfis/245846)
- [O.U.G. nr. 92/2021 - varianta consolidata (envirocons)](https://envirocons.ro/oug-92-din-2021-privind-regimul-deseurilor/)
- [H.G. nr. 1061/2008 privind transportul deseurilor periculoase si nepericuloase](https://legislatie.just.ro/Public/DetaliiDocument/97706) · [model formular de incarcare-descarcare (anexa 3)](https://lege5.ro/Gratuit/geytenzvgi/formular-de-incarcare-descarcare-deseuri-nepericuloase-model-hotarare-1061-2008)
- [H.G. nr. 668/2017 - comercializarea produselor pentru construcții](https://legislatie.just.ro/Public/DetaliiDocument/193282) · [sinteza Universul Juridic](https://www.universuljuridic.ro/stabilirea-conditiilor-pentru-comercializarea-produselor-pentru-constructii-hg-668-2017-intra-in-vigoare-18-noiembrie-2017/)
- [NE 012/1-2022 - Cod de practica pentru producerea betonului](https://legislatie.just.ro/Public/DetaliiDocument/264439) · [istoric CP 012/1-2007](https://www.revistaconstructiilor.eu/index.php/2011/06/11/cod-de-practica-pentru-producerea-betonului-cp-0121-2007-calitatea-si-conformitatea-betonului/)
- [O.P.A.N.A.F. nr. 802/2022 - bunuri cu risc fiscal ridicat (PDF)](https://static.anaf.ro/static/10/Anaf/legislatie/OPANAF_802_2022.pdf) · [Ghid RO e-Transport (MF, PDF)](https://mfinante.gov.ro/static/10/Mfp/GhidROe-Transport.pdf) · [sinteza Accace](https://www.accace.ro/sistemul-ro-transport/)
- [Proiect de lege privind gestionarea deseurilor din construire/desfiintare (PDF)](https://federatiaconstructorilor.ro/attachments/article/254/proiect-lege-deseuri-constructii.pdf) · [pagina proiectului](https://federatiaconstructorilor.ro/legislatie/proiecte-legislative/proiect-legislativ-privind-gestionarea-deseurilor-provenite-din-activitatile-de-construire-si-desfiintare) · [comentariu Arena Construct](https://arenaconstruct.ro/deseurile-din-constructii-obligatii-noi-pentru-titularii-autorizatiilor-si-pentru-autoritati/)

**Legislatie UE**

- [Regulamentul (UE) 2024/3110 (noul CPR) - EUR-Lex](https://eur-lex.europa.eu/eli/reg/2024/3110/oj/eng)
- [DIBt - anunt privind noul CPR](https://www.dibt.de/en/news/whats-new/news-detail/meldung/das-warten-hat-ein-ende-die-novellierte-bauproduktenverordnung-ist-bekanntgemacht) · [FPS Economy BE - CPR](https://economie.fgov.be/en/themes/enterprises/specific-sectors/construction/construction-products/construction-products)
- [Comisia Europeana - End of Waste (Directiva-cadru deseuri)](https://ec.europa.eu/environment/waste/framework/end_of_waste.htm)
- [Legislatia UE privind gestionarea deseurilor - EUR-Lex (sinteza)](https://eur-lex.europa.eu/RO/legal-content/summary/eu-waste-management-law.html)
- [Protocolul UE de gestionare a deseurilor din construcții si demolari, actualizat 2024 (PDF)](https://build-up.ec.europa.eu/system/files/2024-10/eu%20construction%20&%20demolition%20waste%20management%20protocol-ET0224753ENN.pdf) · [pagina Build Up](https://build-up.ec.europa.eu/en/resources-and-tools/publications/eu-construction-demolition-waste-management-protocol-2024-updated)
- [Studiu - criterii EoW pentru agregate inerte in statele membre (ECN, PDF)](https://publicaties.ecn.nl/PdfFetch.aspx?nr=ECN-E--17-010)

**Standarde tehnice**

- [EN 933-11:2009 - clasificarea constituentilor agregatului reciclat grosier](https://standards.iteh.ai/catalog/standards/cen/b071a56c-697f-4b08-861c-ac39a16142f0/en-933-11-2009)
- [EN 12620:2013 - agregate pentru beton](https://standards.iteh.ai/catalog/standards/cen/aef412e6-36ce-49d3-afaa-5200d721ff84/en-12620-2013) · [BS EN 12620:2002+A1:2008 (text, PDF)](https://ibst.vn/upload/documents/file_upload/1655718098BS-EN-12620-2002-A1-2008.pdf) · [ghid SR 16 (Irish Concrete, PDF)](https://irishconcrete.ie/wp-content/uploads/2017/04/SR-16-Guidance-March-2017.pdf)
- [EN 16236 - AVCP pentru agregate (SIS)](https://www.sis.se/en/produkter/construction-materials-and-building/construction-materials/mineral-materials-and-products/ss-en-162362018/)
- [Ghid pentru producatorii de agregate reciclate (John Barritt, PDF)](https://www.johnbarritt.co.uk/wp-content/uploads/2016/04/Recycled-aggregates-Guidance-v1.pdf) · [MPA - agregate reciclate in beton (PDF)](https://cement.mineralproducts.org/MPACement/media/Cement/Publications/Fact-Sheets/2023-02-09_FS_6-Use_of_recycled_aggs_in_concrete.pdf)

**Scheme voluntare**

- [SCS Global - Recycled Content Certification](https://www.scsglobalservices.com/services/recycled-content-certification) · [standardul SCS-103 v7.0 (PDF)](https://cdn.scsglobalservices.com/files/standards/scs_stn_recycledcontent_v7-0_070814.pdf)
- [TÜV SÜD - Recycled content certification](https://www.tuvsud.com/en/services/product-certification/recycled-content-certification) · [GreenCircle](https://www.greencirclecertified.com/recycled-content-certification) · [SGS - conținut reciclat pentru materiale de construcții (PDF)](https://www.sgs.com/-/media/sgscorp/documents/corporate/flyers-and-leaflets/presentations/sgs-ie-webinar-certification-of-recycled-content-for-building-materials-an-introduction-2023-en.cdn.en.pdf)
- [Concrete Sustainability Council - certificare](https://csc.eco/certification/) · [Technical Manual v3.0 (PDF)](https://csc.eco/wp-content/uploads/2024/03/Technical-Manual-CSC-Technical-Manual-Version-3.0_rev.3.pdf)

---

## 11. Recomandare de scope pentru recepție

Daca timpul e scurt (recepție sub 2 saptamani), ordinea de prioritate este:

1. **§8 disclaimerul + varianta de footer + reformularea casetei de semnatura** - risc legal,
   efort mic, nu cere migrare.
2. **Bug-ul A2** (numarul certificatului in PDF) - defect functional vizibil, efort mic.
3. **F1 + F3** (procentul de materii prime secundare + metoda) - selling point, reutilizeaza
   logica din `reports/calculations.ts`.
4. **B2-B4** (CUI/adresa emitent) - cere migrare; fara ele documentul nu e complet ca
   document comercial.
5. Restul (C4-C6, D3, E3-E5) - imbunatatiri de completitudine, pot merge in v1.x.
6. E6 (cod de deseu), F5, F6, A6 (QR) - v2.
