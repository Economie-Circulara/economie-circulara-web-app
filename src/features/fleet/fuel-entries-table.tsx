"use client";

import Link from "next/link";
import { Fuel } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { pricePerLiter } from "./calc";
import { formatAmount, formatDay, formatLiters, vehicleLabel } from "./labels";
import type { FuelEntry } from "./types";

function buildColumns(showVehicle: boolean): ColumnDef<FuelEntry>[] {
  const columns: ColumnDef<FuelEntry>[] = [
    {
      accessorKey: "filledOn",
      header: "Data",
      cell: ({ row }) => (
        <Link href={`/flota/alimentari/${row.original.id}`} className="font-medium hover:underline">
          {formatDay(row.original.filledOn)}
        </Link>
      ),
    },
  ];
  if (showVehicle) {
    columns.push({
      id: "vehicle",
      header: "Vehicul",
      cell: ({ row }) => (
        <Link href={`/flota/${row.original.vehicleId}`} className="hover:underline">
          {vehicleLabel({ name: row.original.vehicleName, plate: row.original.vehiclePlate })}
        </Link>
      ),
    });
  }
  columns.push(
    {
      accessorKey: "liters",
      header: "Litri",
      cell: ({ row }) => formatLiters(row.original.liters),
    },
    {
      accessorKey: "amount",
      header: "Sumă",
      cell: ({ row }) => (row.original.amount !== null ? formatAmount(row.original.amount) : "—"),
    },
    {
      id: "price",
      header: "Lei / L",
      cell: ({ row }) => {
        const price = pricePerLiter(row.original);
        return price !== null ? formatAmount(price) : "—";
      },
    },
    {
      accessorKey: "odometerKm",
      header: "Km la bord",
      cell: ({ row }) => row.original.odometerKm?.toLocaleString("ro-RO") ?? "—",
    },
    {
      accessorKey: "station",
      header: "Benzinărie",
      cell: ({ row }) => row.original.station ?? "—",
    },
    {
      id: "receipt",
      header: "Bon",
      cell: ({ row }) =>
        row.original.receipt ? (
          <a
            href={`/flota/alimentari/${row.original.id}/bon`}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            Vezi
          </a>
        ) : (
          "—"
        ),
    },
  );
  return columns;
}

export function FuelEntriesTable({
  entries,
  showVehicle = true,
}: {
  entries: FuelEntry[];
  showVehicle?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Fuel />}
        title="Nicio alimentare"
        description="Alimentările apar aici după ce le adaugi."
      />
    );
  }
  return <DataTable columns={buildColumns(showVehicle)} data={entries} pageSize={20} />;
}
