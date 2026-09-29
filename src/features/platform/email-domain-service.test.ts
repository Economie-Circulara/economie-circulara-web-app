import { afterEach, describe, expect, it, vi } from "vitest";

// Mock (nu spy - AGENTS.md §2.2): clientul de sesiune Supabase.
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import {
  EmailDomainNotConfiguredError,
  configureEmailDomain,
  refreshEmailDomain,
  removeEmailDomain,
} from "./email-domain-service";
import type { EmailDomainInfo } from "./email-domain-provider";

const INFO: EmailDomainInfo = {
  id: "dom-new",
  name: "etora.ro",
  status: "pending",
  records: [
    { type: "TXT", name: "resend._domainkey", value: "p=A", priority: null, status: "pending" },
  ],
};

/** Session mock: `current` = randul organizatiei; `others` = alte organizatii pe acelasi domeniu la provider. */
function mockSupabase(current: Record<string, unknown> | null, others: unknown[] = []) {
  const updates: Record<string, unknown>[] = [];
  const from = vi.fn(() => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.neq = vi.fn(async () => ({ data: others, error: null }));
    chain.maybeSingle = vi.fn(async () => ({ data: current, error: null }));
    chain.update = vi.fn((patch: Record<string, unknown>) => {
      updates.push(patch);
      return { eq: vi.fn(async () => ({ error: null })) };
    });
    return chain;
  });
  createClient.mockResolvedValue({ from });
  return { updates };
}

function mockProvider() {
  return {
    createDomain: vi.fn().mockResolvedValue(INFO),
    verifyDomain: vi.fn().mockResolvedValue({ ...INFO, status: "verified" }),
    getDomain: vi.fn(),
    removeDomain: vi.fn().mockResolvedValue(undefined),
  };
}

afterEach(() => vi.clearAllMocks());

describe("configureEmailDomain", () => {
  it("domeniu nou: il creeaza la provider, salveaza inregistrarile, elibereaza domeniul vechi", async () => {
    const { updates } = mockSupabase({
      email_domain: "vechi.ro",
      email_domain_provider_id: "dom-old",
    });
    const provider = mockProvider();

    await configureEmailDomain("org-1", { domain: "etora.ro", localPart: "notificari" }, provider);

    expect(provider.createDomain).toHaveBeenCalledWith("etora.ro");
    expect(provider.removeDomain).toHaveBeenCalledWith("dom-old");
    expect(updates[0]).toMatchObject({
      email_domain: "etora.ro",
      email_from_address: "notificari@etora.ro",
      email_domain_provider_id: "dom-new",
      email_domain_status: "pending",
      email_domain_records: INFO.records,
    });
  });

  it("nu sterge de la provider un domeniu folosit si de alta organizatie", async () => {
    mockSupabase({ email_domain: "vechi.ro", email_domain_provider_id: "dom-old" }, [
      { id: "org-2" },
    ]);
    const provider = mockProvider();

    await configureEmailDomain("org-1", { domain: "etora.ro", localPart: "notificari" }, provider);

    expect(provider.removeDomain).not.toHaveBeenCalled();
  });

  it("acelasi domeniu: schimba doar adresa, fara apel la provider", async () => {
    const { updates } = mockSupabase({
      email_domain: "etora.ro",
      email_domain_provider_id: "dom-1",
    });
    const provider = mockProvider();

    await configureEmailDomain("org-1", { domain: "etora.ro", localPart: "comenzi" }, provider);

    expect(provider.createDomain).not.toHaveBeenCalled();
    expect(updates).toEqual([{ email_from_address: "comenzi@etora.ro" }]);
  });

  it("domeniu gol: scoate configurarea", async () => {
    const { updates } = mockSupabase({
      email_domain: "etora.ro",
      email_domain_provider_id: "dom-1",
    });
    const provider = mockProvider();

    await configureEmailDomain("org-1", { domain: null, localPart: "notificari" }, provider);

    expect(provider.removeDomain).toHaveBeenCalledWith("dom-1");
    expect(updates[0]).toMatchObject({
      email_domain: null,
      email_domain_status: "not_configured",
      email_from_address: null,
    });
  });
});

describe("refreshEmailDomain / removeEmailDomain", () => {
  it("reverifica si salveaza statusul", async () => {
    const { updates } = mockSupabase({
      email_domain: "etora.ro",
      email_domain_provider_id: "dom-1",
    });
    const provider = mockProvider();

    const info = await refreshEmailDomain("org-1", provider);

    expect(provider.verifyDomain).toHaveBeenCalledWith("dom-1");
    expect(info.status).toBe("verified");
    expect(updates[0]).toMatchObject({ email_domain_status: "verified" });
  });

  it("fara domeniu configurat -> EmailDomainNotConfiguredError", async () => {
    mockSupabase({ email_domain: null, email_domain_provider_id: null });
    await expect(refreshEmailDomain("org-1", mockProvider())).rejects.toBeInstanceOf(
      EmailDomainNotConfiguredError,
    );
  });

  it("eroarea providerului la stergere nu blocheaza curatarea locala", async () => {
    const { updates } = mockSupabase({
      email_domain: "etora.ro",
      email_domain_provider_id: "dom-1",
    });
    const provider = {
      ...mockProvider(),
      removeDomain: vi.fn().mockRejectedValue(new Error("jos")),
    };

    await removeEmailDomain("org-1", provider);

    expect(updates[0]).toMatchObject({ email_domain_status: "not_configured" });
  });
});
