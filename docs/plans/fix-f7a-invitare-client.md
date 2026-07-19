# Fix F7a — invitare utilizator cu rol `client` in `/setari/utilizatori`

## Problema (finding de review F7a)

Ecranul `/setari/utilizatori` permite adminului sa invite doar staff (operator/admin)
prin `inviteStaffAction`. Lipseste fluxul de invitare a unui utilizator cu rol
`client`, legat de o firma-client existenta (`clients`) prin `profiles.client_id`.
Regula de business (AGENTS.md §3): **un client = un singur utilizator**.

## Scope

- `src/features/settings/**` (queries, actions noi, formular nou)
- `src/app/(admin)/setari/utilizatori/**` (pagina)
- Import (read-only) din `src/features/clients/queries.ts` (`listClients`, `getClient`) —
  nu se modifica.
- Nu se ating: migrari, `database.types.ts`, orders/reports/search/CI.

## Plan

1. **Query noua** `listAvailableClientsForInvite()` in `src/features/settings/queries.ts`:
   ia `listClients()` (org-scoped via RLS, import din `clients/queries`) si scoate
   firmele care au deja un profil `client` legat (`profiles.client_id`). Foloseste
   clientul de sesiune (RLS), nu admin client — doar citire.
2. **`listOrgUsers()`** extins cu `clientName` (embed `clients(name)` prin FK
   `profiles_client_id_fkey`) — lista de utilizatori arata si firma clientilor.
3. **Server action** `inviteClientAction` in `src/features/settings/user-actions.ts`:
   - gating: doar admin (`getCurrentUser`, acelasi pattern ca `inviteStaffAction`).
   - valideaza: email prezent + format minimal, `client_id` prezent.
   - **firma exista in organizatie**: `getClient(clientId)` (import din
     `clients/queries`, RLS org-scoped) — `null` => eroare "firma inexistenta".
   - **firma nu are deja un user**: interogare `profiles` (admin client) dupa
     `client_id` — gasit => eroare "firma are deja un utilizator".
   - invita prin `adminClient.auth.admin.inviteUserByEmail` + insereaza `profiles`
     cu `role: "client"`, `organization_id` = org adminului, `client_id`.
   - `revalidatePath("/setari/utilizatori")`.
4. **UI**: `InviteClientForm` (client component, acelasi stil ca `InviteStaffForm`:
   `FormField` + `Input` + select nativ) — select cu firmele disponibile
   (`listAvailableClientsForInvite`), camp email, buton „Invită client". Adaugat in
   pagina intr-un al doilea `Card`. Tabelul de utilizatori arata coloana „Firma"
   pentru randurile cu rol `client`.

## Enforcement „un client = un singur user"

- **Constraint DB existent** (neschimbat, `0003_rls_hardening.sql`):
  `profiles_client_link check (role = 'client' or client_id is null)` — un profil
  `client` TREBUIE sa aiba `client_id`; un non-client NU poate avea `client_id`.
- **Nu exista un `unique` index pe `profiles.client_id`** la nivel de DB (verificat —
  singurul index e `profiles_client_id_idx`, neunic). Adaugarea unui unique index
  necesita o migrare, in afara scope-ului acestui task (migrarile sunt explicit
  excluse). Enforcement-ul „un singur user per firma" e deci **doar la nivel de
  aplicatie** in `inviteClientAction` (verificare inainte de insert). Exista o
  fereastra teoretica de race condition (doua invitatii simultane pentru aceeasi
  firma) — acceptat ca limitare cunoscuta, documentata si in AGENTS.md §4.1;
  hardening-ul complet (unique index / constraint) ramane pentru un task viitor cu
  acces la migrari.

## Teste (Vitest, mocks, colocate)

- `src/features/settings/user-actions.test.ts`: gating rol (non-admin respins),
  validare (email lipsa, client_id lipsa, firma inexistenta, firma cu user deja
  asociat), flux fericit (invitare + insert profil), esec invitatie/insert profil.
- `src/features/settings/queries.test.ts`: `listAvailableClientsForInvite` filtreaza
  corect firmele cu user existent; `listOrgUsers` mapeaza `clientName`.
