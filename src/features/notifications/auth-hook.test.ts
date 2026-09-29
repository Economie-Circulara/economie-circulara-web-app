import { afterEach, describe, expect, it, vi } from "vitest";

// Mock (nu spy - AGENTS.md §2.2): clientul admin Supabase.
const { createAdminClient } = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import {
  InvalidHookPayloadError,
  buildAuthLink,
  handleSendEmailHook,
  parseSendEmailHookPayload,
  type SendEmailHookPayload,
} from "./auth-hook";

const ORG_ROW = {
  name: "Etora SRL",
  slug: "etora",
  custom_domain: "circular.etora.ro",
  logo_url: null,
  logo_square_url: null,
  primary_color: null,
  secondary_color: null,
  theme: "default",
  email_from_name: "Etora",
  email_from_address: "notificari@etora.ro",
  email_domain: "etora.ro",
  email_domain_status: "verified",
  email_reply_to: null,
  cui: null,
  reg_com: null,
  address: null,
};

/** Admin mock: raspunsuri pe tabel, in ordine; retine filtrele `.eq()`. */
function makeAdmin(responses: Record<string, unknown[]>) {
  const eqCalls: Array<[string, string, unknown]> = [];
  const from = vi.fn((table: string) => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn((col: string, value: unknown) => {
      eqCalls.push([table, col, value]);
      return chain;
    });
    chain.maybeSingle = vi.fn(async () => ({
      data: responses[table]?.shift() ?? null,
      error: null,
    }));
    return chain;
  });
  return { from, eqCalls };
}

function payload(overrides: Partial<SendEmailHookPayload["email_data"]> = {}, user = {}) {
  return {
    user: { id: "user-1", email: "ana@client.ro", user_metadata: {}, ...user },
    email_data: {
      token: "123456",
      token_hash: "hash-1",
      redirect_to: "https://www.lotculot.eu/auth/callback?next=/set-password",
      email_action_type: "invite",
      site_url: "https://www.lotculot.eu",
      ...overrides,
    },
  } as SendEmailHookPayload;
}

afterEach(() => vi.clearAllMocks());

describe("buildAuthLink", () => {
  it("pastreaza calea si `next`, adauga token_hash + type, muta pe domeniul organizatiei", () => {
    const link = buildAuthLink({
      redirectTo: "https://www.lotculot.eu/auth/callback?next=/set-password",
      tokenHash: "h",
      type: "invite",
      orgOrigin: "https://circular.etora.ro",
    });
    expect(link).toBe(
      "https://circular.etora.ro/auth/callback?next=%2Fset-password&token_hash=h&type=invite",
    );
  });

  it("fara redirect_to: site_url + /auth/callback", () => {
    expect(
      buildAuthLink({ siteUrl: "https://www.lotculot.eu", tokenHash: "h", type: "magiclink" }),
    ).toBe("https://www.lotculot.eu/auth/callback?token_hash=h&type=magiclink");
  });

  it("URL invalid -> null", () => {
    expect(
      buildAuthLink({ redirectTo: "javascript:alert(1)", tokenHash: "h", type: "x" }),
    ).toBeNull();
  });
});

describe("parseSendEmailHookPayload", () => {
  it("respinge payload fara user sau tip", () => {
    expect(() => parseSendEmailHookPayload({})).toThrow(InvalidHookPayloadError);
  });
});

