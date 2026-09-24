"use client";

import Link from "next/link";
import { Package } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { itemHref } from "./item-links";
import { KIND_BADGE_VARIANT, KIND_LABELS, UNIT_LABELS } from "./labels";
import type { ItemKind, ItemListRow } from "./types";

function YesNoBadge({ value }: { value: boolean }) {
  return <Badge variant={value ? "ok" : "neutral"}>{value ? "Da" : "Nu"}</Badge>;
}

const baseColumns: ColumnDef<ItemListRow>[] = [
  {
    accessorKey: "title",
    header: "Titlu",
    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={itemHref(row.original)} className="font-medium hover:underline">
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
];

const recipeColumn: ColumnDef<ItemListRow> = {
  accessorKey: "hasRecipe",
  header: "Are rețetă",
  cell: ({ row }) => <YesNoBadge value={row.original.hasRecipe} />,
};

interface EmptyCopy {
  title: string;
  description: string;
  emptyMessage: string;
}

const EMPTY_COPY: Record<ItemKind, EmptyCopy> = {
  physical: {
    title: "Niciun material în catalog",
    description: "Adaugă primul material pentru a începe.",
    emptyMessage: "Niciun material găsit.",
  },
  service: {
    title: "Niciun abonament în catalog",
    description: "Adaugă primul abonament pentru a începe.",
    emptyMessage: "Niciun abonament găsit.",
  },
};

interface ItemsTableProps {
  items: ItemListRow[];
  /**
   * Tipul listat de ecran (`/itemi` -> `physical`, `/abonamente` -> `service`) -
   * decide textele stării goale și dacă se arată coloana "Are rețetă" (retetele
   * se definesc doar pentru materiale fizice, coloana n-are sens pe abonamente).
   */
  kind: ItemKind;
}

export function ItemsTable({ items, kind }: ItemsTableProps) {
  const copy = EMPTY_COPY[kind];
  const columns = kind === "physical" ? [...baseColumns, recipeColumn] : baseColumns;

  if (items.length === 0) {
    return <EmptyState icon={<Package />} title={copy.title} description={copy.description} />;
  }

  return (
    <DataTable columns={columns} data={items} pageSize={10} emptyMessage={copy.emptyMessage} />
  );
}
