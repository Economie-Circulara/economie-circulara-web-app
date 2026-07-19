# Plan de instruire — utilizatori desemnați

Acest document este livrabilul „instruire" din Anexa 1 (finanțare europeană,
secțiunea 5): planul de sesiuni de instruire pentru utilizatorii desemnați de
Beneficiar, organizat pe rol. Fiecare sesiune folosește manualele din acest
folder ca suport de curs și se încheie cu un checklist de competențe verificabil.

## Principii

- **Instruirea se face pe mediul real** (producție sau un mediu de test cu date
  demo), nu doar teoretic — fiecare participant execută pașii, nu doar urmărește.
- **Ordinea sesiunilor urmează fluxul de business** (1→9 din `docs/handoff.md`):
  nu are sens să înveți „Producție" înainte de „Stoc", sau „Comenzi" înainte de
  „Clienți"/„Itemi".
- **Materialele scrise** (manualele din acest folder) rămân disponibile
  permanent după instruire, pentru consultare ulterioară.
- **Fiecare sesiune se încheie cu o probă practică** — participantul execută
  singur un scenariu, nu doar recunoaște ce a văzut demonstrat.

## Roluri instruite și cine participă

| Sesiune | Rol(uri) țintă | Nr. estimat participanți |
| --- | --- | --- |
| S1 — Fundamente + Administrare | Administrator | 1–2 |
| S2 — Operațiuni zilnice | Administrator + Operator | 2–5 |
| S3 — Comenzi, retur/garanție, certificate | Administrator + Operator | 2–5 |
| S4 — Portal client | Client (persoana de contact a fiecărei firme) | variabil, pe măsură ce firmele sunt onboardate |
| S5 (opțional) — Super-admin platformă | Echipa care operează platforma (dacă distinctă de Beneficiar) | 1–2 |

---

## S1 — Fundamente + Administrare organizație (Administrator)

**Durată estimată:** 90 de minute.

**Material de referință:** [`ghid-administrare.md`](ghid-administrare.md) §1–2,
[`utilizare-admin-operator.md`](utilizare-admin-operator.md) §1–2.

**Agendă:**

1. (10 min) Context: ce este certificatul de trasabilitate, de ce contează,
   modelul multi-tenant (o organizație = firma; datele sunt izolate de alte
   organizații).
2. (15 min) Autentificare: invitație → setare parolă, resetare parolă, roluri
   (Administrator/Operator/Client) și ce vede fiecare.
3. (20 min) Setări organizație: identitate, logo, culori white-label, domeniu,
   email expeditor — demonstrație + participantul completează singur un câmp
   din fiecare secțiune.
4. (25 min) Managementul utilizatorilor: invitarea unui operator și a unui
   administrator (participantul invită efectiv un cont de test); discuție
   despre gap-ul curent de invitare a clienților (secțiunea din ghidul de
   administrare) și procedura temporară.
5. (20 min) Întrebări + probă practică: participantul invită un utilizator nou
   și modifică o setare de identitate a organizației, fără asistență.

**Checklist de competențe (bifat de instructor):**

- [ ] Știe să seteze/reseteze parola proprie.
- [ ] Poate explica diferența dintre Administrator/Operator/Client (ce vede fiecare).
- [ ] Poate actualiza identitatea organizației (nume, logo, culori).
- [ ] Poate invita un operator și un administrator nou.
- [ ] Cunoaște procedura temporară pentru crearea unui cont de client (gap curent).

---

## S2 — Operațiuni zilnice: Clienți, Itemi, Rețete, Stoc (Administrator + Operator)

**Durată estimată:** 2 ore.

**Material de referință:** [`utilizare-admin-operator.md`](utilizare-admin-operator.md) §3–5.

**Agendă:**

1. (25 min) Clienți: creare client nou cu lookup CUI (ANAF), completare
   manuală când lookup-ul eșuează, adrese de livrare multiple, documente
   (upload/descărcare, nota despre contracte arhivate).
2. (20 min) Itemi: diferența Fizic/Serviciu, unitate de măsură unică per produs,
   flag „Vandabil" (ce apare în catalogul clientului).
3. (20 min) Rețete: compoziția în procente, fără versionare (produs nou = rețetă
   nouă).
4. (30 min) Stoc: adăugarea unui lot (proveniență, cantitate, sursă, locație),
   blocarea/deblocarea unui lot cu motiv, regula FIFO.
5. (15 min) Audit stoc: filtrare și export CSV.
6. (10 min) Probă practică: fiecare participant creează un client, un item cu
   rețetă simplă și un lot de stoc, apoi blochează și deblochează lotul.

**Checklist de competențe:**

- [ ] Creează un client folosind lookup CUI și completează manual câmpurile lipsă.
- [ ] Adaugă o adresă de livrare și un document pe un client.
- [ ] Creează un item și îi definește o rețetă (procente).
- [ ] Adaugă un lot de stoc cu proveniență corectă.
- [ ] Blochează/deblochează un lot cu motiv.
- [ ] Exportă un audit de stoc filtrat în CSV.

---

## S3 — Producție/Reciclare, Comenzi, Retur/Garanție, Certificate (Administrator + Operator)

**Durată estimată:** 2,5 ore. (Sesiunea cea mai importantă — acoperă lanțul
critic al demo-ului MVP, pașii 5–9 din flux.)

