-- =============================================================================
-- Rețete: procentul unei componente poate depăși 100%
-- =============================================================================
-- Context: procentul unei componente exprimă raportul input/output al
-- rețetei, nu neapărat o compunere care însumează 100%. La rețete de
-- reciclare (ex: moloz -> pietriș), inputul necesar per unitate de output
-- poate depăși 100% (ex: 200% deșeu -> 100% pietriș = ai nevoie de 2x
-- cantitatea de input față de output dorit). Se elimină plafonul de 100 pe
-- `recipe_components.percentage` și se lărgește precizia coloanei ca să
-- încapă valori mari (ex: 1000% pentru un randament de 10%).

alter table public.recipe_components
  alter column percentage type numeric(9, 3);

alter table public.recipe_components
  drop constraint recipe_components_percentage_check;

alter table public.recipe_components
  add constraint recipe_components_percentage_check check (percentage > 0);
