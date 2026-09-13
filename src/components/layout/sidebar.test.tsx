import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "./sidebar";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard"),
}));

const items = [
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
});
