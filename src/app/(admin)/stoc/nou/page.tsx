import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { listItemOptions } from "@/features/stock/queries";
import { LotForm } from "@/features/stock/lot-form";

export const metadata = { title: "Adaugă lot — Lateris Trace" };

/** Formular adăugare lot nou în stoc (doar staff). */
export default async function StocNouPage() {
  await requireRole(["admin", "operator"]);
  const items = await listItemOptions();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Adaugă lot"
        description="Înregistrează un lot nou cu proveniență."
        breadcrumbs={[{ label: "Stoc", href: "/stoc" }, { label: "Lot nou" }]}
      />
      <LotForm items={items} />
    </div>
  );
}
