# Emailuri white-label per domeniu (expeditor + template)

Plan (AGENTS.md §1.1), scris inainte de codare. Cerere 2026-09-29: organizatiile cu
domeniu propriu (Etora, Maconxcx) trebuie sa trimita emailurile de pe domeniul lor, cu
template-ul lor (nu „Lot cu Lot”), cat mai automat, gestionat din panoul super-admin.

## Situatia de pornire

| Canal | Cine trimite | Problema |
| --- | --- | --- |
| Notificari comenzi (`src/features/notifications/`) | aplicatia, prin API HTTP (Resend) | expeditorul per organizatie exista (`email_from_*`), dar il seteaza adminul organizatiei fara nicio verificare de domeniu; template HTML minimal, fara brand |
| Emailuri Auth (invitatie, magic link, resetare parola) | Supabase Auth (SMTP global) | UN expeditor si UN set de template-uri pentru toata platforma - de aici „Lot cu Lot” la Etora |

## Decizii

1. **Supabase „Send Email Hook” (HTTP)** in locul SMTP-ului Supabase: Supabase nu mai
   trimite emailurile Auth, ci POST-eaza catre `/auth/email-hook` (sub prefixul public
   `/auth`). Aplicatia verifica semnatura (Standard Webhooks, HMAC-SHA256, implementare
   proprie cu `node:crypto`, fara dependinta noua), rezolva organizatia userului,
   randeaza template-ul organizatiei si trimite prin acelasi provider ca notificarile.
   - Organizatia: `user_metadata.organization_id` (pus la invitatie - profilul nu exista
     inca in momentul in care Supabase apeleaza hook-ul) -> `profiles.organization_id`
     -> organizatia al carei `custom_domain` e hostul din `redirect_to` -> niciuna
     (brandul platformei, ex. super-admin).
   - Linkul: `redirect_to` + `token_hash` + `type` (acelasi tipar ca template-ul actual
     de Magic Link din `docs/setup.md`, verificat de `/auth/callback` cu `verifyOtp`).
     Originea se inlocuieste cu domeniul organizatiei cand aceasta il are.
   - Eroare de trimitere -> raspuns 500 in formatul hook-ului; Supabase intoarce eroare
     actiunii (userul vede „nu am putut trimite”), nimic nu se pierde silentios.
2. **Un singur layout de email** (`notifications/layout.ts`) pentru Auth si comenzi:
   logo orizontal (`inlineLogoOf`), culoarea brandului (tema, apoi culorile adminului
   doar pe tema implicita - aceeasi regula ca PDF-urile, `pdfBrandFor`), numele
   produsului (`productNameFor`), subsol cu datele firmei (CUI, Reg. Com., adresa).
   Notificarile de comanda primesc si buton catre portal (`/comenzile-mele/<id>`).
3. **Expeditorul pe domeniul organizatiei DOAR daca domeniul e verificat.** Coloane noi
   in `organizations` (migrarea `0050`): `email_domain`, `email_domain_provider_id`,
   `email_domain_status` (`not_configured|pending|verified|failed`),
   `email_domain_records` (jsonb), `email_domain_checked_at`, `email_reply_to`.
   `resolveEmailSender`: adresa organizatiei doar cand statusul e `verified` si adresa e
   pe exact acel domeniu; altfel adresa platformei (`EMAIL_DEFAULT_FROM_ADDRESS`, implicit
   `notificari@lotculot.eu`) cu NUMELE organizatiei - niciun email nu se pierde din cauza
   unui domeniu neconfigurat.
4. **Domeniul si adresa expeditorului le gestioneaza DOAR super-adminul** (garda
   `app.enforce_platform_managed_org_fields` extinsa): o adresa pe un domeniu
   neverificat face trimiterea sa esueze. Adminul organizatiei pastreaza numele
   expeditorului si primeste campul nou „Adresa de raspuns (reply-to)”.
5. **Etapa 2 - automatizare prin Resend Domains API** (`platform/email-domain-provider.ts`,
   adapter ca la rutare/e-Transport; activ doar cu o cheie Resend full access - `RESEND_API_KEY` sau `EMAIL_API_KEY` cand `EMAIL_API_URL` e Resend): in
   `/platform/<id>` -> sectiunea „Email”, super-adminul introduce domeniul si adresa;
   aplicatia creeaza domeniul in Resend (regiunea EU, click/open tracking OPRITE - altfel
   linkurile Auth sunt rescrise), salveaza si afiseaza inregistrarile DNS de pus in
   Cloudflare, iar butonul „Verifica DNS” cere verificarea si actualizeaza statusul.
   Fara cheie Resend sectiunea explica ce lipseste (nu exista mock care sa marcheze
   un domeniu drept verificat - ar trimite emailuri care pica).
6. Trimiterea: `getEmailProvider()` accepta in continuare `EMAIL_API_URL`/`EMAIL_API_KEY`;
   daca lipsesc dar exista `RESEND_API_KEY`, trimite direct prin Resend. Mesajul are acum
   si `reply_to`.

## Fisiere

- `supabase/migrations/0050_org_email_domain.sql` + `supabase/tests/business_flow.sql`
  (garda: adminul nu poate schimba domeniul/adresa, poate schimba reply-to).
- `src/lib/database.types.ts` (coloane noi).
- `src/features/notifications/`: `provider.ts` (reply-to, fallback Resend), `sender.ts`,
  `email-brand.ts`, `layout.ts`, `templates.ts` (pe layout), `auth-templates.ts`,
  `webhook-signature.ts`, `auth-hook.ts`, `service.ts`.
- `src/app/auth/email-hook/route.ts`.
- `src/features/platform/`: `email-domain.ts` (pur), `email-domain-provider.ts` (Resend),
  `email-domain-service.ts`, actiuni noi in `actions.ts`, `org-email-form.tsx`,
  `queries.ts`/`types.ts`; `src/app/platform/[id]/page.tsx`.
- Invitatii (`platform/service.ts`, `settings/user-actions.ts`): `data.organization_id`.
- Setari organizatie: adresa expeditorului read-only + status, camp reply-to.
- Docs: `docs/setup.md` (Resend, Cloudflare, hook Supabase), manual
  `ghid-administrare.md`, `.env.example`, AGENTS.md (regula noua), prompt log.

## Impact asistent AI (AGENTS.md §2.4)

**Decizia: `none`** - configurare de platforma si trimitere de email; asistentul nu
citeste si nu propune nimic legat de expeditor/domenii.

## Teste

- semnatura webhook (valida, alterata, expirata, secret gresit);
- `resolveEmailSender` (verificat / neverificat / alt domeniu / fara config);
- layout + template-uri Auth si comenzi (brand, escape, link, cod);
- hook: rezolvarea organizatiei (metadata, profil, domeniu), linkul pe domeniul
  organizatiei, `next` pastrat, eroare provider -> exceptie;
- provider Resend (cereri create/verify/get mockuite), maparea statusurilor;
- actiunile super-admin (validare, fara cheie, domeniu schimbat).

## In afara scopului (Etapa 3, optional)

Crearea automata a inregistrarilor DNS in Cloudflare (token API cu „DNS Edit”). Acum
inregistrarile se copiaza manual din `/platform/<id>`.
