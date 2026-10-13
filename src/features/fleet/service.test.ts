import { afterEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import {
  FleetValidationError,
  assertOdometerConsistent,
  createFuelEntry,
  createVehicle,
  setVehicleArchived,
  updateFuelEntry,
} from "./service";
import type { FuelEntryInput, VehicleInput } from "./types";

/** Builder Supabase fals: fiecare apel `from(tabel)` intoarce rezultatul pus in coada lui. */
function mockSupabase(results: Record<string, Array<{ data: unknown; error: unknown }>>) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const from = vi.fn((table: string) => {
    const result = results[table]?.shift() ?? { data: null, error: null };
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "insert", "update", "eq", "is", "not", "order"]) {
      builder[method] = vi.fn((...args: unknown[]) => {
        calls.push({ table, method, args });
        return builder;
      });
    }
    builder.single = vi.fn().mockResolvedValue(result);
    // Interogarile fara .single()/.maybeSingle() (lista de kilometraje) se asteapta direct.
    builder.then = (resolve: (value: unknown) => void) => resolve(result);
    builder.maybeSingle = vi.fn().mockResolvedValue(result);
    return builder;
  });
  createClient.mockResolvedValue({ from });
  return calls;
}

const VEHICLE_ROW = {
  id: "v1",
  name: "Basculanta 1",
  plate: "IS-12-ABC",
  vehicle_type: null,
  fuel_type: "Motorină",
  consumption_l_per_100km: "32.50",
  capacity: null,
  capacity_unit: null,
  default_driver_name: null,
  notes: null,
  archived_at: null,
  created_at: "2026-10-13T10:00:00Z",
  updated_at: "2026-10-13T10:00:00Z",
};

const VEHICLE_INPUT: VehicleInput = {
  name: "Basculanta 1",
  plate: "IS-12-ABC",
  vehicleType: null,
  fuelType: "Motorină",
  consumptionLPer100km: 32.5,
  capacity: null,
  capacityUnit: null,
  defaultDriverName: null,
  notes: null,
};

const FUEL_INPUT: FuelEntryInput = {
  vehicleId: "v1",
  filledOn: "2026-10-12",
  liters: 80,
  amount: 600,
  odometerKm: null,
  station: null,
  notes: null,
};

