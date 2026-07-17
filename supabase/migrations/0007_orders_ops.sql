-- =============================================================================
-- Task E — Comenzi: numar de comanda + masina de stari (acceptare / anulare)
-- =============================================================================
-- Migrare aditiva peste schema inghetata din 0001_core_schema.sql. Nu modifica
-- tabele/enum-uri existente — adauga:
--
--   public.order_counters       -> tabel contor, un rand per (organizatie, an)
--   public.generate_order_number(p_org uuid) -> numar de comanda secvential
--   public.accept_order(p_order_id uuid)     -> sent -> accepted, scade stocul
--   public.cancel_order(p_order_id uuid)     -> draft/sent/accepted -> cancelled,
--                                                reface stocul daca era accepted
--
-- Coduri de eroare (in stilul LT00x din 0004_stock_service.sql):
--   OR001 - tranzitie de status invalida
--   OR002 - comanda inexistenta sau fara acces (RLS)
--   OR004 - permisiune insuficienta (operatiune rezervata staff-ului)
--   OR005 - argument obligatoriu lipsa
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. order_counters — contor de numerotare, un rand per (organizatie, an)
-- -----------------------------------------------------------------------------
-- Alegere: tabel contor cu cheie (organization_id, year) + `INSERT ... ON CONFLICT
-- DO UPDATE ... RETURNING`, in loc de a parsa `max(order_number)` din `orders`.
-- Motivatie:
--   * Siguranta la concurenta: `INSERT ... ON CONFLICT DO UPDATE` obtine automat un
--     lock la nivel de rand pe intrarea (organization_id, year) inainte de a intoarce
--     valoarea noua -> doua tranzactii concurente care trimit comenzi in aceeasi
--     organizatie/an sunt serializate de Postgres pe acel rand (a doua asteapta
--     lock-ul primei), fara sa fie nevoie de `LOCK TABLE`/`advisory lock` explicit.
--     Parsarea `max(order_number)` ar avea nevoie de `SELECT ... FOR UPDATE` pe un
--     set de randuri variabil (mult mai greu de facut corect si eficient).
--   * Reset anual natural (seq reincepe de la 1 pe an) + numar lizibil, in stilul
--     "CMD-2026-0001" (varianta ilustrativa din mockup, "CMD-2048", e doar un id
--     scurt fara semnificatie de an — am preferat formatul cu an pentru claritate
--     pe termen lung, fara ambiguitate intre organizatii/ani).
--   * Trade-off acceptat: la un rollback dupa ce numarul a fost generat (ex.
--     `orders` UPDATE-ul care seteaza `order_number`/`status='sent'` esueaza dupa
--     apelul catre `generate_order_number`), secventa "sare" un numar. E acceptabil
--     (comun la orice generator de secventa) — numerele raman unice, doar nu
--     perfect contigue.
create table public.order_counters (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  year            integer not null,
  seq             integer not null default 0,
  updated_at      timestamptz not null default now(),
  primary key (organization_id, year)
);

alter table public.order_counters enable row level security;

-- Atat staff-ul cat si clientul pot declansa generarea unui numar (clientul isi
-- poate trimite singur comanda proprie draft -> sent, vezi 0003_client_write_hardening).
-- `app.org_id()` e definita pentru ambele roluri (citeste `profiles.organization_id`).
create policy order_counters_org_all on public.order_counters
  for all using (organization_id = app.org_id())
  with check (organization_id = app.org_id());

