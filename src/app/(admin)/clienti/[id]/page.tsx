import { notFound } from "next/navigation";
import { History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { AddressSection } from "@/features/clients/address-section";
import { initialClientFormState } from "@/features/clients/action-state";
import { updateClientAction } from "@/features/clients/actions";
import { ClientForm } from "@/features/clients/client-form";
import { getClient, listClientAddresses } from "@/features/clients/queries";
import { DocumentList } from "@/features/documents/document-list";
import { DocumentUpload } from "@/features/documents/document-upload";
import { listDocuments } from "@/features/documents/service";

export const metadata = { title: "Detalii client — Lateris Trace" };

interface ClientDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Ecranul de detaliu/editare client (doar staff): date firmă, adrese de livrare
 * (CRUD, o singură adresă implicită), documente (inclusiv contracte arhivate —
 * decizie 2026-07) și istoric comenzi — placeholder, populat de Task E.
 */
export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  await requireRole(["admin", "operator"]);
  const { id } = await params;

  const client = await getClient(id);
  if (!client) notFound();

  const [addresses, documents] = await Promise.all([
    listClientAddresses(id),
    listDocuments("client", id),
  ]);

  const revalidateTarget = `/clienti/${id}`;

  return (
    <div className="space-y-8">
      <PageHeader
        title={client.name}
        description={`CUI ${client.cui}`}
        breadcrumbs={[{ label: "Clienți", href: "/clienti" }, { label: client.name }]}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Date firmă</h2>
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
          Contractele semnate se arhivează aici ca documente (etichetă „Contract&rdquo;) — platforma
          nu gestionează structurat perioade/obligații/tarife contractuale.
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
          description="Istoricul comenzilor acestui client va apărea aici (Task E — Comenzi)."
        />
      </section>
    </div>
  );
}
