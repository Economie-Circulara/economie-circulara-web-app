# Fix: cast enum `order_type` in `seed-demo.sql`

**Problema:** `supabase/demo/seed-demo.sql` cade la evenimentul demo #14 cu
`COALESCE types order_type and text cannot be matched`. La insert-ul in `orders`,
`coalesce((j ->> 'tip')::public.order_type, case ... end)` amesteca un enum cu un
`case` ai carui literali sunt rezolvati la `text` (capcana din AGENTS.md 4.2).

**Fix:** `(case when j ? 'ret' then 'serviciu' else 'material' end)::public.order_type`.
Restul expresiilor `case`/`coalesce` din fisier au fost verificate - nu mai scriu
in coloane enum fara cast (`process_status` avea deja cast).

**Verificare:** eroarea reprodusa si fix-ul confirmat pe Postgres 16 (expresie
izolata, enum identic). Seed-ul demo complet nu a fost rulat (fara stack Supabase).

**Asistent (2.4):** `none`.
