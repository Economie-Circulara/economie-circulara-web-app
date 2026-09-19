-- =============================================================================
-- `assistant_tool_calls.reasoning_content` - CoT-ul modelului la propunere
-- =============================================================================
-- Context (thinking mode DeepSeek, https://api-docs.deepseek.com/guides/thinking_mode/):
-- cat timp cererea are `tools`, DeepSeek cere *obligatoriu* `reasoning_content`
-- retrimis pe orice mesaj `assistant` cu `tool_calls`, altfel raspunde cu eroare 400.
-- La continuarea automata dupa confirmare (`run.ts#messagesForContinuation`), mesajul
-- assistant(tool_calls) e RECONSTRUIT sintetic din propunerea salvata - fara coloana
-- de fata, CoT-ul original s-ar pierde si continuarea ar pica exact cu acel 400.
-- Aditiva, ca si `provider_call_id` (migrarea 0024): nu schimba comportamentul
-- furnizorilor fara thinking mode (coloana ramane null).
-- =============================================================================

alter table public.assistant_tool_calls
  add column reasoning_content text;

comment on column public.assistant_tool_calls.reasoning_content is
  'CoT-ul modelului la propunere (thinking mode DeepSeek) - retrimis la continuarea conversatiei dupa confirmare, ca `tool_calls` sa nu piarda contextul de rationament (vezi provider.ts#ChatMessage.reasoningContent).';
