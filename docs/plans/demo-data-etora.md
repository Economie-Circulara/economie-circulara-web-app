# Plan: date demo pentru Etora

## Context

Demo cu clientul Etora, organizația nu are date. Datele Macon sunt reale (clienți, loturi) și
nu se copiază între tenanți (izolare/confidențialitate) - refolosim generatorul de demo
existent (`supabase/demo/seed-demo.sql`), care rulează prin RPC-urile reale.

## Pași

1. Seed parametrizat: placeholder-e `__ORG_SLUG__`, `__ORG_NAME__`, `__DEMO_DOMAIN__`.
2. Mod „organizație existentă”: dacă slug-ul există și organizația e complet goală, seed-ul o
   refolosește (nu mai inserează organizația, nu creează `super_admin`); altfel refuză.
3. `export-demo-data.sql` parametrizat pe slug; README cu rețeta Etora și avertismentul de teardown.

## Impact asistent AI (regula 2.4)

Decizia: `none` - script operațional, fără funcționalitate nouă în aplicație.

## Teste

Fără cod de aplicație nou; scriptul SQL nu are test unitar (rulează pe Postgres real,
vezi `supabase/demo/README.md`). Nevalidat local: mediul nu are acces la imaginile Supabase.
