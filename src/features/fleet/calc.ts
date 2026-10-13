import type { FuelEntry, FuelSummary } from "./types";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Totalurile unei liste de alimentari (litri, lei, ultima data). */
export function summarizeFuelEntries(
  entries: Pick<FuelEntry, "liters" | "amount" | "filledOn">[],
): FuelSummary {
  let liters = 0;
  let amount = 0;
  let amountCount = 0;
  let lastFilledOn: string | null = null;
  for (const entry of entries) {
    liters += entry.liters;
    if (entry.amount !== null) {
      amount += entry.amount;
      amountCount += 1;
    }
    if (!lastFilledOn || entry.filledOn > lastFilledOn) lastFilledOn = entry.filledOn;
  }
  return {
    count: entries.length,
    liters: round2(liters),
    amount: round2(amount),
    amountCount,
    lastFilledOn,
  };
}

/** Pretul pe litru al unei alimentari, cand suma e completata. */
export function pricePerLiter(entry: Pick<FuelEntry, "liters" | "amount">): number | null {
  if (entry.amount === null || entry.liters <= 0) return null;
  return round2(entry.amount / entry.liters);
}
