-- =============================================================================
-- 0055 - Fisa de trasabilitate: prefixul numerelor noi devine `TRS-`
-- =============================================================================
-- Decizie 2026-10-08 (intalnirea cu Macon XCX, docs/plans/macon-documente-comanda.md):
-- documentul generat la inchiderea comenzii se numeste „Fisa de trasabilitate”, nu
-- „certificat” - un producator fara certificare nu poate emite certificat de calitate,
-- iar documentul lui de calitate e declaratia de conformitate (incarcata separat).
--
-- Se schimba DOAR formatul numerelor NOI: `TRS-<an>-<seq>`, pe acelasi contor
-- (`certificate_counters`), deci secventa continua. Numerele `CRT-` emise deja raman
-- neschimbate - sunt inghetate in PDF-urile trimise clientilor. Unicitatea
-- (organization_id, number) nu poate fi incalcata: prefixele difera.
-- =============================================================================

create or replace function public.generate_certificate_number(p_org uuid)
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
    raise exception 'Organizatia este obligatorie pentru generarea numarului fisei de trasabilitate.'
      using errcode = 'CT001';
  end if;

  -- RLS (`certificate_counters_staff_all`) impune `app.is_staff_of(p_org)`.
  insert into public.certificate_counters (organization_id, year, seq, updated_at)
  values (p_org, v_year, 1, now())
  on conflict (organization_id, year)
  do update set seq = public.certificate_counters.seq + 1, updated_at = now()
  returning seq into v_seq;

  return format('TRS-%s-%s', v_year, lpad(v_seq::text, 4, '0'));
end;
$$;
