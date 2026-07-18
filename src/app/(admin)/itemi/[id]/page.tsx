import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/features/auth/session";
import { getItemById } from "@/features/items/queries";
import { ItemForm } from "@/features/items/item-form";

export const metadata = { title: "Editează item — Lateris Trace" };

interface ItemDetailPageProps {
  params: Promise<{ id: string }>;
}

/** Formular editare item existent — doar staff. */
export default async function ItemDetailPage({ params }: ItemDetailPageProps) {
  await requireRole(["admin", "operator"]);
  const { id } = await params;

  const item = await getItemById(id);
  if (!item) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.title}
        description="Editează detaliile itemului."
        breadcrumbs={[{ label: "Itemi", href: "/itemi" }, { label: item.title }]}
        actions={
          item.kind === "physical" ? (
            <Button asChild variant="outline">
              <Link href={`/retete/${item.id}`}>Rețetă</Link>
            </Button>
          ) : undefined
        }
      />
      <ItemForm item={item} />
    </div>
  );
}
