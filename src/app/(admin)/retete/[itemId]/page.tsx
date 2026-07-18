import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { getItemById, listItemOptions } from "@/features/items/queries";
import { getRecipeByItemId } from "@/features/recipes/queries";
import { RecipeEditor } from "@/features/recipes/recipe-editor";
import { CreateRecipeButton } from "@/features/recipes/create-recipe-button";

export const metadata = { title: "Rețetă — Lateris Trace" };

interface RecipeEditorPageProps {
  params: Promise<{ itemId: string }>;
}

/** Editor rețetă pentru un item — creeaza reteta daca nu exista inca, altfel o editeaza. */
export default async function RecipeEditorPage({ params }: RecipeEditorPageProps) {
  await requireRole(["admin", "operator"]);
  const { itemId } = await params;

  const item = await getItemById(itemId);
  if (!item) notFound();

  if (item.kind !== "physical") {
    return (
      <div className="space-y-6">
        <PageHeader
          title={`Rețetă — ${item.title}`}
          breadcrumbs={[{ label: "Rețete", href: "/retete" }, { label: item.title }]}
        />
        <p className="text-sm text-muted-foreground">
          Rețetele se pot defini doar pentru itemi de tip fizic. „{item.title}” este un serviciu.
        </p>
      </div>
    );
  }

  const recipe = await getRecipeByItemId(itemId);
  const componentOptions = recipe
    ? await listItemOptions({ kind: "physical", excludeId: itemId })
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Rețetă — ${item.title}`}
        description={`Unitate de măsură: ${item.unit}.`}
        breadcrumbs={[{ label: "Rețete", href: "/retete" }, { label: item.title }]}
      />
      {recipe ? (
        <RecipeEditor recipe={recipe} componentOptions={componentOptions} />
      ) : (
        <CreateRecipeButton itemId={itemId} />
      )}
    </div>
  );
}
