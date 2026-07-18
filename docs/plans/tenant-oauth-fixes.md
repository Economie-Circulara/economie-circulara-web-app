# Plan — PR 3 remediere: tenant pe request, segmente rezervate, OAuth neprovizionat, showcase

Task mic de remediere (3 fix-uri de securitate/corectitudine + 1 fix minor), descris
integral in prompt-ul agentului. Plan pastrat ca referinta conform AGENTS.md §1.1.

## 1. Tenant propagat pe response headers in loc de request headers

`src/lib/supabase/middleware.ts` seta `x-tenant-slug` / `x-tenant-domain` pe
`supabaseResponse.headers`, care ajung doar la browser — server components si route
handlers nu le vad niciodata. Fix: rezolva tenantul **inainte** de a crea raspunsul,
propaga-l pe **request headers** (`NextResponse.next({ request: { headers } })`),
pastrand exact pattern-ul de cookie-uri din `@supabase/ssr` (recreare `supabaseResponse`
in `setAll`, fara logica intre `createServerClient` si `getUser()`). Numele headerelor
devin constante exportate din `src/features/auth/tenant.ts`.

## 2. Segmente rezervate incomplete

`RESERVED_PATH_SEGMENTS` din `tenant.ts` nu includea rutele reale ale aplicatiei
(`dashboard`, `portal`, `platform`, `showcase`, `set-password`, `forgot-password`), deci
`/dashboard` ar fi fost interpretat ca tenant `slug="dashboard"` in rezolvarea pe path.
Fix: adauga segmentele lipsa + teste.

## 3. Useri OAuth fara profil (provizionare ocolita)

`signInWithGoogleAction` foloseste `signInWithOAuth`, care — spre deosebire de magic link
(`shouldCreateUser: false`) — poate crea un rand nou in `auth.users` FARA profil in
`public.profiles`, daca sign-up-ul public nu e dezactivat din dashboard-ul Supabase.

- `src/app/auth/callback/route.ts`: dupa `exchangeCodeForSession` reusit, verifica daca
  userul are profil; daca nu, `signOut()` + redirect `/login?error=unprovisioned`. Fluxul
  de resetare parola (`next=/set-password`) nu are nevoie de exceptie: userul respectiv a
  fost deja invitat (are profil).
- `src/features/auth/login-form.tsx` + `src/app/(auth)/login/page.tsx`: afiseaza un mesaj
  clar in romana pentru `error=unprovisioned` (si, aditional, pentru `error=auth` /
  `error=oauth`, care erau setate dar niciodata afisate).
- `docs/setup.md`: pas obligatoriu — dezactivarea sign-up-ului public din dashboard-ul
  Supabase (Authentication → Sign In / Up).

## 4. `/showcase` public in productie

`src/app/showcase/page.tsx` ramane in `PUBLIC_PREFIXES` (necesar in dev), dar apeleaza
`notFound()` cand `process.env.NODE_ENV === "production"`.

## Criterii de acceptare

- `pnpm typecheck && pnpm lint && pnpm test` verzi.
- Teste noi/extinse: `tenant.test.ts` (segmente noi), `middleware.test.ts` (nou — headere
  pe request, nu pe response), `auth/callback/route.test.ts` (nou — gating profil),
  `login-form.test.tsx` (nou — mesaje de eroare).
- Build de productie verificat manual: `/showcase` -> 404 cu `NODE_ENV=production`.
