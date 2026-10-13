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

/** Abaterea consumului real fata de cel declarat peste care vehiculul e semnalat. */
export const CONSUMPTION_DEVIATION_ALERT_PERCENT = 15;

type OdometerEntry = Pick<FuelEntry, "id" | "liters" | "filledOn" | "odometerKm" | "createdAt">;

/** Alimentarile cu kilometraj, in ordinea in care s-au facut (data, apoi km). */
function withOdometer(entries: OdometerEntry[]): (OdometerEntry & { odometerKm: number })[] {
  return entries
    .filter((e): e is OdometerEntry & { odometerKm: number } => e.odometerKm !== null)
    .sort(
      (a, b) =>
        a.filledOn.localeCompare(b.filledOn) ||
        a.odometerKm - b.odometerKm ||
        a.createdAt.localeCompare(b.createdAt),
    );
}

export interface OdometerStats {
  /** Cel mai mare kilometraj inregistrat (ultima alimentare). */
  currentKm: number | null;
  /** Km intre prima si ultima alimentare cu kilometraj din lista. */
  kmDriven: number;
  /**
   * Consumul real (L/100 km), presupunand PLINUL la fiecare alimentare: litrii
   * alimentarilor 2..n acopera km dintre prima si ultima. `null` sub doua alimentari
   * cu kilometraj sau fara km parcursi.
   */
  realConsumption: number | null;
}

/** Kilometrajul si consumul real ale UNUI vehicul, din alimentarile lui. */
export function odometerStats(entries: OdometerEntry[]): OdometerStats {
  const sorted = withOdometer(entries);
  if (sorted.length === 0) return { currentKm: null, kmDriven: 0, realConsumption: null };
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const kmDriven = last.odometerKm - first.odometerKm;
  const liters = sorted.slice(1).reduce((sum, e) => sum + e.liters, 0);
  return {
    currentKm: last.odometerKm,
    kmDriven,
    realConsumption: sorted.length > 1 && kmDriven > 0 ? round2((liters / kmDriven) * 100) : null,
  };
}

export interface EntryConsumption {
  /** Km de la alimentarea anterioara (cu kilometraj) a aceluiasi vehicul. */
  kmSincePrevious: number | null;
  /** Consumul pe acest interval (L/100 km), presupunand plinul. */
  consumption: number | null;
}

/** Km parcursi si consumul pe fiecare alimentare a UNUI vehicul (cheie = id-ul alimentarii). */
export function consumptionPerEntry(entries: OdometerEntry[]): Map<string, EntryConsumption> {
  const result = new Map<string, EntryConsumption>();
  const sorted = withOdometer(entries);
  sorted.forEach((entry, index) => {
    const previous = index > 0 ? sorted[index - 1] : null;
    const km = previous ? entry.odometerKm - previous.odometerKm : null;
    result.set(entry.id, {
      kmSincePrevious: km,
      consumption: km !== null && km > 0 ? round2((entry.liters / km) * 100) : null,
    });
  });
  return result;
}

/** Abaterea procentuala a consumului real fata de cel declarat (pozitiv = consuma mai mult). */
export function consumptionDeviationPercent(real: number, declared: number): number {
  return Math.round(((real - declared) / declared) * 100);
}
