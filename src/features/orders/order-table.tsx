"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { ORDER_STATUS_BADGE_STATUS } from "./labels";
import { OrderStatusActions } from "./order-status-actions";
import type { OrderListRow } from "./types";

const dateFormatter = new Intl.DateTimeFormat("ro-RO");

function formatDate(iso: string | null): string {
  return iso ? dateFormatter.format(new Date(iso)) : "—";
}

const columns: ColumnDef<OrderListRow>[] = [
  {
    id: "orderNumber",
    header: "Comandă",
    cell: ({ row }) => (
      <Link href={`/comenzi/${row.original.id}`} className="font-medium hover:underline">
        {row.original.orderNumber ?? "Draft"}
      </Link>
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
      <OrderStatusActions orderId={row.original.id} status={row.original.status} />
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
