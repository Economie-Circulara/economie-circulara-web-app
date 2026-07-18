"use client";

import { Building2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { OrgStatusControls } from "./org-status-controls";
import type { OrganizationSummary } from "./types";

const dateFormatter = new Intl.DateTimeFormat("ro-RO");

function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

const columns: ColumnDef<OrganizationSummary>[] = [
  { accessorKey: "name", header: "Nume" },
  {
    accessorKey: "slug",
    header: "Slug / acces",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-mono text-xs">{row.original.slug}</span>
        <span className="text-xs text-muted-foreground">{row.original.accessUrl}</span>
      </div>
    ),
  },
  {
    accessorKey: "customDomain",
    header: "Domeniu custom",
    cell: ({ row }) => row.original.customDomain ?? "—",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.status === "active" ? "ok" : "danger"}>
        {row.original.status === "active" ? "Activ" : "Suspendat"}
      </Badge>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Creata la",
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
  {
    accessorKey: "userCount",
    header: "Utilizatori",
    cell: ({ row }) => <span className="tabular-nums">{row.original.userCount}</span>,
  },
  {
    id: "actions",
    header: "Actiuni",
    cell: ({ row }) => (
      <OrgStatusControls
        key={`${row.original.id}-${row.original.status}`}
        organizationId={row.original.id}
        status={row.original.status}
      />
    ),
  },
];

export function OrganizationsTable({ organizations }: { organizations: OrganizationSummary[] }) {
  if (organizations.length === 0) {
    return (
      <EmptyState
        icon={<Building2 />}
        title="Nicio organizatie inca"
        description="Creeaza prima organizatie pentru a incepe onboarding-ul unui client."
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={organizations}
      pageSize={10}
      emptyMessage="Nicio organizatie gasita."
    />
  );
}
