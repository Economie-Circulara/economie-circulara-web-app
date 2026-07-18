-- =============================================================================
-- Task B — Itemi: tip de item (fizic / serviciu)
-- =============================================================================
-- Migrare aditiva peste schema inghetata din 0001_core_schema.sql. Adauga un enum
-- nou `item_kind` si coloana `items.kind` — NU modifica tabele/enum-uri existente.
--
-- Motivatie (2026-07, cerinta revizuita Anexa 1 "gestionarea tipurilor de produse
-- si servicii furnizate", vezi docs/plans/implementation-plan.md — Task B): tipurile
-- de abonament/serviciu PaaS (ex. Basic/Premium/Pay-per-Use/Flexi-Beton, cerute de
-- un viitor client) se modeleaza ca itemi de tip `service` in catalog, NU ca modul
-- separat de abonamente/facturare. Fara preturi — platforma nu gestioneaza
-- tarife/facturare (vezi AGENTS.md §4: „Contracte = arhivare, nu gestiune").
--
-- Retetele (procente din alti itemi) au sens doar pentru itemi `physical`
-- (compozitie fizica, consum de stoc). Aceasta regula se impune la nivel de
-- aplicatie (src/features/recipes/service.ts), nu printr-un CHECK inter-tabel in
-- schema (Postgres nu suporta CHECK-uri care citesc alt tabel fara trigger, iar un
-- trigger ar adauga complexitate disproportionata fata de nevoie in acest MVP).
-- =============================================================================

create type public.item_kind as enum (
  'physical', -- item fizic (materie prima / produs finit): are stoc, poate avea reteta
  'service'   -- serviciu/abonament (ex. PaaS Basic/Premium/Pay-per-Use): fara stoc, fara reteta
);

alter table public.items
  add column kind public.item_kind not null default 'physical';

comment on column public.items.kind is
  'Tip de item: physical (materie prima/produs — stoc + reteta optionala) sau '
  'service (abonament/serviciu PaaS — fara stoc/reteta). Vezi migrarea 0005 pentru '
  'motivatie (cerinta revizuita Anexa 1).';

-- Filtrare dupa tip in ecranul /itemi (analog `items_sellable_idx` din 0001).
create index items_kind_idx on public.items (organization_id, kind);
