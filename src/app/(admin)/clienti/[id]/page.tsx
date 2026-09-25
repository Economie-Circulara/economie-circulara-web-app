import { notFound } from "next/navigation";
import { History } from "lucide-react";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { AddressSection } from "@/features/clients/address-section";
import { initialClientFormState } from "@/features/clients/action-state";
import {
  archiveClientAction,
  restoreClientAction,
  updateClientAction,
} from "@/features/clients/actions";
import { ClientForm } from "@/features/clients/client-form";
import { ClientPortalInvite } from "@/features/clients/invite-portal-access";
import { getClient, listClientAddresses } from "@/features/clients/queries";
import { getClientPortalStatus } from "@/features/settings/queries";
import { DocumentList } from "@/features/documents/document-list";
import { DocumentUpload } from "@/features/documents/document-upload";
import { listDocuments } from "@/features/documents/service";

export const metadata = { title: "Detalii client - Lot cu Lot" };

interface ClientDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ inviteWarning?: string }>;
}

/**
 * Ecranul de detaliu/editare client (doar staff): date firmă, adrese de livrare
 * (CRUD, o singură adresă implicită), documente (inclusiv contracte arhivate -
 * decizie 2026-07) și istoric comenzi - placeholder, populat de Task E.
 */
export default async function ClientDetailPage({ params, searchParams }: ClientDetailPageProps) {
  const user = await requireRole(["admin", "operator"]);
  const { id } = await params;
  const { inviteWarning } = await searchParams;

  const client = await getClient(id);
  if (!client) notFound();

  const [addresses, documents, portal] = await Promise.all([
    listClientAddresses(id),
    listDocuments("client", id),
    getClientPortalStatus(id),
  ]);

  const revalidateTarget = `/clienti/${id}`;

  return (
    <div className="space-y-8">
      <PageHeader
        title={client.name}
        description={`CUI ${client.cui}`}
        breadcrumbs={[{ label: "Clienți", href: "/clienti" }, { label: client.name }]}
        actions={
          client.archivedAt ? (
            <ConfirmActionButton
              triggerLabel="Restaurează"
              title="Restaurezi acest client?"
              description="Clientul va apărea din nou în liste și în formularul de comandă, iar utilizatorul lui (dacă are cont în portal) se va putea loga din nou."
              confirmLabel="Da, restaurează"
              confirmVariant="default"
              action={restoreClientAction.bind(null, client.id)}
            />
          ) : (
            <ConfirmActionButton
              triggerLabel="Arhivează"
              title="Arhivezi acest client?"
              description="Clientul nu va mai apărea în liste și nu va mai putea primi comenzi noi. Utilizatorul lui din portal nu se va mai putea loga. Comenzile, documentele și certificatele existente rămân neschimbate. Îl poți restaura oricând."
              confirmLabel="Da, arhivează"
              action={archiveClientAction.bind(null, client.id)}
            />
          )
        }
      />

      {client.archivedAt ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="neutral">Arhivat</Badge>
          Clientul este arhivat - ascuns din liste, iar accesul lui în portal este blocat.
        </p>
      ) : null}

      {inviteWarning ? (
        <p className="rounded-md border border-warn bg-warn-bg px-3 py-2 text-sm text-warn">
          {inviteWarning}
        </p>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Date firmă</h2>
          <ClientPortalInvite
            clientId={id}
            defaultEmail={client.email}
            portal={portal}
            canInvite={user.role === "admin"}
          />
        </div>
        <ClientForm
          mode="edit"
          action={updateClientAction}
          initialState={initialClientFormState}
          client={client}
        />
      </section>

      <section className="max-w-2xl space-y-3">
        <h2 className="text-lg font-semibold">Adrese de livrare</h2>
        <AddressSection clientId={id} addresses={addresses} />
      </section>

      <section className="max-w-2xl space-y-3">
        <h2 className="text-lg font-semibold">Documente</h2>
        <p className="text-sm text-muted-foreground">
          Contractele semnate se arhivează aici ca documente (etichetă &quot;Contract&quot;) -
          platforma nu gestionează structurat perioade/obligații/tarife contractuale.
        </p>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Încarcă document nou</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentUpload ownerType="client" ownerId={id} revalidatePath={revalidateTarget} />
          </CardContent>
        </Card>
        <DocumentList documents={documents} canDelete revalidatePath={revalidateTarget} />
      </section>

      <section className="max-w-2xl space-y-3">
        <h2 className="text-lg font-semibold">Istoric comenzi</h2>
        <EmptyState
          icon={<History />}
          title="În curând"
          description="Istoricul comenzilor acestui client va apărea aici (Task E - Comenzi)."
        />
      </section>
    </div>
  );
}
