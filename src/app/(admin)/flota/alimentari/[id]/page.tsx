import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { todayInRomania } from "@/features/fleet/dates";
import { FuelEntryForm } from "@/features/fleet/fuel-entry-form";
import { formatDay } from "@/features/fleet/labels";
import { getFuelEntry, listVehicles } from "@/features/fleet/queries";
import { requireModule } from "@/features/modules/guard";

export const metadata = { title: "Alimentare" };

interface AlimentarePageProps {
  params: Promise<{ id: string }>;
}

/** Corectarea unei alimentari (nu se sterg - decizie 2026-10-10). */
export default async function AlimentarePage({ params }: AlimentarePageProps) {
  await requireRole(["admin", "operator"]);
  await requireModule("fleet");
  const { id } = await params;
  const [entry, vehicles] = await Promise.all([getFuelEntry(id), listVehicles()]);
  if (!entry) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Alimentare ${formatDay(entry.filledOn)} - ${entry.vehicleName}`}
        description="Alimentările nu se șterg; o greșeală se corectează aici."
        breadcrumbs={[
          { label: "Flotă", href: "/flota" },
          { label: "Alimentări", href: "/flota/alimentari" },
          { label: formatDay(entry.filledOn) },
        ]}
      />
      <FuelEntryForm vehicles={vehicles} entry={entry} today={todayInRomania()} />
    </div>
  );
}
