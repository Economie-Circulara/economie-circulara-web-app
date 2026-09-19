import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { ItemForm } from "@/features/items/item-form";

export const metadata = { title: "Adaugă material sau serviciu - Lot cu Lot" };

/** Formular creare item nou (produs fizic sau serviciu) - doar staff. */
export default async function ItemiNouPage() {
  await requireRole(["admin", "operator"]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Adaugă material sau serviciu"
        description="Definește un material sau serviciu nou în catalog."
        breadcrumbs={[
          { label: "Materiale și servicii", href: "/itemi" },
          { label: "Material/serviciu nou" },
        ]}
      />
      <ItemForm />
    </div>
  );
}
