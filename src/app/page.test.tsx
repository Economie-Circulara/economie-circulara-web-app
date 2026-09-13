import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { headers } = vi.hoisted(() => ({ headers: vi.fn() }));
vi.mock("next/headers", () => ({ headers }));
const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));

const { getOrgBranding } = vi.hoisted(() => ({ getOrgBranding: vi.fn() }));
vi.mock("@/features/auth/queries", () => ({ getOrgBranding }));
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/features/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth/session")>();
  return { ...actual, getCurrentUser };
});

import Home from "./page";
import { PLATFORM_NAME } from "@/lib/brand";

/** Randeaza componenta server (async) rezolvand elementul inainte de `render`. */
async function renderHome() {
  render(await Home());
}

describe("Home", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headers.mockResolvedValue(new Map([["host", "app.example.com"]]));
    getCurrentUser.mockResolvedValue(null);
  });

  it("redirecteaza utilizatorii autentificati catre ruta rolului", async () => {
    getCurrentUser.mockResolvedValue({ role: "admin" });

    await Home();

    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  describe("pe domeniul platformei (fara tenant)", () => {
    beforeEach(() => {
      getOrgBranding.mockResolvedValue(null);
    });

    it("NU afiseaza un nume de organizatie, ci descrie platforma", async () => {
      await renderHome();
      expect(
        screen.getByRole("heading", {
          level: 1,
          name: "Trasabilitatea materialelor în economia circulară",
        }),
      ).toBeInTheDocument();
      expect(screen.getByText(PLATFORM_NAME)).toBeInTheDocument();
    });

    it("nu mai pomeneste brandul provizoriu aparut in mockup", async () => {
      await renderHome();
      expect(screen.queryByText(/Lateris/i)).not.toBeInTheDocument();
    });

    it("toate linkurile duc la autentificare, nu la /showcase (404 in productie)", async () => {
      await renderHome();
      const links = screen.getAllByRole("link");
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect(link).toHaveAttribute("href", "/login");
      }
    });

    it("descrie capabilitatile platformei", async () => {
      await renderHome();
      expect(
        screen.getByRole("heading", { name: "Certificat de trasabilitate" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Livrări, avize și e-Transport" }),
      ).toBeInTheDocument();
    });
  });

  describe("pe intrarea unui client (tenant rezolvat)", () => {
    it("afiseaza brandul organizatiei, nu pe cel al platformei", async () => {
      getOrgBranding.mockResolvedValue({
        id: "org-1",
        name: "Beton Construct SRL",
        slug: "beton-construct",
        customDomain: null,
        logoUrl: "https://example.supabase.co/logo.png",
        primaryColor: null,
        secondaryColor: null,
      });

      await renderHome();

      expect(
        screen.getByRole("heading", { level: 1, name: "Beton Construct SRL" }),
      ).toBeInTheDocument();
      expect(screen.queryByText(PLATFORM_NAME)).not.toBeInTheDocument();
    });
  });
});
