import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { getItemById } from "@/features/items/queries";
import { ItemForm } from "@/features/items/item-form";

export const metadata = { title: "Editează abonament - Lot cu Lot" };

interface AbonamentDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Formular editare abonament existent - doar staff. Ecranul e doar pentru
 * itemi `kind = "service"` - un material se editează pe `/itemi/[id]`.
 */
export default async function AbonamentDetailPage({ params }: AbonamentDetailPageProps) {
  await requireRole(["admin", "operator"]);
  const { id } = await params;

  const item = await getItemById(id);
  if (!item || item.kind !== "service") notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.title}
        description="Editează detaliile abonamentului."
        breadcrumbs={[{ label: "Abonamente", href: "/abonamente" }, { label: item.title }]}
      />
      <ItemForm item={item} fixedKind="service" />
    </div>
  );
}
