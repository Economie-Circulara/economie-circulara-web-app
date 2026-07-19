import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { DeliveryTable } from "@/features/deliveries/delivery-table";
import { listDeliveries } from "@/features/deliveries/queries";

export const metadata = { title: "Livrări — Lateris Trace" };

/**
 * Ecranul „Livrări" (Task X5) — lista livrarilor planificate (toate comenzile
 * organizatiei), cu statusul declaratiei e-Transport. Doar staff (admin/operator);
 * planificarea unei livrari noi se face din detaliul comenzii (buton „Planifică
 * livrare", vizibil doar pt. comenzi acceptate fara livrare deja planificata).
 */
export default async function LivrariPage() {
  await requireRole(["admin", "operator"]);

  const deliveries = await listDeliveries();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Livrări"
        description="Planificare transport, aviz de însoțire și declarare RO e-Transport."
      />
      <DeliveryTable deliveries={deliveries} />
    </div>
  );
}
