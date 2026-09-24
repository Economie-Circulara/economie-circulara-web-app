import { notFound } from "next/navigation";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/features/auth/session";
import { archiveRecipeAction, restoreRecipeAction } from "@/features/recipes/actions";
import { getItemById, listItemOptions } from "@/features/items/queries";
import { getRecipeByItemId } from "@/features/recipes/queries";
import { RecipeEditor } from "@/features/recipes/recipe-editor";
import { CreateRecipeButton } from "@/features/recipes/create-recipe-button";

export const metadata = { title: "Rețetă - Lot cu Lot" };

interface RecipeEditorPageProps {
  params: Promise<{ itemId: string }>;
}

/** Editor rețetă pentru un item - creeaza reteta daca nu exista inca, altfel o editeaza. */
export default async function RecipeEditorPage({ params }: RecipeEditorPageProps) {
  await requireRole(["admin", "operator"]);
  const { itemId } = await params;

  const item = await getItemById(itemId);
  if (!item) notFound();

  if (item.kind !== "physical") {
    return (
      <div className="space-y-6">
        <PageHeader
          title={`Rețetă - ${item.title}`}
          breadcrumbs={[{ label: "Rețete", href: "/retete" }, { label: item.title }]}
        />
        <p className="text-sm text-muted-foreground">
          Rețetele se pot defini doar pentru itemi de tip fizic. &quot;{item.title}&quot; este un
          serviciu.
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
        title={`Rețetă - ${item.title}`}
        description={`Unitate de măsură: ${item.unit}.`}
        breadcrumbs={[{ label: "Rețete", href: "/retete" }, { label: item.title }]}
        actions={
          recipe ? (
            recipe.recipeArchivedAt ? (
              <ConfirmActionButton
                triggerLabel="Restaurează rețeta"
                title="Restaurezi această rețetă?"
                description="Rețeta va putea fi folosită din nou în producție."
                confirmLabel="Da, restaurează"
                confirmVariant="default"
                action={restoreRecipeAction.bind(null, recipe.recipeId, item.id)}
              />
            ) : (
              <ConfirmActionButton
                triggerLabel="Arhivează rețeta"
                title="Arhivezi această rețetă?"
                description="Rețeta nu va mai putea fi folosită în producție și nu va mai apărea în listă. Procesele deja făcute cu ea rămân neschimbate. O poți restaura oricând."
                confirmLabel="Da, arhivează"
                action={archiveRecipeAction.bind(null, recipe.recipeId, item.id)}
              />
            )
          ) : undefined
        }
      />
      {recipe?.archivedAt ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="neutral">Arhivată</Badge>
          {recipe.recipeArchivedAt
            ? "Rețeta este arhivată - nu poate fi folosită în producție."
            : "Materialul acestei rețete este arhivat - rețeta nu poate fi folosită în producție."}
        </p>
      ) : null}
      {recipe ? (
        <RecipeEditor recipe={recipe} componentOptions={componentOptions} />
      ) : (
        <CreateRecipeButton itemId={itemId} />
      )}
    </div>
  );
}
