import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireRole } from "@/features/auth/session";
import { listItems } from "@/features/items/queries";
import { ItemsTable } from "@/features/items/items-table";

export const metadata = { title: "Abonamente - Lot cu Lot" };

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none sm:w-48";

interface AbonamentePageProps {
  searchParams: Promise<{ sellable?: string; q?: string }>;
}

/**
 * Ecranul Abonamente - catalogul itemilor `kind = "service"` (produs-ca-serviciu,
 * fără stoc), doar staff, cu filtre + căutare. Oglindește `/itemi` (Materiale),
 * dar tipul e fixat de ecran - nu mai e filtru de UI.
 */
export default async function AbonamentePage({ searchParams }: AbonamentePageProps) {
  await requireRole(["admin", "operator"]);
  const params = await searchParams;

  const sellable =
    params.sellable === "true" ? true : params.sellable === "false" ? false : undefined;
  const search = params.q?.trim() || undefined;

  const items = await listItems({ kind: "service", sellable, search });
  const hasFilters = Boolean(sellable !== undefined || search);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Abonamente"
        description="Catalogul de abonamente (produs-ca-serviciu) - definiție, fără prețuri."
        actions={
          <Button asChild>
            <Link href="/abonamente/nou">+ Adaugă abonament</Link>
          </Button>
        }
      />

      <form method="get" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1.5 sm:w-56">
          <label htmlFor="q" className="text-sm font-medium">
            Căutare
          </label>
          <Input id="q" name="q" defaultValue={search ?? ""} placeholder="Titlu..." />
        </div>
        <div className="space-y-1.5 sm:w-48">
          <label htmlFor="sellable" className="text-sm font-medium">
            Vandabil
          </label>
          <select
            id="sellable"
            name="sellable"
            defaultValue={params.sellable ?? ""}
            className={selectClassName}
          >
            <option value="">Toate</option>
            <option value="true">Da</option>
            <option value="false">Nu</option>
          </select>
        </div>
        <Button type="submit" variant="outline">
          Filtrează
        </Button>
        {hasFilters ? (
          <Button asChild variant="ghost">
            <Link href="/abonamente">Resetează</Link>
          </Button>
        ) : null}
      </form>

      <ItemsTable items={items} kind="service" />
    </div>
  );
}
