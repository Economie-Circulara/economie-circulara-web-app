import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/features/auth/session";
import { listRecipes } from "@/features/recipes/queries";
import { RecipesTable } from "@/features/recipes/recipes-table";

export const metadata = { title: "Rețete - Lot cu Lot" };

interface RetetePageProps {
  searchParams: Promise<{ arhivate?: string }>;
}

/** Ecranul Rețete - lista retetelor definite (doar staff). */
export default async function RetetePage({ searchParams }: RetetePageProps) {
  await requireRole(["admin", "operator"]);
  const params = await searchParams;
  const includeArchived = params.arhivate === "1";
  const recipes = await listRecipes({ includeArchived });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rețete"
        description="Compoziția (în procente) a materialelor fizice din catalog."
        actions={
          <Button asChild>
            <Link href="/retete/nou">+ Rețetă nouă</Link>
          </Button>
        }
      />
      {/* Arhivatele sunt ascunse implicit (migrarea 0035) - comutator explicit. */}
      <div className="text-sm">
        {includeArchived ? (
          <Link href="/retete" className="text-primary hover:underline">
            Ascunde rețetele arhivate
          </Link>
        ) : (
          <Link href="/retete?arhivate=1" className="text-primary hover:underline">
            Arată arhivate
          </Link>
        )}
      </div>
      <RecipesTable recipes={recipes} />
    </div>
  );
}
