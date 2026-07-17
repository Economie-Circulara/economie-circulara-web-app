import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/features/auth/session";
import { PROVENANCE_LABELS, PROVENANCE_OPTIONS } from "@/features/stock/labels";
import { listItemOptions, listLots } from "@/features/stock/queries";
import { StockTable } from "@/features/stock/stock-table";
import type { LotProvenance } from "@/features/stock/types";

export const metadata = { title: "Stoc — Lateris Trace" };

const selectClassName =
  "flex h-9 w-56 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none";

interface StocPageProps {
  searchParams: Promise<{ item_id?: string; provenance?: string }>;
}

/** Ecranul Stoc — lista loturilor (doar staff), cu filtre pe item si proveniență. */
export default async function StocPage({ searchParams }: StocPageProps) {
  await requireRole(["admin", "operator"]);
  const params = await searchParams;

  const provenanceParam = params.provenance ?? "";
  const provenance = (PROVENANCE_OPTIONS as string[]).includes(provenanceParam)
    ? (provenanceParam as LotProvenance)
    : undefined;
  const itemId = params.item_id || undefined;

  const [lots, items] = await Promise.all([listLots({ itemId, provenance }), listItemOptions()]);

  const hasFilters = Boolean(itemId || provenance);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stoc"
        description="Loturile aflate în stoc, proveniența și cantitățile lor."
        actions={
          <Button asChild>
            <Link href="/stoc/nou">+ Adaugă lot</Link>
          </Button>
        }
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor="item_id" className="text-sm font-medium">
            Item
          </label>
          <select
            id="item_id"
            name="item_id"
            defaultValue={itemId ?? ""}
            className={selectClassName}
          >
            <option value="">Toți itemii</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="provenance" className="text-sm font-medium">
            Proveniență
          </label>
          <select
            id="provenance"
            name="provenance"
            defaultValue={provenance ?? ""}
            className={selectClassName}
          >
            <option value="">Toate</option>
            {PROVENANCE_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {PROVENANCE_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          Filtrează
        </Button>
        {hasFilters ? (
          <Button asChild variant="ghost">
            <Link href="/stoc">Resetează</Link>
          </Button>
        ) : null}
      </form>

      <StockTable lots={lots} />
    </div>
  );
}
