-- =============================================================================
-- Task A — Modul documente: bucket privat de storage
-- =============================================================================
-- Migrare aditiva: creeaza bucket-ul PRIVAT `documents` in Supabase Storage.
-- Tabelul `documents` (metadate) exista deja din 0001_core_schema.sql, cu RLS
-- proprie (staff din organizatie + clientul, pe randurile lui). Acest bucket NU
-- primeste politici pe `storage.objects` — ramane inaccesibil direct oricarui rol
-- autentificat (fara politici pe `storage.objects` = deny implicit din RLS). TOT
-- accesul (upload/download/delete) trece prin server actions care folosesc
-- clientul administrativ (service-role, vezi src/lib/supabase/admin.ts):
--   * `uploadDocument` (src/features/documents/service.ts) verifica intai, prin
--     clientul utilizatorului curent (RLS), ca entitatea owner (client/order/item)
--     exista si e accesibila, apoi incarca fisierul SI insereaza randul
--     `documents` folosind clientul admin.
--   * `getDownloadUrl` verifica RLS pe randul `documents` (select cu clientul
--     userului), apoi semneaza un URL temporar cu clientul admin.
--   * `deleteDocument` e restrictionat la staff (`requireRole`) la nivel de
--     server action.
--
-- Alegere deliberata fata de varianta alternativa (politici pe storage.objects
-- bazate pe path `org_id/owner_type/owner_id/...`): am evitat sa duplicam logica
-- de autorizare in doua locuri (RLS pe tabelul `documents` + RLS pe
-- `storage.objects`) pentru un bucket care oricum nu e citit niciodata direct din
-- client (Data API storage) — doar prin server actions, deci un singur punct de
-- control (server-side) e suficient si mai usor de auditat.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
