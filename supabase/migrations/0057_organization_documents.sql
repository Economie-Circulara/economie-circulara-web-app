-- =============================================================================
-- 0057 - Documente generale ale organizatiei (declaratii de conformitate)
-- =============================================================================
-- Decizie 2026-10-08 (intalnirea cu Macon XCX, docs/plans/macon-documente-comanda.md):
-- documentul de calitate al organizatiei e declaratia de conformitate, pe care o
-- INCARCA ea (PDF), generic, nu per comanda. Apare in sectiunea „Documente” a
-- fiecarei comenzi si in /documente, pentru toti clientii organizatiei.
--
-- Model: acelasi tabel `documents`, cu `owner_type = 'organization'` si
-- `owner_id = organization_id` (impus de CHECK). Staff-ul le vede deja prin
-- `documents_staff_all`; clientii organizatiei primesc drept de CITIRE. Incarcarea si
-- stergerea le face doar adminul - verificat in `documents/service.ts` (upload-ul
-- trece prin clientul admin, ca la restul documentelor, migrarea 0006).
--
-- `owner_type::text` in CHECK si in politica: o valoare noua de enum nu poate fi
-- folosita ca literal in aceeasi tranzactie in care a fost adaugata.
-- =============================================================================

alter type public.document_owner_type add value if not exists 'organization';

alter table public.documents
  add constraint documents_organization_owner_check
  check (owner_type::text <> 'organization' or owner_id = organization_id);

drop policy documents_client_select on public.documents;
create policy documents_client_select on public.documents
  for select using (
    app.role() = 'client'
    and organization_id = app.org_id()
    and app.org_is_active(organization_id)
    and (
      (owner_type = 'client' and owner_id = app.client_id())
      or (owner_type = 'order' and exists (
            select 1 from public.orders o
            where o.id = documents.owner_id and o.client_id = app.client_id()))
      or (owner_type = 'item' and exists (
            select 1 from public.items i
            where i.id = documents.owner_id and i.sellable = true))
      -- Documentele generale ale organizatiei (declaratii de conformitate): orice
      -- client al ei. `organization_id = app.org_id()` de mai sus izoleaza tenantul.
      or (owner_type::text = 'organization' and owner_id = organization_id)
    )
  );