**Material de referință:** [`utilizare-admin-operator.md`](utilizare-admin-operator.md) §6–10.

**Agendă:**

1. (30 min) Producție/Reciclare: cele două fluxuri (Output fix — Fabricație vs.
   Output variabil — Reciclare), citirea diagramei Sankey, randament/pierderi
   (se înregistrează, nu se validează).
2. (40 min) Comenzi: crearea unei comenzi în numele clientului, mașina de stări
   (Draft → Trimisă → Acceptată → Livrată → Închisă), **momentul-cheie**:
   acceptarea scade stocul (FIFO), anularea îl reface.
3. (20 min) Retur și garanție: fluxul de retur (readuce în stoc, după acceptare
   manuală) vs. garanție (retur + comandă de înlocuire automată).
4. (20 min) Certificat de trasabilitate: generare automată la închiderea
   comenzii, conținut (lanț de trasabilitate, materiale și origine),
   tipărire/descărcare PDF.
5. (10 min) Rapoarte: cele 6 rapoarte disponibile, export PDF/CSV.
6. (10 min) Căutare globală.
7. (20 min) Probă practică — scenariu complet: participantul pornește un
   proces de producție, creează o comandă, o acceptă, o livrează, o închide și
   verifică certificatul generat automat.

**Checklist de competențe:**

- [ ] Pornește un proces „Output fix" și unul „Output variabil", înțelegând diferența.
- [ ] Creează o comandă în numele unui client, cu linii corecte.
- [ ] Parcurge corect mașina de stări a unei comenzi (Trimite → Acceptă → Livrează → Închide).
- [ ] Explică de ce stocul scade la acceptare, nu la livrare.
- [ ] Inițiază un retur și o garanție, și înțelege diferența dintre ele.
- [ ] Găsește și descarcă certificatul unei comenzi închise.
- [ ] Exportă un raport (PDF și CSV).
- [ ] Folosește căutarea globală pentru a găsi o comandă/client/lot.

> **Notă:** livrări/aviz/e-Transport (Task X5) nu sunt încă disponibile în
> interfață la data acestui plan — sesiunea de instruire pe acel flux se
> adaugă separat când funcționalitatea e livrată (vezi nota din
> `utilizare-admin-operator.md` §9).

---

## S4 — Portal client (rol Client)

**Durată estimată:** 45 de minute. Se repetă pentru fiecare firmă client nou
onboardată (individual sau în grup, dacă mai multe firme sunt instruite simultan).

**Material de referință:** [`utilizare-client.md`](utilizare-client.md) (complet).

**Agendă:**

1. (10 min) Autentificare: setarea parolei din invitație, resetarea parolei.
2. (15 min) Catalog: navigare, adăugare în coș, trimiterea unei comenzi cu
   adresă/dată de livrare.
3. (10 min) Comenzile mele: urmărirea statusului, repetarea unei comenzi vechi.
4. (5 min) Retur/garanție: cum se inițiază pe o comandă finalizată.
5. (5 min) Documente & Certificate: descărcarea documentelor și certificatelor.

**Checklist de competențe:**

- [ ] Își setează parola din emailul de invitație.
- [ ] Plasează o comandă din catalog, cu adresă de livrare aleasă.
- [ ] Verifică statusul unei comenzi trimise.
- [ ] Repetă o comandă anterioară.
- [ ] Descarcă un certificat de trasabilitate.

---

## S5 (opțional) — Super-admin platformă

**Durată estimată:** 45 de minute. Necesară doar dacă echipa care operează
platforma pentru mai mulți clienți (organizații) este distinctă de Beneficiar.

**Material de referință:** [`ghid-administrare.md`](ghid-administrare.md) §3–4.

**Agendă:**

1. (15 min) Crearea unei organizații noi + invitarea adminului ei inițial.
2. (10 min) Suspendarea/reactivarea unei organizații și efectele ei.
3. (20 min) Referință tehnică rapidă: migrări (`supabase db push`), regenerare
   tipuri, backup, unde se configurează domeniul custom pe Vercel.

**Checklist de competențe:**

- [ ] Creează o organizație nouă și invită adminul ei inițial.
- [ ] Suspendă și reactivează o organizație de test, verificând efectul asupra unui cont din ea.
- [ ] Știe unde se aplică o migrare nouă pe proiectul cloud și cum se regenerează tipurile.

---

## Materiale necesare pentru toate sesiunile

- Acces la un mediu funcțional (producție sau mediu de test/demo cu date
  seed — vezi `supabase/seed.sql`, datele demo „Lateris Demo").
- Un proiector/ecran partajat pentru demonstrații live.
- Manualele din acest folder, tipărite sau distribuite digital participanților
  înainte de sesiune.
- Un cont de test per participant (creat înainte de sesiune, cu rolul potrivit),
  pentru proba practică.

## Programare recomandată

Sesiunile S1–S3 se recomandă a fi programate **consecutiv, în aceeași
săptămână**, pentru echipa organizației (Administrator + Operatori), înainte de
go-live. Sesiunea S4 (Portal client) se programează **per firmă client**, la
onboarding-ul ei, nu neapărat legată de calendarul S1–S3. Sesiunea S5 se
programează o singură dată, la finalizarea configurării platformei.

Data și participanții efectivi ai fiecărei sesiuni se agreează cu Beneficiarul
și se consemnează separat (proces-verbal de instruire), ca parte a dosarului de
recepție a proiectului.
