import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { getCurrentOrg } from "@/features/auth/queries";
import { CertificateView } from "@/features/certificates/certificate-view";
import { getCertificateByOrderId } from "@/features/certificates/service";
import { listDocuments } from "@/features/documents/service";
import { getOrderDetail } from "@/features/orders/queries";

export const metadata = { title: "Certificat de trasabilitate — Lateris Trace" };

interface CertificatePageProps {
  params: Promise<{ id: string }>;
}

/**
 * Ecranul „Certificat" (Task G, mockup docs/design/Lateris_Trace.dc.html) —
 * doar staff. Certificatul se genereaza AUTOMAT la inchiderea comenzii (hook in
 * `orders/notifications.ts`); aceasta pagina doar il afiseaza — daca nu exista
 * inca (comanda nu a ajuns la `closed`, sau generarea a eșuat), 404.
 */
export default async function CertificatePage({ params }: CertificatePageProps) {
  await requireRole(["admin", "operator"]);
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
          { label: "Comenzi", href: "/comenzi" },
          { label: order.orderNumber ?? "Comandă", href: `/comenzi/${id}` },
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
