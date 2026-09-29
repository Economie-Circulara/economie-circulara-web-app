// @vitest-environment node
// (File.arrayBuffer lipseste din jsdom; actiunile ruleaza oricum pe server.)
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

import { removeOrgLogoAction, updateOrganizationAction, uploadOrgLogoAction } from "./actions";
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

  it("nu sterge culorile cand lipsesc din formular (tema aleasa de platforma)", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", role: "admin", organizationId: "org-1" });
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ update }) });

    await updateOrganizationAction(initialSettingsState, formData({ name: "Firma SRL" }));

    const payload = update.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("primary_color");
    expect(payload).not.toHaveProperty("secondary_color");
  });

  it("salveaza culorile cand vin din formular (tema implicita)", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", role: "admin", organizationId: "org-1" });
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ update }) });

    await updateOrganizationAction(
      initialSettingsState,
      formData({ name: "Firma SRL", primary_color: "#123456", secondary_color: "" }),
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ primary_color: "#123456", secondary_color: null }),
    );
  });
});

/** Client admin (storage) + client de sesiune (update pe `organizations`) mock-uite. */
function mockLogoClients() {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const getPublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: `https://cdn.example/org-logos/${path}` },
  }));
  const storageFrom = vi.fn().mockReturnValue({ upload, remove, getPublicUrl });
  createAdminClient.mockReturnValue({ storage: { from: storageFrom } });

  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq });
  createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ update }) });

  return { upload, remove, update, eq };
}

function logoForm(variant: string | null): FormData {
  const fd = new FormData();
  if (variant) fd.set("variant", variant);
  fd.set("logo", new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" }));
  return fd;
}

describe("uploadOrgLogoAction (variante de logo, 0049)", () => {
  it("varianta patrata merge in fisierul si coloana ei, fara sa atinga logo-ul orizontal", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", role: "admin", organizationId: "org-1" });
    const { upload, update, eq } = mockLogoClients();

    const state = await uploadOrgLogoAction(initialSettingsState, logoForm("square"));

    expect(state.error).toBeNull();
    expect(upload).toHaveBeenCalledWith("org-1/logo-square", expect.anything(), {
      contentType: "image/svg+xml",
      upsert: true,
    });
    const patch = update.mock.calls[0]![0];
    expect(Object.keys(patch)).toEqual(["logo_square_url"]);
    expect(patch.logo_square_url).toMatch(
      /^https:\/\/cdn\.example\/org-logos\/org-1\/logo-square\?v=\d+$/,
    );
    expect(eq).toHaveBeenCalledWith("id", "org-1");
  });

  it("varianta orizontala pastreaza path-ul si coloana existente (`logo` / `logo_url`)", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", role: "admin", organizationId: "org-1" });
    const { upload, update } = mockLogoClients();

    await uploadOrgLogoAction(initialSettingsState, logoForm("inline"));

    expect(upload.mock.calls[0]![0]).toBe("org-1/logo");
    expect(Object.keys(update.mock.calls[0]![0])).toEqual(["logo_url"]);
  });

  it("respinge o varianta necunoscuta inainte de upload", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", role: "admin", organizationId: "org-1" });
    const { upload } = mockLogoClients();

    const state = await uploadOrgLogoAction(initialSettingsState, logoForm("banner"));

    expect(state.error).toMatch(/variant/i);
    expect(upload).not.toHaveBeenCalled();
  });
});

describe("removeOrgLogoAction", () => {
  it("sterge doar varianta ceruta", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", role: "admin", organizationId: "org-1" });
    const { remove, update } = mockLogoClients();

    const state = await removeOrgLogoAction("square");

    expect(state.error).toBeNull();
    expect(remove).toHaveBeenCalledWith(["org-1/logo-square"]);
    expect(update).toHaveBeenCalledWith({ logo_square_url: null });
  });

  it("respinge o varianta necunoscuta", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", role: "admin", organizationId: "org-1" });
    const { remove } = mockLogoClients();

    // Argumentul vine de la client - poate fi orice.
    const state = await removeOrgLogoAction("banner" as never);

    expect(state.error).toMatch(/variant/i);
    expect(remove).not.toHaveBeenCalled();
  });
});
