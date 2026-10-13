import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/features/auth/session";
import { listVehicles } from "@/features/fleet/queries";
import { VehiclesTable } from "@/features/fleet/vehicles-table";
import { requireModule } from "@/features/modules/guard";

export const metadata = { title: "Flotă" };

interface FlotaPageProps {
  searchParams: Promise<{ arhivate?: string }>;
}

/** Lista vehiculelor (modulul Flotă, migrarea 0056) - staff, doar cu modulul activ. */
export default async function FlotaPage({ searchParams }: FlotaPageProps) {
  await requireRole(["admin", "operator"]);
  await requireModule("fleet");
  const includeArchived = (await searchParams).arhivate === "1";
  const vehicles = await listVehicles({ includeArchived });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flotă"
        description="Vehiculele proprii și consumul lor de combustibil."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/flota/alimentari">Jurnal alimentări</Link>
            </Button>
            <Button asChild>
              <Link href="/flota/nou">+ Adaugă vehicul</Link>
            </Button>
          </div>
        }
      />
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="arhivate"
            value="1"
            defaultChecked={includeArchived}
            className="size-4"
          />
          Arată arhivate
        </label>
        <Button type="submit" variant="outline">
          Filtrează
        </Button>
      </form>
      <VehiclesTable vehicles={vehicles} />
    </div>
  );
}
