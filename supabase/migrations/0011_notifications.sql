-- =============================================================================
-- Task X1 — Notificari email
-- =============================================================================
-- Migrare aditiva peste schema inghetata din 0001_core_schema.sql (nu modifica
-- niciun tabel/enum existent). Adauga:
--
--   public.notification_type   -> enum (o valoare per tranzitie de status
--                                  comanda notificata + 'staff_invite', pt.
--                                  consistenta cu invitatiile Supabase Auth
--                                  din T1.3, optional/neutilizat inca)
--   public.notification_status -> enum ('queued' | 'sent' | 'failed')
--   public.notifications       -> jurnal de email-uri trimise catre clienti/staff
--                                  (o linie per incercare de trimitere), scris de
--                                  src/features/notifications/service.ts
--
-- RLS: staff-ul vede jurnalul organizatiei proprii (audit/debug trimiteri) — NU
-- se acorda insert/update rolului `authenticated`: randurile se scriu DOAR prin
-- serviciul server-side (clientul administrativ, service-role — vezi
-- src/lib/supabase/admin.ts), in stilul deja folosit pt. bucket-urile private
-- `documents`/`certificates` (0006/0009): un singur punct de control server-side,
-- fara sa duplicam logica de autorizare a scrierii intr-o politica RLS separata.
-- Clientul (rol `client`) nu are acces la acest jurnal — nu e cerut de task
-- (notificarile ii sunt trimise PRIN email, nu citite in aplicatie).
-- =============================================================================

create type public.notification_type as enum (
  'order_sent',
  'order_accepted',
  'order_delivered',
  'order_closed',
  'order_cancelled',
  'staff_invite'
);

create type public.notification_status as enum ('queued', 'sent', 'failed');

create table public.notifications (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  recipient_email   text not null,
  type              public.notification_type not null,
  subject           text not null,
  body              text not null,
  -- Comanda asociata (cand notificarea e o tranzitie de status). `on delete set
  -- null`, ca la `stock_events.order_id` (0001) — jurnalul de notificari ramane
  -- ca audit chiar daca (ipotetic) comanda ar fi stearsa.
  related_order_id  uuid references public.orders (id) on delete set null,
  status            public.notification_status not null default 'queued',
  error             text,
  created_at        timestamptz not null default now(),
  sent_at           timestamptz
);

create index notifications_organization_id_idx on public.notifications (organization_id);
create index notifications_related_order_id_idx on public.notifications (related_order_id);

alter table public.notifications enable row level security;

-- Staff-ul vede jurnalul de notificari al organizatiei proprii.
create policy notifications_staff_select on public.notifications
  for select using (app.is_staff_of(organization_id));

-- DOAR select pt. `authenticated` — insert/update raman rezervate `service_role`
-- (clientul admin din src/features/notifications/service.ts). Fara aceasta
-- restrictie, un cont de staff ar putea insera/actualiza direct randuri de
-- notificare prin Data API, ocolind serviciul (randare template, apelul catre
-- providerul de email, tranzitia queued -> sent/failed).
grant select on public.notifications to authenticated;
grant select, insert, update on public.notifications to service_role;
