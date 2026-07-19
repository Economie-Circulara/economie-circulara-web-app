# Manual de utilizare — Administrator / Operator

Acest manual este destinat utilizatorilor cu rol **Administrator** sau **Operator**
ai unei organizații din Lateris Trace (firma producătoare/reciclatoare — clientul
platitor al platformei). Rolul **Operator** are acces la operațiunile zilnice
(stoc, producție, comenzi, clienți, livrări). Rolul **Administrator** are, în plus,
configurarea produselor/rețetelor, personalizarea organizației (white-label) și
managementul utilizatorilor — detaliate în [`ghid-administrare.md`](ghid-administrare.md).

Interfața este aceeași pentru ambele roluri (un singur meniu, în stânga ecranului),
cu excepția „Setări", vizibilă doar pentru Administrator.

> 📷 **[Captură de adăugat: meniul lateral cu toate secțiunile — Dashboard, Comenzi, Stoc, Producție, Clienți, Itemi, Rețete, Audit stoc, Rapoarte, Setări]**

---

## 1. Autentificare

Adresa de acces este cea a organizației (subdomeniu sau domeniu propriu, configurat
de administratorul platformei — vezi `ghid-administrare.md`). Nu există înscriere
publică: contul se creează **doar prin invitație** trimisă de administratorul
organizației (secțiunea „Setări → Utilizatori").

1. Deschide pagina **„Autentificare"** (`/login`). Sigla și numele organizației apar
   automat, pe baza domeniului de acces (white-label).
2. La prima logare, dai click pe linkul din emailul de invitație — ajungi pe ecranul
   **„Setează parola"**, unde completezi câmpurile **„Parola nouă"** și
   **„Confirmă parola"** (minim 8 caractere), apoi apeși **„Salvează parola"**.
3. La logările următoare, completezi **Email** și **Parolă** și apeși **„Conectare"**.
   Există și alternative: **„Continuă cu Google"** și trimiterea unui link de
   autentificare pe email (câmpul „Sau primește un link pe email" + butonul „Trimite").
4. Dacă ai uitat parola, apasă **„Ai uitat parola?"** de lângă câmpul Parolă →
   ecranul **„Resetare parolă"** → introduci emailul → **„Trimite link-ul"** → primești
   un email cu link către ecranul de setare a parolei noi.

> 📷 **[Captură de adăugat: ecranul de Autentificare cu logo-ul organizației]**

---

## 2. Dashboard

Ecranul **„Dashboard"** (prima pagină după logare) oferă o privire de ansamblu:

- **Comenzi active** — comenzi trimise, acceptate sau livrate (neînchise, neanulate).
- **De acceptat** — comenzi trimise, în așteptarea acceptării.
- **Livrate luna aceasta** — comenzi livrate în luna curentă.
- **Certificate emise** — total, de la începutul activității.

Sub cele patru cifre, cardul **„Rapoarte operaționale"** face trimitere directă la
pagina „Rapoarte" (link **„Vezi rapoarte"**).

> 📷 **[Captură de adăugat: Dashboard cu cele 4 carduri KPI]**

---

## 3. Clienți

Meniul **„Clienți"** afișează firmele cu care organizația lucrează (cumpărători și,
opțional, furnizori de materiale/deșeuri). **Regulă de business: un client = o
singură firmă juridică, cu un singur utilizator de portal** (nu persoane fizice).

### 3.1 Lista clienților

Ecranul **„Clienți"** listează firmele existente, cu o casetă **„Căutare"**
(după denumire sau CUI) și butonul **„Filtrează"** / **„Resetează"**.

### 3.2 Adăugarea unui client nou

