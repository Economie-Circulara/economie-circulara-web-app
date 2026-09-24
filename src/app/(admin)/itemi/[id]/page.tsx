import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/features/auth/session";
import { getItemById } from "@/features/items/queries";
import { ItemForm } from "@/features/items/item-form";

export const metadata = { title: "Editează material - Lot cu Lot" };

interface ItemDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Formular editare material existent - doar staff. Ecranul e doar pentru
 * itemi `kind = "physical"` - un abonament se editează pe `/abonamente/[id]`.
 */
export default async function ItemDetailPage({ params }: ItemDetailPageProps) {
  await requireRole(["admin", "operator"]);
  const { id } = await params;

  const item = await getItemById(id);
  if (!item || item.kind !== "physical") notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.title}
        description="Editează detaliile materialului."
        breadcrumbs={[{ label: "Materiale", href: "/itemi" }, { label: item.title }]}
        actions={
          <Button asChild variant="outline">
            <Link href={`/retete/${item.id}`}>Rețetă</Link>
          </Button>
        }
      />
      <ItemForm item={item} fixedKind="physical" />
    </div>
  );
}
