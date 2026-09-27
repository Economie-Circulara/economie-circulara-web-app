import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AttentionCard, KpiRow, QuickActionsCard } from "./dashboard-sections";
import type { OperationalDashboardData } from "./types";

const dashboard: OperationalDashboardData = {
  kpis: { activeOrders: 7, ordersToAccept: 1, deliveredThisMonth: 3, certificatesIssued: 12 },
  recentOrders: [],
  lowStockItems: [],
  blockedLots: 2,
  stockTrends: [],
};

describe("sectiunile panoului de control", () => {
  it("KpiRow afiseaza cei 4 indicatori cu linkurile lor", () => {
    render(<KpiRow dashboard={dashboard} />);
    expect(screen.getByText("Comenzi active")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("De acceptat").closest("a")).toHaveAttribute(
      "href",
      "/comenzi?status=sent",
    );
  });

  it("AttentionCard semnaleaza comenzile de acceptat si loturile blocate", () => {
    render(<AttentionCard dashboard={dashboard} />);
    expect(screen.getByText(/comandă așteaptă/)).toBeInTheDocument();
    expect(screen.getByText(/loturi blocate/)).toBeInTheDocument();
  });

  it("QuickActionsCard duce direct in fluxurile zilnice", () => {
    render(<QuickActionsCard />);
    expect(screen.getByRole("link", { name: /Comandă nouă/ })).toHaveAttribute(
      "href",
      "/comenzi/nou",
    );
    expect(screen.getByRole("link", { name: /Pornește un proces/ })).toHaveAttribute(
      "href",
      "/productie/nou",
    );
  });
});
