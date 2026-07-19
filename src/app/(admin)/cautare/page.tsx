import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { globalSearch } from "@/features/search/service";
import { SearchResults } from "@/features/search/search-results";

export const metadata = { title: "Căutare — Lateris Trace" };

interface CautarePageProps {
  searchParams: Promise<{ q?: string }>;
}

/**
 * Ecranul de rezultate al căutării globale (Task X2) — doar staff (bara din
 * topbar navighează aici doar pentru admin/operator, vezi `topbar.tsx`).
 * Rezultatele sunt grupate pe tip (comandă/client/lot/produs/certificat) de
 * `globalSearch`, care respectă deja izolarea multi-tenant (RLS, clientul
 * utilizatorului curent).
 */
export default async function CautarePage({ searchParams }: CautarePageProps) {
  const user = await requireRole(["admin", "operator"]);
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
            : "Caută comenzi, clienți, loturi, produse sau certificate."
        }
      />
      <SearchResults query={query} groups={groups} />
    </div>
  );
}
