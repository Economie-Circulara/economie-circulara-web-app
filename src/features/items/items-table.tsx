"use client";

import Link from "next/link";
import { Package } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { KIND_BADGE_VARIANT, KIND_LABELS, UNIT_LABELS } from "./labels";
import type { ItemListRow } from "./types";

function YesNoBadge({ value }: { value: boolean }) {
  return <Badge variant={value ? "ok" : "neutral"}>{value ? "Da" : "Nu"}</Badge>;
}

const columns: ColumnDef<ItemListRow>[] = [
  {
    accessorKey: "title",
    header: "Titlu",
    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={`/itemi/${row.original.id}`} className="font-medium hover:underline">
          {row.original.title}
        </Link>
        {/* Vizibil doar cu "Arată arhivate" (migrarea 0035). */}
        {row.original.archivedAt ? <Badge variant="neutral">Arhivat</Badge> : null}
      </div>
    ),
  },
  {
    accessorKey: "kind",
    header: "Tip",
    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-1">
        <Badge variant={KIND_BADGE_VARIANT[row.original.kind]}>
          {KIND_LABELS[row.original.kind]}
        </Badge>
        {/* Itemii fizici fara urmarire de stoc (apa, aer) - migrarea 0029. */}
        {row.original.kind === "physical" && !row.original.isTracked ? (
          <Badge variant="neutral">Nelimitat</Badge>
        ) : null}
      </div>
    ),
  },
  {
    accessorKey: "unit",
    header: "UM",
    cell: ({ row }) => UNIT_LABELS[row.original.unit],
  },
  {
    accessorKey: "sellable",
    header: "Vandabil",
    cell: ({ row }) => <YesNoBadge value={row.original.sellable} />,
  },
  {
    accessorKey: "hasRecipe",
    header: "Are rețetă",
    cell: ({ row }) => <YesNoBadge value={row.original.hasRecipe} />,
  },
];

export function ItemsTable({ items }: { items: ItemListRow[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Package />}
        title="Niciun material sau serviciu în catalog"
        description="Adaugă primul material sau serviciu pentru a începe."
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={items}
      pageSize={10}
      emptyMessage="Niciun material sau serviciu găsit."
    />
  );
}
