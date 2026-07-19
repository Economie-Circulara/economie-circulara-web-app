import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { globalSearch } from "@/features/search/service";
import { SearchResults } from "@/features/search/search-results";

export const metadata = { title: "Căutare — Lateris Trace" };

interface CautaPageProps {
  searchParams: Promise<{ q?: string }>;
}

/**
 * Ecranul de rezultate al căutării globale pentru portalul clientului (fix F7b —
 * `globalSearch` suporta deja rolul `client`, dar nu exista ruta care sa-l
 * foloseasca). Path distinct (`/cauta`, nu `/cautare`): grupurile de rute
 * `(admin)`/`(client)` nu pot defini acelasi path. `globalSearch` respecta deja
 * izolarea multi-tenant (RLS) si limiteaza rezultatele clientului la comenzile/
 * certificatele proprii + catalog — vezi `src/features/search/service.ts`.
 */
export default async function CautaPage({ searchParams }: CautaPageProps) {
  const user = await requireRole(["client"]);
  const params = await searchParams;
  const query = params.q?.trim() ?? "";

  const groups = query ? await globalSearch(query, { role: user.role }) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Căutare"
        description={
          query
            ? `Rezultate pentru „${query}”`
            : "Caută comenzi, certificate sau produse din catalog."
        }
      />
      <SearchResults query={query} groups={groups} />
    </div>
  );
}
