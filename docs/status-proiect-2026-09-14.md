# Status proiect Lot cu Lot

**Data evaluării:** 2026-09-14
**Versiune analizată:** commit `3b702dd`, identic cu `origin/main`

## Rezumat executiv

Proiectul este la aproximativ **81% din drumul către un v1 gata de recepție și
utilizare reală**.

În cod sunt implementate aproximativ **93% dintre funcționalitățile MVP**, dar
gradul de verificare, integrare cu servicii externe și pregătire operațională este
mai mic. Proiectul nu mai este în faza de construcție de bază, ci în faza de
**stabilizare, conformitate și recepție**.

| Perspectivă | Estimare |
| --- | ---: |
| Funcționalități MVP existente în cod | **~93%** |
| V1 gata de recepție/producție | **~81%** |
| Cererea extinsă PaaS a viitorului client | **~68–72%** |
| Lucru rămas pentru v1 | **~19%** |

Estimarea de 81% este orientativă și ponderată astfel: funcționalitate 55%,
conformitate/certificat 15%, QA 15%, producție și integrări 10%, documentație și
recepție 5%.

## Ce este produsul

Lot cu Lot este o platformă SaaS multi-tenant pentru producători și reciclatori,
destinată trasabilității materialelor în economia circulară.

Nucleul produsului este:

- evidența clienților, produselor, serviciilor, loturilor și documentelor;
- stoc și consum FIFO, cu audit complet al mișcărilor;
- reciclare, producție și recondiționare;
- comenzi, livrări, retururi și garanții;
- trasabilitate de la produsul livrat până la loturile-sursă;
- certificat PDF de trasabilitate;
- portal separat pentru client;
- administrare multi-tenant și white-label.

Platforma nu este marketplace, ERP financiar sau sistem de facturare. Nu gestionează
prețuri, bani, tarife ori obligații contractuale structurate. Contractele sunt
arhivate ca documente.

Modelul Product-as-a-Service este implementat în variantă „light”: produs sau
serviciu în catalog, comandă, dată estimată de retur și flux de
retur/recondiționare/reutilizare.

## Status pe module

| Zonă | Status | Observație |
| --- | --- | --- |
| Autentificare, roluri, multi-tenant și suspendarea organizației | 🟢 | Implementate, cu RLS și hardening |
| Clienți, lookup CUI, adrese, documente și invitare client | 🟢 | Funcționale; manualul este parțial depășit |
| Produse, servicii și rețete | 🟢 | CRUD complet; comenzile cu servicii sunt tratate fără consum de stoc |
| Stoc, loturi, FIFO și audit | 🟢 | Implementate; suita SQL de business trece pe PostgreSQL real |
| Producție, reciclare și recondiționare | 🟢 | Fluxurile și trasabilitatea există |
| Comenzi, retur și garanție | 🟢/🟡 | Fluxurile principale există; retururile au încă UX minimal |
| Certificate web și PDF | 🟡 | Funcționale; datele juridice de bază ale emitentului există, dar conținutul rămâne incomplet |
| Portal client | 🟢 | Catalog, comenzi, repetare, documente și certificate |
| Livrări și aviz PDF | 🟡 | Modul implementat; e-Transport real nu este conectat |
| Rapoarte, KPI, CSV/PDF și căutare | 🟢 | Implementate; raportul CO₂ este amânat pentru v2 |
| Notificări email | 🟡 | Codul există; fără configurare folosește provider mock |
| Asistent AI | 🟡 | Implementat suplimentar; provider mock implicit și producție neverificată |
| Responsive/mobil | 🟡 | Interfața mobilă există, dar testarea mobilă din CI este configurată greșit |
| Manual și instruire | 🟡 | Există ajutor în aplicație și 28 capturi; unele texte sunt depășite |

## Dimensiunea actuală

- 19 verticale de business în `src/features/`;
- 24 de migrări Supabase;
- aproximativ 43.000 de linii TypeScript, TSX și SQL;
- 94 de fișiere de teste unitare;
- 6 suite Playwright E2E;
- 3 suite SQL;
- 28 capturi în manual.

