import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { todayInRomania } from "@/features/fleet/dates";
import { FuelEntryForm } from "@/features/fleet/fuel-entry-form";
import { listVehicles } from "@/features/fleet/queries";
import { requireModule } from "@/features/modules/guard";

export const metadata = { title: "Alimentare nouă" };

interface AlimentareNouaPageProps {
  searchParams: Promise<{ vehicul?: string }>;
}

export default async function AlimentareNouaPage({ searchParams }: AlimentareNouaPageProps) {
  await requireRole(["admin", "operator"]);
  await requireModule("fleet");
  const { vehicul } = await searchParams;
  const vehicles = await listVehicles();
  const preselected = vehicles.some((v) => v.id === vehicul) ? vehicul : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alimentare nouă"
        breadcrumbs={[
          { label: "Flotă", href: "/flota" },
          { label: "Alimentări", href: "/flota/alimentari" },
          { label: "Alimentare nouă" },
        ]}
      />
      {vehicles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Adaugă întâi un vehicul în flotă, apoi alimentările lui.
        </p>
      ) : (
        <FuelEntryForm
          vehicles={vehicles}
          defaultVehicleId={preselected}
          today={todayInRomania()}
          returnTo={preselected ? `/flota/${preselected}` : "/flota/alimentari"}
        />
      )}
    </div>
  );
}
