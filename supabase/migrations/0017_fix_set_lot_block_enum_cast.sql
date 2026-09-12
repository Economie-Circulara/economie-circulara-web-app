-- =============================================================================
-- 0017 — FIX: `set_lot_block` esua la RUNTIME (blocarea loturilor nu a functionat
--        niciodata)
-- =============================================================================
-- BUG (descoperit 2026-09-12, prin `supabase/tests/business_flow.sql`):
-- `public.set_lot_block` din `0004_stock_service.sql` insereaza evenimentul de
-- audit cu tipul calculat astfel:
--
--   case when p_blocked then 'block' else 'unblock' end
--
-- Expresia `CASE` forteaza rezolvarea literalilor `unknown` la **text** INAINTE de
-- atribuirea catre coloana, iar `stock_events.event_type` e enum
-- (`public.stock_event_type`) — Postgres NU face cast implicit text -> enum la
-- INSERT. Rezultat:
--
--   ERROR: column "event_type" is of type public.stock_event_type
--          but expression is of type text
--
-- Deci ORICE blocare sau deblocare de lot cadea. (Un literal simplu, ex. 'reversal'
-- in `cancel_order`, functioneaza: rămâne de tip `unknown` si e coercitat in
-- contextul de atribuire. Doar expresiile — CASE/COALESCE — forteaza `text`.)
--
-- DE CE NU A FOST PRINS PANA ACUM: corpul unei functii plpgsql nu e verificat la
-- tip la creare, doar la EXECUTIE. Migrarea se aplica fara eroare, `typecheck`,
-- `lint`, testele unitare (care mock-uiesc RPC-ul) si `pnpm build` trec toate —
-- niciunul nu executa functia pe un Postgres real. Acum e acoperit de testul
-- functional B6 din `supabase/tests/business_flow.sql`.
--
-- IMPACT: „Loturile pot fi blocate cu un motiv => ies din stocul disponibil"
-- (docs/handoff.md, secțiunea Loturi) — functionalitate MVP complet nefunctionala.
--
-- FIX: cast explicit la enum. Functia e recreata IDENTIC in restul corpului
-- (migrari aditive: nu se editeaza `0004_stock_service.sql` — AGENTS.md regula
-- „migrari aditive, numerotate"). Semnatura e neschimbata, deci GRANT-urile
-- existente rămân valabile; le re-aplicam oricum, pentru ca `create or replace`
-- pe o functie existenta pastreaza privilegiile, dar explicitul e mai sigur la
-- re-rulari pe baze noi.
-- =============================================================================

create or replace function public.set_lot_block(
  p_lot_id  uuid,
  p_blocked boolean,
  p_reason  text default null
)
returns public.lots
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lot public.lots;
begin
  if p_blocked and (p_reason is null or btrim(p_reason) = '') then
    raise exception 'Motivul blocarii este obligatoriu.'
      using errcode = 'LT005';
  end if;

  -- RLS (`lots_staff_all`) filtreaza deja randul in afara organizatiei apelantului;
  -- daca update-ul nu afecteaza niciun rand, tratam ca "lot inexistent / fara acces".
  update public.lots
  set is_blocked    = p_blocked,
      block_reason  = case when p_blocked then p_reason else null end
  where id = p_lot_id
  returning * into v_lot;

  if v_lot.id is null then
    raise exception 'Lot inexistent sau fara acces: %', p_lot_id
      using errcode = 'LT002';
  end if;

  insert into public.stock_events (
    organization_id, item_id, lot_id, event_type, quantity, reason, created_by
  )
  values (
    v_lot.organization_id, v_lot.item_id, v_lot.id,
    -- SINGURA modificare fata de 0004: cast explicit la enum.
    (case when p_blocked then 'block' else 'unblock' end)::public.stock_event_type,
    0, p_reason, auth.uid()
  );

  return v_lot;
end;
$$;

revoke all on function public.set_lot_block(uuid, boolean, text) from public;
grant execute on function public.set_lot_block(uuid, boolean, text)
  to authenticated, service_role;
