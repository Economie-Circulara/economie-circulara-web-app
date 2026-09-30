-- =============================================================================
-- Clienti persoana fizica (plan docs/plans/clienti-persoana-fizica.md)
-- =============================================================================
-- Pana acum un client era mereu o firma (CUI obligatoriu, 0001). Organizatia poate
-- lucra acum si cu persoane fizice: nume + CNP obligatorii (facturare), restul
-- fluxului identic (email -> invitatie in portal, adrese, comenzi, certificate).
--
--   - `client_type`: `juridica` (implicit - backfill pentru toti clientii existenti)
--     sau `fizica`;
--   - `cnp`: doar pentru persoane fizice, unic per organizatie (ca CUI-ul);
--   - `cui` devine nullable - o persoana fizica nu are CUI.
--
-- CNP-ul e data personala: aplicatia il afiseaza DOAR staff-ului, pe pagina
-- clientului. RLS-ul pe `clients` ramane neschimbat (staff-ul organizatiei + clientul
-- propriu), deci nu apar cai noi de acces.
-- =============================================================================

alter table public.clients
  add column client_type text not null default 'juridica',
  add column cnp text,
  alter column cui drop not null;

alter table public.clients
  add constraint clients_client_type_check
    check (client_type in ('juridica', 'fizica')),
  -- Identificatorul fiscal corespunde tipului; o persoana fizica nu are campurile
  -- de firma (reg. com., platitor de TVA). `cnp is not null` e explicit: un regex pe
  -- NULL da NULL, iar un CHECK care da NULL TRECE.
  add constraint clients_identity_check
    check (
      (client_type = 'juridica' and cui is not null and cnp is null)
      or (
        client_type = 'fizica'
        and cui is null
        and cnp is not null
        and cnp ~ '^[0-9]{13}$'
        and reg_com is null
        and is_vat_payer = false
      )
    );

create unique index clients_organization_id_cnp_key
  on public.clients (organization_id, cnp)
  where cnp is not null;

comment on column public.clients.client_type is
  'juridica = firma (CUI obligatoriu) | fizica = persoana fizica (CNP obligatoriu), 0051.';
comment on column public.clients.cnp is
  'CNP-ul clientului persoana fizica (0051). Date personale - afisat doar staff-ului.';
