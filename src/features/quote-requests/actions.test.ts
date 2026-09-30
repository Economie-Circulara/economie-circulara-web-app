import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRole = vi.fn();
vi.mock("@/features/auth/session", () => ({ requireRole }));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const select = vi.fn();
const eq = vi.fn(() => ({ select }));
const update = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ update }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from }) }));

const { setQuoteRequestStatusAction } = await import("./actions");

beforeEach(() => {
  vi.clearAllMocks();
  select.mockResolvedValue({ data: [{ id: "q-1" }], error: null });
});

describe("setQuoteRequestStatusAction", () => {
  it("marcheaza cererea rezolvata (doar staff)", async () => {
    const result = await setQuoteRequestStatusAction("q-1", "handled");
    expect(result).toEqual({ error: null });
    expect(requireRole).toHaveBeenCalledWith(["admin", "operator"]);
    expect(from).toHaveBeenCalledWith("quote_requests");
    expect(update).toHaveBeenCalledWith({ status: "handled" });
    expect(eq).toHaveBeenCalledWith("id", "q-1");
    expect(revalidatePath).toHaveBeenCalledWith("/cereri-oferta");
  });

  it("refuza un status necunoscut", async () => {
    const result = await setQuoteRequestStatusAction("q-1", "sters" as never);
    expect(result.error).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });

  it("o cerere invizibila (alta organizatie, RLS) = inexistenta", async () => {
    select.mockResolvedValue({ data: [], error: null });
    const result = await setQuoteRequestStatusAction("q-2", "handled");
    expect(result).toEqual({ error: "Cererea nu există." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
