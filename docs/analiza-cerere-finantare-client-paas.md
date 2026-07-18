# Analiza cererii de finanțare a unui viitor client — modelul PaaS „beton ca serviciu"

**Sursă:** [cerere-finantare-client-paas.pdf](cerere-finantare-client-paas.pdf)

**Ce este documentul:** extras din **cererea de fonduri nerambursabile a unui viitor
client** al platformei (IMM, CAEN 2363 — Fabricarea betonului). Cererea este **depusă și
în evaluare**. Dacă va fi aprobată, clientul va contracta firma noastră și va cumpăra o
**licență de folosire** a platformei, ca să-și implementeze modelul PaaS + trasabilitatea
promise finanțatorului său.

**Consecințe practice:**

1. **Textul cererii lui e fix** (depusă) — nu mai putem influența formulările. Strategia:
   mapăm capabilitățile platformei pe promisiunile lui și gestionăm diferențele prin
   **contractul de licență** (fișă tehnică anexată care definește exact ce face softul);
   interpretarea promisiunilor la auditul lui = responsabilitatea clientului.
2. **Aprobarea e incertă** — nu construim nimic specific acestui client până la aprobare.
   Feature-urile care se mulează pe produsul existent le facem oricum, generic (vezi §3).
3. **Piața e mixtă** (avem și clienți fără finanțare) → produsul rămâne generic;
   feature-urile de conformitate/raportare sunt diferențiator, nu nucleu. Pentru clienții
   viitori cu cereri **încă nedepuse**, pregătim o **fișă tehnică standard** cu formulări
   „sigure" pentru capitolul de platformă digitală — controlăm formulările din amonte.

---

## 1. Ce promite cererea clientului (rezumat)

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

### Modulele platformei digitale (numite explicit în cererea lui)

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

## 2. 🚩 Diferențe între promisiunile clientului și platformă

Textul cererii lui nu se mai poate schimba; acestea sunt punctele unde promisiunile lui
depășesc ce face (sau va face) platforma — de gestionat prin **contractul de licență**
și prin interpretare la auditul lui:

### 🚩🚩🚩 R1. „Monitorizat în timp real prin platforma digitală integrată în fluxul tehnologic"

Sugerează senzori/IoT/telemetrie și măsurare live a volumului utilizat. Platforma
înregistrează cantități la livrare/retur, operate de oameni. **Gestionare:** fișa tehnică
din contractul de licență definește monitorizarea ca *„înregistrarea operativă în
platformă a cantităților livrate, utilizate și returnate"*; monitorizarea GPS (v2)
acoperă „timp real" pe transport, nu pe consumul din șantier.

### 🚩🚩 R2. „Generează automat rapoarte privind impactul ecologic (ex.: CO₂ economisit)"

Cifre pe care clientul le va folosi la propriul decont. Procentul de materii secundare
îl calculăm solid din trasabilitate; **CO₂ economisit cere factori de emisie pe care
nu-i putem stabili noi**. **Gestionare:** calcul cu factori de emisie **configurați de
client** (metodologia = răspunderea lui); feature-ul de CO₂ = v2 (vezi §3).

### 🚩 R3. „Planuri dinamice de aprovizionare" / „planificare inteligentă"

Interpretabile ca optimizare algoritmică. **Interpretare apărabilă:** programarea
livrărilor în funcție de stadiul lucrărilor, făcută de dispecer cu informația din
platformă. Nu construim algoritmi de planificare.

### 🚩 R4. „Optimizarea livrărilor prin platformă (trasee scurte, reducerea transporturilor redundante)"

Nu construim route-optimization. **Interpretare apărabilă:** programarea/gruparea
livrărilor de către oameni pe baza datelor; vizibilitatea GPS din v2 e argument
suplimentar.

### 🚩 R5. „Monitorizarea consumului" (Premium)

**Interpretare apărabilă:** consum = cantități livrate − returnate, înregistrate în
platformă per client/comandă/perioadă (raportul din §3).

---

## 3. Mapare pe produs: ce facem acum vs. v2

Regula stabilită (17 iulie 2026): **ce se mulează pe ce avem → acum; ce e complet nou → v2.**

| Cerință din cererea clientului | Decizie | Cum se mulează |
| --- | --- | --- |
| Tipuri de abonament (Basic/Premium/Pay-per-Use/Flexi-Beton) | **acum** | ca tip de produs/serviciu în catalog (item ne-fizic / categorie „serviciu"); detaliul exact la implementare (Task B) |
| Raport „utilizat = livrat − returnat" (baza pay-per-use) | **acum** | datele există (comenzi, retururi, `stock_events`) → raport în pagina Rapoarte (Task X3) |
| % materii prime secundare (ținta ≥60%) | **acum** | derivat direct din datele de trasabilitate → raport în Task X3 |
| Contracte cu perioadă determinată | **acum (light)** | documente contractuale atașate clientului (infrastructura existentă) + `expected_return_date` pe comenzi |
| Activități de service post-vânzare (verificări, constatări) | **acum (minim)** | note/documente pe comandă + fluxul de garanție existent (Task F); modul dedicat doar dacă cere piața |
| CO₂ economisit (factori de emisie) | **v2** | complet nou; factori configurabili de client, metodologia = răspunderea lui |
| Monitorizare „în timp real" | **v2 parțial** | GPS pe transport (v2); în rest = înregistrare operativă a cantităților |
| „Planuri dinamice" / „optimizare trasee" | **nu construim** | interpretare: programare umană pe baza datelor din platformă |
| Plasare/programare comenzi de către clienți + notificări | ✅ deja în plan | Task H (portal client) + X1 (notificări) |
| Trasabilitate agregate reciclate; recuperare/recondiționare/reintegrare | ✅ deja în plan | nucleul platformei (Task C, D, F, G) |

---

## 4. Relația cu Anexa 1 (proiectul nostru finanțat)

Cererea clientului **nu afectează Anexa 1** — sunt finanțări și contracte separate.
Anexa rămâne pe varianta zveltă (vezi
[anexa-1-modificari-propuse.md](anexa-1-modificari-propuse.md)); feature-urile cerute de
acest client se construiesc ca funcționalități de produs, generice, în ritmul stabilit
în §3. Secțiunea 4 din anexă permite oricum extinderi.

## 5. Întrebări deschise pentru client (la semnarea contractului de licență)

1. Acceptă fișa tehnică din contractul de licență cu definirea „monitorizării" ca
   înregistrare operativă a cantităților (+ opțional GPS pe transport în v2)?
2. Cine furnizează factorii de emisie pentru „CO₂ economisit"? (noi doar calculăm — v2)
3. Cele 4 abonamente sunt fixe sau se configurează liber? (le implementăm ca tipuri
   de produs/serviciu configurabile)
4. Raportarea ≥60% materii secundare: per produs, per perioadă, per total producție?
5. Care e calendarul proiectului lui (când trebuie să demonstreze platforma la audit)?
