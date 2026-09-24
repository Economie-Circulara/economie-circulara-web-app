import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { ItemForm } from "@/features/items/item-form";

export const metadata = { title: "Adaugă material - Lot cu Lot" };

/** Formular creare material nou (item fizic) - doar staff. Tipul e fixat de ecran. */
export default async function ItemiNouPage() {
  await requireRole(["admin", "operator"]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Adaugă material"
        description="Definește un material fizic nou în catalog."
        breadcrumbs={[{ label: "Materiale", href: "/itemi" }, { label: "Material nou" }]}
      />
      <ItemForm fixedKind="physical" />
    </div>
  );
}
