-- =============================================================================
-- Rețete: direcție explicită (compunere / descompunere) + conversii de UM
-- =============================================================================
-- Doua bug-uri reale raportate din productie, cu aceeasi radacina - reteta era
-- folosita implicit cu doua semantici contradictorii si fara nicio constiinta a
-- unitatilor de masura:
--
--   1. "Graficul de reciclare arata invers". Cele doua wizard-uri de proces
--      (src/features/production/fixed-output-form.tsx si variable-output-form.tsx)
--      INTERPRETAU aceeasi structura in doua feluri opuse: 4a (output fix)
--      considera itemul retetei OUTPUT si componentele INPUT (BOM clasic - ca in
--      comentariile din 0001_core_schema.sql si in textul din recipe-editor.tsx),
--      iar 4b (reciclare) considera itemul retetei INPUT si componentele OUTPUT
--      (ca in seed si in migrarea 0008). Care semantica se aplica depindea de
--      TAB-ul pe care a dat click utilizatorul, nu de reteta - deci aceeasi reteta
--      producea un flux inversat intre cele doua ecrane.
--
--   2. "Cantitatile de la beton ies gresite". Procentele se aplicau direct peste
--      cantitati brute, indiferent de UM: 1 kg era tratat ca 1 litru si ca 1 mc.
--      O reteta de beton (output in mc) cu apa (litru), nisip (tona) si ciment
--      (kg) calcula numere fara sens fizic.
--
-- Fix (aditiv, nu se editeaza migrarile existente - AGENTS.md §1):
--
--   * `recipes.direction` - enum NOU, explicit, nu dedus. Ambele directii raman
--     complet suportate; nu e o migrare "alegem una", ci transformarea unei
--     duble utilizari implicite intr-un camp explicit, citit uniform de tot codul.
--   * `recipe_components.conversion_factor` - cate unitati din UM-ul itemului
--     PROPRIU al retetei corespund unei unitati din UM-ul COMPONENTEI.
--
-- Formula de calcul (identica pentru AMBELE directii - directia decide doar care
-- parte e "totalul" care se distribuie si cum se deseneaza fluxul pe grafic, NU
-- matematica; vezi src/features/production/calc.ts):
--
--   cantitate_componenta (in UM-ul componentei)
--     = (percentage / 100 * cantitate_totala_in_UM-ul_itemului_retetei)
--       / conversion_factor
--
-- Exemplu (reteta de beton, item = beton cu UM = kg):
--   * componenta nisip, UM = mc,    1 mc nisip  ≈ 1500 kg beton -> factor 1500
--   * componenta apa,   UM = litru, 1 l apa     ≈    1 kg beton -> factor 1
-- Implicit 1 = no-op sigur (UM-uri identice, sau unitati de numarare -
-- bucata/palet/sac - unde utilizatorul introduce direct echivalenta dorita).
--
-- NU se reintroduce plafonul de 100% eliminat in 0027 - procentul ramane un
-- raport input:output si poate depasi 100 (ex. 200% moloz -> 100% pietris).
-- Procentul si factorul de conversie sunt ortogonale: procentul exprima
-- raportul cantitativ al retetei, factorul doar traduce unitatile.
-- =============================================================================

create type public.recipe_direction as enum (
  'compunere',    -- BOM: itemul retetei e OUTPUT-ul, componentele sunt INPUT-urile
                  -- necesare ca sa il obtii (ex. beton <- apa + nisip + ciment).
  'descompunere'  -- itemul retetei e INPUT-ul, componentele sunt OUTPUT-urile in
                  -- care se descompune (ex. moloz -> nisip + pietris + balast).
);

alter table public.recipes
  add column direction public.recipe_direction not null default 'compunere';

comment on column public.recipes.direction is
  'Semantica retetei: compunere = `recipes.item_id` e OUTPUT-ul, componentele sunt '
  'INPUT-urile (BOM); descompunere = `recipes.item_id` e INPUT-ul, componentele sunt '
  'OUTPUT-urile (reciclare). Vezi migrarea 0028 - inainte, directia era dedusa din '
  'wizard-ul folosit, ceea ce ducea la fluxuri inversate pe acelasi set de date.';

-- Backfill pentru retetele existente. `compunere` e implicitul (semantica din
-- comentariile schemei 0001 si din editorul de retete), dar retetele care au fost
-- FOLOSITE deja intr-un proces de tip `input_fixed` (fluxul 4b - reciclare, unde
-- itemul retetei a fost consumat ca input, iar componentele au devenit loturi de
-- output) sunt, prin evidenta datelor, retete de descompunere. Heuristica se
-- bazeaza pe fapte istorice din `processes`, nu pe ghicit dupa denumiri.
update public.recipes r
set direction = 'descompunere'
where exists (
  select 1
  from public.processes p
  where p.recipe_id = r.id
    and p.type = 'input_fixed'
);

alter table public.recipe_components
  add column conversion_factor numeric(18, 9) not null default 1
    check (conversion_factor > 0);

comment on column public.recipe_components.conversion_factor is
  'Cate unitati din UM-ul itemului propriu al retetei corespund unei unitati din '
  'UM-ul acestei componente (ex. reteta pe kg de beton, componenta nisip in mc, '
  '1 mc ≈ 1500 kg -> 1500). Cantitatea componentei = percentage/100 * total / '
  'conversion_factor. Implicit 1 (UM-uri identice sau echivalenta introdusa direct '
  'de utilizator la unitatile de numarare). Vezi migrarea 0028.';
