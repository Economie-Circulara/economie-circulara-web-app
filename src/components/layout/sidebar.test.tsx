import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "./sidebar";
import type { NavEntry } from "./nav-config";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn(() => "/dashboard") }));
vi.mock("next/navigation", () => ({ usePathname }));

const items: NavEntry[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "dashboard" as const,
    roles: ["admin" as const],
  },
];

describe("Sidebar", () => {
  it("pastreaza organizatia sus si afiseaza logo-ul platformei centrat, cu link la homepage", () => {
    render(
      <Sidebar orgName="Beton Circular" logoUrl="https://example.com/org-logo.svg" items={items} />,
    );

    expect(screen.getByRole("img", { name: "Beton Circular" })).toHaveAttribute(
      "src",
      "https://example.com/org-logo.svg",
    );
    expect(screen.queryByText("Powered by")).not.toBeInTheDocument();

    const platformLogo = screen.getByRole("img", { name: "Lot cu Lot" });
    expect(platformLogo).toHaveAttribute("src", "/lot-cu-lot-logo.svg");
    expect(platformLogo).toHaveClass("h-12");
    expect(screen.getByRole("link", { name: "Lot cu Lot" })).toHaveAttribute("href", "/");
  });

  describe("grupuri de navigatie", () => {
    const groupedItems: NavEntry[] = [
      { label: "Panou de control", href: "/dashboard", icon: "dashboard", roles: ["admin"] },
      {
        key: "stoc",
        label: "Stoc",
        items: [
          { label: "Materiale și servicii", href: "/itemi", icon: "items", roles: ["admin"] },
          { label: "Rețete", href: "/retete", icon: "recipes", roles: ["admin"] },
        ],
      },
    ];

    it("afiseaza grupul extins implicit, cu toti copiii vizibili", () => {
      usePathname.mockReturnValue("/dashboard");
      render(<Sidebar orgName="Beton Circular" items={groupedItems} />);

      expect(screen.getByRole("button", { name: "Stoc" })).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("link", { name: "Materiale și servicii" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Rețete" })).toBeInTheDocument();
    });

    it("marcheaza ca activ link-ul a carui ruta e curenta, chiar imbricat intr-un grup", () => {
      usePathname.mockReturnValue("/itemi");
      render(<Sidebar orgName="Beton Circular" items={groupedItems} />);

      expect(screen.getByRole("link", { name: "Materiale și servicii" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(screen.getByRole("link", { name: "Rețete" })).not.toHaveAttribute("aria-current");
    });

    it("pliaza grupul la click pe antet, ascunzand copiii", async () => {
      usePathname.mockReturnValue("/dashboard");
      const user = userEvent.setup();
      render(<Sidebar orgName="Beton Circular" items={groupedItems} />);

      const toggle = screen.getByRole("button", { name: "Stoc" });
      await user.click(toggle);

      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("link", { name: "Materiale și servicii" })).not.toBeInTheDocument();
    });
  });
});
