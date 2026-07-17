import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { ItemForm } from "@/features/items/item-form";

export const metadata = { title: "Adaugă item — Lateris Trace" };

/** Formular creare item nou (produs fizic sau serviciu) — doar staff. */
export default async function ItemiNouPage() {
  await requireRole(["admin", "operator"]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Adaugă item"
        description="Definește un item nou în catalog — produs fizic sau serviciu."
        breadcrumbs={[{ label: "Itemi", href: "/itemi" }, { label: "Item nou" }]}
      />
      <ItemForm />
    </div>
  );
}
