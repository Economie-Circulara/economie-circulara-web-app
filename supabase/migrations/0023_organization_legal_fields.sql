-- =============================================================================
-- Date de identificare fiscala pe organizatie - obligatorii pe certificat
-- =============================================================================
-- Migrare aditiva (NU modifica nimic existent). Gap semnalat in
-- docs/analiza-conformitate-anexa.md (Prioritate 1, certificat, spike S2):
-- `organizations` nu avea CUI/Reg. Com./adresa, deci certificatul de trasabilitate
-- nu putea afisa datele emitentului - un certificat fara CUI-ul emitentului nu
-- e utilizabil comercial.
--
-- Toate 3 coloane NULLABLE si FARA validare de format (la fel ca `clients.cui`,
-- vezi 0001_core_schema.sql - "fara validare stricta de format la creare
-- manuala"): organizatiile existente (demo, clientii deja provizionati) nu au
-- aceste date si nu trebuie sa fie blocate pana le completeaza din Setari.
--
-- O singura adresa (spre deosebire de `clients`/`client_addresses`, care au mai
-- multe adrese de livrare per client): o organizatie are un singur sediu social,
-- de-asta coloana se numeste simplu `address`, nu `hq_address`.
-- =============================================================================

alter table public.organizations
  add column cui     text,
  add column reg_com text,
  add column address text;
