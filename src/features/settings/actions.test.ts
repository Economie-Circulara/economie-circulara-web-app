import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks (nu spies - AGENTS.md §2.2).
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { createAdminClient } = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ getCurrentUser }));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { updateOrganizationAction } from "./actions";
import { initialSettingsState } from "./action-state";

afterEach(() => {
  vi.clearAllMocks();
});

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("updateOrganizationAction", () => {
  it("respinge un non-admin (fara sa atinga baza de date)", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", role: "operator", organizationId: "org-1" });

    const state = await updateOrganizationAction(
      initialSettingsState,
      formData({ name: "Firma SRL" }),
    );

    expect(state.error).toMatch(/permisiunea/i);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("cere numele organizatiei", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", role: "admin", organizationId: "org-1" });

    const state = await updateOrganizationAction(initialSettingsState, formData({}));

    expect(state.error).toMatch(/nume/i);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("salveaza CUI/Reg. Com./adresa (migrarea 0023) alaturi de restul campurilor", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", role: "admin", organizationId: "org-1" });

    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ update }) });

    const state = await updateOrganizationAction(
      initialSettingsState,
      formData({
        name: "Beton Circular SRL",
        cui: "  RO987654  ",
        reg_com: "J40/9999/2020",
        address: "Str. Fabricii nr. 1",
      }),
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Beton Circular SRL",
        cui: "RO987654",
        reg_com: "J40/9999/2020",
        address: "Str. Fabricii nr. 1",
      }),
    );
    expect(eq).toHaveBeenCalledWith("id", "org-1");
    expect(state.error).toBeNull();
    expect(state.message).toMatch(/salvate/i);
  });

  it("goleste campurile optionale netrimise (trim -> null, nu string gol)", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", role: "admin", organizationId: "org-1" });

    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ update }) });

    await updateOrganizationAction(
      initialSettingsState,
      formData({ name: "Firma SRL", cui: "   " }),
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ cui: null, reg_com: null, address: null }),
    );
  });
});