1. Din lista de clienți, apasă **„+ Adaugă client"** → ecranul **„Adaugă client"**.
2. Completează câmpul **CUI** (fără prefixul „RO" — se normalizează automat) și
   apasă **„Caută"** lângă el: sistemul interoghează baza publică ANAF și, dacă
   găsește firma, precompletează automat **Denumire**, **Nr. Registrul Comerțului**,
   **Adresă sediu** și bifa **„Plătitor de TVA"**. Datele rămân complet editabile —
   dacă lookup-ul eșuează sau firma nu e găsită, se completează manual.
3. Completează, opțional, secțiunea **„Contact"**: Email, Telefon, Persoană de
   contact, Note, și bifa **„Este și furnizor (materiale/deșeuri)"** dacă firma
   aduce și materiale la reciclare.
4. Apasă **„Creează clientul"**.

> 📷 **[Captură de adăugat: formularul „Adaugă client" cu butonul „Caută" lângă CUI]**

### 3.3 Detaliul unui client

Din listă, click pe o firmă deschide ecranul de detaliu, cu secțiunile:

- **„Date firmă"** — același formular ca la creare, editabil (buton
  **„Salvează modificările"**).
- **„Adrese de livrare"** — poate avea mai multe adrese; una poate fi marcată
  implicită.
- **„Documente"** — încărcare de fișiere atașate clientului (contracte semnate,
  certificate de la client etc.). **Contractele se arhivează aici** ca documente
  (etichetă sugerată „Contract") — platforma nu gestionează structurat perioade,
  obligații sau tarife contractuale, doar arhivează PDF-ul semnat.
  - Formular **„Încarcă document nou"**: alege **Fișier** (PDF, imagine sau Office,
    max. 10MB) și, opțional, o **Etichetă** (sugestii: „Contract", „Certificat",
    „Aviz"), apoi apasă **„Încarcă"**.
  - Fiecare document din listă are butoanele **„Descarcă"** și **„Șterge"**
    (cu confirmare).
- **„Istoric comenzi"** — placeholder informativ; istoricul detaliat de comenzi
  al clientului se consultă din ecranul **„Comenzi"** (filtrare după client) sau
  din **„Căutare"**.

> 📷 **[Captură de adăugat: ecranul de detaliu client, secțiunea Documente]**

---

## 4. Itemi și Rețete

### 4.1 Itemi

Meniul **„Itemi"** este catalogul de produse și servicii al organizației — **fără
prețuri**. Un item poate fi:

- **Fizic** — ține stoc (loturi), poate avea o rețetă.
- **Serviciu** — abonament/serviciu PaaS (product-as-a-service), fără stoc.

Lista permite filtrare după **Căutare** (titlu), **Tip** (Fizic/Serviciu) și
**Vandabil** (Da/Nu).

Pentru a adăuga un item, apasă **„+ Adaugă item"** și completează:

- **Titlu** (obligatoriu)
- **Descriere**
- **Unitate de măsură** (kg, tonă, mc, litru, bucată, sac, palet) — **un singur UM
  per produs**; dacă același material se vinde în unități diferite, se creează
  produse separate (fără conversii între unități).
- **Tip item** (Fizic/Serviciu)
- **URL poză** (opțional)
- Bifa **„Vandabil (apare în catalogul clientului)"** — doar itemii vandabili apar
  în catalogul portalului client.

Apasă **„Creează itemul"**.

> 📷 **[Captură de adăugat: ecranul „Itemi" cu lista și filtrele]**

### 4.2 Rețete

Meniul **„Rețete"** listează rețetele definite pentru itemii fizici. O rețetă
descrie **compoziția în procente** a unui produs din alți itemi fizici (materii
prime/componente). **Rețetele nu se versionează** — dacă se schimbă compoziția,
se creează un item (produs) nou.

Pentru a defini/edita rețeta unui item: din listă, click pe item → ecranul
**„Rețetă — <nume item>"**. Dacă itemul nu are încă rețetă, apare un buton de
creare; altfel, editorul de rețetă permite adăugarea/editarea componentelor și a
procentelor lor. Rețetele se pot defini **doar pentru itemi de tip Fizic**
(pentru servicii, ecranul afișează un mesaj informativ).

> 📷 **[Captură de adăugat: editorul de rețetă cu componentele în procente]**

---

## 5. Stoc

Meniul **„Stoc"** afișează **loturile** aflate în stoc — fiecare intrare de
materie primă sau produs finit creează un lot propriu, cu proveniență și cantitate.

### 5.1 Lista de loturi

Coloane: Item, Data intrare, Proveniență, Cantitate rămasă/inițială, Calitate,
Status (Activ/Blocat), Acțiuni. Filtrare după **Item** și **Proveniență**.

Proveniențele posibile la intrare manuală: **Achiziție, Producție internă,
Reciclare, Recondiționare, Retur, Ajustare inventar**. (Recondiționarea este
distinctă de reciclare în trasabilitate și rapoarte — cerință de conformitate.)

### 5.2 Adăugarea unui lot nou

1. Apasă **„+ Adaugă lot"** → ecranul **„Adaugă lot"**.
2. Alege **Item**, completează **Cantitate**, **Data intrare** (implicit azi),
   **Proveniență**, opțional **Sursă** (furnizor/proces/referință liberă) și
   **Locație** (depozit/zonă), opțional o **Notă**.
3. Apasă **„Înregistrează lotul"** — se creează automat și evenimentul de intrare
   în auditul de stoc.

> 📷 **[Captură de adăugat: formularul „Adaugă lot"]**

### 5.3 Blocarea/deblocarea unui lot

Din lista de loturi, coloana „Acțiuni":

- Pe un lot activ, apasă **„Blochează"** → apare un câmp **„Motivul blocării"**
  (obligatoriu) → **„Confirmă"** (sau **„Anulează"** pentru a renunța). Un lot
  blocat **iese din stocul disponibil** (nu mai poate fi consumat la producție).
- Pe un lot blocat, apasă **„Deblochează"** pentru a-l reintroduce în stocul
  disponibil.

### 5.4 Consumul de stoc (FIFO)

**Regulă de business:** consumul loturilor la producție se face **FIFO implicit**
(se consumă mai întâi loturile cele mai vechi), cu opțiune de selecție manuală în
ecranele de producție (secțiunea 6).

### 5.5 Audit stoc

Meniul **„Audit stoc"** este jurnalul complet al mișcărilor de stoc — Intrare,
Consum, Ajustare, Blocare, Deblocare, Stornare — cu filtrare pe **Item** și
**Tip eveniment**. Butonul **„⤓ Exportă CSV"** (în antetul paginii) descarcă
lista filtrată curentă ca fișier CSV.

> 📷 **[Captură de adăugat: ecranul „Audit stoc" cu butonul de export CSV]**

---

## 6. Producție și reciclare

Meniul **„Producție"** listează procesele de fabricație/reciclare/recondiționare
derulate, cu status: **Planificat → În lucru → Așteaptă confirmare → Finalizat**
(sau **Anulat**).

### 6.1 Pornirea unui proces nou

Apasă **„+ Pornește proces"** → ecranul **„Pornește proces"**, cu **două fluxuri**,
alese din tab-uri:

**a) „Output fix — Fabricație"** (ex. fabricare cărămizi, pavaje):

1. Alegi rețeta/produsul de output și **cantitatea de output dorită**.
2. Sistemul calculează automat, pe baza rețetei (procente), **consumul necesar**
   din fiecare componentă și propune alocarea **FIFO** din loturile disponibile
   (previzualizare live, cu eventuale erori dacă nu e stoc suficient).
3. Diagrama **Sankey** afișează vizual fluxul: loturi de input → proces → lot de
   output.
4. Apeși **„Confirmă și pornește →"** — se creează procesul, se consumă loturile
   (FIFO) și se creează lotul/loturile noi de output.

**b) „Output variabil — Reciclare"** (ex. reciclare moloz, demolări):

1. Alegi materialul de **input** și cantitatea introdusă.
2. Sistemul afișează **outputul ideal** conform rețetei (fracțiile teoretice).
3. Ajustezi manual cantitățile **reale** obținute pentru fiecare fracție (coloana
   editabilă), pentru că randamentul real diferă de cel teoretic.
4. Confirmi — se creează loturile noi rezultate, cu proveniența „Reciclare" (sau
   „Recondiționare", după caz).

**Notă:** pierderile/randamentul se **înregistrează**, nu se validează — sistemul
nu blochează un proces cu randament sub cel ideal.

> 📷 **[Captură de adăugat: wizard-ul „Pornește proces" cu cele două tab-uri Output fix / Output variabil]**

### 6.2 Detaliul unui proces

Click pe un proces din listă deschide ecranul de detaliu, cu:

- Diagrama **„Flux materiale"** (Sankey: input → proces → output).
- Cardurile **„Inputuri (loturi consumate)"** și **„Outputuri (loturi create)"**,
  cu total input/output.
- **„Randament / pierderi"** — diferența input − output, informativă.
- Buton **„Anulează procesul"**, disponibil doar cât procesul e într-un status
  netermin (Planificat/În lucru/Așteaptă confirmare).

> 📷 **[Captură de adăugat: detaliul unui proces cu diagrama Sankey]**

---

## 7. Comenzi

Meniul **„Comenzi"** listează comenzile clienților, cu filtrare după **Status**
și **Căutare** (client sau număr comandă).

### 7.1 Mașina de stări a unei comenzi

```
Draft → Trimisă → Acceptată → Livrată → Închisă
                      ↓
                   Anulată (posibilă din stările netermin)
```

Butoanele de tranziție rapidă apar contextual (doar tranzițiile valide din
statusul curent, atât în listă cât și în ecranul de detaliu):
**„Trimite"**, **„Acceptă"**, **„Livrează"**, **„Închide"**, **„Anulează"**.

- **„Acceptă"** este momentul-cheie de business: **la acceptare se scade stocul**
  (consum FIFO din loturile disponibile pentru fiecare linie a comenzii). La
  **„Anulează"**, dacă stocul fusese deja scăzut, acesta **se reface**.
- **„Închide"** generează **automat** certificatul de trasabilitate PDF al
  comenzii (secțiunea 7.4) — nu există un buton separat „Generează certificat".

### 7.2 Crearea unei comenzi în numele clientului

Organizația poate crea o comandă în numele unui client (flag intern
„creată de organizație"), util pentru fluxul dominant real (comenzi preluate prin
telefon/WhatsApp și înregistrate în platformă):

1. Din lista „Comenzi", apasă **„+ Comandă nouă"** → ecranul **„Comandă nouă"**.
2. Alege **Client**, opțional o **Adresă de livrare** (dependentă de client) și o
   **Dată livrare**, opțional **Note**.
3. În secțiunea **„Linii comandă"**, alege un item vandabil și o cantitate, apasă
   adaugă-linie; repetă pentru fiecare produs; poți șterge o linie adăugată.
4. Trimite formularul — comanda se creează ca **Draft**.

Notificările prin email se trimit identic indiferent dacă e comandă creată de
client sau de organizație.

> 📷 **[Captură de adăugat: ecranul „Comandă nouă" cu selectorul de client și liniile de comandă]**

### 7.3 Detaliul unei comenzi

Ecranul de detaliu (`/comenzi/[id]`) afișează: client (CUI, notă „Creată de
organizație în numele clientului" dacă e cazul), livrare (adresă, dată livrare,
eventual „Retur estimat (închiriere)" pentru fluxul de închiriere ca serviciu),
linii de comandă, și un **traseu vizual al statusului** (Draft → Trimisă →
Acceptată → Livrată → Închisă, sau „Anulată").

Dacă o comandă a fost livrată/închisă, pot apărea butoanele **„Retur"** și
**„Garanție"** (secțiunea 8). Dacă certificatul există deja, apare butonul
**„Vezi certificat"**.

> 📷 **[Captură de adăugat: ecranul de detaliu comandă, cu traseul de status]**

---

## 8. Retur și garanție

După ce o comandă e finalizată (livrată/închisă), din ecranul ei de detaliu pot
apărea două butoane:

- **„Retur"** — clientul (sau organizația, în numele lui) aduce materialele
  înapoi. Se deschide un formular cu o linie per produs livrat, cu maximul
  returnabil afișat (`Max. returnabil: <cantitate> <UM>`); se introduc
  cantitățile efectiv returnate, opțional o notă, apoi **„Trimite"** — se
  creează o **nouă comandă**, legată de comanda originală (etichetă „Retur").
- **„Garanție"** — la fel ca returul, dar sistemul creează automat, în plus, o
  comandă de **înlocuire** (comandă de vânzare obișnuită, care parcurge fluxul
  normal Draft → Trimisă → Acceptată → Livrată → Închisă).

Comanda-retur/garanție nou creată apare inițial ca **Draft**; pe ea, în loc de
butoanele generice de tranziție, apare butonul dedicat **„Acceptă retur"** —
acceptarea unui retur **adaugă** materialul înapoi în stoc (după inspecție/
acceptare manuală), spre deosebire de acceptarea unei comenzi de vânzare, care
scade stocul.

**Închiriere (product-as-a-service):** este simulată prin comandă + retur, cu
câmpul opțional **„Retur estimat"** pe comandă (dată la care se așteaptă
materialul înapoi).

> 📷 **[Captură de adăugat: formularul de Retur/Garanție cu cantitățile per produs]**

---

## 9. Livrări, aviz și e-Transport

> ⚠️ **Această secțiune descrie fluxul planificat (Task X5), aflat în curs de
> implementare la data redactării acestui manual.** Nu există încă o rută
> `/livrari` dedicată în aplicație — planificarea livrării, generarea avizului
> și declararea e-Transport se vor adăuga separat. Manualul va fi actualizat cu
> pașii exacți din interfață imediat ce task-ul e livrat.

Fluxul planificat, conform planului de implementare:

1. O comandă **acceptată** poate avea o livrare planificată: dată, transportator,
   număr de înmatriculare, șofer, rută.
2. Se generează un **aviz de însoțire a mărfii**.
3. Avizul se declară în **RO e-Transport** (ANAF) prin serviciul terț
   **Socrate.io** (pentru transporturile care depășesc pragurile legale).
4. Codul **UIT** rezultat se stochează pe livrare și apare pe avizul PDF
   printabil.

Până la livrarea acestei funcționalități, planificarea/urmărirea livrărilor se
face în afara platformei (telefon/document extern), iar comanda se mișcă direct
din „Acceptată" în „Livrată" prin butonul **„Livrează"** din ecranul comenzii
(secțiunea 7.1).

---

## 10. Rapoarte

Meniul **„Rapoarte"** oferă 6 rapoarte operaționale, calculate pe o **perioadă**
selectabilă (câmpurile **„De la"** / **„Până la"** + butonul **„Aplică perioada"**):

1. **„Comenzi pe perioadă"** — numărul de comenzi create în perioadă, grupate pe status.
2. **„Livrări"** — comenzile livrate sau închise în perioadă.
3. **„Retururi și garanții"** — legăturile de retur/garanție cerute în perioadă.
4. **„Materiale reciclate/recondiționate reintegrate"** — loturi cu proveniență
   reciclare, recondiționare sau retur, intrate în stoc în perioadă.
5. **„Utilizare PaaS (livrat − returnat)"** — cantitatea efectiv utilizată de
   fiecare client (livrat minus returnat acceptat), per produs — relevant pentru
   clienți cu model de tip „serviciu" (produs-ca-serviciu).
6. **„% materii prime secundare"** — ponderea materiilor prime secundare
   (reciclate/recondiționate/retur) din inputul de producție, per produs.

Fiecare raport are propriile butoane de export: **„⤓ PDF"** (cu antet white-label
al organizației) și **„⤓ CSV"**.

Un card suplimentar, **„CO₂ economisit — în pregătire (v2)"**, este afișat doar
informativ — **nu este încă un raport funcțional** (necesită factori de emisie
configurabili per organizație, planificat ulterior).

> 📷 **[Captură de adăugat: ecranul „Rapoarte" cu selectorul de perioadă și un raport expandat]**

---

## 11. Căutare

Bara de căutare din partea de sus a ecranului (disponibilă doar pentru
Administrator/Operator) caută global în: **comenzi, clienți, loturi, produse și
certificate**. Se introduce un termen și se apasă Enter (sau se navighează direct
la pagina **„Căutare"**), rezultatele apar grupate pe tip.

> 📷 **[Captură de adăugat: bara de căutare din antet + pagina de rezultate grupate]**

---

## 12. Setări (doar Administrator)

Configurarea organizației (identitate, white-label, domeniu, email) și
managementul utilizatorilor sunt descrise în detaliu în
[`ghid-administrare.md`](ghid-administrare.md) — accesibile din meniul
**„Setări"**, vizibil doar rolului Administrator.
