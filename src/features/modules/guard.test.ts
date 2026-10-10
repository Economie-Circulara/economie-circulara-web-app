import { afterEach, describe, expect, it, vi } from "vitest";

const { getCurrentOrg, notFound } = vi.hoisted(() => ({
  getCurrentOrg: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/features/auth/queries", () => ({ getCurrentOrg }));
vi.mock("next/navigation", () => ({ notFound }));

import { requireModule } from "./guard";

afterEach(() => {
  vi.clearAllMocks();
});

describe("requireModule", () => {
  it("trece cand organizatia are modulul activ", async () => {
    getCurrentOrg.mockResolvedValue({ enabledModules: ["assistant", "fleet"] });
    await expect(requireModule("fleet")).resolves.toBeUndefined();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("404 cand modulul e dezactivat", async () => {
    getCurrentOrg.mockResolvedValue({ enabledModules: ["fleet"] });
    await expect(requireModule("assistant")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("404 fara organizatie", async () => {
    getCurrentOrg.mockResolvedValue(null);
    await expect(requireModule("assistant")).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
