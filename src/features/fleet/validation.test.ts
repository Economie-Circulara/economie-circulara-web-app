import { describe, expect, it } from "vitest";
import {
  normalizePlate,
  parseDecimalField,
  parseFuelEntryForm,
  parseVehicleForm,
  validateReceiptFile,
} from "./validation";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("parseDecimalField", () => {
  it("accepta virgula romaneasca si spatiile", () => {
    expect(parseDecimalField("32,5")).toBe(32.5);
    expect(parseDecimalField(" 1 200 ")).toBe(1200);
  });
  it("gol = null, text = invalid", () => {
    expect(parseDecimalField(null)).toBeNull();
    expect(parseDecimalField("abc")).toBeUndefined();
    expect(parseDecimalField("-3")).toBeUndefined();
  });
});

describe("normalizePlate", () => {
  it("majuscule si spatii simple", () => {
    expect(normalizePlate("  is 12  abc ")).toBe("IS 12 ABC");
    expect(normalizePlate(null)).toBeNull();
  });
});

describe("parseVehicleForm", () => {
  it("doar numele si consumul sunt obligatorii", () => {
    const result = parseVehicleForm(form({ name: "Basculanta 1", consumption: "32,5" }));
    expect(result).toEqual({
      ok: true,
      value: {
        name: "Basculanta 1",
        plate: null,
        vehicleType: null,
        fuelType: null,
        consumptionLPer100km: 32.5,
        capacity: null,
        capacityUnit: null,
        defaultDriverName: null,
        notes: null,
      },
    });
  });

  it("respinge lipsa numelui sau un consum invalid", () => {
    expect(parseVehicleForm(form({ consumption: "30" })).ok).toBe(false);
    expect(parseVehicleForm(form({ name: "A", consumption: "0" })).ok).toBe(false);
    expect(parseVehicleForm(form({ name: "A", consumption: "250" })).ok).toBe(false);
    expect(parseVehicleForm(form({ name: "A" })).ok).toBe(false);
  });

  it("capacitatea cere unitatea; fara capacitate unitatea se ignora", () => {
    const missingUnit = parseVehicleForm(form({ name: "A", consumption: "30", capacity: "20" }));
    expect(missingUnit).toEqual({ ok: false, error: expect.stringMatching(/unitatea/) });

    const withUnit = parseVehicleForm(
      form({ name: "A", consumption: "30", capacity: "20", capacity_unit: "t", plate: "is-1-ab" }),
    );
    expect(withUnit.ok && withUnit.value).toMatchObject({
      capacity: 20,
      capacityUnit: "t",
      plate: "IS-1-AB",
    });

    const unitOnly = parseVehicleForm(form({ name: "A", consumption: "30", capacity_unit: "t" }));
    expect(unitOnly.ok && unitOnly.value.capacityUnit).toBeNull();
  });
});

describe("parseFuelEntryForm", () => {
  const TODAY = "2026-10-13";
  const base = { vehicle_id: "v1", filled_on: "2026-10-12", liters: "80,5" };

  it("parseaza o alimentare minima", () => {
    expect(parseFuelEntryForm(form(base), TODAY)).toEqual({
      ok: true,
      value: {
        vehicleId: "v1",
        filledOn: "2026-10-12",
        liters: 80.5,
        amount: null,
        odometerKm: null,
        station: null,
        notes: null,
      },
    });
  });

  it("suma si kilometrajul optionale, validate cand exista", () => {
    const ok = parseFuelEntryForm(
      form({ ...base, amount: "603,75", odometer_km: "120500" }),
      TODAY,
    );
    expect(ok.ok && ok.value).toMatchObject({ amount: 603.75, odometerKm: 120500 });
    expect(parseFuelEntryForm(form({ ...base, amount: "x" }), TODAY).ok).toBe(false);
    expect(parseFuelEntryForm(form({ ...base, odometer_km: "12,5" }), TODAY).ok).toBe(false);
  });

  it("kilometrajul e obligatoriu doar cand se cere (alimentari noi)", () => {
    expect(parseFuelEntryForm(form(base), TODAY, { requireOdometer: true })).toEqual({
      ok: false,
      error: expect.stringMatching(/kilometrajul/),
    });
    const ok = parseFuelEntryForm(form({ ...base, odometer_km: "120 500" }), TODAY, {
      requireOdometer: true,
    });
    expect(ok.ok && ok.value.odometerKm).toBe(120500);
  });

  it("respinge vehicul lipsa, litri <= 0, data invalida sau din viitor", () => {
    expect(parseFuelEntryForm(form({ ...base, vehicle_id: "" }), TODAY).ok).toBe(false);
    expect(parseFuelEntryForm(form({ ...base, liters: "0" }), TODAY).ok).toBe(false);
    expect(parseFuelEntryForm(form({ ...base, filled_on: "12.10.2026" }), TODAY).ok).toBe(false);
    expect(parseFuelEntryForm(form({ ...base, filled_on: "2026-10-14" }), TODAY)).toEqual({
      ok: false,
      error: expect.stringMatching(/viitor/),
    });
  });
});

describe("validateReceiptFile", () => {
  it("accepta poze si PDF sub 4MB", () => {
    expect(validateReceiptFile({ size: 1000, type: "image/jpeg" })).toBeNull();
    expect(validateReceiptFile({ size: 1000, type: "application/pdf" })).toBeNull();
  });
  it("respinge fisiere mari sau de alt tip", () => {
    expect(validateReceiptFile({ size: 5 * 1024 * 1024, type: "image/jpeg" })).toMatch(/4MB/);
    expect(validateReceiptFile({ size: 1000, type: "text/plain" })).toMatch(/imagine/);
  });
});
