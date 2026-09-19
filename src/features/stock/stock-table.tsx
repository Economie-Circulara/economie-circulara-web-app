"use client";

import { Fragment, useState } from "react";
import { Boxes, ChevronDown, ChevronRight } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PROVENANCE_BADGE_STATUS, QUALITY_LABELS, lotBadgeStatus } from "./labels";
import { LotBlockControls } from "./lot-block-controls";
import type { LotWithItem } from "./types";

const dateFormatter = new Intl.DateTimeFormat("ro-RO");

function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/**
 * Proveniența lotului + clientul care l-a adus, cand exista (doar loturile de
 * aport au `clientName` - migrarile 0030/0031). Trasabilitatea "de la cine a venit
 * materialul" e chiar motivul pentru care s-a adaugat `lots.client_id`, deci apare
 * langa provenienta, nu ascunsa intr-un ecran separat.
 */
function ProvenanceCell({ lot }: { lot: LotWithItem }) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <StatusBadge group="provenance" status={PROVENANCE_BADGE_STATUS[lot.provenance]} />
      {lot.clientName ? (
        <span className="text-xs text-muted-foreground">{lot.clientName}</span>
      ) : null}
    </div>
  );
}

const columns: ColumnDef<LotWithItem>[] = [
  { accessorKey: "itemTitle", header: "Material" },
  {
    accessorKey: "entryDate",
    header: "Data intrare",
    cell: ({ row }) => formatDate(row.original.entryDate),
  },
  {
    accessorKey: "provenance",
    header: "Proveniență",
    cell: ({ row }) => <ProvenanceCell lot={row.original} />,
  },
  {
    id: "quantity",
    accessorFn: (row) => row.remainingQty,
    header: "Cantitate rămasă",
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">
        {row.original.remainingQty} / {row.original.initialQty} {row.original.unit}
      </span>
    ),
  },
  {
    accessorKey: "qualityStatus",
    header: "Calitate",
    cell: ({ row }) => QUALITY_LABELS[row.original.qualityStatus],
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge group="lot" status={lotBadgeStatus(row.original.isBlocked)} />,
  },
  {
    id: "actions",
    header: "Acțiuni",
    cell: ({ row }) => <LotBlockControls lot={row.original} />,
  },
];

interface GroupedStock {
  itemId: string;
  itemTitle: string;
  unit: LotWithItem["unit"];
  totalRemainingQty: number;
  totalInitialQty: number;
  lotCount: number;
  blockedCount: number;
  lots: LotWithItem[];
}

function groupLotsByItem(lots: LotWithItem[]): GroupedStock[] {
  const map = new Map<string, GroupedStock>();
  for (const lot of lots) {
    let group = map.get(lot.itemId);
    if (!group) {
      group = {
        itemId: lot.itemId,
        itemTitle: lot.itemTitle,
        unit: lot.unit,
        totalRemainingQty: 0,
        totalInitialQty: 0,
        lotCount: 0,
        blockedCount: 0,
        lots: [],
      };
      map.set(lot.itemId, group);
    }
    group.totalRemainingQty += lot.remainingQty;
    group.totalInitialQty += lot.initialQty;
    group.lotCount += 1;
    if (lot.isBlocked) group.blockedCount += 1;
    group.lots.push(lot);
  }
  return Array.from(map.values()).sort((a, b) => a.itemTitle.localeCompare(b.itemTitle, "ro"));
}

function LotsDetail({ lots }: { lots: LotWithItem[] }) {
  return (
    <div className="rounded-md border bg-secondary/20">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Data intrare</TableHead>
            <TableHead>Proveniență</TableHead>
            <TableHead>Cantitate rămasă</TableHead>
            <TableHead>Calitate</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Acțiuni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lots.map((lot) => (
            <TableRow key={lot.id} className="hover:bg-secondary/40">
              <TableCell className="text-muted-foreground">{formatDate(lot.entryDate)}</TableCell>
              <TableCell>
                <ProvenanceCell lot={lot} />
              </TableCell>
              <TableCell>
                <span className="font-medium tabular-nums">
                  {lot.remainingQty} / {lot.initialQty} {lot.unit}
                </span>
              </TableCell>
              <TableCell>{QUALITY_LABELS[lot.qualityStatus]}</TableCell>
              <TableCell>
                <StatusBadge group="lot" status={lotBadgeStatus(lot.isBlocked)} />
              </TableCell>
              <TableCell>
                <LotBlockControls lot={lot} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function GroupedStockTable({ groups }: { groups: GroupedStock[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(itemId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Material</TableHead>
            <TableHead>Cantitate totală</TableHead>
            <TableHead>Loturi</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => {
            const isOpen = expanded.has(group.itemId);
            return (
              <Fragment key={group.itemId}>
                <TableRow onClick={() => toggle(group.itemId)} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {isOpen ? (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-4 text-muted-foreground" />
                      )}
                      {group.itemTitle}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium tabular-nums">
                      {group.totalRemainingQty} / {group.totalInitialQty} {group.unit}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {group.lotCount} {group.lotCount === 1 ? "lot" : "loturi"}
                  </TableCell>
                  <TableCell>
                    {group.blockedCount > 0 ? (
                      <StatusBadge group="lot" status="blocat" />
                    ) : (
                      <StatusBadge group="lot" status="activ" />
                    )}
                  </TableCell>
                </TableRow>
                {isOpen ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="bg-secondary/10 p-3">
                      <LotsDetail lots={group.lots} />
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function StockTable({
  lots,
  view = "grouped",
}: {
  lots: LotWithItem[];
  view?: "grouped" | "lots";
}) {
  if (lots.length === 0) {
    return (
      <EmptyState
        icon={<Boxes />}
        title="Niciun lot în stoc"
        description="Adaugă primul lot pentru a începe evidența stocului."
      />
    );
  }

  if (view === "lots") {
    return (
      <DataTable columns={columns} data={lots} pageSize={10} emptyMessage="Niciun lot găsit." />
    );
  }

  const groups = groupLotsByItem(lots);
  return <GroupedStockTable groups={groups} />;
}
