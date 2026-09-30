"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Inbox } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { setQuoteRequestStatusAction } from "./actions";
import type { QuoteRequestRow } from "./queries";

const dateFormatter = new Intl.DateTimeFormat("ro-RO", {
  dateStyle: "medium",
  timeStyle: "short",
});

function StatusButton({ row }: { row: QuoteRequestRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const next = row.status === "new" ? "handled" : "new";

  return (
    <div className="space-y-1">
      <Button
        size="sm"
        variant={row.status === "new" ? "default" : "outline"}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await setQuoteRequestStatusAction(row.id, next);
            setError(result.error);
            if (!result.error) router.refresh();
          })
        }
      >
        {pending ? "Se salvează..." : row.status === "new" ? "Marchează rezolvată" : "Redeschide"}
      </Button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

const columns: ColumnDef<QuoteRequestRow>[] = [
  {
    id: "createdAt",
    header: "Primită",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {dateFormatter.format(new Date(row.original.createdAt))}
      </span>
    ),
  },
  { accessorKey: "service", header: "Serviciu" },
  {
    id: "contact",
    header: "Solicitant",
    cell: ({ row }) => (
      <div className="space-y-0.5">
        <div className="font-medium">{row.original.name}</div>
        <a
          className="block hover:underline"
          href={`tel:${row.original.phone.replace(/[^\d+]/g, "")}`}
        >
          {row.original.phone}
        </a>
        {row.original.email ? (
          <a
            className="block text-muted-foreground hover:underline"
            href={`mailto:${row.original.email}`}
          >
            {row.original.email}
          </a>
        ) : null}
      </div>
    ),
  },
  {
    id: "message",
    header: "Detalii",
    cell: ({ row }) =>
      row.original.message ? (
        <p className="max-w-md whitespace-pre-line text-sm">{row.original.message}</p>
      ) : (
        <span className="text-xs text-muted-foreground">-</span>
      ),
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) =>
      row.original.status === "new" ? (
        <Badge variant="info">Nouă</Badge>
      ) : (
        <Badge variant="neutral">Rezolvată</Badge>
      ),
  },
  { id: "actions", header: "", cell: ({ row }) => <StatusButton row={row.original} /> },
];

export function QuoteRequestTable({ requests }: { requests: QuoteRequestRow[] }) {
  if (requests.length === 0) {
    return (
      <EmptyState
        icon={<Inbox />}
        title="Nicio cerere de ofertă"
        description="Cererile trimise din formularul „Cere o ofertă” de pe site apar aici."
      />
    );
  }
  return (
    <DataTable
      columns={columns}
      data={requests}
      pageSize={20}
      emptyMessage="Nicio cerere găsită."
    />
  );
}
