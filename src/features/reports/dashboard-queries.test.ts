import { afterEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { getDashboardKpis } from "./dashboard-queries";

/** Query builder fals, chainable, care rezolva la un rezultat `{ count, error }`. */
function makeCountBuilder(count: number, error: unknown = null) {
  const builder: Record<string, unknown> & { then: (resolve: (v: unknown) => void) => void } = {
    then: (resolve) => resolve({ count, error }),
  };
  for (const m of ["select", "in", "eq", "gte", "or"]) {
    builder[m] = vi.fn(() => builder);
  }
  return builder;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getDashboardKpis", () => {
  it("combina cele 4 numarari in indicatorii de dashboard", async () => {
    // Ordinea de apel din sursa (Promise.all): active, de-acceptat, livrate, certificate.
    const builders = [
      makeCountBuilder(14), // comenzi active (sent/accepted/delivered)
      makeCountBuilder(3), // de acceptat (sent)
      makeCountBuilder(27), // livrate luna curenta
      makeCountBuilder(27), // certificate emise (total)
    ];
    let call = 0;
    const from = vi.fn(() => builders[call++]);
    createClient.mockResolvedValue({ from });

    const result = await getDashboardKpis();

    expect(result).toEqual({
      activeOrders: 14,
      ordersToAccept: 3,
      deliveredThisMonth: 27,
      certificatesIssued: 27,
    });
    expect(builders[0].in).toHaveBeenCalledWith("status", ["sent", "accepted", "delivered"]);
    expect(builders[1].eq).toHaveBeenCalledWith("status", "sent");
    expect(builders[2].eq).toHaveBeenCalledWith("status", "delivered");
    // Momentul livrarii = delivered_at, cu fallback delivery_date ?? updated_at
    // (acelasi lant ca deliveredAtIso din calculations.ts — Fix F3).
    const orFilter = (builders[2].or as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(orFilter).toMatch(/^delivered_at\.gte\./);
    expect(orFilter).toContain("and(delivered_at.is.null,delivery_date.gte.");
    expect(orFilter).toContain("and(delivered_at.is.null,delivery_date.is.null,updated_at.gte.");
  });

  it("intoarce 0 daca vreo numarare e null (fara randuri)", async () => {
    const builders = [
      makeCountBuilder(null as unknown as number),
      makeCountBuilder(null as unknown as number),
      makeCountBuilder(null as unknown as number),
      makeCountBuilder(null as unknown as number),
    ];
    let call = 0;
    createClient.mockResolvedValue({ from: vi.fn(() => builders[call++]) });

    const result = await getDashboardKpis();
    expect(result).toEqual({
      activeOrders: 0,
      ordersToAccept: 0,
      deliveredThisMonth: 0,
      certificatesIssued: 0,
    });
  });

  it("arunca eroare daca una dintre numarari esueaza", async () => {
    const builders = [
      makeCountBuilder(14),
      makeCountBuilder(0, { message: "boom" }),
      makeCountBuilder(27),
      makeCountBuilder(27),
    ];
    let call = 0;
    createClient.mockResolvedValue({ from: vi.fn(() => builders[call++]) });

    await expect(getDashboardKpis()).rejects.toThrow();
  });
});
