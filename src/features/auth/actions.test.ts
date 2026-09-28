import { afterEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { getOriginForEmail, getRequestTenantOrigin } = vi.hoisted(() => ({
  getOriginForEmail: vi.fn().mockResolvedValue("https://trace.acme.ro"),
  getRequestTenantOrigin: vi.fn().mockResolvedValue("https://www.lotculot.eu"),
}));
vi.mock("./origin", () => ({ getOriginForEmail, getRequestTenantOrigin }));

const { getCurrentUser, homePathForRole } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  homePathForRole: vi.fn(),
}));
vi.mock("./session", () => ({ getCurrentUser, homePathForRole }));

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));

import { requestPasswordResetAction, signInWithMagicLinkAction } from "./actions";
import { initialAuthState } from "./form-state";

function formData(email: string): FormData {
  const data = new FormData();
  data.set("email", email);
  return data;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("signInWithMagicLinkAction", () => {
  it("trimite linkul catre callback-ul domeniului organizatiei userului si nu creeaza useri", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    createClient.mockResolvedValue({ auth: { signInWithOtp } });

    const state = await signInWithMagicLinkAction(initialAuthState, formData(" User@Example.ro "));

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "user@example.ro",
      options: {
        shouldCreateUser: false,
        emailRedirectTo: "https://trace.acme.ro/auth/callback",
      },
    });
    expect(getOriginForEmail).toHaveBeenCalledWith("user@example.ro");
    expect(state).toEqual({
      error: null,
      message: "Ti-am trimis un link de autentificare pe email.",
    });
  });

  it("nu contacteaza Supabase cand emailul lipseste", async () => {
    const state = await signInWithMagicLinkAction(initialAuthState, formData(""));

    expect(createClient).not.toHaveBeenCalled();
    expect(getOriginForEmail).not.toHaveBeenCalled();
    expect(state.error).toMatch(/email/i);
  });
});

describe("requestPasswordResetAction", () => {
  it("trimite resetarea pe hostul cererii (PKCE: cookie-ul verifier e pe acel host)", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
    createClient.mockResolvedValue({ auth: { resetPasswordForEmail } });

    await requestPasswordResetAction(initialAuthState, formData("user@example.ro"));

    expect(getOriginForEmail).not.toHaveBeenCalled();
    expect(resetPasswordForEmail).toHaveBeenCalledWith("user@example.ro", {
      redirectTo: "https://www.lotculot.eu/auth/callback?next=/set-password",
    });
  });
});
