-- Asistentul AI doar pentru staff (decizie 2026-09-30, docs/plans/asistent-fara-clienti.md).
--
-- Clientul nu mai are asistent. Aplicatia il opreste pe rute si in server actions;
-- aici e a doua linie: politicile de SCRIERE din 0020 cer suplimentar un rol cu
-- asistent (admin / operator / super-admin, profil activ - `app.role()` e null pentru
-- conturile blocate). Citirea conversatiilor proprii vechi ramane neschimbata: nu se
-- sterge istoric.

create or replace function app.can_use_assistant()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(app.role() in ('super_admin', 'admin', 'operator'), false)
$$;

-- Conversatii: citire/stergere proprie ca inainte; creare/modificare doar cu asistent.
drop policy assistant_conversations_own on public.assistant_conversations;

create policy assistant_conversations_select_own on public.assistant_conversations
  for select using (user_id = auth.uid());

create policy assistant_conversations_delete_own on public.assistant_conversations
  for delete using (user_id = auth.uid());

create policy assistant_conversations_insert_own on public.assistant_conversations
  for insert with check (user_id = auth.uid() and app.can_use_assistant());

create policy assistant_conversations_update_own on public.assistant_conversations
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and app.can_use_assistant());

-- Mesaje si propuneri: acelasi `using` (conversatie proprie), `with check` + rol.
drop policy assistant_messages_own on public.assistant_messages;

create policy assistant_messages_own on public.assistant_messages
  for all using (
    exists (
      select 1 from public.assistant_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    app.can_use_assistant()
    and exists (
      select 1 from public.assistant_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

drop policy assistant_tool_calls_own on public.assistant_tool_calls;

create policy assistant_tool_calls_own on public.assistant_tool_calls
  for all using (
    exists (
      select 1 from public.assistant_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    app.can_use_assistant()
    and exists (
      select 1 from public.assistant_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );
