# Clienti persoana fizica

## Cerinta

Pe langa firme (persoana juridica), organizatia poate adauga clienti **persoana
fizica**: nume + CNP obligatorii (facturare), restul fluxului identic (email ->
invitatie in portal, adrese optionale, comenzi, certificate). In formularul de client
se bifeaza tipul; asistentul AI suporta ambele tipuri.

## Decizii

- **Coloane noi pe `clients`** (migrarea `0051_client_individuals.sql`):
  - `client_type text not null default 'juridica'` cu CHECK `juridica | fizica`
    (backfill implicit: toti clientii existenti sunt firme);
  - `cnp text` - doar pentru `fizica`;
  - `cui` devine NULLABLE.
  - CHECK de consistenta: `juridica` => `cui` completat, `cnp` gol; `fizica` =>
    `cnp` de 13 cifre, `cui`/`reg_com` goale, `is_vat_payer = false`.
  - CNP unic per organizatie (index unic partial), ca si CUI-ul.
- **CNP-ul e data personala (GDPR)** - il vede DOAR staff-ul, pe pagina clientului si
  in formular. Nu apare pe certificate, avize/PDF de livrare, pagina comenzii,
  cautarea globala, selecturi sau raspunsurile tool-urilor de citire ale asistentului:
  acolo identificatorul afisat e „Persoană fizică” (helper
  `clientTaxIdLabel` in `src/features/clients/labels.ts`).
- Cautarea din lista de clienti (staff) gaseste si dupa CNP.
- Validare CNP in aplicatie: 13 cifre + cifra de control (`cnp.ts`); in DB doar
  formatul (13 cifre).
- Lookup-ul ANAF (CUI) exista doar pentru `juridica`.
- Schimbarea tipului unui client existent se face din formular (UI); campurile
  celuilalt tip sunt golite la salvare.

## Asistent AI - decizie `write` (+ `read`)

- `creeaza_client` (v2): parametru nou `tip` (`juridica` implicit | `fizica`) + `cnp`.
  Pentru `fizica`: `cnp` obligatoriu si valid, fara CUI/reg. com./TVA. Renderer
  `generic` (campurile afisate depind de tip).
- `editeaza_client` (v2): parametru `cnp` (doar pentru persoane fizice); CUI/reg.
  com./TVA refuzate pentru o persoana fizica. Tipul nu se schimba din asistent.
  Cardul arata CNP-ul existent mascat.
- `listeaza_clienti` (v2, read): intoarce `tip`; `cui` doar la firme, CNP niciodata.
- System prompt: clientul persoana fizica nu se cauta la ANAF - se cer nume + CNP.
- Manual: sectiunea „Clienți” din `utilizare-admin-operator.md`.

## Teste

- `cnp.test.ts` (validare), `actions.test.ts` (citire formular per tip), `service`
  (payload per tip, duplicat CNP), tool-urile asistentului (parse + execute per tip),
  `supabase/tests/business_flow.sql` (CHECK-urile de consistenta).
