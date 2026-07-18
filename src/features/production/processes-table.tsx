"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Factory } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { PROCESS_STATUS_BADGE_STATUS, PROCESS_TYPE_LABELS } from "./labels";
import type { ProcessListRow } from "./types";

const dateFormatter = new Intl.DateTimeFormat("ro-RO", { dateStyle: "short", timeStyle: "short" });

function formatDate(iso: string | null): string {
  return iso ? dateFormatter.format(new Date(iso)) : "—";
}

const columns: ColumnDef<ProcessListRow>[] = [
  {
    accessorKey: "type",
    header: "Tip",
    cell: ({ row }) => PROCESS_TYPE_LABELS[row.original.type],
  },
  { accessorKey: "outputItemTitle", header: "Output" },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge group="process" status={PROCESS_STATUS_BADGE_STATUS[row.original.status]} />
    ),
  },
  {
    id: "date",
    header: "Data",
    accessorFn: (row) => row.completedAt ?? row.startedAt ?? row.createdAt,
    cell: ({ row }) =>
      formatDate(row.original.completedAt ?? row.original.startedAt ?? row.original.createdAt),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Link
        href={`/productie/${row.original.id}`}
        className="text-sm font-medium text-accent hover:underline"
      >
        Detalii →
      </Link>
    ),
  },
];

export function ProcessesTable({ processes }: { processes: ProcessListRow[] }) {
  const router = useRouter();

  if (processes.length === 0) {
    return (
      <EmptyState
        icon={<Factory />}
        title="Niciun proces înregistrat"
        description="Pornește primul proces de producție, reciclare sau recondiționare."
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={processes}
      pageSize={10}
      emptyMessage="Niciun proces găsit."
      onRowClick={(row) => router.push(`/productie/${row.id}`)}
    />
  );
}
