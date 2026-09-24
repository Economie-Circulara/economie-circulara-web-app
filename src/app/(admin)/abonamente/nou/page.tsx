import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { ItemForm } from "@/features/items/item-form";

export const metadata = { title: "Adaugă abonament - Lot cu Lot" };

/** Formular creare abonament nou (item `kind = "service"`) - doar staff. Tipul e fixat de ecran. */
export default async function AbonamentNouPage() {
  await requireRole(["admin", "operator"]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Adaugă abonament"
        description="Definește un abonament nou (produs-ca-serviciu) în catalog."
        breadcrumbs={[{ label: "Abonamente", href: "/abonamente" }, { label: "Abonament nou" }]}
      />
      <ItemForm fixedKind="service" />
    </div>
  );
}
