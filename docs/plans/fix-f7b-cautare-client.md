# Fix F7b — Cautare globala nu e cablata pentru portalul clientului

Plan scurt (AGENTS.md §1.1), scris inainte de codare.

## Finding

Review F7b: `globalSearch(query, { role })` (`src/features/search/service.ts`)
suporta deja rolul `client` (comenzi/certificate proprii + catalog, RLS-scoped —
vezi `docs/plans/task-x2-cautare.md`, sectiunea „Incertitudini"), dar nu exista
nicio ruta/UI care sa o foloseasca pentru client: bara din topbar e afisata doar
pentru staff, iar `/cautare` traieste sub `(admin)` cu
`requireRole(["admin","operator"])`.

## Constrangere de rutare Next.js

Grupurile de rute `(admin)` si `(client)` NU pot defini acelasi path (`/cautare`
ar coliza). Ruta noua pentru client foloseste un path DISTINCT: **`/cauta`**.

## Modificari

1. **`src/app/(client)/cauta/page.tsx`** (nou) — pagina de rezultate pentru
   client, simetrica cu `(admin)/cautare/page.tsx`: `requireRole(["client"])`,
   citeste `?q=`, apeleaza `globalSearch(q, { role: "client" })`, randeaza cu
   `SearchResults` (aceeasi componenta de prezentare, reutilizata).

2. **`src/components/layout/topbar.tsx`** — bara de cautare se afiseaza acum si
   pentru rolul `client`; destinatia formularului (`action`) e o mapare
   rol→path (`admin`/`operator` → `/cautare`, `client` → `/cauta`), nu mai e
   hardcodata la `/cautare`. Restul comportamentului (form GET nativ, fara JS)
   ramane neschimbat.

3. **Verificare href-uri per rol** — `service.ts` deja construieste href-urile
   corect per rol (`searchOrders`/`searchCertificates` folosesc
   `/comenzile-mele` cand `role === "client"`, `searchCatalogItems` foloseste
   mereu `/catalog`) si asta e deja acoperit de teste existente
   (`service.test.ts`, describe „rol client” — `/comenzile-mele/order-1`,
   `/comenzile-mele/order-1/certificat`, `/catalog`). Clientul nu primeste
   niciodata `client`/`lot` (grupuri nici macar interogate pentru rolul lui),
   deci nu exista risc de link catre `/clienti/...` sau `/stoc?...` (rute de
   admin). Nicio modificare necesara in `service.ts`/`search-results.tsx` —
   mapping-ul e deja corect si testat; `SearchResults` doar randeaza `href`-ul
   primit, fara sa-l construiasca.

## Teste

Niciun test nou in `service.ts` (mapping-ul e deja acoperit). Se pot adauga
teste pentru pagina noua `(client)/cauta/page.tsx` daca se justifica logica
proprie (in acest caz e un wrapper subtire ca `(admin)/cautare/page.tsx`, care
la randul lui nu are test dedicat — logica testabila traieste in `service.ts`).

## Fisiere atinse

- `src/app/(client)/cauta/page.tsx` (nou)
- `src/components/layout/topbar.tsx` (mapare rol→path cautare, activare pt.
  client)
