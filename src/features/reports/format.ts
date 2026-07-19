import { ORDER_STATUS_LABELS } from "@/features/orders/labels";
import type { ReportPdfColumn } from "./pdf";
import type {
  DeliveryReportRow,
  OrderStatusCount,
  PaasUsageRow,
  RecycledMaterialRow,
  ReturnReportRow,
  SecondaryMaterialRow,
} from "./types";

/**
 * Formatarea tabelara comuna PDF/CSV a fiecarui raport — un singur loc care decide
 * coloanele + textul afisat per rand, consumat atat de rutele de export CSV cat si
 * PDF (`ReportPdfColumn` + `Record<string,string>`, format cerut de `pdf.tsx`).
 */

export interface FormattedReport {
  columns: ReportPdfColumn[];
  rows: Record<string, string>[];
}

const qtyFormatter = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 3 });
const dateFormatter = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" });

function formatQty(value: number): string {
  return qtyFormatter.format(value);
}

function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso.length === 10 ? `${iso}T00:00:00.000Z` : iso));
}

const RETURN_LINK_TYPE_LABELS: Record<string, string> = {
  return: "Retur",
  warranty: "Garanție",
};

export function formatOrdersByStatusReport(rows: OrderStatusCount[]): FormattedReport {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return {
    columns: [
      { key: "label", header: "Status", flex: 2 },
      { key: "count", header: "Număr comenzi", align: "right" },
    ],
    rows: [
      ...rows.map((row) => ({ label: row.label, count: String(row.count) })),
      { label: "Total", count: String(total) },
    ],
  };
}

export function formatDeliveriesReport(rows: DeliveryReportRow[]): FormattedReport {
  return {
    columns: [
      { key: "orderNumber", header: "Comandă" },
      { key: "clientName", header: "Client", flex: 1.5 },
      { key: "status", header: "Status" },
      { key: "referenceDate", header: "Data livrării" },
      { key: "itemsSummary", header: "Produse", flex: 2 },
    ],
    rows: rows.map((row) => ({
      orderNumber: row.orderNumber ?? "—",
      clientName: row.clientName,
      status: ORDER_STATUS_LABELS[row.status],
      referenceDate: formatDate(row.referenceDate),
      itemsSummary: row.itemsSummary,
    })),
  };
}

export function formatReturnsReport(rows: ReturnReportRow[]): FormattedReport {
  return {
    columns: [
      { key: "linkCreatedAt", header: "Data cererii" },
      { key: "linkType", header: "Tip" },
      { key: "originalOrderNumber", header: "Comandă originală" },
      { key: "clientName", header: "Client", flex: 1.5 },
      { key: "returnOrderStatus", header: "Status retur" },
      { key: "itemsSummary", header: "Produse", flex: 2 },
    ],
    rows: rows.map((row) => ({
      linkCreatedAt: formatDate(row.linkCreatedAt),
      linkType: RETURN_LINK_TYPE_LABELS[row.linkType] ?? row.linkType,
      originalOrderNumber: row.originalOrderNumber ?? "—",
      clientName: row.clientName,
      returnOrderStatus: ORDER_STATUS_LABELS[row.returnOrderStatus],
      itemsSummary: row.itemsSummary,
    })),
  };
}

export function formatRecycledMaterialsReport(rows: RecycledMaterialRow[]): FormattedReport {
  return {
    columns: [
      { key: "provenanceLabel", header: "Proveniență" },
      { key: "itemTitle", header: "Material", flex: 1.5 },
      { key: "quantity", header: "Cantitate intrată", align: "right" },
      { key: "unit", header: "UM" },
      { key: "lotsCount", header: "Nr. loturi", align: "right" },
    ],
    rows: rows.map((row) => ({
      provenanceLabel: row.provenanceLabel,
      itemTitle: row.itemTitle,
      quantity: formatQty(row.quantity),
      unit: row.unit,
      lotsCount: String(row.lotsCount),
    })),
  };
}

export function formatPaasUsageReport(rows: PaasUsageRow[]): FormattedReport {
  return {
    columns: [
      { key: "clientName", header: "Client", flex: 1.5 },
      { key: "itemTitle", header: "Produs", flex: 1.5 },
      { key: "delivered", header: "Livrat", align: "right" },
      { key: "returned", header: "Returnat", align: "right" },
      { key: "used", header: "Utilizat", align: "right" },
      { key: "unit", header: "UM" },
    ],
    rows: rows.map((row) => ({
      clientName: row.clientName,
      itemTitle: row.itemTitle,
      delivered: formatQty(row.delivered),
      returned: formatQty(row.returned),
      used: formatQty(row.used),
      unit: row.unit,
    })),
  };
}

export function formatSecondaryMaterialReport(rows: SecondaryMaterialRow[]): FormattedReport {
  return {
    columns: [
      { key: "productTitle", header: "Produs", flex: 1.5 },
      { key: "totalInput", header: "Input total", align: "right" },
      { key: "secondaryInput", header: "Din care secundar", align: "right" },
      { key: "percentageSecondary", header: "% materii secundare", align: "right" },
    ],
    rows: rows.map((row) => ({
      productTitle: row.productTitle,
      totalInput: formatQty(row.totalInput),
      secondaryInput: formatQty(row.secondaryInput),
      percentageSecondary: `${qtyFormatter.format(row.percentageSecondary)}%`,
    })),
  };
}
