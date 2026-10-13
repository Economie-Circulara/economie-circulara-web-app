-- =============================================================================
-- 0057 - Livrari: transportatorul, nr. de inmatriculare si soferul devin OPTIONALE
-- (etapa 2 din docs/plans/flota-combustibil.md, decizie 2026-10-10).
--
-- O livrare se poate planifica fara ele (ex. transportator extern necunoscut inca).
-- Declararea e-Transport le cere in continuare: `declareETransport` refuza fara
-- transportator si nr. de inmatriculare, cu mesaj salvat in `declaration_error`, iar
-- datele se completeaza din `/livrari/[id]` cat livrarea nu a plecat.
-- `client_order_delivery` (0041) le intoarce deja ca text - NULL trece neschimbat.
-- =============================================================================

alter table public.deliveries
  alter column carrier_name drop not null,
  alter column vehicle_plate drop not null,
  alter column driver_name drop not null;
