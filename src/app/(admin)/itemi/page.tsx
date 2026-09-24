import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireRole } from "@/features/auth/session";
import { listItems } from "@/features/items/queries";
import { ItemsTable } from "@/features/items/items-table";

export const metadata = { title: "Materiale - Lot cu Lot" };

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none sm:w-48";

interface ItemiPageProps {
  searchParams: Promise<{ sellable?: string; q?: string; arhivate?: string }>;
}

/**
 * Ecranul Materiale - catalogul itemilor fizici (definitie), doar staff, cu
 * filtre + cautare. Abonamentele (`kind = "service"`) au ecran propriu
 * (`/abonamente`) - aici tipul e fixat, nu mai e filtru de UI.
 */
export default async function ItemiPage({ searchParams }: ItemiPageProps) {
  await requireRole(["admin", "operator"]);
  const params = await searchParams;

  const sellable =
    params.sellable === "true" ? true : params.sellable === "false" ? false : undefined;
  const search = params.q?.trim() || undefined;

  const includeArchived = params.arhivate === "1";

  const items = await listItems({ kind: "physical", sellable, search, includeArchived });
  const hasFilters = Boolean(sellable !== undefined || search || includeArchived);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Materiale"
        description="Catalogul de materiale fizice - definiție, fără prețuri."
        actions={
          <Button asChild>
            <Link href="/itemi/nou">+ Adaugă material</Link>
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
        {/* Arhivatele sunt ascunse implicit (migrarea 0035) - comutator explicit. */}
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
        {hasFilters ? (
          <Button asChild variant="ghost">
            <Link href="/itemi">Resetează</Link>
          </Button>
        ) : null}
      </form>

      <ItemsTable items={items} kind="physical" />
    </div>
  );
}