## Verificări efectuate

Pe versiunea curentă și în ultimele workflow-uri aferente:

- `pnpm typecheck`: **trece**;
- `pnpm lint`: **trece**;
- `pnpm test`: **712/712 teste trec**;
- `pnpm build`: **trece**;
- `business_flow.sql`, `rls_isolation.sql` și `assistant_rls.sql`: **trec** pe
  PostgreSQL/Supabase real în workflow-ul DB;
- `pnpm format:check`: **eșuează în 2 fișiere**;
- site-ul public `https://www.lotculot.eu`: **HTTP 200**, cu brandingul actual;
- workflow-ul principal CI pentru `3b702dd`: **verde**.

## Probleme care blochează declararea proiectului drept „gata”

### 1. Suita E2E eșuează, dar GitHub o afișează verde

Workflow-ul E2E are `continue-on-error: true`. La ultima rulare:

- 15 teste au trecut;
- 18 teste au eșuat;
- 27 teste nu au mai rulat.

Cauze identificate:

- unele teste și date demo nu mai sunt aliniate;
- testul homepage a rămas în urma schimbării de branding;
- proiectul `mobile-chromium` moștenește WebKit de la profilul iPhone 13, în timp ce
  CI instalează doar Chromium;
- suita de generare a capturilor pentru manual este inclusă greșit în suita normală
  de regresie;
- suite care modifică aceeași bază rulează în paralel.

Testul de login care folosea selectorul ambiguu `Email` a fost reparat, dar restul
surselor de instabilitate de mai sus mențin suita roșie.

### 2. Starea bazei de date de producție nu este dovedită complet

Documentația confirmă aplicarea migrărilor hosted până la `0019`. Nu există dovadă
în repository că au fost aplicate și migrările ulterioare:

- `0020_assistant.sql`;
- `0021_item_images_storage.sql`;
- `0022_accept_order_skip_service_items.sql`;
- `0023_organization_legal_fields.sql`.

Trebuie verificate și variabilele de producție:

- `SUPABASE_SECRET_KEY`;
- `EMAIL_API_URL` și `EMAIL_API_KEY`;
- providerul și cheia asistentului AI;
- configurația e-Transport.

### 3. Certificatul trebuie completat

Certificatul se generează și poate fi descărcat. CUI-ul, numărul de Registrul
Comerțului și adresa emitentului au fost adăugate, dar încă lipsesc elemente
importante:

- autorizația de mediu și, dacă este diferită, adresa instalației emitentului;
- data și adresa livrării;
- UIT, transportator și vehicul;
- identificatorii loturilor livrate și ai loturilor-sursă;
- tipul și data proceselor de transformare;
- procentul total de materii prime secundare;
- metoda și baza de calcul;
- protecție pentru procente calculate peste unități de măsură incompatibile;
- disclaimer juridic;
- lista documentelor însoțitoare.

Certificatul trebuie poziționat drept document voluntar de trasabilitate, nu certificat
de conformitate, declarație de performanță, document CE sau atestare de laborator.

### 4. Integrarea e-Transport nu este reală

Modulul de livrări, avizul PDF și stocarea codului UIT există. Providerul implicit
generează însă un cod `MOCK-UIT-*`. Adapterul Socrate.io are încă payload-ul real marcat
TODO și depinde de contract, credențiale și clarificarea regulilor legale.

### 5. Documentația este parțial depășită

Manualul afirmă încă, în unele secțiuni, că:

- ruta `/livrari` nu există;
- invitarea unui client nu are formular dedicat.

Ambele funcționalități există acum.

Mai lipsesc trei capturi reale:

- formular retur/garanție pentru admin;
- formular retur/garanție pentru client;
- detaliu comandă client cu „Repetă comanda”.

## Defecte și limitări secundare

- graful Sankey din pagina web a certificatului poate suprapune etichetele la lanțuri
  lungi;
- rândurile din lista de clienți navighează prin click pe `<tr>`, nu prin link accesibil;
- dashboardul mai conține cel puțin un text fără diacritice;
- verificarea driftului `database.types.ts` este informativă, nu blocantă;
- un `activity_log` general nu există; auditul este distribuit între `stock_events`,
  statusurile comenzilor și procese;
