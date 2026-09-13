import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ManualContent } from "./manual-content";

describe("ManualContent", () => {
  it("randeaza titluri cu id, tabele GFM si capturi rescrise", () => {
    const markdown = [
      "## Setări organizație",
      "",
      "![ecranul de setări](img/admin-settings.png)",
      "",
      "| Câmp | Rol |",
      "| --- | --- |",
      "| Nume | identitate |",
    ].join("\n");

    render(<ManualContent markdown={markdown} />);

    expect(screen.getByRole("heading", { name: "Setări organizație" })).toHaveAttribute(
      "id",
      "setări-organizație",
    );
    expect(screen.getByAltText("ecranul de setări")).toHaveAttribute(
      "src",
      "/ajutor/img/admin-settings.png",
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Câmp" })).toBeInTheDocument();
  });

  it("randeaza link-urile intre documente si le lasa text pe cele din repo", () => {
    render(
      <ManualContent markdown="Vezi [manualul clientului](utilizare-client.md) și [handoff](../handoff.md)." />,
    );

    expect(screen.getByRole("link", { name: "manualul clientului" })).toHaveAttribute(
      "href",
      "/ajutor/utilizare-client",
    );
    expect(screen.queryByRole("link", { name: "handoff" })).toBeNull();
    expect(screen.getByText("handoff")).toBeInTheDocument();
  });

  it("foloseste id-ul explicit {#...} din markdown", () => {
    render(<ManualContent markdown="### 2.2 Gap cunoscut {#gap-cunoscut-invitarea-unui-client}" />);

    expect(screen.getByRole("heading", { name: "2.2 Gap cunoscut" })).toHaveAttribute(
      "id",
      "gap-cunoscut-invitarea-unui-client",
    );
  });
});
