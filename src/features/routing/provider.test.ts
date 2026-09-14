import { afterEach, describe, expect, it, vi } from "vitest";
import { AddressNotFoundError, RoutingNotConfiguredError } from "./types";
import { GoogleRoutingProvider, MockRoutingProvider, getRoutingProvider } from "./provider";

describe("MockRoutingProvider", () => {
  const provider = new MockRoutingProvider();

  it("geocodeaza determinist: aceeasi adresa produce mereu aceleasi coordonate", async () => {
    const first = await provider.geocode({ address: "Șos. Moara de Foc 12, Iași" });
    const second = await provider.geocode({ address: "Șos. Moara de Foc 12, Iași" });
    expect(first).toEqual(second);
  });

  it("adrese diferite produc coordonate diferite", async () => {
    const a = await provider.geocode({ address: "Adresa A" });
    const b = await provider.geocode({ address: "Adresa B" });
    expect(a).not.toEqual(b);
  });

  it("arunca AddressNotFoundError pentru o adresa goala", async () => {
    await expect(provider.geocode({ address: "  " })).rejects.toBeInstanceOf(AddressNotFoundError);
  });

  it("calculeaza cel putin 2 variante de ruta, cu distanta/durata pozitive", async () => {
    const routes = await provider.computeRoutes({
      origin: { lat: 47.16, lng: 27.58 },
      destination: { lat: 47.2, lng: 27.65 },
    });

    expect(routes.length).toBeGreaterThanOrEqual(2);
    for (const route of routes) {
      expect(route.distanceMeters).toBeGreaterThan(0);
      expect(route.durationSeconds).toBeGreaterThan(0);
      expect(route.polyline.length).toBeGreaterThan(0);
    }
  });
});

describe("GoogleRoutingProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("arunca RoutingNotConfiguredError cand lipseste cheia API (geocode)", async () => {
    const provider = new GoogleRoutingProvider({});
    await expect(provider.geocode({ address: "Iași" })).rejects.toBeInstanceOf(
      RoutingNotConfiguredError,
    );
  });

  it("arunca RoutingNotConfiguredError cand lipseste cheia API (computeRoutes)", async () => {
    const provider = new GoogleRoutingProvider({});
    await expect(
      provider.computeRoutes({ origin: { lat: 0, lng: 0 }, destination: { lat: 1, lng: 1 } }),
    ).rejects.toBeInstanceOf(RoutingNotConfiguredError);
  });

  it("geocodeaza cu adresa text-liber cand nu exista componente structurate (nu 'România' singur)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "OK",
        results: [
          {
            formatted_address: "Șos. Moara de Foc 12, Iași",
            geometry: { location: { lat: 1, lng: 2 } },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GoogleRoutingProvider({ apiKey: "test-key" });
    await provider.geocode({ address: "Șos. Moara de Foc 12, Iași" });

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("address")).toEqual("Șos. Moara de Foc 12, Iași");
  });

  it("geocodeaza cu componentele structurate cand exista (adresa mai precisa)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "OK",
        results: [{ formatted_address: "x", geometry: { location: { lat: 1, lng: 2 } } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GoogleRoutingProvider({ apiKey: "test-key" });
    await provider.geocode({
      address: "text liber neignorat",
      street: "Șos. Moara de Foc",
      streetNumber: "12",
      locality: "Iași",
      county: "Iași",
    });

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("address")).toEqual(
      "Șos. Moara de Foc 12, Iași, Iași, România",
    );
  });

  it("parseaza raspunsul Routes API (durata in secunde, distanta, polilinie)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [
          { distanceMeters: 12345, duration: "678s", polyline: { encodedPolyline: "enc1" } },
          { distanceMeters: 15000, duration: "700s", polyline: { encodedPolyline: "enc2" } },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GoogleRoutingProvider({ apiKey: "test-key" });
    const routes = await provider.computeRoutes({
      origin: { lat: 47.1, lng: 27.5 },
      destination: { lat: 47.2, lng: 27.6 },
    });

    expect(routes).toEqual([
      {
        distanceMeters: 12345,
        durationSeconds: 678,
        polyline: "enc1",
        label: "Ruta recomandată de Google",
      },
      {
        distanceMeters: 15000,
        durationSeconds: 700,
        polyline: "enc2",
        label: "Rută alternativă 1",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("routes.googleapis.com"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("getRoutingProvider", () => {
  const originalEnv = process.env.ROUTING_PROVIDER;
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.ROUTING_PROVIDER;
    else process.env.ROUTING_PROVIDER = originalEnv;
  });

  it("intoarce MockRoutingProvider implicit", () => {
    delete process.env.ROUTING_PROVIDER;
    expect(getRoutingProvider()).toBeInstanceOf(MockRoutingProvider);
  });

  it("intoarce GoogleRoutingProvider cand ROUTING_PROVIDER=google", () => {
    process.env.ROUTING_PROVIDER = "google";
    expect(getRoutingProvider()).toBeInstanceOf(GoogleRoutingProvider);
  });
});
