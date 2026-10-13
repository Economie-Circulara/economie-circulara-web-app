import type { CapacityUnit } from "./types";

export const CAPACITY_UNIT_OPTIONS: CapacityUnit[] = ["t", "mc", "kg", "l"];

export const CAPACITY_UNIT_LABELS: Record<CapacityUnit, string> = {
  t: "tone",
  mc: "mc",
  kg: "kg",
  l: "litri",
};

/** Sugestii (datalist) - campurile raman text liber. */
export const VEHICLE_TYPE_SUGGESTIONS = [
  "Basculantă",
  "Camion",
  "Autoutilitară",
  "Autoturism",
  "Cap tractor",
];
export const FUEL_TYPE_SUGGESTIONS = ["Motorină", "Benzină", "GPL", "Electric"];

const liters = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat("ro-RO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatLiters(value: number): string {
  return `${liters.format(value)} L`;
}

export function formatAmount(value: number): string {
  return `${money.format(value)} lei`;
}

/** `YYYY-MM-DD` -> `DD.MM.YYYY`. */
export function formatDay(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

export function formatConsumption(value: number): string {
  return `${liters.format(value)} L/100 km`;
}

/** "Basculantă 1 (IS-12-ABC)" - numele vehiculului cu numarul, cand exista. */
export function vehicleLabel(vehicle: { name: string; plate: string | null }): string {
  return vehicle.plate ? `${vehicle.name} (${vehicle.plate})` : vehicle.name;
}
