"use client";

import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { SUPPLIER_LABEL, VAT_PAYER_LABEL } from "./labels";
import type { Client } from "./types";

const columns: ColumnDef<Client>[] = [
  { accessorKey: "name", header: "Denumire" },
  { accessorKey: "cui", header: "CUI" },
  {
    id: "contact",
    header: "Contact",
    cell: ({ row }) => {
      const { contactPerson, email, phone } = row.original;
      const parts = [contactPerson, email, phone].filter(Boolean);
      return parts.length ? parts.join(" · ") : "—";
    },
  },
  {
    id: "flags",
    header: "Flag-uri",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1.5">
        {row.original.isSupplier ? <Badge variant="accent">{SUPPLIER_LABEL}</Badge> : null}
        {row.original.isVatPayer ? <Badge variant="info">{VAT_PAYER_LABEL}</Badge> : null}
      </div>
    ),
  },
];

export function ClientTable({ clients }: { clients: Client[] }) {
  const router = useRouter();

  if (clients.length === 0) {
    return (
      <EmptyState
        icon={<Building2 />}
        title="Niciun client"
        description="Adaugă primul client — poți căuta datele firmei după CUI."
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={clients}
      pageSize={10}
      emptyMessage="Niciun client găsit."
      onRowClick={(client) => router.push(`/clienti/${client.id}`)}
    />
  );
}
