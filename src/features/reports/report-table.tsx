"use client";

import { Inbox } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import type { FormattedReport } from "./format";

/**
 * Tabel generic pentru orice raport din /rapoarte — reutilizeaza ACELEASI coloane +
 * randuri (deja formatate ca text in `format.ts`) folosite si de exporturile CSV/PDF,
 * ca sa nu existe doua surse de adevar pentru ce se afiseaza.
 */
export function ReportTable({
  report,
  emptyMessage = "Nicio înregistrare în perioada selectată.",
}: {
  report: FormattedReport;
  emptyMessage?: string;
}) {
  if (report.rows.length === 0) {
    return (
      <EmptyState icon={<Inbox />} title="Fără date" description={emptyMessage} className="py-8" />
    );
  }

  const columns: ColumnDef<Record<string, string>>[] = report.columns.map((col) => ({
    id: col.key,
    accessorKey: col.key,
    header: col.header,
    cell: ({ row }) => (
      <span className={cn(col.align === "right" && "block text-right tabular-nums")}>
        {row.original[col.key] ?? "—"}
      </span>
    ),
  }));

  return (
    <DataTable columns={columns} data={report.rows} pageSize={10} emptyMessage={emptyMessage} />
  );
}
