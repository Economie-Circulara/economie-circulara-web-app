import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getCurrentOrg } from "@/features/auth/queries";
import { requireRole } from "@/features/auth/session";
import { CertificateView } from "@/features/certificates/certificate-view";
import { getCertificateByOrderId } from "@/features/certificates/service";
import { listDocuments } from "@/features/documents/service";
import { getOrderDetail } from "@/features/orders/queries";

export const metadata = { title: "Certificat de trasabilitate — Lateris Trace" };

interface CertificatePageProps {
  params: Promise<{ id: string }>;
}

/**
 * Certificatul unei comenzi proprii — acelasi `CertificateView` folosit si de
 * staff (`src/app/(admin)/comenzi/[id]/certificat/page.tsx`, Task G): componenta
 * randeaza doar din snapshot-ul inghetat, fara acces la stoc/procese live.
 * `getOrderDetail`/`getCertificateByOrderId`/`listDocuments` sunt toate RLS-scoped
 * la comenzile clientului curent (`certificates_client_select`,
 * `documents_client_select` din 0001_core_schema.sql).
 */
export default async function ClientCertificatePage({ params }: CertificatePageProps) {
  await requireRole(["client"]);
  const { id } = await params;

  const order = await getOrderDetail(id);
  if (!order) notFound();

  const certificate = await getCertificateByOrderId(id);
  if (!certificate) notFound();

  const [org, documents] = await Promise.all([getCurrentOrg(), listDocuments("order", id)]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificat de trasabilitate"
        description={order.orderNumber ?? undefined}
        breadcrumbs={[
          { label: "Comenzile mele", href: "/comenzile-mele" },
          { label: order.orderNumber ?? "Comandă", href: `/comenzile-mele/${id}` },
          { label: "Certificat" },
        ]}
      />

      <CertificateView
        certificateId={certificate.id}
        number={certificate.number}
        issuedAt={certificate.issuedAt}
        orgName={org?.name ?? "Lateris Trace"}
        snapshot={certificate.snapshot}
        documents={documents}
      />
    </div>
  );
}
