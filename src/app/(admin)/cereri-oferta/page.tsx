import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { listQuoteRequests } from "@/features/quote-requests/queries";
import { QuoteRequestTable } from "@/features/quote-requests/quote-request-table";

export const metadata = { title: "Cereri de ofertă" };

/**
 * Cererile trimise din formularul „Cere o ofertă” de pe site-ul de prezentare
 * (migrarea 0051, plan docs/plans/site-cerere-oferta.md). Doar staff; fiecare cerere
 * ajunge si pe email, iar aici se tine evidenta celor rezolvate.
 */
export default async function CereriOfertaPage() {
  await requireRole(["admin", "operator"]);
  const requests = await listQuoteRequests();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cereri de ofertă"
        description="Trimise din formularul de pe site. Sunați sau scrieți solicitantului, apoi marcați cererea rezolvată."
      />
      <QuoteRequestTable requests={requests} />
    </div>
  );
}
