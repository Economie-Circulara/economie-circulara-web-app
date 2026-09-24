import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireRole } from "@/features/auth/session";
import { KIND_LABELS, KIND_OPTIONS } from "@/features/items/labels";
import { listItems } from "@/features/items/queries";
import { ItemsTable } from "@/features/items/items-table";
import type { ItemKind } from "@/features/items/types";

export const metadata = { title: "Materiale și servicii - Lot cu Lot" };

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none sm:w-48";

interface ItemiPageProps {
  searchParams: Promise<{ kind?: string; sellable?: string; q?: string; arhivate?: string }>;
}

/** Ecranul Itemi - catalogul (definitie), doar staff, cu filtre + cautare. */
export default async function ItemiPage({ searchParams }: ItemiPageProps) {
  await requireRole(["admin", "operator"]);
  const params = await searchParams;

  const kindParam = params.kind ?? "";
  const kind = (KIND_OPTIONS as string[]).includes(kindParam) ? (kindParam as ItemKind) : undefined;
  const sellable =
    params.sellable === "true" ? true : params.sellable === "false" ? false : undefined;
  const search = params.q?.trim() || undefined;

  const includeArchived = params.arhivate === "1";

  const items = await listItems({ kind, sellable, search, includeArchived });
  const hasFilters = Boolean(kind || sellable !== undefined || search || includeArchived);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Materiale și servicii"
        description="Catalogul de materiale (fizice) și servicii - definiție, fără prețuri."
        actions={
          <Button asChild>
            <Link href="/itemi/nou">+ Adaugă material sau serviciu</Link>
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
          <label htmlFor="kind" className="text-sm font-medium">
            Tip
          </label>
          <select id="kind" name="kind" defaultValue={kind ?? ""} className={selectClassName}>
            <option value="">Toate</option>
            {KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
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

      <ItemsTable items={items} />
    </div>
  );
}
