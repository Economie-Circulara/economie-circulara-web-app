import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/features/auth/session";
import { archiveItemAction, restoreItemAction } from "@/features/items/actions";
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
        actions={
          item.archivedAt ? (
            <ConfirmActionButton
              triggerLabel="Restaurează"
              title="Restaurezi acest abonament?"
              description="Va apărea din nou în liste și va putea fi folosit în comenzi."
              confirmLabel="Da, restaurează"
              confirmVariant="default"
              action={restoreItemAction.bind(null, item.id)}
            />
          ) : (
            <ConfirmActionButton
              triggerLabel="Arhivează"
              title="Arhivezi acest abonament?"
              description="Nu va mai apărea în liste și nu va mai putea fi ales în comenzi. Istoricul (comenzi, certificate) rămâne neschimbat. Îl poți restaura oricând."
              confirmLabel="Da, arhivează"
              action={archiveItemAction.bind(null, item.id)}
            />
          )
        }
      />
      {item.archivedAt ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="neutral">Arhivat</Badge>
          Acest abonament este arhivat - ascuns din liste și din selecturi.
        </p>
      ) : null}
      <ItemForm item={item} fixedKind="service" />
    </div>
  );
}
