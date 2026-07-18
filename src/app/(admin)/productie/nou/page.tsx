import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { listRecipes } from "@/features/recipes/queries";
import { listItemOptions } from "@/features/items/queries";
import { ProcessWizard } from "@/features/production/process-wizard";

export const metadata = { title: "Pornește proces — Lateris Trace" };

/**
 * Ecranul de pornire proces — doua sub-fluxuri (4a output fix / 4b output
 * variabil). Datele initiale (retete + itemi fizici) se incarca server-side;
 * preview-ul FIFO si confirmarea sunt server actions apelate din wizard.
 */
export default async function ProductieNouPage() {
  await requireRole(["admin", "operator"]);

  const [recipes, inputItems] = await Promise.all([
    listRecipes(),
    listItemOptions({ kind: "physical" }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pornește proces"
        description="Producție (output fix) sau reciclare / recondiționare (input fix, output variabil)."
        breadcrumbs={[{ label: "Producție", href: "/productie" }, { label: "Proces nou" }]}
      />

      <ProcessWizard recipes={recipes} inputItems={inputItems} />
    </div>
  );
}
