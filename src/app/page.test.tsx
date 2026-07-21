import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/features/auth/session";

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/features/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/auth/session")>()),
  getCurrentUser,
}));

const { redirect } = vi.hoisted(() => ({
  // Mimeaza `redirect` din Next: arunca, ca fluxul sa se opreasca (nu mai randeaza).
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

import Home from "./page";

function user(role: SessionUser["role"]): SessionUser {
  return {
    id: "u1",
    email: "u@demo.local",
    role,
    organizationId: role === "super_admin" ? null : "org-1",
    clientId: null,
    fullName: null,
    organizationStatus: null,
  };
}

afterEach(() => vi.clearAllMocks());

describe("Home", () => {
  it("afiseaza landing-ul cu CTA de autentificare pentru vizitatori anonimi", async () => {
    getCurrentUser.mockResolvedValue(null);
    render(await Home());
    expect(screen.getByRole("heading", { name: "Lateris Trace" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Autentificare" })).toHaveAttribute("href", "/login");
  });

  it("redirectioneaza adminul logat la /dashboard", async () => {
    getCurrentUser.mockResolvedValue(user("admin"));
    await expect(Home()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("redirectioneaza super-adminul logat la /platform", async () => {
    getCurrentUser.mockResolvedValue(user("super_admin"));
    await expect(Home()).rejects.toThrow("NEXT_REDIRECT:/platform");
    expect(redirect).toHaveBeenCalledWith("/platform");
  });
});
