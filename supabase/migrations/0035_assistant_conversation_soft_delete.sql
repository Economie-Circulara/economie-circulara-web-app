-- =============================================================================
-- Soft delete pentru conversatiile cu asistentul AI
-- =============================================================================
-- Pana acum, o conversatie (`assistant_conversations`) nu putea fi stearsa deloc
-- din UI - nici macar utilizatorul care a creat-o. RLS-ul (`assistant_conversations_own`,
-- 0020) ii da deja voie la DELETE (`for all using (user_id = auth.uid())`), dar un
-- hard-delete ar sterge in cascada (`on delete cascade`) si mesajele/tool-call-urile
-- asociate - inclusiv propunerile de scriere `assistant_tool_calls`, care sunt singurul
-- loc unde ramane auditul unei actiuni CONFIRMATE (ce s-a propus, cine a confirmat,
-- rezultatul). Solutie: SOFT delete, la fel ca restul aplicatiei (loturile nu se sterg
-- niciodata, comenzile se anuleaza in loc sa se stearga) - `deleted_at` marcheaza
-- conversatia ca ascunsa, fara sa piarda istoricul.
--
-- Nu e nevoie de coloana `deleted_at` in `src/lib/database.types.ts` (generat): tabelele
-- de asistent nu sunt inca in tipul `Database` (vezi comentariul din
-- src/features/assistant/db.ts) - randurile sunt tipate manual acolo, unde se
-- actualizeaza si acest camp.
alter table public.assistant_conversations
  add column deleted_at timestamptz;

comment on column public.assistant_conversations.deleted_at is
  'Soft delete: cand e completat, conversatia e ascunsa din UI (listConversations/'
  'getConversation filtreaza pe `deleted_at is null`), dar randul si mesajele/tool-call-urile'
  'asociate raman in baza, pentru audit.';
