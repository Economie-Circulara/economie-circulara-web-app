-- =============================================================================
-- Utilizarea asistentului AI - contoare pentru super-admin, FARA continut
-- =============================================================================
-- Plan: docs/plans/asistent-utilizare-super-admin.md.
--
-- Conversatiile raman PERSONALE (0020): nu adaugam politici de SELECT pentru
-- super-admin pe tabelele asistentului - ar expune textul mesajelor, argumentele si
-- rezultatele tool-urilor. Cele doua RPC-uri de mai jos intorc DOAR contoare.
--
-- Autorizare explicita (security definer => RLS NU se aplica in corp): doar
-- `app.is_super_admin()`; oricine altcineva primeste 0 randuri.
-- =============================================================================

-- Per (organizatie, utilizator): activitatea din perioada.
create or replace function public.platform_ai_user_activity(p_since timestamptz)
returns table (
  organization_id uuid,
  user_id         uuid,
  conversations   bigint,
  user_messages   bigint,
  active_days     bigint,
  last_active_at  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.organization_id,
         c.user_id,
         count(distinct c.id)                                          as conversations,
         count(*) filter (where m.role = 'user')                       as user_messages,
         count(distinct (m.created_at at time zone 'UTC')::date)
           filter (where m.role = 'user')                              as active_days,
         max(m.created_at)                                             as last_active_at
  from public.assistant_messages m
  join public.assistant_conversations c on c.id = m.conversation_id
  where m.created_at >= p_since
    and app.is_super_admin()
  group by c.organization_id, c.user_id
$$;

-- Per (organizatie, utilizator, tool, status): numarul de apeluri din perioada.
create or replace function public.platform_ai_tool_activity(p_since timestamptz)
returns table (
  organization_id uuid,
  user_id         uuid,
  tool            text,
  status          text,
  calls           bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.organization_id, c.user_id, t.tool, t.status, count(*) as calls
  from public.assistant_tool_calls t
  join public.assistant_conversations c on c.id = t.conversation_id
  where t.created_at >= p_since
    and app.is_super_admin()
  group by c.organization_id, c.user_id, t.tool, t.status
$$;

revoke all on function public.platform_ai_user_activity(timestamptz) from public;
revoke all on function public.platform_ai_tool_activity(timestamptz) from public;
grant execute on function public.platform_ai_user_activity(timestamptz) to authenticated, service_role;
grant execute on function public.platform_ai_tool_activity(timestamptz) to authenticated, service_role;
