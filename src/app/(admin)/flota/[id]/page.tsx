import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/features/auth/session";
import { archiveVehicleAction, restoreVehicleAction } from "@/features/fleet/actions";
import { odometerStats, summarizeFuelEntries } from "@/features/fleet/calc";
import { FuelEntriesTable } from "@/features/fleet/fuel-entries-table";
import { FuelSummaryCards } from "@/features/fleet/fuel-summary";
import { vehicleLabel } from "@/features/fleet/labels";
import { OdometerSummary } from "@/features/fleet/odometer-summary";
import { getVehicle, listFuelEntries } from "@/features/fleet/queries";
import { VehicleForm } from "@/features/fleet/vehicle-form";
import { requireModule } from "@/features/modules/guard";

export const metadata = { title: "Vehicul" };

interface VehiclePageProps {
  params: Promise<{ id: string }>;
}

/** Detaliul unui vehicul: totaluri, alimentari, editare, arhivare. */
export default async function VehiclePage({ params }: VehiclePageProps) {
  await requireRole(["admin", "operator"]);
  await requireModule("fleet");
  const { id } = await params;

  const vehicle = await getVehicle(id);
  if (!vehicle) notFound();
  const entries = await listFuelEntries({ vehicleId: id });

  return (
    <div className="space-y-6">
      <PageHeader
        title={vehicleLabel(vehicle)}
        breadcrumbs={[{ label: "Flotă", href: "/flota" }, { label: vehicle.name }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {vehicle.archivedAt ? null : (
              <Button asChild>
                <Link href={`/flota/alimentari/nou?vehicul=${vehicle.id}`}>+ Alimentare</Link>
              </Button>
            )}
            {vehicle.archivedAt ? (
              <ConfirmActionButton
                triggerLabel="Restaurează"
                title="Restaurezi acest vehicul?"
                description="Va apărea din nou în listă și va putea fi ales la alimentări."
                confirmLabel="Da, restaurează"
                confirmVariant="default"
                action={restoreVehicleAction.bind(null, vehicle.id)}
              />
            ) : (
              <ConfirmActionButton
                triggerLabel="Arhivează"
                title="Arhivezi acest vehicul?"
                description="Nu va mai apărea în listă și nu va mai putea fi ales la alimentări noi. Alimentările lui rămân în jurnal. Îl poți restaura oricând."
                confirmLabel="Da, arhivează"
                action={archiveVehicleAction.bind(null, vehicle.id)}
              />
            )}
          </div>
        }
      />
      {vehicle.archivedAt ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="neutral">Arhivat</Badge>
          Acest vehicul este arhivat - nu mai poate fi ales la alimentări noi.
        </p>
      ) : null}

      <FuelSummaryCards summary={summarizeFuelEntries(entries)} />
      <OdometerSummary
        stats={odometerStats(entries)}
        declaredConsumption={vehicle.consumptionLPer100km}
      />

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Alimentări</h2>
        <FuelEntriesTable entries={entries} showVehicle={false} />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Detalii vehicul</h2>
        <VehicleForm vehicle={vehicle} />
      </section>
    </div>
  );
}