- livrările sunt modelate simplificat: o livrare per comandă și fără livrări parțiale;
- GPS, CO₂, IoT, optimizare de traseu și verificarea publică prin QR sunt v2.

## Ambiguități care necesită decizie

### Baza contractuală

Anexa 1 din repository este încă marcată drept draft nedepus. Cererea de finanțare a
viitorului client PaaS este deja depusă, dar documentația proiectului spune că este o
finanțare separată.

Trebuie stabilit ce document va fi folosit efectiv la recepția proiectului curent.

### Definiția PaaS

Implementarea actuală înseamnă comandă, perioadă de utilizare, retur și
recondiționare. Cererea clientului vorbește suplimentar despre:

- monitorizare în timp real;
- monitorizarea consumului;
- CO₂ economisit;
- planificare inteligentă;
- optimizarea traseelor.

Documentația internă le tratează ca v2 sau ca interpretări operaționale, nu ca
funcționalități curente.

### Certificatul

Conținutul și formulările finale trebuie confirmate cu un jurist sau consultant de
mediu, în special pentru:

- încetarea statutului de deșeu;
- standardele de produs aplicabile;
- DoP și marcaj CE;
- bonul de livrare pentru beton;
- pragurile e-Transport;
- disclaimer și formularea casetei de emitere/semnătură.

### Producție și furnizori externi

Trebuie confirmate explicit:

- migrările aplicate în Supabase hosted;
- secretul administrativ Supabase din Vercel;
- providerul real de email;
- providerul AI și condițiile GDPR;
- contractul și accesul sandbox/producție Socrate.io.

## Ordinea recomandată a lucrărilor

### P0 — înainte de recepție

1. Repararea și separarea suitei E2E, inclusiv configurația proiectului mobil.
2. Eliminarea `continue-on-error` după stabilizarea testelor.
3. Verificarea migrărilor `0020`–`0023` și a variabilelor de producție.
4. Smoke test autentificat pe producție: login, creare client, upload document și poză,
   stoc, producție, comandă, livrare, certificat și retur.
5. Repararea celor două abateri Prettier și transformarea verificării de format într-o
   condiție clară de recepție.

### P1 — produs și conformitate

6. Completarea certificatului și validarea juridică a formulărilor.
7. Conectarea notificărilor email reale.
8. Integrarea Socrate.io sau declararea explicită a e-Transport drept funcționalitate
   viitoare.
9. Repararea grafului web pentru lanțuri lungi.

### P2 — livrabile de recepție

10. Actualizarea manualelor.
11. Generarea celor trei capturi lipsă.
12. Executarea și documentarea sesiunilor de instruire.
13. Pregătirea procesului-verbal de predare, a acceselor, codului-sursă și suportului de
    garanție.

## Concluzie

Funcționalitățile mari sunt deja construite. Proiectul poate fi demonstrat, iar
site-ul public este disponibil. Totuși, nu trebuie declarat încă „gata de recepție”
din cauza suitei E2E roșii, a stării neverificate a producției, a integrărilor mock și
a certificatului incomplet. Fluxurile SQL critice sunt acum acoperite de trei suite
care trec pe o bază Supabase reală.

Ținta realistă imediată este închiderea celor aproximativ **19% rămase**, concentrate
în QA, producție, conformitate și livrabile, nu construirea unor module majore noi.

## Documente de referință

- [Handoff produs](handoff.md)
- [Plan de implementare](plans/implementation-plan.md)
- [Anexa 1 — draft](anexa-1-specificatii-tehnice.md)
- [Analiza de conformitate](analiza-conformitate-anexa.md)
- [Analiza certificatului](analiza-standarde-certificat.md)
- [Analiza cererii clientului PaaS](analiza-cerere-finantare-client-paas.md)
- [Cererea de finanțare a clientului PaaS](cerere-finantare-client-paas.pdf)
- [Manualele aplicației](manual/README.md)
