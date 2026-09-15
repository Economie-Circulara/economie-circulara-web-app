import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouteMap } from "./route-map";
import type { RouteChoiceView } from "./route-actions";

// Exemplul oficial Google (vezi polyline.test.ts) - 3 puncte reale, decodabile.
const POLYLINE = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

const ROUTES: RouteChoiceView[] = [
  { distanceMeters: 1000, durationSeconds: 60, polyline: POLYLINE, label: "Ruta directă" },
  { distanceMeters: 1200, durationSeconds: 90, polyline: POLYLINE, label: "Rută alternativă" },
];

describe("RouteMap", () => {
  it("randeaza harta cu markerii de origine (A) si destinatie (B)", () => {
    render(<RouteMap routes={ROUTES} selectedIndex={0} />);

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("nu randeaza nimic cand nu exista rute", () => {
    const { container } = render(<RouteMap routes={[]} selectedIndex={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
