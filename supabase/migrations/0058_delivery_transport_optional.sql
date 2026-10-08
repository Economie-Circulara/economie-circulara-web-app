-- =============================================================================
-- 0058 - Transportatorul, vehiculul si soferul livrarii devin optionale
-- =============================================================================
-- Decizie 2026-10-08 (Macon XCX): la planificare nu se stie mereu cine duce marfa
-- (transport facut de beneficiar, masina aleasa in ziua livrarii). Livrarea se poate
-- planifica fara ele si se completeaza ulterior pe `/livrari/[id]`.
--
-- Declararea RO e-Transport le cere in continuare - verificat in aplicatie
-- (`declareETransport`) inainte de apelul catre provider. RPC-ul
-- `client_order_delivery` (0056) intoarce `text`, deci accepta deja NULL.
-- =============================================================================

alter table public.deliveries
  alter column carrier_name drop not null,
  alter column vehicle_plate drop not null,
  alter column driver_name drop not null;
