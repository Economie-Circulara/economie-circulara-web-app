import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { sortQuoteRequests } = await import("./queries");

const row = (id: string, status: "new" | "handled", createdAt: string) => ({
  id,
  service: "Beton",
  name: "X",
  phone: "0700",
  email: null,
  message: null,
  status,
  createdAt,
  handledAt: null,
});

describe("sortQuoteRequests", () => {
  it("pune cererile noi primele, apoi cele mai recente", () => {
    const sorted = sortQuoteRequests([
      row("a", "handled", "2026-09-30T10:00:00Z"),
      row("b", "new", "2026-09-28T10:00:00Z"),
      row("c", "new", "2026-09-29T10:00:00Z"),
      row("d", "handled", "2026-09-30T12:00:00Z"),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(["c", "b", "d", "a"]);
  });
});
