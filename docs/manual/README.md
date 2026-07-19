# Manual Lateris Trace — cuprins

Acest folder conține documentația de utilizare și administrare a platformei
**Lateris Trace**, livrată ca parte a Task X6 (documentație obligatorie pentru
conformitatea cu Anexa 1 — finanțare europeană). Documentele descriu ecranele
și fluxurile **reale** ale aplicației, verificate în cod la data redactării
(2026-07-19).

## Cine citește ce

| Document | Pentru cine | Ce conține |
| --- | --- | --- |
| [`utilizare-admin-operator.md`](utilizare-admin-operator.md) | **Administrator** și **Operator** ai unei organizații | Ghid pas-cu-pas pentru activitatea zilnică: autentificare, dashboard, clienți, itemi/rețete, stoc, producție/reciclare, comenzi, retur/garanție, livrări, rapoarte, căutare. |
| [`utilizare-client.md`](utilizare-client.md) | **Client** (firma care cumpără) | Ghid pas-cu-pas pentru portalul clientului: autentificare, catalog, comenzi proprii, retur/garanție, documente și certificate. |
| [`ghid-administrare.md`](ghid-administrare.md) | **Administrator de organizație** și **Super-admin de platformă** (+ echipa tehnică) | Configurarea organizației (identitate, white-label, domeniu, email), managementul utilizatorilor, administrarea multi-organizație (super-admin), și referințe tehnice de operare (Supabase, Vercel, migrări, backup). |
| [`instruire.md`](instruire.md) | **Persoana responsabilă cu instruirea** utilizatorilor desemnați (Beneficiar) | Plan de sesiuni de instruire pe rol, agendă, durată estimată, checklist de competențe, materiale necesare. |

## Cum se citesc manualele de utilizare

Ambele manuale de utilizare (`utilizare-admin-operator.md`, `utilizare-client.md`)
urmăresc **fluxul complet al platformei**, de la crearea organizației până la
certificatul de trasabilitate — același flux descris în
[`docs/handoff.md`](../handoff.md) și rezumat în [`docs/index.md`](../index.md):

1. Creare organizație + useri
2. Creare client (lookup CUI → precompletare → confirmare)
3. Definire itemi cu rețete
4. Intrare stoc cu lot și documente
5. Proces reciclare (input → confirmare output manual → loturi noi)
6. Producție (cantitate output → consum FIFO automat → loturi noi)
7. Comandă (client sau admin)
8. Acceptare comandă → scădere stoc
9. Livrare → închidere → generare certificat PDF automat

Manualul admin/operator acoperă pașii 1–9 din perspectiva organizației; manualul
clientului acoperă partea vizibilă lui din pașii 7–9 (plasare comandă, urmărire
status, retur, descărcare documente/certificate).

## Notă importantă — capturi de ecran

**Acest manual nu conține încă capturi de ecran (screenshot-uri).** Textul
descrie titlurile de ecran, denumirile de buton și câmpurile de formular exact
așa cum apar în interfață (verificate în codul sursă la data redactării), dar
imaginile propriu-zise trebuie adăugate ulterior, direct din aplicația
funcțională (mediu de dezvoltare sau producție), de către echipa de proiect sau
un agent cu acces la un browser/aplicație rulantă. Locurile recomandate pentru
capturi sunt marcate în text cu formatul:

> 📷 **[Captură de adăugat: <descriere ecran>]**

## Stadiul funcționalităților la data redactării (2026-07-19)

Cateva note de onestitate, ca sa nu existe asteptari gresite:

- **Livrări, aviz de însoțire a mărfii și declarare e-Transport** (Task X5) sunt
  **în curs de implementare** — nu există încă o rută `/livrari` dedicată în
  aplicație. Secțiunea corespunzătoare din manualul admin/operator descrie
  fluxul *planificat* (conform planului de implementare) și va fi actualizată
  cu pașii exacți din interfață când task-ul e livrat.
- **Invitarea unui utilizator cu rol `client`** (creare cont de logare pentru
  portalul clientului) nu are încă un formular dedicat în `/setari/utilizatori`
  — ecranul acela permite azi doar invitarea de operatori/administratori. Vezi
  nota din [`ghid-administrare.md`](ghid-administrare.md#gap-cunoscut-invitarea-unui-client)
  pentru detalii și soluția temporară.
- Secțiunea „CO₂ economisit" din pagina Rapoarte este marcată explicit în
  aplicație ca fiind în pregătire (v2) — nu e un raport funcțional încă.

Restul fluxurilor descrise (autentificare, clienți, itemi, rețete, stoc,
producție/reciclare, comenzi, retur/garanție, certificate, rapoarte, căutare,
portal client) sunt funcționale și documentate pe baza ecranelor reale.
