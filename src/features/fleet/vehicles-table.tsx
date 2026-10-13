"use client";

import Link from "next/link";
import { Truck } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { CAPACITY_UNIT_LABELS, formatConsumption } from "./labels";
import type { Vehicle } from "./types";

const columns: ColumnDef<Vehicle>[] = [
  {
    accessorKey: "name",
    header: "Vehicul",
    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={`/flota/${row.original.id}`} className="font-medium hover:underline">
          {row.original.name}
        </Link>
        {row.original.archivedAt ? <Badge variant="neutral">Arhivat</Badge> : null}
      </div>
    ),
  },
  {
    accessorKey: "plate",
    header: "Nr. înmatriculare",
    cell: ({ row }) => row.original.plate ?? "—",
  },
  {
    accessorKey: "consumptionLPer100km",
    header: "Consum",
    cell: ({ row }) => formatConsumption(row.original.consumptionLPer100km),
  },
  {
    id: "capacity",
    header: "Capacitate",
    cell: ({ row }) =>
      row.original.capacity !== null && row.original.capacityUnit
        ? `${row.original.capacity} ${CAPACITY_UNIT_LABELS[row.original.capacityUnit]}`
        : "—",
  },
  {
    accessorKey: "defaultDriverName",
    header: "Șofer",
    cell: ({ row }) => row.original.defaultDriverName ?? "—",
  },
];

export function VehiclesTable({ vehicles }: { vehicles: Vehicle[] }) {
  if (vehicles.length === 0) {
    return (
      <EmptyState
        icon={<Truck />}
        title="Niciun vehicul în flotă"
        description="Adaugă primul vehicul: un nume și consumul mediu ajung."
      />
    );
  }
  return <DataTable columns={columns} data={vehicles} pageSize={20} />;
}
