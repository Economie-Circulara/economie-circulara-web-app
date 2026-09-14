# Dashboard operațional extins

> Plan scris înainte de codare (AGENTS.md §1.1). Scope: dashboardul staff existent,
> interogări read-only în `src/features/reports/`, teste unitare colocate și prompt log.
> Nu sunt necesare migrări; portalul client rămâne neschimbat.

## Obiectiv

Transformarea dashboardului din patru KPI-uri într-o privire de lucru imediat utilă
pentru admin și operator:

- păstrează indicatorii existenți, cu rute directe spre ecranele relevante;
- arată ultimele comenzi și ce comenzi așteaptă acceptarea;
- semnalează stocul de verificat, definit transparent ca **≤20%** din cantitatea
  inițială încă disponibilă, plus loturile blocate;
- arată evoluția reală a stocului pentru ultimele 14 zile, separată pe unitate de
  măsură ca să nu amestece kg, bucăți etc.

## Date și calcule

`getOperationalDashboard()` va citi sub RLS doar `lots`, `stock_events` și cele mai
recente `orders`, în paralel cu KPI-urile. Stocul redus se agregă per item; pragul nu
este o regulă de business configurabilă și va fi etichetat explicit ca un semnal de
revizuire. Pentru grafic, nivelul zilnic la sfârșitul zilei se reconstruiește înapoi
din stocul curent și evenimentele semnate din audit, pentru fiecare UM.

## UI

Se adaugă componente mici dedicate pentru grafic și lista de acțiuni. Dashboardul
include linkuri către Comenzi și Stoc, stări goale utile, este responsive și rămâne
vizibil doar pentru admin/operator.

## Verificare

- teste pure pentru semnalul de stoc și seria de evoluție;
- testele existente pentru KPI rămân valabile;
- `pnpm typecheck`, `pnpm lint`, `pnpm test` și verificare vizuală locală a rutei.
