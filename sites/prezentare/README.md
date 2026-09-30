# Site de prezentare per tenant

Pagina one-page de pe domeniul radacina al fiecarui client (`etora.ro`, `maconxcx.ro`),
separata de aplicatie. Un cod, cate un deploy per client (`SITE_TENANT`).

- Continut: `content/<tenant>.json` (validat la build de `src/lib/content.ts`).
- Tema + logo: din `/platform` (RPC `org_branding`) daca sunt setate `SUPABASE_URL` +
  `SUPABASE_PUBLISHABLE_KEY`, altfel din fisierul de continut.
- Deploy si DNS: `docs/setup.md` 3.1.3. Plan: `docs/plans/site-prezentare-tenanti.md`.

```bash
pnpm install
SITE_TENANT=etora pnpm dev     # http://localhost:3000
pnpm test && pnpm typecheck
SITE_TENANT=maconxcx pnpm build  # -> out/
```
