# Asistentul AI doar pentru staff (fara rolul client)

Decizie 2026-09-30: asistentul AI se scoate din portalul clientului. Ramane pentru
**admin** si **operator** (staff-ul organizatiei) si pentru **super-admin** (neschimbat,
are doar tool-urile de citire).

## Pasi

1. `src/features/assistant/access.ts` - `ASSISTANT_ROLES` + `canUseAssistant(role)`,
   sursa unica pentru rolurile cu acces.
2. Meniu: `ASSISTANT_NAV_ITEM.roles = ASSISTANT_ROLES`; `navForRole` nu mai adauga
   intrarea pentru client.
3. Rute: `/asistent`, `/asistent/[id]`, `/asistent/atasamente/[id]` cer
   `requireRole(ASSISTANT_ROLES)` (clientul e redirectionat la pagina lui de start).
4. Server actions (`assistant/actions.ts`): contextul cere acelasi rol - un client
   care apeleaza direct actiunea e redirectionat, fara apel de model.
5. Tool-uri: `cauta_in_manual` si `cauta` nu mai au rolul `client`
   (`toolsForRole("client")` e gol); sugestiile de client din UI dispar.
6. DB (migrarea `0054_assistant_staff_only.sql`): politicile de scriere pe
   `assistant_conversations` / `assistant_messages` / `assistant_tool_calls` cer
   suplimentar `app.can_use_assistant()` (rol admin/operator/super-admin activ).
   Citirea conversatiilor proprii vechi ramane neschimbata (nu se sterge istoric).
7. Manualul clientului: sectiunea „Asistent AI” scoasa.
8. Teste: `access.test.ts`, `registry.test.ts`, `nav-config.test.ts`, e2e
   `asistent.spec.ts` (clientul e redirectionat), test DB in `assistant_rls.sql`.

## Impact asupra asistentului (regula 2.4)

- **Decizia**: `read` restrans - niciun tool nou; clientul pierde accesul la tot
  asistentul (inclusiv tool-urile de citire `cauta_in_manual`, `cauta`).