const FUEL_ROW = {
  id: "f1",
  vehicle_id: "v1",
  filled_on: "2026-10-12",
  liters: "80.00",
  amount: "600.00",
  odometer_km: null,
  station: null,
  notes: null,
  receipt_path: "org/x-bon.jpg",
  receipt_file_name: "bon.jpg",
  receipt_mime_type: "image/jpeg",
  created_at: "2026-10-13T10:00:00Z",
  updated_at: "2026-10-13T10:00:00Z",
  vehicles: { name: "Basculanta 1", plate: "IS-12-ABC" },
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("createVehicle", () => {
  it("insereaza in organizatia userului si mapeaza numerele din DB", async () => {
    const calls = mockSupabase({ vehicles: [{ data: VEHICLE_ROW, error: null }] });
    const vehicle = await createVehicle("org-1", "u1", VEHICLE_INPUT);
    expect(vehicle.consumptionLPer100km).toBe(32.5);
    expect(calls.find((c) => c.method === "insert")?.args[0]).toMatchObject({
      organization_id: "org-1",
      created_by: "u1",
      consumption_l_per_100km: 32.5,
    });
  });

  it("numar de inmatriculare duplicat => mesaj clar", async () => {
    mockSupabase({ vehicles: [{ data: null, error: { code: "23505", message: "dup" } }] });
    await expect(createVehicle("org-1", "u1", VEHICLE_INPUT)).rejects.toThrow(
      new FleetValidationError("Numărul de înmatriculare IS-12-ABC există deja în flotă."),
    );
  });
});

describe("setVehicleArchived", () => {
  it("seteaza / goleste archived_at", async () => {
    const calls = mockSupabase({ vehicles: [{ data: { id: "v1" }, error: null }] });
    await setVehicleArchived("v1", false);
    expect(calls.find((c) => c.method === "update")?.args[0]).toEqual({ archived_at: null });
  });

  it("vehicul invizibil (RLS / modul oprit) => eroare", async () => {
    mockSupabase({ vehicles: [{ data: null, error: null }] });
    await expect(setVehicleArchived("v1", true)).rejects.toThrow();
  });
});

describe("createFuelEntry", () => {
  it("salveaza alimentarea cu bonul", async () => {
    const calls = mockSupabase({
      vehicles: [{ data: { id: "v1", archived_at: null }, error: null }],
      fuel_entries: [{ data: FUEL_ROW, error: null }],
    });
    const entry = await createFuelEntry("org-1", FUEL_INPUT, {
      path: "org/x-bon.jpg",
      fileName: "bon.jpg",
      mimeType: "image/jpeg",
    });
    expect(entry).toMatchObject({ liters: 80, amount: 600, vehicleName: "Basculanta 1" });
    expect(entry.receipt?.fileName).toBe("bon.jpg");
    expect(calls.find((c) => c.method === "insert")?.args[0]).toMatchObject({
      organization_id: "org-1",
      receipt_path: "org/x-bon.jpg",
    });
  });

  it("refuza un vehicul arhivat", async () => {
    mockSupabase({ vehicles: [{ data: { id: "v1", archived_at: "2026-10-01" }, error: null }] });
    await expect(createFuelEntry("org-1", FUEL_INPUT, null)).rejects.toThrow(/arhivat/);
  });

  it("refuza un vehicul inexistent", async () => {
    mockSupabase({ vehicles: [{ data: null, error: null }] });
    await expect(createFuelEntry("org-1", FUEL_INPUT, null)).rejects.toThrow(/nu există/);
  });
});

describe("updateFuelEntry", () => {
  it("o alimentare veche isi pastreaza vehiculul arhivat; bonul neschimbat nu se atinge", async () => {
    const calls = mockSupabase({
      vehicles: [{ data: { id: "v1", archived_at: "2026-10-01" }, error: null }],
      fuel_entries: [{ data: FUEL_ROW, error: null }],
    });
    await updateFuelEntry("f1", "v1", FUEL_INPUT, undefined);
    const patch = calls.find((c) => c.method === "update")?.args[0] as Record<string, unknown>;
    expect(patch).not.toHaveProperty("receipt_path");
    expect(patch).toMatchObject({ liters: 80 });
  });

  it("mutarea pe un vehicul arhivat e refuzata", async () => {
    mockSupabase({ vehicles: [{ data: { id: "v2", archived_at: "2026-10-01" }, error: null }] });
    await expect(
      updateFuelEntry("f1", "v1", { ...FUEL_INPUT, vehicleId: "v2" }, undefined),
    ).rejects.toThrow(/arhivat/);
  });

  it("bonul scos (null) goleste coloanele bonului", async () => {
    const calls = mockSupabase({
      vehicles: [{ data: { id: "v1", archived_at: null }, error: null }],
      fuel_entries: [{ data: FUEL_ROW, error: null }],
    });
    await updateFuelEntry("f1", "v1", FUEL_INPUT, null);
    expect(calls.find((c) => c.method === "update")?.args[0]).toMatchObject({
      receipt_path: null,
      receipt_file_name: null,
      receipt_mime_type: null,
    });
  });
});

describe("assertOdometerConsistent", () => {
  const history = {
    fuel_entries: [
      {
        data: [
          { id: "f1", filled_on: "2026-10-01", odometer_km: 100_000 },
          { id: "f2", filled_on: "2026-10-10", odometer_km: 101_000 },
        ],
        error: null,
      },
    ],
  };

  it("accepta un kilometraj intre alimentarea anterioara si cea ulterioara", async () => {
    mockSupabase(structuredClone(history));
    await expect(assertOdometerConsistent("v1", "2026-10-05", 100_400)).resolves.toBeUndefined();
  });

  it("respinge un kilometraj mai mic decat la o alimentare anterioara", async () => {
    mockSupabase(structuredClone(history));
    await expect(assertOdometerConsistent("v1", "2026-10-05", 99_000)).rejects.toThrow(
      /mai mic decât la o alimentare anterioară/,
    );
  });

  it("respinge un kilometraj mai mare decat la o alimentare ulterioara", async () => {
    mockSupabase(structuredClone(history));
    await expect(assertOdometerConsistent("v1", "2026-10-05", 102_000)).rejects.toThrow(
      /mai mare decât la o alimentare ulterioară/,
    );
  });

  it("la corectare se ignora alimentarea insasi; fara kilometraj nu se verifica nimic", async () => {
    mockSupabase(structuredClone(history));
    await expect(
      assertOdometerConsistent("v1", "2026-10-10", 100_500, "f2"),
    ).resolves.toBeUndefined();
    await expect(assertOdometerConsistent("v1", "2026-10-05", null)).resolves.toBeUndefined();
  });
});
