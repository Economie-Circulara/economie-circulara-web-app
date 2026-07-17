-- =============================================================================
-- Task D — Productie & Reciclare: recondiționare (provenienta noua) + RPC finalizare
-- =============================================================================
-- Migrare aditiva peste schema inghetata din 0001_core_schema.sql si peste Task C
-- (0004_stock_service.sql). NU modifica migrari existente.
--
-- -----------------------------------------------------------------------------
-- NOTA IMPORTANTA — de ce ambele bucati sunt in ACEEASI migrare/tranzactie
-- -----------------------------------------------------------------------------
-- `ALTER TYPE ... ADD VALUE` este permis in Postgres 15 chiar si intr-o migrare
-- transactionala (aplicata implicit intr-o singura tranzactie de `psql -f`),
-- ATATA TIMP CAT valoarea noua NU e FOLOSITA (nu apare ca literal/constanta
-- evaluata) in ACEEASI tranzactie — altfel Postgres arunca:
--   "unsafe use of new value of enum type" (eroare la commit).
--
-- Functia `confirm_process` de mai jos primeste un parametru de tip
-- `public.lot_provenance` (tipul enum, extins mai jos cu 'reconditioning'), dar
-- NU foloseste literalul 'reconditioning' nicaieri in corpul ei — valoarea vine
-- runtime, din `p_outputs` (jsonb), la un apel ULTERIOR, intr-o cu totul alta
-- tranzactie (cea a cererii HTTP care porneste efectiv un proces de
-- recondiționare). A crea o functie al carei parametru e DOAR tipizat cu enum-ul
-- extins nu "foloseste" noua valoare in sensul restrictiei Postgres — doar
-- OID-ul tipului conteaza la compilarea functiei, nu lista de labeluri.
--
-- Daca la un moment viitor s-ar adauga in ACEASTA migrare un DEFAULT, un CHECK,
-- un INSERT/SEED sau orice expresie care scrie explicit 'reconditioning'::lot_provenance,
-- acea bucata TREBUIE mutata intr-o migrare separata (ex. 0009), aplicata dupa ce
-- 0008 a fost deja comisa. Pana atunci, un singur fisier e sigur si suficient.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Provenienta noua de lot: 'reconditioning' (recondiționare)
-- -----------------------------------------------------------------------------
-- Distincta de 'recycling' (reciclare) — cerinta Anexa 1 d / AGENTS.md §4: un
-- proces de recondiționare (ex. sortare/curatare/reambalare a unor loturi
-- existente, fara reteta de descompunere in fractii noi) trebuie sa apara
-- SEPARAT de reciclare in trasabilitate si rapoarte, nu confundat cu ea.
alter type public.lot_provenance add value 'reconditioning';

-- -----------------------------------------------------------------------------
-- 2. confirm_process — pornire + finalizare atomica a unui proces de
--    productie/reciclare/recondiționare (Task D, fluxurile 4a si 4b)
-- -----------------------------------------------------------------------------
-- Creeaza randul `processes` + consuma inputurile (FIFO sau selectie manuala,
-- prin `public.consume_fifo`, deja definit in 0004) + creeaza loturile de output
-- (prin `public.create_lot`, 0004) + scrie `process_inputs`/`process_outputs`
-- pentru trasabilitate — TOTUL intr-un singur apel, deci o singura tranzactie
-- (funcțiile apelate din corp ruleaza in tranzactia apelantului, nu isi
-- deschid una noua). Daca stocul e insuficient (LT001 din consume_fifo) sau
-- orice alt pas esueaza, INTREG apelul face rollback — nu ramane niciun proces
-- "orfan" fara input/output (consistent cu "fara productie partiala", AGENTS.md §4).
--
-- p_inputs  — jsonb array: [{"item_id": uuid, "lot_ids": uuid[], "qty": numeric}, ...]
--             cate un rand per item consumat; `lot_ids` = loturile alese la preview
--             (FIFO calculat de `planFifoConsumption` pt. 4a, sau selectie manuala
--             pt. 4b) — trimise explicit ca sa oglindeasca exact ce a vazut
--             utilizatorul, indiferent daca a fost FIFO automat sau ales manual.
-- p_outputs — jsonb array: [{"item_id": uuid, "qty": numeric,
--             "provenance": lot_provenance, "source": text|null,
--             "location": text|null, "quality_status": quality_status|null}, ...]
--             cate un rand per lot nou creat (un singur output la 4a; unul sau
--             mai multe la 4b — fractiile editate de utilizator).
--
-- SECURITY INVOKER (ca toate RPC-urile din 0004): RLS ramane in vigoare pe
-- fiecare INSERT/UPDATE din corp, evaluata cu identitatea apelantului;
-- `app.is_staff_of` e doar pentru un mesaj de eroare clar (RLS ar respinge
-- oricum, dar cu o eroare generica).
create or replace function public.confirm_process(
  p_type           public.process_type,
  p_output_item_id uuid,
  p_recipe_id      uuid default null,
  p_notes          text default null,
  p_inputs         jsonb default '[]'::jsonb,
  p_outputs        jsonb default '[]'::jsonb
)
returns public.processes
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org       uuid;
  v_process   public.processes;
  v_input     record;
  v_consumed  record;
  v_output    record;
  v_lot       public.lots;
