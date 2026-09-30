# Site de prezentare: continutul Macon XCX + formularul „Cere o ofertă”

## Context

Un demo extern (artifact „Macon XCX Demo”) a propus pentru `maconxcx.ro` un site mai
complet decat al nostru: texte reale (beton, transport, concasare, istoric din 2010,
investitia din 2025), un flux de economie circulara in 4 pasi, un formular „Cere o
ofertă” (in demo nu trimitea nimic) si o sectiune de noutati.

Decizii (2026-09-30, utilizatorul):

1. Macon XCX = **beton, transport, concasare** (+ materiale) - nu abonamente la
   echipamente, cum era placeholder-ul nostru.
2. Cererea de oferta se trimite **pe email SI se salveaza in aplicatie**.
3. **Noutatile - mai tarziu** (task separat: tabel per organizatie + editare in
   aplicatie + publicare pe site).

Nu copiem HTML-ul demo-ului: am pierde tema din `/platform`, validarea continutului
la build si reutilizarea pentru Etora. Preluam continutul si structura.

## Site (`sites/prezentare`)

- `content.ts`: sectiuni noi, **optionale** per tenant:
  - `services.items[].tag` (eticheta scurta, ex. „Stație proprie”);
  - `circular` - titlu, intro, pasi (`label`/`title`/`text`), nota optionala;
  - `quote` - lista de servicii din formular (activeaza formularul).
- `page.tsx`: cu `quote`, hero-ul are formularul in dreapta (in locul certificatului
  ilustrativ) si antetul un buton „Cere ofertă”; `circular` apare inaintea
  sectiunii de trasabilitate.
- `QuoteForm` (client component): serviciu, nume, telefon, email (optional),
  detalii, acord GDPR obligatoriu + camp-capcana ascuns (boti). Trimite JSON la
  `https://<appDomain>/api/public/cerere-oferta`. La eroare afiseaza telefonul /
  emailul firmei.
- Pagina `/confidentialitate` (nota de informare minima, generata din continut) -
  **de validat juridic de client** inainte de a scoate `draft`.
- `content/maconxcx.json`: textele din demo. Telefon, email de contact, program si
  punctele de lucru raman de completat de firma.

Decizie schimbata fata de `site-prezentare-tenanti.md` („fara formular, fara date
personale”): formularul colecteaza nume + telefon, deci are acord explicit si nota
de informare. Tot fara cookie-uri (nu e nevoie de banner).

## Aplicatie

### DB - migrarea `0051_quote_requests.sql`

- Tabel `quote_requests` (organizatie, serviciu, nume, telefon, email, detalii,
  domeniul de origine, hash-ul IP-ului, status `new`/`handled`, cine/cand a
  rezolvat). RLS: staff-ul organizatiei citeste si actualizeaza; nimeni nu insereaza
  direct.
- RPC `submit_quote_request` (`security definer`, DOAR `service_role` - endpoint-ul
  public il apeleaza cu clientul admin; anonimul nu il poate apela direct ocolind
  verificarile rutei):
  - organizatia = cea al carei `custom_domain` e hostul cererii, activa (`QR001`);
  - validari de lungime / campuri obligatorii (`QR004`);
  - limita anti-spam: max 5 cereri / ora de la acelasi IP (`QR002`) si 200 / zi per
    organizatie (`QR003`).
- Staff-ul marcheaza cererea rezolvata / o redeschide (update pe `status`, trigger
  care stampileaza `handled_at` / `handled_by`).

### Endpoint `POST /api/public/cerere-oferta`

- Prefix public nou `/api/public` in middleware (fara sesiune).
- CORS: raspunde doar originilor site-ului organizatiei - apex-ul domeniului
  aplicatiei si `www.` (`abonamente.maconxcx.ro` -> `maconxcx.ro`,
  `www.maconxcx.ro`), plus `localhost` in afara productiei. CORS nu e o protectie
  de securitate (curl il ignora) - protectia e validarea + limita din RPC.
- Camp-capcana completat -> raspuns de succes fals, nimic salvat.
- IP-ul nu se salveaza in clar: SHA-256 cu sare (`QUOTE_IP_SALT`, fallback pe o
  constanta).
- Dupa salvare, emailul catre firma: `email_reply_to` al organizatiei daca e setat,
  altfel toti adminii activi; brand + expeditor prin `emailBrandFor` +
  `renderEmailLayout`; `reply-to` = emailul solicitantului (daca l-a dat). Un email
  esuat NU pica cererea (e deja in aplicatie) - doar se jurnalizeaza.

### Ecran `/cereri-oferta`

Grupul „Comenzi” (si „Vânzări” in organizarea `flux`), admin + operator: lista
cererilor (noi primele), telefon/email clicabile, „Marchează rezolvată” /
„Redeschide”.

## Teste

- Site: validarea continutului nou, construirea/validarea payload-ului formularului.
- App: parsarea cererii, originile permise, destinatarii + continutul emailului,
  ruta (RPC + provider mock-uite: succes, capcana, CORS, erori RPC, email esuat),
  meniul.
- `business_flow.sql` B32: RPC-ul (domeniu necunoscut, validari, limita pe IP),
  staff-ul altei organizatii nu vede cererea, rezolvarea stampileaza autorul.

## Impactul asupra asistentului AI (regula 2.4)

**Decizia: `none`** pentru acum. Candidat ulterior la `read` („ce cereri de oferta
noi am?”) - nu e cerut.

## Manual

`docs/manual/utilizare-admin-operator.md`: sectiune scurta „Cereri de ofertă”.

## Ramane de facut (in afara acestui task)

- Noutati (decizia 3).
- Politica de confidentialitate validata juridic + termenul de pastrare a cererilor
  (azi nu se sterg automat).
- Datele de contact reale Macon XCX (telefon, email, program, puncte de lucru).
- Env pe Vercel: `QUOTE_IP_SALT` (optional, recomandat).
