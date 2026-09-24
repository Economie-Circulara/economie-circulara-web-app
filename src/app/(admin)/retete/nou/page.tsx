import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { listPhysicalItemsWithoutRecipe } from "@/features/recipes/queries";
import { RecipeNewForm } from "@/features/recipes/recipe-new-form";

export const metadata = { title: "Rețetă nouă - Lot cu Lot" };

/** Pornire rețetă noua: alege materialul fizic (fara rețetă inca). */
export default async function RetetaNouaPage() {
  await requireRole(["admin", "operator"]);
  const items = await listPhysicalItemsWithoutRecipe();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rețetă nouă"
        description="Alege materialul fizic pentru care definești rețeta."
        breadcrumbs={[{ label: "Rețete", href: "/retete" }, { label: "Rețetă nouă" }]}
      />
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Toate materialele fizice au deja o rețetă definită (sau nu există încă niciun material
          fizic - adaugă unul în{" "}
          <Link className="underline" href="/itemi/nou">
            Materiale
          </Link>
          ).
        </p>
      ) : (
        <RecipeNewForm items={items} />
      )}
    </div>
  );
}