grant select, insert, update on public.order_counters to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. generate_order_number — numar de comanda secvential per (organizatie, an)
-- -----------------------------------------------------------------------------
create or replace function public.generate_order_number(p_org uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_year integer := extract(year from now())::integer;
  v_seq  integer;
begin
  if p_org is null then
    raise exception 'Organizatia este obligatorie pentru generarea numarului de comanda.'
      using errcode = 'OR005';
  end if;

  -- RLS (`order_counters_org_all`) impune `organization_id = app.org_id()`: un
  -- apelant care incearca sa genereze un numar pentru alta organizatie primeste o
  -- violare de politica (insufficient_privilege), nu un numar strain.
  insert into public.order_counters (organization_id, year, seq, updated_at)
  values (p_org, v_year, 1, now())
  on conflict (organization_id, year)
  do update set seq = public.order_counters.seq + 1, updated_at = now()
  returning seq into v_seq;

  return format('CMD-%s-%s', v_year, lpad(v_seq::text, 4, '0'));
end;
$$;

revoke all on function public.generate_order_number(uuid) from public;
grant execute on function public.generate_order_number(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. accept_order — sent -> accepted, consuma stocul FIFO pentru fiecare linie
-- -----------------------------------------------------------------------------
-- SECURITY INVOKER (ca si RPC-urile din 0004): ruleaza in tranzactia (implicita) a
-- apelului, deci orice eroare (tranzitie invalida, stoc insuficient LT001 din
-- `consume_fifo`) face ROLLBACK complet — nu ramane niciun consum partial, iar
-- comanda ramane `sent`. RLS ramane in vigoare (`orders_staff_all`,
-- `stock_events_staff_insert`, `lots_staff_all`) evaluata cu identitatea apelantului.
create or replace function public.accept_order(p_order_id uuid)
returns public.orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders;
  v_item  record;
begin
  -- FOR UPDATE: blocheaza randul comenzii pana la commit, ca sa nu se suprapuna cu
  -- o alta tranzitie concurenta (ex. o a doua acceptare sau o anulare simultana).
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Comanda inexistenta sau fara acces: %', p_order_id
      using errcode = 'OR002';
  end if;

  if not app.is_staff_of(v_order.organization_id) then
    raise exception 'Nu ai permisiunea de a accepta aceasta comanda.'
      using errcode = 'OR004';
  end if;

  if v_order.status <> 'sent' then
    raise exception 'Comanda % nu poate fi acceptata din statusul % (trebuie sa fie "sent").',
      p_order_id, v_order.status
      using errcode = 'OR001';
  end if;

  -- FOR UPDATE pe order_items: blocheaza liniile comenzii pe durata acceptarii, ca
  -- sa nu poata fi editate concurent (RLS le-ar permite editarea clientului cat timp
  -- statusul e inca 'sent', pana la UPDATE-ul final de mai jos).
  for v_item in
    select item_id, quantity
    from public.order_items
    where order_id = p_order_id
    for update
  loop
    -- Consum FIFO atomic (vezi 0004_stock_service.sql). O eroare aici (ex. LT001 -
    -- stoc insuficient) opreste bucla si propaga exceptia -> toata functia (si
    -- consumurile deja facute in aceasta bucla) fac rollback.
    perform public.consume_fifo(
      p_item_id        => v_item.item_id,
      p_qty            => v_item.quantity,
      p_manual_lot_ids => null,
      p_event_type     => 'consumption',
      p_order_id       => p_order_id,
      p_process_id     => null,
      p_reason         => 'Acceptare comanda ' || coalesce(v_order.order_number, p_order_id::text)
    );
  end loop;

  update public.orders set status = 'accepted' where id = p_order_id returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.accept_order(uuid) from public;
grant execute on function public.accept_order(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. cancel_order — draft/sent/accepted -> cancelled; reface stocul daca era accepted
-- -----------------------------------------------------------------------------
-- Anularea unei comenzi `draft`/`sent` e o simpla schimbare de status (nu s-a scazut
-- inca stoc). Anularea unei comenzi `accepted` trebuie sa refaca stocul consumat la
-- acceptare — parcurge `stock_events` de tip 'consumption' scrise pentru aceasta
-- comanda (create de `accept_order`/`consume_fifo`) si, pentru fiecare, readauga
-- cantitatea in lotul respectiv (`remaining_qty += qty`) + scrie un `stock_event`
-- 'reversal' de audit (cantitate pozitiva, acelasi lot). Atomic: orice eroare (ex.
-- constraintul `lots_remaining_lte_initial`, foarte improbabil in flux normal) face
-- rollback complet, comanda ramane `accepted`.
create or replace function public.cancel_order(p_order_id uuid)
returns public.orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders;
  v_event record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Comanda inexistenta sau fara acces: %', p_order_id
      using errcode = 'OR002';
  end if;

  if v_order.status not in ('draft', 'sent', 'accepted') then
    raise exception 'Comanda % nu poate fi anulata din statusul %.', p_order_id, v_order.status
      using errcode = 'OR001';
  end if;

  if v_order.status = 'accepted' then
    -- Refacerea stocului e o operatiune interna (miscare de stoc) — rezervata
    -- staff-ului, la fel ca restul RPC-urilor din stock service. Clientul poate
    -- anula direct (fara aceasta functie) doar cat comanda e draft/sent, conform
    -- politicilor din 0003_client_write_hardening.sql; o comanda `accepted` nu mai
    -- e in acel domeniu, deci ajunge aici doar prin actiunea explicita a staff-ului.
    if not app.is_staff_of(v_order.organization_id) then
      raise exception 'Doar personalul poate anula o comanda deja acceptata (necesita refacere stoc).'
        using errcode = 'OR004';
    end if;

    for v_event in
      select id, item_id, lot_id, quantity
      from public.stock_events
      where order_id = p_order_id
        and event_type = 'consumption'
        and lot_id is not null
      for update
    loop
      update public.lots
      set remaining_qty = remaining_qty + abs(v_event.quantity)
      where id = v_event.lot_id;

      insert into public.stock_events (
        organization_id, item_id, lot_id, event_type, quantity, reason, order_id, created_by
      )
      values (
        v_order.organization_id, v_event.item_id, v_event.lot_id, 'reversal',
        abs(v_event.quantity),
        'Anulare comanda ' || coalesce(v_order.order_number, p_order_id::text),
        p_order_id, auth.uid()
      );
    end loop;
  end if;

  update public.orders set status = 'cancelled' where id = p_order_id returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.cancel_order(uuid) from public;
grant execute on function public.cancel_order(uuid) to authenticated, service_role;
