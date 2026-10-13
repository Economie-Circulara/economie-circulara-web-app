import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  requireModule: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  revalidatePath: vi.fn(),
  getFuelEntry: vi.fn(),
  uploadFuelReceipt: vi.fn(),
  removeFuelReceipt: vi.fn(),
  createFuelEntry: vi.fn(),
  updateFuelEntry: vi.fn(),
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  setVehicleArchived: vi.fn(),
}));

vi.mock("@/features/auth/session", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/features/modules/guard", () => ({ requireModule: mocks.requireModule }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./dates", () => ({ todayInRomania: () => "2026-10-13" }));
vi.mock("./queries", () => ({ getFuelEntry: mocks.getFuelEntry }));
vi.mock("./receipt-storage", () => ({
  uploadFuelReceipt: mocks.uploadFuelReceipt,
  removeFuelReceipt: mocks.removeFuelReceipt,
}));
vi.mock("./service", async () => {
  const actual = await vi.importActual<typeof import("./service")>("./service");
  return {
    FleetValidationError: actual.FleetValidationError,
    createFuelEntry: mocks.createFuelEntry,
    updateFuelEntry: mocks.updateFuelEntry,
    createVehicle: mocks.createVehicle,
    updateVehicle: mocks.updateVehicle,
    setVehicleArchived: mocks.setVehicleArchived,
  };
});

import { initialFleetFormState } from "./action-state";
import {
  archiveVehicleAction,
  createFuelEntryAction,
  createVehicleAction,
  updateFuelEntryAction,
} from "./actions";

function form(fields: Record<string, string | File>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const RECEIPT = { path: "org-1/new-bon.jpg", fileName: "bon.jpg", mimeType: "image/jpeg" };
const fuelFields = {
  vehicle_id: "v1",
  filled_on: "2026-10-12",
  liters: "80",
  odometer_km: "120500",
};

beforeEach(() => {
  mocks.requireRole.mockResolvedValue({ id: "u1", role: "operator", organizationId: "org-1" });
  mocks.requireModule.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("garda modulului Flotă", () => {
  it("staff + modulul `fleet` pe fiecare actiune", async () => {
    mocks.setVehicleArchived.mockResolvedValue(undefined);
    await archiveVehicleAction("v1");
    expect(mocks.requireRole).toHaveBeenCalledWith(["admin", "operator"]);
    expect(mocks.requireModule).toHaveBeenCalledWith("fleet");
  });

  it("modul dezactivat => 404, nimic scris", async () => {
    mocks.requireModule.mockRejectedValue(new Error("NEXT_NOT_FOUND"));
    await expect(
      createVehicleAction(initialFleetFormState, form({ name: "A", consumption: "30" })),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.createVehicle).not.toHaveBeenCalled();
  });
});

describe("createVehicleAction", () => {
  it("valideaza, creeaza si duce pe pagina vehiculului", async () => {
    mocks.createVehicle.mockResolvedValue({ id: "v9" });
    await expect(
      createVehicleAction(initialFleetFormState, form({ name: "A", consumption: "30" })),
    ).rejects.toThrow("REDIRECT:/flota/v9");
    expect(mocks.createVehicle).toHaveBeenCalledWith(
      "org-1",
      "u1",
      expect.objectContaining({ consumptionLPer100km: 30 }),
    );
  });

  it("formular invalid => eroare, fara scriere", async () => {
    const state = await createVehicleAction(initialFleetFormState, form({ name: "A" }));
    expect(state.error).toMatch(/Consumul/);
    expect(mocks.createVehicle).not.toHaveBeenCalled();
  });
});

describe("createFuelEntryAction", () => {
  it("incarca bonul, salveaza si revine pe ruta ceruta (doar /flota)", async () => {
    mocks.uploadFuelReceipt.mockResolvedValue(RECEIPT);
    mocks.createFuelEntry.mockResolvedValue({ id: "f1" });
    const file = new File(["x"], "bon.jpg", { type: "image/jpeg" });
    await expect(
      createFuelEntryAction(
        initialFleetFormState,
        form({ ...fuelFields, receipt: file, return_to: "/flota/v1" }),
      ),
    ).rejects.toThrow("REDIRECT:/flota/v1");
    expect(mocks.createFuelEntry).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ liters: 80 }),
      RECEIPT,
    );
  });

  it("un return_to extern e ignorat", async () => {
    mocks.createFuelEntry.mockResolvedValue({ id: "f1" });
    await expect(
      createFuelEntryAction(
        initialFleetFormState,
        form({ ...fuelFields, return_to: "https://evil.example" }),
      ),
    ).rejects.toThrow("REDIRECT:/flota/alimentari");
  });

  it("daca salvarea pica, bonul deja incarcat se sterge", async () => {
    mocks.uploadFuelReceipt.mockResolvedValue(RECEIPT);
    mocks.createFuelEntry.mockRejectedValue(new Error("Vehiculul ales este arhivat."));
    const file = new File(["x"], "bon.jpg", { type: "image/jpeg" });
    const state = await createFuelEntryAction(
      initialFleetFormState,
      form({ ...fuelFields, receipt: file }),
    );
    expect(state.error).toBe("Vehiculul ales este arhivat.");
    expect(mocks.removeFuelReceipt).toHaveBeenCalledWith(RECEIPT.path);
  });
});

