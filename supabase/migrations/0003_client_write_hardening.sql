-- =============================================================================
-- T2.0 — Hardening RLS scrieri client (comenzi / order_items)
-- =============================================================================
-- Problema (review 2026-07): politicile `orders_client_all` si
-- `order_items_client_all` din 0001_core_schema.sql sunt `FOR ALL`, conditionate
-- doar de `client_id` / apartenenta comenzii. Tabelele au GRANT pe `authenticated`
-- si sunt expuse prin Data API/PostgREST, deci un user cu rol `client` putea:
--   * schimba `orders.status` direct (ex. sent -> accepted/closed), ocolind
--     server actions (fara scadere de stoc, fara certificat);
--   * edita/sterge `order_items` pe comenzi deja acceptate (cantitati modificate
--     dupa ce stocul a fost deja scazut la acceptare).
--
-- Migrare ADITIVA (0001 e inghetata, nu se modifica). Inlocuieste cele doua
-- politici `FOR ALL` cu politici granulare (select/insert/update/delete) +
-- un trigger BEFORE UPDATE pe `orders` care valideaza explicit tranzitiile de
-- status permise clientului (RLS `USING`/`WITH CHECK` nu poate compara direct
-- OLD vs NEW pe coloane arbitrare din `WITH CHECK`; trigger-ul are acces la
-- ambele si da mesajul de eroare clar).
--
-- Domeniu:
--   * orders SELECT client      -> NESCHIMBAT (vede toate comenzile proprii,
--                                   indiferent de status).
--   * orders INSERT client      -> doar client_id propriu, status in
--                                   ('draft', 'sent').
--   * orders UPDATE client      -> se poate porni editarea doar de pe o comanda
--                                   proprie aflata in draft/sent; rezultatul
--                                   trebuie sa ramana intr-un status permis
--                                   clientului (draft/sent/cancelled) - tranzitia
--                                   exacta OLD -> NEW e validata de trigger:
--                                     draft -> sent
--                                     draft -> cancelled
--                                     sent  -> cancelled
--                                     status neschimbat (editari de alte campuri)
--                                   Orice alta tranzitie (inclusiv spre accepted/
--                                   delivered/closed, sau inapoi sent -> draft)
--                                   e interzisa pentru client.
--   * orders DELETE client      -> doar comenzi `draft`.
--   * order_items SELECT client -> NESCHIMBAT (vede itemii tuturor comenzilor
--                                   proprii, indiferent de status).
--   * order_items I/U/D client  -> doar cat timp comanda parinte e inca
--                                   `draft`/`sent` (dupa acceptare, itemii devin
--                                   read-only pentru client).
--   * staff (admin/operator/super_admin) -> neafectat: politicile `*_staff_all`
--     raman intacte, iar trigger-ul verifica explicit `app.role() = 'client'`
--     (pentru staff/service_role, `app.role()` intoarce alta valoare sau NULL,
--     deci nu intra pe ramura de validare).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Trigger: valideaza tranzitiile de status facute de rolul `client`
-- -----------------------------------------------------------------------------
-- Ruleaza pentru orice UPDATE pe `orders` (staff sau client); pentru staff /
-- service_role (app.role() <> 'client') nu face nimic. E a doua linie de
-- aparare fata de politica RLS de UPDATE de mai jos: RLS restrange deja
-- multimea de statusuri posibile in `WITH CHECK`, dar nu poate exprima usor
-- perechi (status_vechi -> status_nou) permise - triggerul, avand acces la
-- OLD si NEW, face exact asta.
create or replace function app.enforce_client_order_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if app.role() = 'client' then
    if not (
      new.status = old.status
      or (old.status = 'draft' and new.status in ('sent', 'cancelled'))
      or (old.status = 'sent' and new.status = 'cancelled')
    ) then
      raise exception
        'Tranzitie de status interzisa pentru rolul client: % -> % (comanda %)',
        old.status, new.status, old.id
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

grant execute on function app.enforce_client_order_status_transition() to authenticated, service_role;

create trigger orders_client_status_transition
  before update on public.orders
  for each row execute function app.enforce_client_order_status_transition();

-- -----------------------------------------------------------------------------
-- 2. orders — inlocuieste politica FOR ALL cu politici granulare
-- -----------------------------------------------------------------------------
drop policy if exists orders_client_all on public.orders;

-- SELECT: neschimbat fata de politica veche - clientul isi vede toate comenzile
-- proprii, indiferent de status.
create policy orders_client_select on public.orders
  for select using (app.role() = 'client' and client_id = app.client_id());

-- INSERT: doar comenzi proprii, create direct in draft sau sent.
create policy orders_client_insert on public.orders
  for insert with check (
    app.role() = 'client'
    and client_id = app.client_id()
    and status in ('draft', 'sent')
  );

-- UPDATE: randul curent (OLD) trebuie sa fie o comanda proprie draft/sent;
-- rezultatul (NEW) trebuie sa ramana intr-un status permis clientului - tranzitia
-- exacta e validata de trigger-ul de mai sus.
create policy orders_client_update on public.orders
  for update using (
    app.role() = 'client'
    and client_id = app.client_id()
    and status in ('draft', 'sent')
  )
  with check (
    app.role() = 'client'
    and client_id = app.client_id()
    and status in ('draft', 'sent', 'cancelled')
  );

-- DELETE: doar comenzi draft (inca netrimise).
create policy orders_client_delete on public.orders
  for delete using (
    app.role() = 'client'
    and client_id = app.client_id()
    and status = 'draft'
  );

-- -----------------------------------------------------------------------------
-- 3. order_items — inlocuieste politica FOR ALL cu politici granulare
-- -----------------------------------------------------------------------------
drop policy if exists order_items_client_all on public.order_items;

-- SELECT: neschimbat - clientul vede itemii tuturor comenzilor proprii.
create policy order_items_client_select on public.order_items
  for select using (
    app.role() = 'client'
    and exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.client_id = app.client_id()
    )
  );

-- INSERT/UPDATE/DELETE: doar cat timp comanda parinte e inca draft/sent.
create policy order_items_client_insert on public.order_items
  for insert with check (
    app.role() = 'client'
    and exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.client_id = app.client_id()
        and o.status in ('draft', 'sent')
    )
  );

create policy order_items_client_update on public.order_items
  for update using (
    app.role() = 'client'
    and exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.client_id = app.client_id()
        and o.status in ('draft', 'sent')
    )
  )
  with check (
    app.role() = 'client'
    and exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.client_id = app.client_id()
        and o.status in ('draft', 'sent')
    )
  );

create policy order_items_client_delete on public.order_items
  for delete using (
    app.role() = 'client'
    and exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.client_id = app.client_id()
        and o.status in ('draft', 'sent')
    )
  );
