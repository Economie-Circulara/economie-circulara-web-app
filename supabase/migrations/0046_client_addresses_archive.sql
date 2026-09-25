-- =============================================================================
-- Adrese de livrare: arhivare (ascunse din agenda, pastrate pe comenzi)
-- =============================================================================
-- Clientul isi gestioneaza acum adresele din portal (/adresele-mele) si poate da o
-- adresa AD HOC pentru o singura comanda/aport. Ambele au nevoie de o adresa care
-- exista (FK `orders.delivery_address_id`) dar NU apare in agenda / pickere:
--   - adresa ad hoc ("doar pentru această comandă") se creeaza direct arhivata;
--   - "stergerea" unei adrese deja folosite pe o comanda devine arhivare - o
--     stergere fizica ar goli adresa din comenzile vechi (`on delete set null`,
--     0001). Adresele nefolosite se sterg in continuare fizic.
-- Acelasi principiu ca 0035 ("nimic cu istoric nu se sterge fizic").
--
-- Fara politici noi: RLS-ul pe `client_addresses` (0014/0016) e pe intregul rand -
-- clientul isi scrie deja propriile adrese, staff-ul pe ale organizatiei.
-- =============================================================================

alter table public.client_addresses
  add column archived_at timestamptz;

comment on column public.client_addresses.archived_at is
  'Adresa ascunsa din agenda si din pickere (0046): ad hoc (o singura comanda) sau stearsa dupa ce a fost folosita. Comenzile vechi o afiseaza in continuare.';
