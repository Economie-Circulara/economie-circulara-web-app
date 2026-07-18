import Link from "next/link";
import { Award } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { getCertificateByOrderId } from "@/features/certificates/service";
import { DocumentList } from "@/features/documents/document-list";
import { listDocuments } from "@/features/documents/service";
import { listOrders } from "@/features/orders/queries";

export const metadata = { title: "Documente & Certificate — Lateris Trace" };

const dateFormatter = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" });

/**
 * Ecranul „Documente & Certificate": documentele proprii ale firmei (contracte
 * arhivate etc., `owner_type='client'`) + certificatele comenzilor inchise —
 * doar consultare/descarcare, fara upload (Task H, punctul 4). Comenzile si
 * certificatele sunt RLS-scoped la clientul curent, la fel ca in
 * `/comenzile-mele`.
 */
export default async function DocumentePage() {
  const user = await requireRole(["client"]);

  const [clientDocuments, closedOrders] = await Promise.all([
    user.clientId ? listDocuments("client", user.clientId) : Promise.resolve([]),
    listOrders({ status: "closed" }),
  ]);

  const certificates = (
    await Promise.all(
      closedOrders.map(async (order) => ({
        order,
        certificate: await getCertificateByOrderId(order.id),
      })),
    )
  ).filter(
    (
      row,
    ): row is {
      order: (typeof closedOrders)[number];
      certificate: NonNullable<Awaited<ReturnType<typeof getCertificateByOrderId>>>;
    } => row.certificate !== null,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Documente & Certificate"
        description="Documentele firmei și certificatele de trasabilitate."
      />

      <section className="max-w-3xl space-y-3">
        <h2 className="text-lg font-semibold">Documente</h2>
        <DocumentList documents={clientDocuments} canDelete={false} revalidatePath="/documente" />
      </section>

      <section className="max-w-3xl space-y-3">
        <h2 className="text-lg font-semibold">Certificate de trasabilitate</h2>
        {certificates.length === 0 ? (
          <EmptyState
            icon={<Award />}
            title="Niciun certificat"
            description="Certificatele apar automat la închiderea comenzilor livrate."
          />
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {certificates.map(({ order, certificate }) => (
              <li
                key={certificate.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{certificate.number}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.orderNumber ?? "Comandă"} · emis{" "}
                    {dateFormatter.format(new Date(certificate.issuedAt))}
                  </p>
                </div>
                <Link
                  href={`/comenzile-mele/${order.id}/certificat`}
                  className="text-sm font-medium text-accent hover:underline"
                >
                  Vezi certificat
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
