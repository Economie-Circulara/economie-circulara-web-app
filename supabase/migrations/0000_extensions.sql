-- Migrare de baza (T0.3): extensii folosite transversal in proiect.
-- Schema de business completa (organizatii, clienti, stoc, comenzi etc.) se adauga in
-- T1.1 ca migrare separata, conform planului de implementare.

-- gen_random_uuid() + functii criptografice
create extension if not exists pgcrypto with schema extensions;

-- cautare fuzzy / trigram (folosita ulterior de cautarea globala - Task X2)
create extension if not exists pg_trgm with schema extensions;
