-- =============================================================================
-- Upload logo organizatie: bucket PUBLIC de storage
-- =============================================================================
-- Migrare aditiva: creeaza bucket-ul PUBLIC `org-logos` in Supabase Storage.
-- Public (spre deosebire de `documents`, privat - vezi 0006_documents_storage.sql)
-- pentru ca logo-ul e randat direct de browser cu `<img src>` in sidebar (fara
-- URL semnat, fara request suplimentar catre server pe fiecare afisare).
--
-- La fel ca la `documents`: FARA politici pe `storage.objects` - upload/delete
-- trece exclusiv prin server actions care folosesc clientul admin (service-role,
-- vezi src/features/settings/actions.ts), cu autorizarea facuta acolo
-- (`requireRole(["admin"])`). Un bucket public nu are nevoie de politica SELECT
-- pentru citire (Storage serveste obiectele publice direct, fara RLS).
--
-- Fiecare organizatie are UN SINGUR obiect, la path fix `${organizationId}/logo`
-- (upsert la reincarcare) - evita fisiere orfane la inlocuirea logo-ului.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do nothing;