describe("kilometrajul obligatoriu", () => {
  it("alimentare noua fara kilometraj => eroare, nimic salvat", async () => {
    const { odometer_km: _omit, ...withoutOdometer } = fuelFields;
    const state = await createFuelEntryAction(initialFleetFormState, form(withoutOdometer));
    expect(state.error).toMatch(/kilometrajul/);
    expect(mocks.createFuelEntry).not.toHaveBeenCalled();
  });

  it("o alimentare veche fara kilometraj se poate corecta tot fara el", async () => {
    mocks.getFuelEntry.mockResolvedValue({
      id: "f0",
      vehicleId: "v1",
      odometerKm: null,
      receipt: null,
    });
    mocks.updateFuelEntry.mockResolvedValue({ id: "f0" });
    const { odometer_km: _omit, ...withoutOdometer } = fuelFields;
    const state = await updateFuelEntryAction(
      initialFleetFormState,
      form({ ...withoutOdometer, id: "f0" }),
    );
    expect(state.error).toBeNull();
  });

  it("o alimentare cu kilometraj nu il poate pierde la corectare", async () => {
    mocks.getFuelEntry.mockResolvedValue({
      id: "f1",
      vehicleId: "v1",
      odometerKm: 120000,
      receipt: null,
    });
    const { odometer_km: _omit, ...withoutOdometer } = fuelFields;
    const state = await updateFuelEntryAction(
      initialFleetFormState,
      form({ ...withoutOdometer, id: "f1" }),
    );
    expect(state.error).toMatch(/kilometrajul/);
    expect(mocks.updateFuelEntry).not.toHaveBeenCalled();
  });
});

describe("updateFuelEntryAction", () => {
  const existing = {
    id: "f1",
    vehicleId: "v1",
    odometerKm: 120000,
    receipt: { path: "org-1/old-bon.jpg", fileName: "old.jpg", mimeType: "image/jpeg" },
  };

  it("bon nou => inlocuieste si sterge bonul vechi", async () => {
    mocks.getFuelEntry.mockResolvedValue(existing);
    mocks.uploadFuelReceipt.mockResolvedValue(RECEIPT);
    mocks.updateFuelEntry.mockResolvedValue({ id: "f1" });
    const file = new File(["x"], "bon.jpg", { type: "image/jpeg" });
    const state = await updateFuelEntryAction(
      initialFleetFormState,
      form({ ...fuelFields, id: "f1", receipt: file }),
    );
    expect(state.message).toMatch(/salvată/);
    expect(mocks.updateFuelEntry).toHaveBeenCalledWith("f1", "v1", expect.anything(), RECEIPT);
    expect(mocks.removeFuelReceipt).toHaveBeenCalledWith("org-1/old-bon.jpg");
  });

  it("fara fisier si fara bifa => bonul ramane (undefined), nimic sters", async () => {
    mocks.getFuelEntry.mockResolvedValue(existing);
    mocks.updateFuelEntry.mockResolvedValue({ id: "f1" });
    await updateFuelEntryAction(initialFleetFormState, form({ ...fuelFields, id: "f1" }));
    expect(mocks.updateFuelEntry).toHaveBeenCalledWith("f1", "v1", expect.anything(), undefined);
    expect(mocks.removeFuelReceipt).not.toHaveBeenCalled();
  });

  it("bifa „Scoate bonul” => null si bonul vechi se sterge", async () => {
    mocks.getFuelEntry.mockResolvedValue(existing);
    mocks.updateFuelEntry.mockResolvedValue({ id: "f1" });
    await updateFuelEntryAction(
      initialFleetFormState,
      form({ ...fuelFields, id: "f1", remove_receipt: "on" }),
    );
    expect(mocks.updateFuelEntry).toHaveBeenCalledWith("f1", "v1", expect.anything(), null);
    expect(mocks.removeFuelReceipt).toHaveBeenCalledWith("org-1/old-bon.jpg");
  });

  it("alimentare invizibila (RLS) => eroare", async () => {
    mocks.getFuelEntry.mockResolvedValue(null);
    const state = await updateFuelEntryAction(
      initialFleetFormState,
      form({ ...fuelFields, id: "f1" }),
    );
    expect(state.error).toMatch(/nu există/);
  });
});
