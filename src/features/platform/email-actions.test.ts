import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireRole }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/origin", () => ({ getOrganizationOrigin: vi.fn() }));

const { getEmailDomainProvider } = vi.hoisted(() => ({ getEmailDomainProvider: vi.fn() }));
vi.mock("./email-domain-provider", async () => ({
  ...(await vi.importActual<typeof import("./email-domain-provider")>("./email-domain-provider")),
  getEmailDomainProvider,
}));

const { configureEmailDomain, refreshEmailDomain, removeEmailDomain } = vi.hoisted(() => ({
  configureEmailDomain: vi.fn(),
  refreshEmailDomain: vi.fn(),
  removeEmailDomain: vi.fn(),
}));
vi.mock("./email-domain-service", async () => ({
  ...(await vi.importActual<typeof import("./email-domain-service")>("./email-domain-service")),
  configureEmailDomain,
  refreshEmailDomain,
  removeEmailDomain,
}));

import {
  removeOrganizationEmailDomainAction,
  updateOrganizationEmailDomainAction,
  verifyOrganizationEmailDomainAction,
} from "./actions";
import { EmailDomainProviderError } from "./email-domain-provider";
import { initialOrgEmailState } from "./form-state";

const PROVIDER = {
  createDomain: vi.fn(),
  verifyDomain: vi.fn(),
  getDomain: vi.fn(),
  removeDomain: vi.fn(),
};

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  requireRole.mockResolvedValue({ id: "super-1", role: "super_admin" });
  getEmailDomainProvider.mockReturnValue(PROVIDER);
});
afterEach(() => vi.clearAllMocks());

describe("updateOrganizationEmailDomainAction", () => {
  it("cere rolul super-admin si trimite domeniul + adresa normalizate", async () => {
    const state = await updateOrganizationEmailDomainAction(
      initialOrgEmailState,
      formData({ organization_id: "org-1", email_domain: "Etora.ro", email_local_part: "Comenzi" }),
    );

    expect(requireRole).toHaveBeenCalledWith(["super_admin"]);
    expect(configureEmailDomain).toHaveBeenCalledWith(
      "org-1",
      { domain: "etora.ro", localPart: "comenzi" },
      PROVIDER,
    );
    expect(state.error).toBeNull();
  });

  it("domeniu invalid -> eroare, fara apel", async () => {
    const state = await updateOrganizationEmailDomainAction(
      initialOrgEmailState,
      formData({ organization_id: "org-1", email_domain: "nu e bun" }),
    );
    expect(state.error).toMatch(/invalid/);
    expect(configureEmailDomain).not.toHaveBeenCalled();
  });

  it("fara RESEND_API_KEY -> explica ce lipseste", async () => {
    getEmailDomainProvider.mockReturnValue(null);
    const state = await updateOrganizationEmailDomainAction(
      initialOrgEmailState,
      formData({ organization_id: "org-1", email_domain: "etora.ro" }),
    );
    expect(state.error).toMatch(/RESEND_API_KEY/);
  });

  it("afiseaza mesajul de eroare al providerului", async () => {
    configureEmailDomain.mockRejectedValue(
      new EmailDomainProviderError("Resend: cheie invalida", 401),
    );
    const state = await updateOrganizationEmailDomainAction(
      initialOrgEmailState,
      formData({ organization_id: "org-1", email_domain: "etora.ro" }),
    );
    expect(state.error).toBe("Resend: cheie invalida");
  });
});

describe("verifyOrganizationEmailDomainAction / removeOrganizationEmailDomainAction", () => {
  it("verificat -> mesaj de succes", async () => {
    refreshEmailDomain.mockResolvedValue({
      id: "d",
      name: "etora.ro",
      status: "verified",
      records: [],
    });
    const state = await verifyOrganizationEmailDomainAction(
      initialOrgEmailState,
      formData({ organization_id: "org-1" }),
    );
    expect(state.message).toMatch(/verificat/);
  });

  it("in asteptare -> spune sa reincerce", async () => {
    refreshEmailDomain.mockResolvedValue({
      id: "d",
      name: "etora.ro",
      status: "pending",
      records: [],
    });
    const state = await verifyOrganizationEmailDomainAction(
      initialOrgEmailState,
      formData({ organization_id: "org-1" }),
    );
    expect(state.message).toMatch(/reincearca/);
  });

  it("scoate domeniul", async () => {
    await expect(removeOrganizationEmailDomainAction("org-1")).resolves.toEqual({ error: null });
    expect(removeEmailDomain).toHaveBeenCalledWith("org-1", PROVIDER);
  });
});
