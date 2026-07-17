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
      <Link href={`/itemi/${row.original.id}`} className="font-medium hover:underline">
        {row.original.title}
      </Link>
    ),
  },
  {
    accessorKey: "kind",
    header: "Tip",
    cell: ({ row }) => (
      <Badge variant={KIND_BADGE_VARIANT[row.original.kind]}>
        {KIND_LABELS[row.original.kind]}
      </Badge>
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
        title="Niciun item în catalog"
        description="Adaugă primul item (produs sau serviciu) pentru a începe."
      />
    );
  }

  return (
    <DataTable columns={columns} data={items} pageSize={10} emptyMessage="Niciun item găsit." />
  );
}
