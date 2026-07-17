"use client";

import Link from "next/link";
import { ScrollText } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { isPercentageSumComplete } from "./validation";
import type { RecipeListRow } from "./types";

const columns: ColumnDef<RecipeListRow>[] = [
  {
    accessorKey: "itemTitle",
    header: "Item",
    cell: ({ row }) => (
      <Link href={`/retete/${row.original.itemId}`} className="font-medium hover:underline">
        {row.original.itemTitle}
      </Link>
    ),
  },
  {
    accessorKey: "componentCount",
    header: "Nr. componente",
  },
  {
    accessorKey: "percentageSum",
    header: "Sumă procente",
    cell: ({ row }) => {
      const ok = isPercentageSumComplete(row.original.percentageSum);
      return (
        <Badge variant={ok ? "ok" : "warn"}>
          {row.original.percentageSum}% {ok ? "" : "⚠"}
        </Badge>
      );
    },
  },
];

export function RecipesTable({ recipes }: { recipes: RecipeListRow[] }) {
  if (recipes.length === 0) {
    return (
      <EmptyState
        icon={<ScrollText />}
        title="Nicio rețetă definită"
        description="Creează prima rețetă pentru un item fizic."
      />
    );
  }

  return (
    <DataTable columns={columns} data={recipes} pageSize={10} emptyMessage="Nicio rețetă găsită." />
  );
}
