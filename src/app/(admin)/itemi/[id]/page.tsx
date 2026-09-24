import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/features/auth/session";
import { archiveItemAction, restoreItemAction } from "@/features/items/actions";
import { getItemById } from "@/features/items/queries";
import { ItemForm } from "@/features/items/item-form";

export const metadata = { title: "Editează material/serviciu - Lot cu Lot" };

interface ItemDetailPageProps {
  params: Promise<{ id: string }>;
}

/** Formular editare item existent - doar staff. */
export default async function ItemDetailPage({ params }: ItemDetailPageProps) {
  await requireRole(["admin", "operator"]);
  const { id } = await params;

  const item = await getItemById(id);
  if (!item) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.title}
        description="Editează detaliile materialului sau serviciului."
        breadcrumbs={[{ label: "Materiale și servicii", href: "/itemi" }, { label: item.title }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {item.kind === "physical" ? (
              <Button asChild variant="outline">
                <Link href={`/retete/${item.id}`}>Rețetă</Link>
              </Button>
            ) : null}
            {item.archivedAt ? (
              <ConfirmActionButton
                triggerLabel="Restaurează"
                title="Restaurezi acest material/serviciu?"
                description="Va apărea din nou în liste și va putea fi folosit în comenzi, rețete și intrări de stoc."
                confirmLabel="Da, restaurează"
                confirmVariant="default"
                action={restoreItemAction.bind(null, item.id)}
              />
            ) : (
              <ConfirmActionButton
                triggerLabel="Arhivează"
                title="Arhivezi acest material/serviciu?"
                description="Nu va mai apărea în liste și nu va mai putea fi ales în comenzi, rețete sau intrări de stoc. Istoricul (loturi, comenzi, certificate) rămâne neschimbat. Îl poți restaura oricând."
                confirmLabel="Da, arhivează"
                action={archiveItemAction.bind(null, item.id)}
              />
            )}
          </div>
        }
      />
      {item.archivedAt ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="neutral">Arhivat</Badge>
          Acest material/serviciu este arhivat - ascuns din liste și din selecturi.
        </p>
      ) : null}
      <ItemForm item={item} />
    </div>
  );
}
