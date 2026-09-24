import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks (nu spies - AGENTS.md §2.2) - arhivarea clientilor (migrarea 0035).
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireRole }));

const { listClientUserIds, setAuthUsersBanned } = vi.hoisted(() => ({
  listClientUserIds: vi.fn(),
  setAuthUsersBanned: vi.fn(),
}));
vi.mock("@/features/settings/auth-ban", () => ({ listClientUserIds, setAuthUsersBanned }));
vi.mock("@/features/settings/user-actions", () => ({ sendClientInvite: vi.fn() }));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { archiveClientAction, restoreClientAction } from "./actions";
import { DuplicateCuiError, setClientArchived } from "./service";

function makeBuilder(finalResult: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ["select", "eq", "update"]) {
    builder[m] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn().mockResolvedValue(finalResult);
  return builder;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("setClientArchived", () => {
  it("seteaza archived_at pe clients (blocarea userului o face trigger-ul DB)", async () => {
    const builder = makeBuilder({ data: { id: "c1" }, error: null });
    const from = vi.fn().mockReturnValue(builder);
    createClient.mockResolvedValue({ from });

    await setClientArchived("c1", true);

    expect(from).toHaveBeenCalledWith("clients");
    expect(from).not.toHaveBeenCalledWith("profiles");
    const patch = builder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof patch.archived_at).toBe("string");
  });

  it("0 randuri afectate => eroare", async () => {
    createClient.mockResolvedValue({
      from: vi.fn().mockReturnValue(makeBuilder({ data: null, error: null })),
    });
    await expect(setClientArchived("c-x", false)).rejects.toThrow(/nu există|nu ai acces/i);
  });
});

describe("archiveClientAction / restoreClientAction", () => {
  it("arhivarea blocheaza si contul din Supabase Auth al utilizatorului-client", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "operator" });
    createClient.mockResolvedValue({
      from: vi.fn().mockReturnValue(makeBuilder({ data: { id: "c1" }, error: null })),
    });
    listClientUserIds.mockResolvedValue(["client-user-1"]);
    setAuthUsersBanned.mockResolvedValue(true);

    const result = await archiveClientAction("c1");

    expect(result).toEqual({ error: null });
    expect(requireRole).toHaveBeenCalledWith(["admin", "operator"]);
    expect(setAuthUsersBanned).toHaveBeenCalledWith(["client-user-1"], true);
    expect(revalidatePath).toHaveBeenCalledWith("/clienti");
  });

  it("restaurarea deblocheaza contul", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "admin" });
    createClient.mockResolvedValue({
      from: vi.fn().mockReturnValue(makeBuilder({ data: { id: "c1" }, error: null })),
    });
    listClientUserIds.mockResolvedValue(["client-user-1"]);

    await restoreClientAction("c1");

    expect(setAuthUsersBanned).toHaveBeenCalledWith(["client-user-1"], false);
  });

  it("daca arhivarea esueaza, nu atinge conturile din Auth", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "admin" });
    createClient.mockResolvedValue({
      from: vi.fn().mockReturnValue(makeBuilder({ data: null, error: { message: "boom" } })),
    });

    const result = await archiveClientAction("c1");

    expect(result.error).toBe("boom");
    expect(setAuthUsersBanned).not.toHaveBeenCalled();
  });
});

describe("DuplicateCuiError", () => {
  it("indica si varianta clientului arhivat (CUI-ul ramane unic)", () => {
    expect(new DuplicateCuiError("123").message).toMatch(/arhiva/i);
  });
});