describe("handleSendEmailHook", () => {
  it("invitatie: organizatia din metadata, expeditorul si domeniul ei", async () => {
    const admin = makeAdmin({ organizations: [ORG_ROW] });
    createAdminClient.mockReturnValue(admin);
    const provider = { send: vi.fn().mockResolvedValue(undefined) };

    await handleSendEmailHook(
      payload({}, { user_metadata: { organization_id: "org-1" } }),
      provider,
    );

    expect(admin.from).not.toHaveBeenCalledWith("profiles");
    expect(admin.eqCalls).toContainEqual(["organizations", "id", "org-1"]);
    const message = provider.send.mock.calls[0][0];
    expect(message.to).toBe("ana@client.ro");
    expect(message.from).toEqual({ name: "Etora", address: "notificari@etora.ro" });
    expect(message.subject).toBe("Invitație în Etora SRL");
    expect(message.html).toContain(
      "https://circular.etora.ro/auth/callback?next=%2Fset-password&amp;token_hash=hash-1&amp;type=invite",
    );
  });

  it("profilul are prioritate fata de metadata (editabila de user)", async () => {
    const admin = makeAdmin({ profiles: [{ organization_id: "org-1" }], organizations: [ORG_ROW] });
    createAdminClient.mockReturnValue(admin);
    const provider = { send: vi.fn().mockResolvedValue(undefined) };

    await handleSendEmailHook(
      payload({ email_action_type: "magiclink" }, { user_metadata: { organization_id: "org-x" } }),
      provider,
    );

    expect(admin.eqCalls).toContainEqual(["organizations", "id", "org-1"]);
    expect(admin.eqCalls).not.toContainEqual(["organizations", "id", "org-x"]);
  });

  it("magic link: organizatia din profil", async () => {
    const admin = makeAdmin({ profiles: [{ organization_id: "org-1" }], organizations: [ORG_ROW] });
    createAdminClient.mockReturnValue(admin);
    const provider = { send: vi.fn().mockResolvedValue(undefined) };

    await handleSendEmailHook(payload({ email_action_type: "magiclink" }), provider);

    expect(admin.eqCalls).toContainEqual(["profiles", "id", "user-1"]);
    expect(provider.send.mock.calls[0][0].subject).toBe("Autentificare în Etora SRL");
  });

  it("fara profil: organizatia dupa domeniul din redirect_to", async () => {
    const admin = makeAdmin({ profiles: [null], organizations: [ORG_ROW] });
    createAdminClient.mockReturnValue(admin);
    const provider = { send: vi.fn().mockResolvedValue(undefined) };

    await handleSendEmailHook(
      payload({
        email_action_type: "recovery",
        redirect_to: "https://circular.etora.ro/auth/callback",
      }),
      provider,
    );

    expect(admin.eqCalls).toContainEqual(["organizations", "custom_domain", "circular.etora.ro"]);
    expect(provider.send.mock.calls[0][0].from.address).toBe("notificari@etora.ro");
  });

  it("fara organizatie (super-admin): brandul platformei", async () => {
    createAdminClient.mockReturnValue(makeAdmin({ profiles: [null], organizations: [null] }));
    const provider = { send: vi.fn().mockResolvedValue(undefined) };

    await handleSendEmailHook(payload({ email_action_type: "recovery" }), provider);

    expect(provider.send.mock.calls[0][0].subject).toContain("Lot cu Lot");
  });

  it("schimbare email: cate un mesaj pe fiecare adresa", async () => {
    createAdminClient.mockReturnValue(makeAdmin({ profiles: [null], organizations: [null] }));
    const provider = { send: vi.fn().mockResolvedValue(undefined) };

    const sent = await handleSendEmailHook(
      payload(
        { email_action_type: "email_change", token_hash_new: "hash-2" },
        { new_email: "nou@client.ro" },
      ),
      provider,
    );

    expect(sent).toBe(2);
    expect(provider.send.mock.calls.map((c) => c[0].to)).toEqual([
      "nou@client.ro",
      "ana@client.ro",
    ]);
  });

  it("tip necunoscut -> InvalidHookPayloadError; eroarea providerului se propaga", async () => {
    createAdminClient.mockReturnValue(makeAdmin({ organizations: [ORG_ROW] }));
    const failing = { send: vi.fn().mockRejectedValue(new Error("jos")) };

    await expect(
      handleSendEmailHook(payload({ email_action_type: "necunoscut" }), failing),
    ).rejects.toBeInstanceOf(InvalidHookPayloadError);
    await expect(
      handleSendEmailHook(payload({}, { user_metadata: { organization_id: "org-1" } }), failing),
    ).rejects.toThrow("jos");
  });
});
