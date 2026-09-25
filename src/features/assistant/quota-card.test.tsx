import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuotaCard } from "./quota-card";
import type { QuotaStatus } from "./types";

const QUOTA: QuotaStatus = {
  monthlyLimit: 2000,
  monthlyUsed: 680,
  dailyLimit: 400,
  dailyUsed: 25,
  dailyPercent: 20,
  messagesThisMonth: 80,
  estimatedMessagesLeft: 155,
  warning: false,
  blockedReason: null,
};

describe("QuotaCard", () => {
  it("arata creditele, procentul, estimarea si consumul de azi", () => {
    render(<QuotaCard quota={QUOTA} />);

    expect(screen.getByText(/Credite AI luna aceasta/)).toBeTruthy();
    expect(screen.getByText("680 / 2.000")).toBeTruthy();
    expect(screen.getByText(/34% folosit.*aproximativ 155 întrebări/)).toBeTruthy();
    expect(screen.getByText(/25 din cele 400 credite ale tale pe zi/)).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("34");
  });

  it("explicatia (buton „i”) spune ce e un credit si de ce consuma diferit", () => {
    render(<QuotaCard quota={QUOTA} />);
    fireEvent.click(screen.getByRole("button", { name: "Ce sunt creditele AI?" }));
    const note = screen.getByRole("note").textContent ?? "";
    expect(note).toMatch(/cât a lucrat asistentul/);
    expect(note).toMatch(/comun pentru toată organizația/);
    expect(note).toMatch(/cel mult 20%/);
  });

  it("peste 80%: avertizare; nelimitat: fara bara", () => {
    const { rerender } = render(
      <QuotaCard quota={{ ...QUOTA, monthlyUsed: 1700, warning: true }} />,
    );
    expect(screen.getByText(/Organizația a folosit 85% din credite/)).toBeTruthy();

    rerender(<QuotaCard quota={{ ...QUOTA, monthlyLimit: 0, dailyLimit: 0 }} />);
    expect(screen.getByText("Nelimitat")).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
