"use client";

import Link from "next/link";
import { ArrowDownCircle, ArrowUpCircle, ShoppingCart } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_BADGE_STATUS } from "./labels";
import { OrderStatusActions } from "./order-status-actions";
import type { OrderListRow } from "./types";

const dateFormatter = new Intl.DateTimeFormat("ro-RO");

function formatDate(iso: string | null): string {
  return iso ? dateFormatter.format(new Date(iso)) : "-";
}

/**
 * Indicator vizual al sensului stocului: comenzile de tip "aport" (client -> org)
 * si legaturile "return"/"warranty" (`linkType`) creează un lot nou (intake,
 * stocul crește); orice altă comandă - inclusiv "replacement", care e o vanzare
 * obisnuita - consumă FIFO (stocul scade).
 */
function StockDirectionIndicator({
  orderType,
  linkType,
}: {
  orderType: OrderListRow["orderType"];
  linkType: OrderListRow["linkType"];
}) {
  const increasesStock = orderType === "aport" || linkType === "return" || linkType === "warranty";
  const label =
    orderType === "aport"
      ? "Aport"
      : linkType === "warranty"
        ? "Garanție"
        : linkType === "return"
          ? "Retur"
          : "Vânzare";
  const title = increasesStock ? `${label} — stocul crește` : `${label} — stocul scade`;

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        increasesStock ? "text-ok" : "text-danger",
      )}
    >
      {increasesStock ? (
        <ArrowUpCircle className="size-3.5" aria-hidden="true" />
      ) : (
        <ArrowDownCircle className="size-3.5" aria-hidden="true" />
      )}
      {label}
    </span>
  );
}

const columns: ColumnDef<OrderListRow>[] = [
  {
    id: "orderNumber",
    header: "Comandă",
    cell: ({ row }) => (
      <Link href={`/comenzi/${row.original.id}`} className="font-medium hover:underline">
        {row.original.orderNumber ?? "Ciornă"}
      </Link>
    ),
  },
  {
    id: "direction",
    header: "Sens stoc",
    cell: ({ row }) => (
      <StockDirectionIndicator
        orderType={row.original.orderType}
        linkType={row.original.linkType}
      />
    ),
  },
  { accessorKey: "clientName", header: "Client" },
  {
    accessorKey: "itemsSummary",
    header: "Produse",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.itemsSummary}</span>
    ),
  },
  {
    accessorKey: "deliveryDate",
    header: "Data livrare",
    cell: ({ row }) => formatDate(row.original.deliveryDate),
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge group="order" status={ORDER_STATUS_BADGE_STATUS[row.original.status]} />
    ),
  },
  {
    id: "actions",
    header: "Acțiuni",
    cell: ({ row }) => (
      <div className="flex flex-wrap items-start justify-end gap-2">
        {/* Un aport nu se livreaza (materialul vine de la client). */}
        {row.original.status === "accepted" &&
        !row.original.delivery &&
        row.original.orderType !== "aport" ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/livrari/nou?orderId=${row.original.id}`}>Planifică livrare</Link>
          </Button>
        ) : null}
        <OrderStatusActions
          orderId={row.original.id}
          status={row.original.status}
          delivery={row.original.delivery}
          orderType={row.original.orderType}
        />
      </div>
    ),
  },
];

export function OrderTable({ orders }: { orders: OrderListRow[] }) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart />}
        title="Nicio comandă"
        description="Creează prima comandă în numele unui client."
      />
    );
  }

  return (
    <DataTable columns={columns} data={orders} pageSize={10} emptyMessage="Nicio comandă găsită." />
  );
}
