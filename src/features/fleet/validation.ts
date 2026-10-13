import { CAPACITY_UNIT_OPTIONS } from "./labels";
import type { CapacityUnit, FuelEntryInput, VehicleInput } from "./types";

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function text(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value.length ? value : null;
}

/** Numar zecimal din formular - accepta si virgula romaneasca ("12,5"). `undefined` = invalid. */
export function parseDecimalField(raw: string | null): number | null | undefined {
  if (raw === null) return null;
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return undefined;
  return Number(normalized);
}

/** Numarul de inmatriculare, normalizat pentru afisare: majuscule, spatii simple. */
export function normalizePlate(raw: string | null): string | null {
  if (!raw) return null;
  const plate = raw.toUpperCase().replace(/\s+/g, " ").trim();
  return plate.length ? plate : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseVehicleForm(formData: FormData): ParseResult<VehicleInput> {
  const name = text(formData, "name");
  if (!name) return { ok: false, error: "Numele vehiculului este obligatoriu." };

  const consumption = parseDecimalField(text(formData, "consumption"));
  if (consumption === null || consumption === undefined || consumption <= 0 || consumption > 200) {
    return {
      ok: false,
      error: "Consumul trebuie să fie un număr între 0 și 200 (litri / 100 km).",
    };
  }

  const capacity = parseDecimalField(text(formData, "capacity"));
  if (capacity === undefined || (capacity !== null && capacity <= 0)) {
    return { ok: false, error: "Capacitatea trebuie să fie un număr pozitiv." };
  }
  const unitRaw = text(formData, "capacity_unit");
  const capacityUnit = (CAPACITY_UNIT_OPTIONS as string[]).includes(unitRaw ?? "")
    ? (unitRaw as CapacityUnit)
    : null;
  if (capacity !== null && !capacityUnit) {
    return { ok: false, error: "Alege unitatea de măsură a capacității." };
  }

  return {
    ok: true,
    value: {
      name,
      plate: normalizePlate(text(formData, "plate")),
      vehicleType: text(formData, "vehicle_type"),
      fuelType: text(formData, "fuel_type"),
      consumptionLPer100km: consumption,
      capacity,
      capacityUnit: capacity === null ? null : capacityUnit,
      defaultDriverName: text(formData, "default_driver_name"),
      notes: text(formData, "notes"),
    },
  };
}

export function parseFuelEntryForm(formData: FormData, today: string): ParseResult<FuelEntryInput> {
  const vehicleId = text(formData, "vehicle_id");
  if (!vehicleId) return { ok: false, error: "Alege vehiculul." };

  const filledOn = text(formData, "filled_on");
  if (!filledOn || !DATE_RE.test(filledOn) || Number.isNaN(Date.parse(filledOn))) {
    return { ok: false, error: "Data alimentării nu este validă." };
  }
  if (filledOn > today) return { ok: false, error: "Data alimentării nu poate fi în viitor." };

  const liters = parseDecimalField(text(formData, "liters"));
  if (liters === null || liters === undefined || liters <= 0) {
    return { ok: false, error: "Cantitatea (litri) trebuie să fie un număr pozitiv." };
  }

  const amount = parseDecimalField(text(formData, "amount"));
  if (amount === undefined) return { ok: false, error: "Suma trebuie să fie un număr." };

  const odometer = parseDecimalField(text(formData, "odometer_km"));
  if (odometer === undefined || (odometer !== null && !Number.isInteger(odometer))) {
    return { ok: false, error: "Kilometrajul trebuie să fie un număr întreg." };
  }

  return {
    ok: true,
    value: {
      vehicleId,
      filledOn,
      liters,
      amount,
      odometerKm: odometer,
      station: text(formData, "station"),
      notes: text(formData, "notes"),
    },
  };
}

/** Bonul de alimentare: imagine sau PDF, max 4MB (sub plafonul de 4.5MB al server actions). */
export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;
export const RECEIPT_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
] as const;

export function validateReceiptFile(file: { size: number; type: string }): string | null {
  if (file.size > MAX_RECEIPT_BYTES) return "Bonul depășește limita de 4MB.";
  if (!(RECEIPT_MIME_TYPES as readonly string[]).includes(file.type)) {
    return "Bonul trebuie să fie o imagine (JPG, PNG, WEBP, HEIC) sau un PDF.";
  }
  return null;
}
