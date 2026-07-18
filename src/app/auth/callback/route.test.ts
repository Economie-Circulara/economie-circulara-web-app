import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { GET } from "./route";

/** Construieste un client Supabase fals: schimb cod -> user, plus lookup `profiles`. */
function mockSupabase(options: {
  exchangeError?: { message: string } | null;
  user?: { id: string } | null;
  profile?: { id: string } | null;
}) {
  const { exchangeError = null, user = { id: "u1" }, profile = null } = options;
  const signOut = vi.fn().mockResolvedValue({ error: null });
  createClient.mockResolvedValue({
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        data: { user: exchangeError ? null : user },
        error: exchangeError,
      }),
      signOut,
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
        }),
      }),
    }),
  });
  return { signOut };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /auth/callback", () => {
  it("redirecteaza la /login?error=auth cand nu exista `code`", async () => {
    const request = new NextRequest("http://localhost:3000/auth/callback");
    const response = await GET(request);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=auth");
  });

  it("redirecteaza la /login?error=auth cand exchangeCodeForSession esueaza", async () => {
    mockSupabase({ exchangeError: { message: "invalid code" } });
    const request = new NextRequest("http://localhost:3000/auth/callback?code=abc");
    const response = await GET(request);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=auth");
  });

  it("redirecteaza la /login?error=unprovisioned si delogheaza cand userul nu are profil (ex. OAuth auto-creat)", async () => {
    const { signOut } = mockSupabase({ user: { id: "u1" }, profile: null });
    const request = new NextRequest("http://localhost:3000/auth/callback?code=abc");
    const response = await GET(request);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?error=unprovisioned",
    );
  });

  it("redirecteaza la `next` cand userul are profil", async () => {
    mockSupabase({ user: { id: "u1" }, profile: { id: "u1" } });
    const request = new NextRequest("http://localhost:3000/auth/callback?code=abc&next=/dashboard");
    const response = await GET(request);
    expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("redirecteaza catre radacina cand nu exista `next` si userul are profil", async () => {
    mockSupabase({ user: { id: "u1" }, profile: { id: "u1" } });
    const request = new NextRequest("http://localhost:3000/auth/callback?code=abc");
    const response = await GET(request);
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("permite fluxul de resetare parola (`next=/set-password`) cand userul are profil", async () => {
    mockSupabase({ user: { id: "u1" }, profile: { id: "u1" } });
    const request = new NextRequest(
      "http://localhost:3000/auth/callback?code=abc&next=/set-password",
    );
    const response = await GET(request);
    expect(response.headers.get("location")).toBe("http://localhost:3000/set-password");
  });
});
