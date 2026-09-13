-- =============================================================================
-- Poze item: bucket PUBLIC de storage
-- =============================================================================
-- Migrare aditiva: creeaza bucket-ul PUBLIC `item-images` in Supabase Storage,
-- inlocuind input-ul text "URL poza" cu upload real de fisier (src/features/items).
-- Public (la fel ca `org-logos`, vezi 0019_organization_logos_storage.sql) pentru
-- ca poza e randata direct de browser cu `<img src>` (in tabelul /itemi si in
-- catalogul clientului), fara URL semnat.
--
-- FARA politici pe `storage.objects` - upload/delete trece exclusiv prin server
-- actions care folosesc clientul admin (service-role, vezi
-- src/features/items/actions.ts), cu autorizarea facuta acolo
-- (`requireRole(["admin", "operator"])`).
--
-- Fiecare item are UN SINGUR obiect, la path fix `${itemId}/image` (upsert la
-- reincarcare) - evita fisiere orfane la inlocuirea pozei.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do nothing;