begin
  select organization_id into v_org from public.items where id = p_output_item_id;
  if v_org is null then
    raise exception 'Item de output inexistent: %', p_output_item_id
      using errcode = 'LT003';
  end if;

  if not app.is_staff_of(v_org) then
    raise exception 'Nu ai permisiunea de a porni un proces pentru aceasta organizatie.'
      using errcode = 'LT004';
  end if;

  if p_inputs is null or jsonb_typeof(p_inputs) <> 'array' or jsonb_array_length(p_inputs) = 0 then
    raise exception 'Procesul trebuie sa aiba cel putin un input.'
      using errcode = 'LT005';
  end if;

  if p_outputs is null or jsonb_typeof(p_outputs) <> 'array' or jsonb_array_length(p_outputs) = 0 then
    raise exception 'Procesul trebuie sa aiba cel putin un output.'
      using errcode = 'LT005';
  end if;

  -- 2.1 Randul de proces — pornit si finalizat in aceeasi tranzactie (fara
  -- productie partiala: fie totul reuseste, fie nimic nu se persista).
  insert into public.processes (
    organization_id, type, status, output_item_id, recipe_id, notes,
    started_at, completed_at, created_by
  )
  values (
    v_org, p_type, 'completed', p_output_item_id, p_recipe_id, p_notes,
    now(), now(), auth.uid()
  )
  returning * into v_process;

  -- 2.2 Inputuri — consum FIFO/manual per item (poate implica mai multe loturi).
  for v_input in
    select * from jsonb_to_recordset(p_inputs) as x(item_id uuid, lot_ids uuid[], qty numeric)
  loop
    if v_input.item_id is null or v_input.qty is null or v_input.qty <= 0 then
      raise exception 'Input invalid in procesul %: item/cantitate lipsa.', v_process.id
        using errcode = 'LT005';
    end if;

    for v_consumed in
      select * from public.consume_fifo(
        p_item_id        => v_input.item_id,
        p_qty            => v_input.qty,
        p_manual_lot_ids => v_input.lot_ids,
        p_event_type     => 'consumption',
        p_process_id     => v_process.id
      )
    loop
      insert into public.process_inputs (organization_id, process_id, lot_id, item_id, quantity)
      values (v_org, v_process.id, v_consumed.lot_id, v_input.item_id, v_consumed.qty);
    end loop;
  end loop;

  -- 2.3 Outputuri — un lot nou per rand (provenance: internal_production /
  -- recycling / reconditioning, ales de utilizator — vezi src/features/production).
  for v_output in
    select * from jsonb_to_recordset(p_outputs) as x(
      item_id uuid,
      qty numeric,
      provenance public.lot_provenance,
      source text,
      location text,
      quality_status public.quality_status
    )
  loop
    if v_output.item_id is null or v_output.qty is null or v_output.qty <= 0 then
      raise exception 'Output invalid in procesul %: item/cantitate lipsa.', v_process.id
        using errcode = 'LT005';
    end if;

    select * into v_lot from public.create_lot(
      p_item_id        => v_output.item_id,
      p_quantity       => v_output.qty,
      p_provenance     => v_output.provenance,
      p_source         => coalesce(v_output.source, 'Proces ' || v_process.id::text),
      p_location       => v_output.location,
      p_quality_status => v_output.quality_status
    );

    insert into public.process_outputs (organization_id, process_id, lot_id, item_id, quantity)
    values (v_org, v_process.id, v_lot.id, v_output.item_id, v_output.qty);
  end loop;

  return v_process;
end;
$$;

revoke all on function public.confirm_process(
  public.process_type, uuid, uuid, text, jsonb, jsonb
) from public;
grant execute on function public.confirm_process(
  public.process_type, uuid, uuid, text, jsonb, jsonb
) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. cancel_process — anulare proces neinceput/nefinalizat (nicio miscare de stoc)
-- -----------------------------------------------------------------------------
-- `confirm_process` de mai sus e singurul mod curent de a crea un proces, si
-- creeaza direct un proces 'completed' (atomic, vezi nota de mai sus) — deci in
-- fluxul actual nu ramane niciodata un proces "in asteptare" de anulat. Functia
-- exista totusi ca sa acopere masina de stari completa a `process_status`
-- (planned/in_progress/awaiting_confirmation -> cancelled), pt. procese create
-- pe alte cai (viitoare planificare, interventie manuala) — vezi
-- src/features/production/service.ts#cancelProcess.
create or replace function public.cancel_process(p_process_id uuid)
returns public.processes
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_process public.processes;
begin
  update public.processes
  set status = 'cancelled'
  where id = p_process_id
    and status in ('planned', 'in_progress', 'awaiting_confirmation')
  returning * into v_process;

  if v_process.id is null then
    raise exception 'Proces inexistent, fara acces, sau deja finalizat/anulat: %', p_process_id
      using errcode = 'LT002';
  end if;

  return v_process;
end;
$$;

revoke all on function public.cancel_process(uuid) from public;
grant execute on function public.cancel_process(uuid) to authenticated, service_role;
