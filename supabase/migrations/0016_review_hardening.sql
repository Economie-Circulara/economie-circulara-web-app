-- =============================================================================
-- 0016 — Hardening din review-ul tehnic (orchestrator, 2026-07-19)
-- =============================================================================
-- Inchide doua gap-uri semnalate de subagentii care au rezolvat findings-urile
-- de review (F1 si F7a), pe zone care nu incapeau in scope-ul lor:
--
--   1. `order_links_client_insert` (introdusa in 0010_returns.sql, DUPA guard-ul
--      0012) nu cere `app.org_is_active` — un client al unei organizatii
--      SUSPENDATE putea inca crea legaturi de retur/garantie prin Data API.
--      Completeaza guard-ul de organizatie suspendata (T2.1 / 0012 / 0014).
--   2. `profiles.client_id` nu avea unicitate la nivel de DB — regula de business
--      "un client = un singur utilizator" (AGENTS.md §4) era impusa doar in
--      aplicatie (`inviteClientAction`, cu o fereastra teoretica de race la doua
--      invitatii simultane). Adaugam un index unic PARTIAL.
--
-- Migrare ADITIVA (nu editeaza migrari existente).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. order_links: clientul nu mai poate crea legaturi cat timp org e suspendata.
-- -----------------------------------------------------------------------------
-- Aceeasi conditie `app.org_is_active(organization_id)` ca la celelalte scrieri
-- de client guardate in 0012/0014. Restul conditiilor raman identice cu 0010.
drop policy order_links_client_insert on public.order_links;
create policy order_links_client_insert on public.order_links
  for insert with check (
    app.role() = 'client'
    and organization_id = app.org_id()
    and app.org_is_active(organization_id)
    and exists (
      select 1 from public.orders o
      where o.id = order_links.original_order_id and o.client_id = app.client_id()
    )
    and exists (
      select 1 from public.orders o
      where o.id = order_links.linked_order_id and o.client_id = app.client_id()
    )
  );

-- -----------------------------------------------------------------------------
-- 2. Un client = un singur utilizator, impus la nivel de DB.
-- -----------------------------------------------------------------------------
-- Index unic PARTIAL: doar randurile cu `client_id` non-null (rolurile
-- non-client au client_id null si nu trebuie sa se ciocneasca). Inlocuieste
-- enforcement-ul pur de aplicatie din `inviteClientAction` (elimina fereastra de
-- race la invitatii simultane pe aceeasi firma). Indexul neunic
-- `profiles_client_id_idx` din 0001 ramane (nu strica, dar cel unic il face
-- redundant pe cautarile after client_id; lasat pentru compatibilitate).
create unique index if not exists profiles_client_id_unique
  on public.profiles (client_id)
  where client_id is not null;
