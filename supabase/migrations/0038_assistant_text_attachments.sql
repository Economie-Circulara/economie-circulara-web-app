-- =============================================================================
-- Asistent AI: atasamente text (TXT, Markdown, CSV/TSV, HTML, JSON, XML)
-- =============================================================================
-- Extinde 0036: pe langa imagini si PDF, utilizatorii ataseaza fisiere text intalnite
-- in practica (exporturi CSV din Excel, note Markdown, pagini HTML salvate, JSON/XML din
-- alte sisteme), citite de asistent cu `citeste_document`. Tipurile sunt cele CANONICE
-- deduse din extensie (src/features/assistant/attachment-rules.ts#resolveMimeType).
-- Plan: docs/plans/asistent-atasamente.md.
-- =============================================================================

update storage.buckets
set allowed_mime_types = array[
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/pdf',
  'text/plain', 'text/markdown', 'text/csv', 'text/tab-separated-values', 'text/html',
  'application/json', 'application/xml'
]
where id = 'assistant-attachments';

alter table public.assistant_attachments
  drop constraint if exists assistant_attachments_mime_type_check;

alter table public.assistant_attachments
  add constraint assistant_attachments_mime_type_check check (mime_type in (
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/pdf',
    'text/plain', 'text/markdown', 'text/csv', 'text/tab-separated-values', 'text/html',
    'application/json', 'application/xml'
  ));
