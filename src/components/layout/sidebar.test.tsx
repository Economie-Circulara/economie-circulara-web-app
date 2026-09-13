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
  it("pastreaza organizatia ca brand principal si afiseaza discret platforma in footer", () => {
    render(
      <Sidebar orgName="Beton Circular" logoUrl="https://example.com/org-logo.svg" items={items} />,
    );

    expect(screen.getByRole("img", { name: "Beton Circular" })).toHaveAttribute(
      "src",
      "https://example.com/org-logo.svg",
    );
    expect(screen.getByText("Powered by")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Lot cu Lot" })).toHaveAttribute(
      "src",
      "/lot-cu-lot-logo.svg",
    );
  });
});
