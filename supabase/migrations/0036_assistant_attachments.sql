-- =============================================================================
-- Asistent AI: atasamente in chat (imagini / PDF)
-- =============================================================================
-- Plan: docs/plans/asistent-atasamente.md
--
-- Bucket PRIVAT (documentele pot contine date ale clientilor). Fara politici pe
-- `storage.objects`: upload-ul se face din browser cu URL semnat emis de server
-- (dupa validare + insert in tabelul de mai jos, pe sesiunea utilizatorului), iar
-- citirea prin clientul admin, DOAR dupa ce randul din `assistant_attachments` a fost
-- citit pe sesiunea utilizatorului (RLS) - vezi src/features/assistant/attachments.ts.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assistant-attachments',
  'assistant-attachments',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']
)
on conflict (id) do nothing;

create table public.assistant_attachments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  storage_path    text not null unique,
  file_name       text not null check (length(file_name) between 1 and 200),
  mime_type       text not null
                    check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf')),
  size_bytes      integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at      timestamptz not null default now()
);

create index assistant_attachments_user_idx on public.assistant_attachments (user_id, created_at);

alter table public.assistant_attachments enable row level security;

-- Personale, ca si conversatiile (0020): fiecare utilizator isi vede doar atasamentele
-- lui, si doar cat timp e staff intr-o organizatie ACTIVA (app.is_staff_of, 0012).
create policy assistant_attachments_select_own on public.assistant_attachments
  for select using (user_id = auth.uid() and app.is_staff_of(organization_id));

create policy assistant_attachments_insert_own on public.assistant_attachments
  for insert with check (user_id = auth.uid() and app.is_staff_of(organization_id));

-- Fara update/delete: randul e o inregistrare de audit (ce fisier a fost dat asistentului).
grant select, insert on public.assistant_attachments to authenticated;
grant select, insert, update, delete on public.assistant_attachments to service_role;
