import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OdometerSummary } from "./odometer-summary";

describe("OdometerSummary", () => {
  it("arata kilometrajul, km parcursi si abaterea mare de consum", () => {
    render(
      <OdometerSummary
        stats={{ currentKm: 101_000, kmDriven: 1000, realConsumption: 45 }}
        declaredConsumption={30}
      />,
    );
    expect(screen.getByText("101.000 km")).toBeInTheDocument();
    expect(screen.getByText("1.000 km")).toBeInTheDocument();
    expect(screen.getByText(/\+50%\) - abatere mare/)).toBeInTheDocument();
  });

  it("fara date suficiente explica de ce lipseste consumul real", () => {
    render(
      <OdometerSummary
        stats={{ currentKm: null, kmDriven: 0, realConsumption: null }}
        declaredConsumption={30}
      />,
    );
    expect(screen.getByText(/două alimentări cu kilometraj/)).toBeInTheDocument();
  });
});
