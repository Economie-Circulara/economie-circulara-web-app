import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { VehicleForm } from "@/features/fleet/vehicle-form";
import { requireModule } from "@/features/modules/guard";

export const metadata = { title: "Vehicul nou" };

export default async function VehiculNouPage() {
  await requireRole(["admin", "operator"]);
  await requireModule("fleet");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicul nou"
        description="Un nume și consumul mediu ajung; restul se poate completa oricând."
        breadcrumbs={[{ label: "Flotă", href: "/flota" }, { label: "Vehicul nou" }]}
      />
      <VehicleForm />
    </div>
  );
}
