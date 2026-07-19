"use client";

import Link from "next/link";
import { Truck } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { DECLARATION_STATUS_BADGE_VARIANT, DECLARATION_STATUS_LABELS } from "./labels";
import type { DeliveryListRow } from "./types";

const dateFormatter = new Intl.DateTimeFormat("ro-RO");

function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

const columns: ColumnDef<DeliveryListRow>[] = [
  {
    id: "orderNumber",
    header: "Comandă",
    cell: ({ row }) => (
      <Link href={`/livrari/${row.original.id}`} className="font-medium hover:underline">
        {row.original.orderNumber ?? "Draft"}
      </Link>
    ),
  },
  { accessorKey: "clientName", header: "Client" },
  {
    accessorKey: "scheduledDate",
    header: "Data programată",
    cell: ({ row }) => formatDate(row.original.scheduledDate),
  },
  { accessorKey: "carrierName", header: "Transportator" },
  { accessorKey: "vehiclePlate", header: "Vehicul" },
  {
    id: "declarationStatus",
    header: "e-Transport",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Badge variant={DECLARATION_STATUS_BADGE_VARIANT[row.original.declarationStatus]}>
          {DECLARATION_STATUS_LABELS[row.original.declarationStatus]}
        </Badge>
        {row.original.uitCode ? (
          <span className="font-mono text-xs text-muted-foreground">{row.original.uitCode}</span>
        ) : null}
      </div>
    ),
  },
];

export function DeliveryTable({ deliveries }: { deliveries: DeliveryListRow[] }) {
  if (deliveries.length === 0) {
    return (
      <EmptyState
        icon={<Truck />}
        title="Nicio livrare planificată"
        description="Planifică o livrare dintr-o comandă acceptată."
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={deliveries}
      pageSize={10}
      emptyMessage="Nicio livrare găsită."
    />
  );
}
