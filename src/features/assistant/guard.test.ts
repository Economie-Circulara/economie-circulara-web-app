import { afterEach, describe, expect, it, vi } from "vitest";

const { requireRole, requireModule } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  requireModule: vi.fn(),
}));
vi.mock("@/features/auth/session", () => ({ requireRole }));
vi.mock("@/features/modules/guard", () => ({ requireModule }));

import { ASSISTANT_ROLES } from "./access";
import { requireAssistantUser } from "./guard";

afterEach(() => {
  vi.clearAllMocks();
});

describe("requireAssistantUser", () => {
  it("staff-ul trece doar daca organizatia are modulul `assistant`", async () => {
    const user = { id: "u1", role: "operator", organizationId: "org-1" };
    requireRole.mockResolvedValue(user);
    await expect(requireAssistantUser()).resolves.toBe(user);
    expect(requireRole).toHaveBeenCalledWith(ASSISTANT_ROLES);
    expect(requireModule).toHaveBeenCalledWith("assistant");
  });

  it("modul dezactivat => 404 (eroarea lui requireModule se propaga)", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "admin", organizationId: "org-1" });
    requireModule.mockRejectedValue(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));
    await expect(requireAssistantUser()).rejects.toThrow(/404/);
  });

  it("super-adminul (fara organizatie) nu depinde de modul", async () => {
    requireRole.mockResolvedValue({ id: "s1", role: "super_admin", organizationId: null });
    await requireAssistantUser();
    expect(requireModule).not.toHaveBeenCalled();
  });
});
