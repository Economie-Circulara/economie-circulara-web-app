import type { DashboardLowStockItem, DashboardStockTrend, DashboardStockTrendPoint } from "./types";

export interface DashboardLotInput {
  itemId: string;
  itemTitle: string;
  unit: string;
  initialQty: number;
  remainingQty: number;
  isBlocked: boolean;
}

export interface DashboardStockEventInput {
  createdAt: string;
  quantity: number;
  unit: string;
}

const LOW_STOCK_RATIO = 0.2;

/** Grupeaza loturile pe item; un semnal de revizuire apare la cel mult 20% disponibil. */
export function findLowStockItems(lots: DashboardLotInput[]): DashboardLowStockItem[] {
  const byItem = new Map<string, DashboardLowStockItem>();

  for (const lot of lots) {
    const current = byItem.get(lot.itemId) ?? {
      itemId: lot.itemId,
      itemTitle: lot.itemTitle,
      unit: lot.unit,
      initialQty: 0,
      remainingQty: 0,
      availabilityPercent: 0,
      blockedLots: 0,
    };
    current.initialQty += lot.initialQty;
    current.remainingQty += lot.remainingQty;
    if (lot.isBlocked) current.blockedLots += 1;
    byItem.set(lot.itemId, current);
  }

  return Array.from(byItem.values())
    .map((item) => ({
      ...item,
      availabilityPercent:
        item.initialQty === 0 ? 0 : Math.round((item.remainingQty / item.initialQty) * 100),
    }))
    .filter((item) => item.initialQty > 0 && item.availabilityPercent <= LOW_STOCK_RATIO * 100)
    .sort(
      (a, b) =>
        a.availabilityPercent - b.availabilityPercent ||
        a.itemTitle.localeCompare(b.itemTitle, "ro"),
    );
}

function isoDateOffset(now: Date, offset: number): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/**
 * Reconstruieste nivelul stocului la finalul fiecarei zile din stocul actual si
 * evenimentele semnate din audit. Seriile raman separate pe unitate de masura.
 */
export function buildStockTrends(
  lots: DashboardLotInput[],
  events: DashboardStockEventInput[],
  now: Date = new Date(),
  days = 14,
): DashboardStockTrend[] {
  const dates = Array.from({ length: days }, (_, index) => isoDateOffset(now, index - days + 1));
  const currentByUnit = new Map<string, number>();
  for (const lot of lots) {
    currentByUnit.set(lot.unit, (currentByUnit.get(lot.unit) ?? 0) + lot.remainingQty);
  }

  const eventsByUnitAndDate = new Map<string, Map<string, number>>();
  for (const event of events) {
    const date = event.createdAt.slice(0, 10);
    if (!dates.includes(date)) continue;
    const byDate = eventsByUnitAndDate.get(event.unit) ?? new Map<string, number>();
    byDate.set(date, (byDate.get(date) ?? 0) + event.quantity);
    eventsByUnitAndDate.set(event.unit, byDate);
  }

  return Array.from(currentByUnit.entries())
    .map(([unit, currentQuantity]) => {
      const deltas = eventsByUnitAndDate.get(unit) ?? new Map<string, number>();
      const quantities = Array.from({ length: days }, () => 0);
      quantities[days - 1] = currentQuantity;
      for (let index = days - 2; index >= 0; index -= 1) {
        quantities[index] = quantities[index + 1] - (deltas.get(dates[index + 1]) ?? 0);
      }
      const points: DashboardStockTrendPoint[] = dates.map((date, index) => ({
        date,
        quantity: quantities[index],
      }));
      return { unit, points };
    })
    .sort((a, b) => a.unit.localeCompare(b.unit, "ro"));
}
