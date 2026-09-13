-- =============================================================================
-- Contract viu al capabilitatilor asistentului AI - status tranzitoriu +
-- versiune de tool + id-ul apelului la furnizorul LLM
-- =============================================================================
-- Context (docs/plans/asistent-contract-capabilitati.md): raspunsul asistentului
-- la o comanda cu linii (array) se strica atunci cand utilizatorul confirma
-- propunerea fara sa atinga niciun camp - cardul generic serializeaza array-ul
-- ca text si il retrimite ca override, suprascriind valoarea tipata din
-- `assistant_tool_calls.arguments`. Migrarea aditiva de fata pregateste DB-ul
-- pentru fix-ul din `run.ts`/`tools/registry.ts` (aceasta migrare NU schimba
-- comportament - doar adauga coloane/valori posibile):
--
--   1. status tranzitoriu `executing` - revendicat ATOMIC (`update ... where
--      status='proposed'`) inainte de executie, ca doua confirmari concurente
--      (dublu-click, doua file) sa nu creeze de doua ori aceeasi comanda.
--   2. `tool_version` - versiunea manifestului de capabilitati la momentul
--      propunerii (audit: "cu ce contract s-a produs acest apel").
--   3. `provider_call_id` - id-ul brut al tool-call-ului dat de FURNIZORUL LLM
--      (`ProviderToolCall.id`, azi folosit doar efemer in `run.ts`) - necesar ca
--      sa reconstruim perechea de mesaje assistant(tool_calls)/tool(result) cand
--      reluam conversatia cu modelul dupa o confirmare (continuare automata).
-- =============================================================================

alter table public.assistant_tool_calls
  drop constraint assistant_tool_calls_status_check;

alter table public.assistant_tool_calls
  add constraint assistant_tool_calls_status_check
  check (status in ('proposed', 'executing', 'confirmed', 'rejected', 'failed'));

alter table public.assistant_tool_calls
  add column tool_version integer not null default 1,
  add column provider_call_id text;

comment on column public.assistant_tool_calls.status is
  'proposed -> executing (revendicat atomic, vezi service.ts#claimProposal) -> confirmed | failed. rejected direct din proposed. Tool-urile de CITIRE se salveaza direct confirmed.';
comment on column public.assistant_tool_calls.tool_version is
  'Versiunea tool-ului (AssistantTool.version) activa la momentul propunerii - audit de contract.';
comment on column public.assistant_tool_calls.provider_call_id is
  'Id-ul tool-call-ului asa cum l-a produs furnizorul LLM (ProviderToolCall.id) - reconstruieste mesajele assistant/tool la continuarea conversatiei dupa confirmare.';
