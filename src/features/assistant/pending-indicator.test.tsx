import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PendingIndicator, pendingLabel } from "./pending-indicator";

afterEach(() => {
  vi.useRealTimers();
});

describe("pendingLabel", () => {
  it("schimba mesajul dupa timpul scurs", () => {
    expect(pendingLabel(0)).toBe("Mă gândesc...");
    expect(pendingLabel(7)).toBe("Caut datele necesare... (7 s)");
    expect(pendingLabel(20)).toMatch(/mai mulți pași.*\(20 s\)/);
  });
});

describe("PendingIndicator", () => {
  it("numara secundele cat timp e afisat", () => {
    vi.useFakeTimers();
    render(<PendingIndicator />);
    expect(screen.getByRole("status").textContent).toBe("Mă gândesc...");

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByRole("status").textContent).toBe("Caut datele necesare... (6 s)");
  });
});
