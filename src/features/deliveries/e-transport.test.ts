import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ETransportNotConfiguredError,
  MockETransportProvider,
  SocrateETransportProvider,
  getETransportProvider,
} from "./e-transport";

function declarationInput(
  overrides: Partial<Parameters<MockETransportProvider["declare"]>[0]> = {},
) {
  return {
    deliveryId: "delivery-1",
    organizationId: "org-1",
    orderNumber: "CMD-2026-0001",
    scheduledDate: "2026-08-01",
    carrierName: "Transport SRL",
    vehiclePlate: "B 123 ABC",
    driverName: "Ion Popescu",
    routeOrigin: "Depozit central",
    routeDestination: "Șantier Militari",
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("MockETransportProvider", () => {
  it("returnează un UIT determinist (același deliveryId -> același UIT)", async () => {
    const provider = new MockETransportProvider();

    const first = await provider.declare(declarationInput());
    const second = await provider.declare(declarationInput());

    expect(first.uit).toEqual(second.uit);
    expect(first.uit).toMatch(/^MOCK-UIT-[0-9A-F]{10}$/);
  });

  it("generează UIT diferit pentru livrări diferite", async () => {
    const provider = new MockETransportProvider();

    const a = await provider.declare(declarationInput({ deliveryId: "delivery-a" }));
    const b = await provider.declare(declarationInput({ deliveryId: "delivery-b" }));

    expect(a.uit).not.toEqual(b.uit);
  });

  it("nu apelează rețeaua (fetch nu e definit/apelat)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await new MockETransportProvider().declare(declarationInput());

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("SocrateETransportProvider", () => {
  it("aruncă ETransportNotConfiguredError cât timp lipsesc credențialele (cazul actual, S4 nerezolvat)", async () => {
    const provider = new SocrateETransportProvider({});

    await expect(provider.declare(declarationInput())).rejects.toBeInstanceOf(
      ETransportNotConfiguredError,
    );
  });

  it("citește configurația din env cand nu e injectată explicit", async () => {
    vi.stubEnv("SOCRATE_API_URL", "");
    vi.stubEnv("SOCRATE_API_KEY", "");
    const provider = new SocrateETransportProvider();

    await expect(provider.declare(declarationInput())).rejects.toBeInstanceOf(
      ETransportNotConfiguredError,
    );
  });
});

describe("getETransportProvider", () => {
  it("întoarce MockETransportProvider implicit (fără ETRANSPORT_PROVIDER setat)", () => {
    vi.stubEnv("ETRANSPORT_PROVIDER", "");
    expect(getETransportProvider()).toBeInstanceOf(MockETransportProvider);
  });

  it("întoarce SocrateETransportProvider cand ETRANSPORT_PROVIDER=socrate", () => {
    vi.stubEnv("ETRANSPORT_PROVIDER", "socrate");
    expect(getETransportProvider()).toBeInstanceOf(SocrateETransportProvider);
  });

  it("întoarce MockETransportProvider pentru orice altă valoare necunoscută", () => {
    vi.stubEnv("ETRANSPORT_PROVIDER", "altceva");
    expect(getETransportProvider()).toBeInstanceOf(MockETransportProvider);
  });
});
