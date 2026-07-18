import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/features/auth/session";
import { listRecipes } from "@/features/recipes/queries";
import { RecipesTable } from "@/features/recipes/recipes-table";

export const metadata = { title: "Rețete — Lateris Trace" };

/** Ecranul Rețete — lista retetelor definite (doar staff). */
export default async function RetetePage() {
  await requireRole(["admin", "operator"]);
  const recipes = await listRecipes();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rețete"
        description="Compoziția (în procente) a itemilor fizici din catalog."
        actions={
          <Button asChild>
            <Link href="/retete/nou">+ Rețetă nouă</Link>
          </Button>
        }
      />
      <RecipesTable recipes={recipes} />
    </div>
  );
}
