"use client";

import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { CLIENT_TYPE_LABELS, SUPPLIER_LABEL, VAT_PAYER_LABEL } from "./labels";
import type { Client } from "./types";

const columns: ColumnDef<Client>[] = [
  {
    accessorKey: "name",
    header: "Denumire",
    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-1.5">
        <span>{row.original.name}</span>
        {/* Vizibil doar cu "Arată arhivați" (migrarea 0035). */}
        {row.original.archivedAt ? <Badge variant="neutral">Arhivat</Badge> : null}
      </div>
    ),
  },
  {
    id: "identifier",
    header: "CUI / CNP",
    // Tabelul e doar pentru staff (ca pagina clientului) - CNP-ul poate aparea aici.
    cell: ({ row }) =>
      row.original.clientType === "fizica" ? (row.original.cnp ?? "-") : (row.original.cui ?? "-"),
  },
  {
    id: "contact",
    header: "Contact",
    cell: ({ row }) => {
      const { contactPerson, email, phone } = row.original;
      const parts = [contactPerson, email, phone].filter(Boolean);
      return parts.length ? parts.join(" · ") : "-";
    },
  },
  {
    id: "flags",
    header: "Flag-uri",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1.5">
        {row.original.clientType === "fizica" ? (
          <Badge variant="neutral">{CLIENT_TYPE_LABELS.fizica}</Badge>
        ) : null}
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
        description="Adaugă primul client - o firmă (poți căuta datele după CUI) sau o persoană fizică."
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
