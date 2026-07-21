# Decizie: model de tenancy în URL (subdomeniu vs. slug vs. fără)

**Status:** Decis pentru MVP — **Opțiunea A (fără tenant în URL)**.
**Data:** 2026-07-21
**Context cost:** Vercel Free (Hobby) + Supabase Free.

---

## Rezumat

Platforma e multi-tenant cu **izolare logică prin RLS** pe `organization_id`. Organizația
utilizatorului curent se rezolvă din **profilul lui** (`profiles.organization_id`) după
autentificare — nu din URL. Pentru MVP **nu punem tenantul în URL** (fără subdomenii, fără
segment de slug). Aplicația funcționează corect așa: după login, tot ce vede și scrie un
user e automat limitat la organizația lui.

Singurul lucru pe care tenantul-în-URL l-ar adăuga este **brandingul pe pagina de login**
(logo/culori ale organizației *înainte* de autentificare) și URL-uri „de firmă". Niciunul
nu e necesar funcțional pentru MVP.

## Ce există deja în cod (dar NU e activ)

- `src/features/auth/tenant.ts` — `resolveTenant(host, pathname, rootDomain)` știe să deducă
  un slug din **subdomeniu** (`acme.<root>`), din **segment de path** (`/acme/...`) sau un
  **custom domain**. E cod pur, fără DB.
- `middleware.ts` propagă slug-ul rezolvat prin headere (`x-tenant-slug`), iar `/login`
  își ia brandingul din `getOrgBranding(hint)`.
- **DAR nu există nicio rută `/[slug]` în `src/app/`.** Toate rutele sunt neprefixate
  (`/login`, `/dashboard`, …), iar segmentele lor sunt în `RESERVED_PATH_SEGMENTS`. Deci
  `/acme` sau `/acme/login` dau **404** azi. În dev, pe `localhost`, login-ul arată
  brandingul default fiindcă nu se rezolvă niciun tenant.

Practic: „instalația" de tenant e pe jumătate construită pentru modelul pe **subdomeniu**,
dar neconectată la rute reale.

## Implicații de cost

Subdomeniile sunt o chestiune de **frontend/Vercel**, nu de Supabase. Izolarea între
organizații se face prin RLS, indiferent de URL.

| Serviciu | Multi-tenant pe același proiect | Subdomenii per-org |
| --- | --- | --- |
| **Supabase** | Free e suficient (RLS + un singur proiect). Auth: pune un wildcard în redirect URLs (`https://*.domeniul.app/**`) — gratis. | Nu privește Supabase. „Custom domain" plătit e doar pentru API-ul Supabase (`db.firma.ro`) — **nu ne trebuie**. |
| **Vercel** | Free (un domeniu, chiar `proiect.vercel.app`). | **Wildcard `*.domeniu.app` cere Vercel Pro.** Subdomenii individuale (adăugate manual) merg pe Free, dar nu scalează. |

**Slug / path-based (`/acme/...`) rulează 100% gratis** pe ambele — un singur domeniu, fără
wildcard, fără custom domain.

## Opțiuni (pentru revizuire ulterioară)

| Opțiune | Cost infra | Efort cod | Ce câștigi |
| --- | --- | --- | --- |
| **A. Fără tenant în URL** *(ales)* | $0 | zero | Org din user-ul logat. Merge deja. Login fără branding per-org. |
| **B. Slug / path-based** | $0 | mediu-mare (rutele trec sub `/[slug]/`) | Login branded per-org + URL-uri `/acme/...`, pe domeniu gratuit |
| **C. Subdomenii** | Vercel Pro (wildcard) | mic (deja half-built) | URL-uri `acme.firma.app`, cel mai curat, dar plătit |

### Variantă „B ușoară" (dacă se vrea login branded fără cost)

Se pot adăuga **doar** `/[slug]` și `/[slug]/login` care afișează brandingul organizației;
după autentificare userul intră în aplicația normală (neprefixată), scoped pe org prin RLS.
URL-ul își pierde slug-ul post-login. Evită refactorul masiv al tuturor rutelor.

## Când reconsiderăm

- Când un client cere explicit **login branded** (logo-ul lui înainte de autentificare) →
  implementează B (ușoară) — gratis.
- Când se justifică URL-uri `acme.firma.app` (marketing / white-label complet) și bugetul
  permite → C, cu `NEXT_PUBLIC_ROOT_DOMAIN` + Vercel Pro (wildcard) + wildcard redirect în
  Supabase Auth.

Până atunci, `resolveTenant` și brandingul din `/login` rămân în cod, inerte și inofensive.
