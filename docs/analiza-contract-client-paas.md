# Analiza draft-ului de contract cu un client plătitor — modelul PaaS „beton ca serviciu"

**Sursă:** [contract-draft-client-paas.pdf](contract-draft-client-paas.pdf) (pag. 13–15) —
primit 17 iulie 2026.

**Ce este documentul:** draft de contract pentru unul dintre clienții plătitori ai
platformei (o organizație/tenant viitor, IMM cu CAEN 2363 — Fabricarea betonului).
Textul pare preluat din **propria cerere de finanțare a clientului** (referințe la grila
ETF, subcriteriul A4.a, Regio Nord-Est, „concasorul mobil achiziționat în proiect") —
deci clientul are propriul proiect finanțat, în care a promis un model PaaS gestionat
printr-o platformă digitală, și cumpără platforma noastră ca să-l demonstreze la audit.

**Două consecințe practice:**

1. Ce scrie aici sunt **așteptările unui client plătitor** (cerințe de produs + puncte
   de negociat în contract înainte de semnare) — NU obligații ale proiectului nostru
   finanțat. Anexa 1 rămâne guvernată de propriul nostru context de finanțare.
2. Profilul acestui client e probabil **profilul pieței**: IMM-uri finanțate pe economie
   circulară care trebuie să demonstreze modele PaaS. Feature-urile cerute aici (abonamente,
   raportare sustenabilitate) sunt vandabile la toți clienții următori.

---

## 1. Ce promite draftul de contract (rezumat)

### Modelul de afaceri: 4 tipuri de abonamente/servicii

1. **Abonament „Basic" — Livrare și asistență:** livrare beton la locația clientului,
   asistență la planificarea consumului, tratamente post-turnare. *„Platforma digitală
   permite clienților să plaseze comenzi la cerere, să programeze livrările în funcție
   de stadiul lucrărilor și să primească notificări privind statusul comenzilor."*
2. **Abonament „Premium" — Beton ca serviciu cu suport post-vânzare:** livrare +
   **monitorizarea consumului** + servicii de mentenanță (verificare periodică a calității
   betonului turnat, recomandări); **înlocuirea** betonului neconform (demolare, curățare,
   concasare, returnare); *„planuri dinamice de aprovizionare pentru a minimiza pierderile"*.
3. **Model „Pay-per-Use" — Beton la utilizare:** *„plata este realizată doar pentru
   cantitățile efectiv utilizate pe șantier, cu trasabilitate completă prin platformă"*;
   concasorul mobil gestionează deșeurile pe șantier, agregate reciclate integrate in situ.
4. **Abonament „Flexi-Beton" — Închiriere de elemente prefabricate din beton:** *„clientul
   încheie un contract pentru o perioadă determinată"*; *„clientul plătește doar pentru
   volumul efectiv utilizat (m³), **monitorizat în timp real prin platforma digitală
   integrată în fluxul tehnologic**"*; după utilizare, elementele sunt *„recuperate,
   verificate, recondiționate și reintegrate în circuit"*.

### Modulele platformei digitale (numite explicit)

- **Modul de comenzi și livrări optimizate** — clienții pot plasa și programa comenzile;
- **Modul de trasabilitate a resurselor** — urmărește cantitatea de agregate reciclate utilizate;
- **Modul de raportare sustenabilitate** — *„generează automat rapoarte privind impactul
  ecologic (ex.: CO₂ economisit)"*.

### Indicatori asumați de client (în proiectul lui)

- materii prime secundare utilizate: **≥ 60%** (față de 2024);
- reducerea emisiilor CO₂ (agregate reciclate + „optimizarea livrărilor prin platformă —
  trasee scurte, reducerea transporturilor redundante");
- reducerea timpilor de aprovizionare prin „planificare inteligentă".

---

## 2. 🚩 Red flags — de negociat ÎNAINTE de semnare

Acestea sunt formulări din draft care promit mai mult decât face (sau va face) platforma.
Dacă semnăm contractul cu textul actual, ne asumăm livrarea lor.

### 🚩🚩🚩 R1. „Monitorizat în timp real prin platforma digitală integrată în fluxul tehnologic"

Cel mai periculos text (Flexi-Beton). Sugerează senzori/IoT/telemetrie și măsurare live
a volumului utilizat. Platforma înregistrează cantități la livrare/retur, operate de
oameni. **De negociat:** înlocuirea cu *„înregistrarea operativă în platformă a
cantităților livrate, utilizate și returnate"*. Monitorizarea GPS (v2) poate acoperi
„timp real" doar pe transport, nu pe consumul din șantier.

### 🚩🚩 R2. „Generează automat rapoarte privind impactul ecologic (ex.: CO₂ economisit)"

„Automat" + cifre de CO₂ = pretenție auditabilă (clientul le va folosi la propriul
decont!) care cere o metodologie de calcul. Procentul de materii secundare îl putem
calcula solid din trasabilitate; CO₂ economisit cere **factori de emisie pe care nu-i
putem stabili noi**. **De negociat:** platforma calculează pe baza factorilor de emisie
**configurați de client** (metodologia = răspunderea clientului); formularea „automat"
se păstrează doar pentru % materii secundare.

### 🚩 R3. „Planuri dinamice de aprovizionare" / „planificare inteligentă"

Vagi, interpretabile ca optimizare algoritmică. **De negociat:** clarificat că înseamnă
programarea livrărilor în funcție de stadiul lucrărilor, făcută de dispecer cu
informația din platformă.

### 🚩 R4. „Optimizarea livrărilor prin platformă (trasee scurte, reducerea transporturilor redundante)"

Sugerează optimizare de rute — nu construim route-optimization. **De negociat:**
reformulare spre programarea/gruparea livrărilor; vizibilitatea GPS din v2 e argument
suplimentar, nu optimizare algoritmică.

### 🚩 R5. „Monitorizarea consumului" (Premium)

Nedefinit. **De negociat:** consum = cantități livrate − returnate, înregistrate în
platformă per client/comandă/perioadă.

---

## 3. Cerințe de produs care rezultă (gap-uri față de plan)

Independent de negocierea formulărilor, clientul are nevoie reală de:

| Cerință | Status în plan | Ce trebuie făcut |
| --- | --- | --- |
| **Tipuri de abonament/serviciu** (Basic/Premium/Pay-per-Use/Flexi-Beton) | ❌ | Nomenclator configurabil per organizație + atașare la client/contract/comandă. Fără facturare — plata rămâne în afara platformei; noi furnizăm cantitățile care stau la baza ei |
| **Raport „utilizat = livrat − returnat"** (baza pay-per-use) | 🟡 datele există (comenzi, retururi, `stock_events`) | Raport dedicat per client/perioadă în pagina Rapoarte |
| **Raport sustenabilitate** (% materii secundare, CO₂ economisit) | ❌ | Extensie Task X3: % din datele de trasabilitate + CO₂ cu factori de emisie configurabili |
| **Contracte cu perioadă determinată** | ❌ | Susține modulul light de contracte: tip abonament + perioadă + documente atașate |
| **Activități de service post-vânzare** (verificări calitate, tratamente, constatări) | ❌ | Minim viabil: activitate operațională atașată comenzii/clientului (dată, tip, note, poze); înlocuirea neconformului e deja acoperită (garanție → comandă de înlocuire, Task F) |
| Plasare/programare comenzi de către clienți + notificări | ✅ | Task H + X1 — confirmă păstrarea portalului client |
| Trasabilitate agregate reciclate, recuperare/recondiționare/reintegrare | ✅ | Nucleul platformei (Task C, D, F, G) |

---

## 4. Impact asupra Anexei 1 (proiectul nostru finanțat)

Acest document **nu obligă** Anexa 1 — sunt contracte diferite. Dar informează decizia:

- **Recomandare:** Anexa 1 rămâne pe varianta zveltă (tăierile propuse în discuția din
  17 iulie rămân valabile — mai puține obligații la auditul nostru), iar feature-urile
  de abonamente/sustenabilitate se construiesc **pe banii/contractul clientului plătitor**,
  ca funcționalități ale produsului. Secțiunea 4 din anexă permite oricum extinderi.
- **Alternativă** (dacă vrem anexa mai bogată la recepție): includem în anexă doar
  formulările soft — „evidența tipurilor de servicii furnizate" și „rapoarte privind
  utilizarea materialelor reciclate" — pe care oricum le livrăm. De decis.
- Întrebarea despre contracte pentru echipa non-tehnică rămâne valabilă, cu context nou:
  un client plătitor cere deja contracte pe perioadă → modulul light de contracte devine
  probabil necesar ca feature de produs, indiferent de răspunsul pe anexă.

## 5. Întrebări deschise pentru clientul plătitor (la negocierea contractului)

1. Acceptă redefinirea „monitorizării în timp real" ca înregistrare operativă a
   cantităților (+ opțional GPS pe transport în v2)?
2. Cine furnizează factorii de emisie pentru „CO₂ economisit"? (noi doar calculăm)
3. Cele 4 abonamente sunt fixe sau se configurează liber? (le implementăm ca nomenclator)
4. Raportarea ≥60% materii secundare: per produs, per perioadă, per total producție?
5. Ce înseamnă concret „planuri dinamice de aprovizionare" pentru ei — e acceptabilă
   interpretarea „programarea livrărilor pe baza datelor din platformă"?
