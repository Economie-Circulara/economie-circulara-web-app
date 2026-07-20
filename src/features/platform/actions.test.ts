import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireRole }));

const { createOrganizationRow, inviteOrganizationAdmin, setOrganizationStatus } = vi.hoisted(
  () => ({
    createOrganizationRow: vi.fn(),
    inviteOrganizationAdmin: vi.fn(),
    setOrganizationStatus: vi.fn(),
  }),
);
vi.mock("./service", async () => {
  const actual = await vi.importActual<typeof import("./service")>("./service");
  return {
    ...actual,
    createOrganizationRow,
    inviteOrganizationAdmin,
    setOrganizationStatus,
  };
});

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

const { headers } = vi.hoisted(() => ({
  headers: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers }));

import {
  createOrganizationAction,
  reactivateOrganizationAction,
  suspendOrganizationAction,
} from "./actions";
import { initialCreateOrganizationState, initialOrgStatusState } from "./form-state";
import { InviteFailedError, ProfileCreateFailedError, SlugTakenError } from "./service";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  headers.mockResolvedValue(
    new Map([
      ["x-forwarded-proto", "https"],
      ["host", "app.lateristrace.ro"],
    ]),
  );
  requireRole.mockResolvedValue({ id: "super-1", role: "super_admin" });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("createOrganizationAction", () => {
  it("respinge cererea cand numele lipseste", async () => {
    const state = await createOrganizationAction(
      initialCreateOrganizationState,
      formData({ slug: "acme", admin_email: "admin@acme.ro" }),
    );
    expect(state.error).toMatch(/nume/i);
    expect(createOrganizationRow).not.toHaveBeenCalled();
  });

  it("respinge un slug invalid", async () => {
    const state = await createOrganizationAction(
      initialCreateOrganizationState,
      formData({ name: "Acme", slug: "Acme Invalid!", admin_email: "admin@acme.ro" }),
    );
    expect(state.error).toMatch(/slug/i);
    expect(createOrganizationRow).not.toHaveBeenCalled();
  });

  it("respinge cererea cand emailul adminului lipseste", async () => {
    const state = await createOrganizationAction(
      initialCreateOrganizationState,
      formData({ name: "Acme", slug: "acme" }),
    );
    expect(state.error).toMatch(/email/i);
    expect(createOrganizationRow).not.toHaveBeenCalled();
  });

  it("creeaza organizatia, invita adminul si redirectioneaza la /platform cand totul reuseste", async () => {
    createOrganizationRow.mockResolvedValue("org-1");
    inviteOrganizationAdmin.mockResolvedValue(undefined);

    await expect(
      createOrganizationAction(
        initialCreateOrganizationState,
        formData({ name: "Acme Recycling", slug: "acme-recycling", admin_email: "Admin@Acme.ro" }),
      ),
    ).rejects.toThrow("REDIRECT:/platform");

    expect(createOrganizationRow).toHaveBeenCalledWith("Acme Recycling", "acme-recycling");
    expect(inviteOrganizationAdmin).toHaveBeenCalledWith(
      "org-1",
      "admin@acme.ro",
      "https://app.lateristrace.ro/auth/callback?next=/set-password",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/platform");
  });

  it("raporteaza slug deja folosit fara sa apeleze invitatia", async () => {
    createOrganizationRow.mockRejectedValue(new SlugTakenError("acme"));

    const state = await createOrganizationAction(
      initialCreateOrganizationState,
      formData({ name: "Acme", slug: "acme", admin_email: "admin@acme.ro" }),
    );

    expect(state.error).toMatch(/deja folosit/i);
    expect(state.organizationId).toBeNull();
    expect(inviteOrganizationAdmin).not.toHaveBeenCalled();
  });

  it("esec partial: organizatia e creata dar invitatia esueaza — starea pastreaza organizationId (nu se ascunde)", async () => {
    createOrganizationRow.mockResolvedValue("org-1");
    inviteOrganizationAdmin.mockRejectedValue(new InviteFailedError("cont deja existent"));

    const state = await createOrganizationAction(
      initialCreateOrganizationState,
      formData({ name: "Acme Recycling", slug: "acme-recycling", admin_email: "admin@acme.ro" }),
    );

    expect(state.error).toBe("cont deja existent");
    expect(state.organizationId).toBe("org-1");
    expect(state.orgName).toBe("Acme Recycling");
    expect(state.orgSlug).toBe("acme-recycling");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("esec partial (profil): mesaj distinct cand invitatia trece dar profilul nu se salveaza", async () => {
    createOrganizationRow.mockResolvedValue("org-1");
    inviteOrganizationAdmin.mockRejectedValue(new ProfileCreateFailedError("boom"));

    const state = await createOrganizationAction(
      initialCreateOrganizationState,
      formData({ name: "Acme Recycling", slug: "acme-recycling", admin_email: "admin@acme.ro" }),
    );

    expect(state.error).toMatch(/profilul adminului/i);
    expect(state.organizationId).toBe("org-1");
  });

  it("retrimite invitatia fara sa recreeze organizatia cand organization_id e prezent in formular", async () => {
    inviteOrganizationAdmin.mockResolvedValue(undefined);

    const prevState = {
      error: "cont deja existent",
      message: null,
      organizationId: "org-1",
      orgName: "Acme Recycling",
      orgSlug: "acme-recycling",
      adminEmail: "admin@acme.ro",
    };

    await expect(
      createOrganizationAction(
        prevState,
        formData({
          organization_id: "org-1",
          admin_email: "alt-admin@acme.ro",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/platform");

    expect(createOrganizationRow).not.toHaveBeenCalled();
    expect(inviteOrganizationAdmin).toHaveBeenCalledWith(
      "org-1",
      "alt-admin@acme.ro",
      expect.stringContaining("/auth/callback"),
    );
  });
});

describe("suspendOrganizationAction / reactivateOrganizationAction", () => {
  it("suspenda organizatia si revalideaza /platform", async () => {
    setOrganizationStatus.mockResolvedValue(undefined);

    const state = await suspendOrganizationAction(
      initialOrgStatusState,
      formData({ organization_id: "org-1" }),
    );

    expect(setOrganizationStatus).toHaveBeenCalledWith("org-1", "suspended");
    expect(revalidatePath).toHaveBeenCalledWith("/platform");
    expect(state.error).toBeNull();
  });

  it("reactiveaza organizatia", async () => {
    setOrganizationStatus.mockResolvedValue(undefined);

    const state = await reactivateOrganizationAction(
      initialOrgStatusState,
      formData({ organization_id: "org-1" }),
    );

    expect(setOrganizationStatus).toHaveBeenCalledWith("org-1", "active");
    expect(state.error).toBeNull();
  });

  it("raporteaza eroarea cand actualizarea de status esueaza", async () => {
    setOrganizationStatus.mockRejectedValue(new Error("boom"));

    const state = await suspendOrganizationAction(
      initialOrgStatusState,
      formData({ organization_id: "org-1" }),
    );

    expect(state.error).toMatch(/suspenda/i);
  });

  it("respinge cererea fara organization_id", async () => {
    const state = await suspendOrganizationAction(initialOrgStatusState, formData({}));
    expect(state.error).toMatch(/invalida/i);
    expect(setOrganizationStatus).not.toHaveBeenCalled();
  });
});
