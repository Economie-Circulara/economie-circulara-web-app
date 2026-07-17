"use client";

import { Boxes } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { PROVENANCE_BADGE_STATUS, QUALITY_LABELS, lotBadgeStatus } from "./labels";
import { LotBlockControls } from "./lot-block-controls";
import type { LotWithItem } from "./types";

const dateFormatter = new Intl.DateTimeFormat("ro-RO");

function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

const columns: ColumnDef<LotWithItem>[] = [
  { accessorKey: "itemTitle", header: "Item" },
  {
    accessorKey: "entryDate",
    header: "Data intrare",
    cell: ({ row }) => formatDate(row.original.entryDate),
  },
  {
    accessorKey: "provenance",
    header: "Proveniență",
    cell: ({ row }) => (
      <StatusBadge group="provenance" status={PROVENANCE_BADGE_STATUS[row.original.provenance]} />
    ),
  },
  {
    id: "quantity",
    accessorFn: (row) => row.remainingQty,
    header: "Cantitate rămasă",
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">
        {row.original.remainingQty} / {row.original.initialQty} {row.original.unit}
      </span>
    ),
  },
  {
    accessorKey: "qualityStatus",
    header: "Calitate",
    cell: ({ row }) => QUALITY_LABELS[row.original.qualityStatus],
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge group="lot" status={lotBadgeStatus(row.original.isBlocked)} />,
  },
  {
    id: "actions",
    header: "Acțiuni",
    cell: ({ row }) => <LotBlockControls lot={row.original} />,
  },
];

export function StockTable({ lots }: { lots: LotWithItem[] }) {
  if (lots.length === 0) {
    return (
      <EmptyState
        icon={<Boxes />}
        title="Niciun lot în stoc"
        description="Adaugă primul lot pentru a începe evidența stocului."
      />
    );
  }

  return <DataTable columns={columns} data={lots} pageSize={10} emptyMessage="Niciun lot găsit." />;
}
