import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  uploadDocumentAction: vi.fn(),
  deleteDocumentAction: vi.fn(),
  getDownloadUrlAction: vi.fn(),
}));

import { ItemDocumentsSection } from "./item-documents-section";

describe("ItemDocumentsSection", () => {
  it("avertizeaza ca documentele unui produs vandabil sunt vizibile clientilor", () => {
    render(<ItemDocumentsSection itemId="i1" documents={[]} sellable revalidatePath="/itemi/i1" />);
    expect(screen.getByText(/și clienților, în portal/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Încarcă" })).toBeInTheDocument();
  });

  it("produs nevandabil: documentele raman ale echipei", () => {
    render(
      <ItemDocumentsSection
        itemId="i1"
        documents={[]}
        sellable={false}
        revalidatePath="/itemi/i1"
      />,
    );
    expect(screen.getByText(/clienții nu le văd/)).toBeInTheDocument();
  });
});
