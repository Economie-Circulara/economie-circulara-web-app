"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { History } from "lucide-react";
import { STOCK_EVENT_LABELS } from "./labels";
import type { StockEvent } from "./types";

const dateTimeFormatter = new Intl.DateTimeFormat("ro-RO", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

function lotReference(event: StockEvent): string {
  return event.lotId ? event.lotId.slice(0, 8).toUpperCase() : "—";
}

const columns: ColumnDef<StockEvent>[] = [
  {
    accessorKey: "createdAt",
    header: "Timp",
    cell: ({ row }) => (
      <span className="whitespace-nowrap font-mono text-xs">
        {formatDateTime(row.original.createdAt)}
      </span>
    ),
  },
  {
    accessorKey: "createdByName",
    header: "Utilizator",
    cell: ({ row }) => row.original.createdByName ?? "—",
  },
  {
    accessorKey: "eventType",
    header: "Acțiune",
    cell: ({ row }) => STOCK_EVENT_LABELS[row.original.eventType],
  },
  {
    id: "reference",
    header: "Referință",
    cell: ({ row }) => (
      <span>
        {row.original.itemTitle}{" "}
        <span className="font-mono text-xs text-muted-foreground">
          {lotReference(row.original)}
        </span>
      </span>
    ),
  },
  {
    accessorKey: "quantity",
    header: "Delta",
    cell: ({ row }) => (
      <span className="font-mono font-medium tabular-nums">
        {row.original.quantity > 0 ? "+" : ""}
        {row.original.quantity}
      </span>
    ),
  },
  {
    accessorKey: "reason",
    header: "Motiv",
    cell: ({ row }) => row.original.reason ?? "—",
  },
];

export function AuditTable({ events }: { events: StockEvent[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={<History />}
        title="Niciun eveniment de stoc"
        description="Miscarile de stoc (intrari, consum, blocari) apar aici pe masura ce se inregistreaza."
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={events}
      pageSize={20}
      emptyMessage="Niciun eveniment gasit."
    />
  );
}
