import { afterEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { deleteSite, upsertSite } from "./site-service";

afterEach(() => {
  vi.clearAllMocks();
});

function siteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "site-1",
    organization_id: "org-1",
    name: "Stație Iași",
    address: "Șos. Moara de Foc 12",
    lat: null,
    lng: null,
    geocoded_at: null,
    is_default: true,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("upsertSite - un singur punct de plecare implicit per organizatie", () => {
  it("la crearea unui punct implicit, dezactiveaza intai orice alt punct implicit al organizatiei", async () => {
    const clearEq2 = vi.fn().mockResolvedValue({ error: null });
    const clearEq1 = vi.fn().mockReturnValue({ eq: clearEq2 });
    const update = vi.fn().mockReturnValue({ eq: clearEq1 });

    const single = vi.fn().mockResolvedValue({ data: siteRow(), error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });

    const from = vi.fn().mockReturnValue({ update, insert });
    createClient.mockResolvedValue({ from });

    await upsertSite({
      organizationId: "org-1",
      name: "Stație Iași",
      address: "Șos. Moara de Foc 12",
      isDefault: true,
    });

    expect(update).toHaveBeenCalledWith({ is_default: false });
    expect(clearEq1).toHaveBeenCalledWith("organization_id", "org-1");
    expect(clearEq2).toHaveBeenCalledWith("is_default", true);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ organization_id: "org-1", is_default: true }),
    );
  });

  it("la editarea unui punct existent catre implicit, exclude propriul rand din clear (.neq)", async () => {
    const neq = vi.fn().mockResolvedValue({ error: null });
    const clearEq2 = vi.fn().mockReturnValue({ neq });
    const clearEq1 = vi.fn().mockReturnValue({ eq: clearEq2 });
    const update = vi.fn().mockReturnValue({ eq: clearEq1 });

    const single = vi.fn().mockResolvedValue({ data: siteRow(), error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eqUpdateTarget = vi.fn().mockReturnValue({ select });
    const updateTarget = vi.fn().mockReturnValue({ eq: eqUpdateTarget });

    let callCount = 0;
    const from = vi.fn().mockImplementation(() => {
      callCount += 1;
      // primul apel .from() e pt. clear-ul punctului implicit, al doilea pt. update-ul propriu-zis
      return callCount === 1 ? { update } : { update: updateTarget };
    });
    createClient.mockResolvedValue({ from });

    await upsertSite({
      id: "site-1",
      organizationId: "org-1",
      name: "Stație Iași",
      address: "Șos. Moara de Foc 12",
      isDefault: true,
    });

    expect(neq).toHaveBeenCalledWith("id", "site-1");
    expect(updateTarget).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Stație Iași", is_default: true }),
    );
  });

  it("nu atinge alte puncte de plecare cand isDefault e false", async () => {
    const single = vi.fn().mockResolvedValue({ data: siteRow({ is_default: false }), error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const update = vi.fn();

    const from = vi.fn().mockReturnValue({ update, insert });
    createClient.mockResolvedValue({ from });

    await upsertSite({
      organizationId: "org-1",
      name: "Depozit secundar",
      address: "Str. Exemplu 2",
      isDefault: false,
    });

    expect(update).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ is_default: false }));
  });
});

describe("deleteSite", () => {
  it("sterge punctul de plecare dupa id", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ delete: del });
    createClient.mockResolvedValue({ from });

    await deleteSite("site-1");

    expect(del).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith("id", "site-1");
  });

  it("arunca o eroare cand stergerea esueaza", async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    const from = vi.fn().mockReturnValue({ delete: vi.fn().mockReturnValue({ eq }) });
    createClient.mockResolvedValue({ from });

    await expect(deleteSite("site-1")).rejects.toThrow("Nu am putut șterge punctul de plecare.");
  });
});
