import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireRole } from "@/features/auth/session";
import { summarizeFuelEntries } from "@/features/fleet/calc";
import { FuelEntriesTable } from "@/features/fleet/fuel-entries-table";
import { FuelSummaryCards } from "@/features/fleet/fuel-summary";
import { vehicleLabel } from "@/features/fleet/labels";
import { listFuelEntries, listVehicles } from "@/features/fleet/queries";
import { requireModule } from "@/features/modules/guard";

export const metadata = { title: "Jurnal alimentări" };

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none sm:w-56";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface AlimentariPageProps {
  searchParams: Promise<{ vehicul?: string; de_la?: string; pana_la?: string }>;
}

/** Jurnalul de alimentari al flotei, filtrabil pe vehicul si perioada, cu totaluri. */
export default async function AlimentariPage({ searchParams }: AlimentariPageProps) {
  await requireRole(["admin", "operator"]);
  await requireModule("fleet");
  const params = await searchParams;
  const vehicleId = params.vehicul || undefined;
  const from = params.de_la && DATE_RE.test(params.de_la) ? params.de_la : undefined;
  const to = params.pana_la && DATE_RE.test(params.pana_la) ? params.pana_la : undefined;

  // Filtrul arata si vehiculele arhivate: jurnalul e istoric.
  const [vehicles, entries] = await Promise.all([
    listVehicles({ includeArchived: true }),
    listFuelEntries({ vehicleId, from, to }),
  ]);
  const hasFilters = Boolean(vehicleId || from || to);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jurnal alimentări"
        description="Toate alimentările flotei, cu bonurile atașate."
        breadcrumbs={[{ label: "Flotă", href: "/flota" }, { label: "Alimentări" }]}
        actions={
          <Button asChild>
            <Link href="/flota/alimentari/nou">+ Adaugă alimentare</Link>
          </Button>
        }
      />
      <form method="get" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1.5">
          <label htmlFor="vehicul" className="text-sm font-medium">
            Vehicul
          </label>
          <select
            id="vehicul"
            name="vehicul"
            defaultValue={vehicleId ?? ""}
            className={selectClassName}
          >
            <option value="">Toate</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicleLabel(vehicle)}
                {vehicle.archivedAt ? " (arhivat)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 sm:w-44">
          <label htmlFor="de_la" className="text-sm font-medium">
            De la
          </label>
          <Input id="de_la" name="de_la" type="date" defaultValue={from ?? ""} />
        </div>
        <div className="space-y-1.5 sm:w-44">
          <label htmlFor="pana_la" className="text-sm font-medium">
            Până la
          </label>
          <Input id="pana_la" name="pana_la" type="date" defaultValue={to ?? ""} />
        </div>
        <Button type="submit" variant="outline">
          Filtrează
        </Button>
        {hasFilters ? (
          <Button asChild variant="ghost">
            <Link href="/flota/alimentari">Resetează</Link>
          </Button>
        ) : null}
      </form>
      <FuelSummaryCards summary={summarizeFuelEntries(entries)} />
      <FuelEntriesTable entries={entries} />
    </div>
  );
}
