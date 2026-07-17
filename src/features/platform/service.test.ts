import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks (nu spies — vezi AGENTS.md §2.2): inlocuim clientii Supabase (admin + sesiune).
const { createAdminClient } = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import {
  InviteFailedError,
  ProfileCreateFailedError,
  SlugTakenError,
  createOrganizationRow,
  inviteOrganizationAdmin,
  setOrganizationStatus,
} from "./service";

afterEach(() => {
  vi.clearAllMocks();
});

describe("createOrganizationRow", () => {
  it("insereaza organizatia si returneaza id-ul", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "org-1" }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    createAdminClient.mockReturnValue({ from });

    const id = await createOrganizationRow("Acme Recycling", "acme-recycling");

    expect(from).toHaveBeenCalledWith("organizations");
    expect(insert).toHaveBeenCalledWith({ name: "Acme Recycling", slug: "acme-recycling" });
    expect(id).toBe("org-1");
  });

  it("arunca SlugTakenError cand slug-ul e deja folosit (violare unicitate 23505)", async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    createAdminClient.mockReturnValue({ from });

    await expect(createOrganizationRow("Acme", "acme")).rejects.toBeInstanceOf(SlugTakenError);
  });

  it("arunca eroare generica pentru alte esecuri de insert", async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    createAdminClient.mockReturnValue({ from });

    await expect(createOrganizationRow("Acme", "acme")).rejects.toThrow("boom");
  });
});

describe("inviteOrganizationAdmin", () => {
  function mockAdmin({
    inviteError,
    inviteUser,
    profileError,
  }: {
    inviteError?: { message: string } | null;
    inviteUser?: { id: string } | null;
    profileError?: { message: string } | null;
  }) {
    const inviteUserByEmail = vi.fn().mockResolvedValue({
      data: inviteUser === undefined ? { user: { id: "user-1" } } : { user: inviteUser },
      error: inviteError ?? null,
    });
    const insert = vi.fn().mockResolvedValue({ error: profileError ?? null });
    const from = vi.fn().mockReturnValue({ insert });
    createAdminClient.mockReturnValue({
      auth: { admin: { inviteUserByEmail } },
      from,
    });
    return { inviteUserByEmail, insert, from };
  }

  it("invita userul si creeaza profilul admin legat de organizatie", async () => {
    const { inviteUserByEmail, insert, from } = mockAdmin({});

    await inviteOrganizationAdmin("org-1", "admin@acme.ro", "https://app/auth/callback");

    expect(inviteUserByEmail).toHaveBeenCalledWith("admin@acme.ro", {
      redirectTo: "https://app/auth/callback",
    });
    expect(from).toHaveBeenCalledWith("profiles");
    expect(insert).toHaveBeenCalledWith({
      id: "user-1",
      organization_id: "org-1",
      role: "admin",
      email: "admin@acme.ro",
    });
  });

  it("arunca InviteFailedError cand invitatia esueaza (organizatia ramane creata)", async () => {
    mockAdmin({ inviteError: { message: "email deja folosit" }, inviteUser: null });

    await expect(
      inviteOrganizationAdmin("org-1", "admin@acme.ro", "https://app"),
    ).rejects.toBeInstanceOf(InviteFailedError);
  });

  it("arunca ProfileCreateFailedError cand invitatia reuseste dar profilul nu poate fi salvat", async () => {
    mockAdmin({ profileError: { message: "constraint esuat" } });

    await expect(
      inviteOrganizationAdmin("org-1", "admin@acme.ro", "https://app"),
    ).rejects.toBeInstanceOf(ProfileCreateFailedError);
  });
});

describe("setOrganizationStatus", () => {
  function mockSession(updateError: { message: string } | null = null) {
    const eq = vi.fn().mockResolvedValue({ error: updateError });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    createClient.mockResolvedValue({ from });
    return { update, eq, from };
  }

  it("seteaza status='suspended' prin clientul de sesiune (RLS permite super-adminului)", async () => {
    const { update, eq, from } = mockSession();

    await setOrganizationStatus("org-1", "suspended");

    expect(from).toHaveBeenCalledWith("organizations");
    expect(update).toHaveBeenCalledWith({ status: "suspended" });
    expect(eq).toHaveBeenCalledWith("id", "org-1");
  });

  it("seteaza status='active' (reactivare)", async () => {
    const { update } = mockSession();

    await setOrganizationStatus("org-1", "active");

    expect(update).toHaveBeenCalledWith({ status: "active" });
  });

  it("arunca eroare cand update-ul esueaza", async () => {
    mockSession({ message: "RLS denied" });

    await expect(setOrganizationStatus("org-1", "suspended")).rejects.toThrow();
  });
});
