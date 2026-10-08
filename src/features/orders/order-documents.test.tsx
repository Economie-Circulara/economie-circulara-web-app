import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mocks (nu spies - AGENTS.md §2.2): server actions-urile documentelor nu ruleaza in jsdom.
vi.mock("@/features/documents/actions", () => ({
  uploadDocumentAction: vi.fn(),
  deleteDocumentAction: vi.fn(),
  getDownloadUrlAction: vi.fn(),
}));

import type { DocumentRecord } from "@/features/documents/types";
import { OrderDocuments, groupProductDocuments, type OrderDocumentsProps } from "./order-documents";

function doc(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: "doc-1",
    ownerType: "organization",
    ownerId: "org-1",
    fileName: "Declaratie conformitate C25-30.pdf",
    filePath: "org-1/organization/org-1/x.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
    description: "Declarație de conformitate",
    uploadedBy: "user-1",
    createdAt: "2026-10-01T10:00:00.000Z",
    ...overrides,
  };
}

function props(overrides: Partial<OrderDocumentsProps> = {}): OrderDocumentsProps {
  return {
    orderId: "order-1",
    avizHref: null,
    traceabilityHref: null,
    generalDocuments: [],
    orderDocuments: [],
    canManage: true,
    revalidatePath: "/comenzi/order-1",
    ...overrides,
  };
}

describe("OrderDocuments", () => {
  it("staff: arata avizul si fisa de trasabilitate cand exista", () => {
    render(
      <OrderDocuments
        {...props({
          avizHref: "/livrari/delivery-1/aviz",
          traceabilityHref: "/comenzi/order-1/trasabilitate",
        })}
      />,
    );
    expect(screen.getByRole("link", { name: "Descarcă PDF" })).toHaveAttribute(
      "href",
      "/livrari/delivery-1/aviz",
    );
    expect(screen.getByRole("link", { name: "Vezi fișa de trasabilitate" })).toHaveAttribute(
      "href",
      "/comenzi/order-1/trasabilitate",
    );
  });

  it("explica de ce lipsesc documentele generate inainte de livrare/inchidere", () => {
    render(<OrderDocuments {...props()} />);
    expect(screen.getByText(/Avizul apare după planificarea livrării/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Descarcă PDF" })).not.toBeInTheDocument();
  });

  it("listeaza declaratiile de conformitate ale organizatiei", () => {
    render(<OrderDocuments {...props({ generalDocuments: [doc()] })} />);
    expect(screen.getByText("Declaratie conformitate C25-30.pdf")).toBeInTheDocument();
  });

  it("staff: poate atasa documente comenzii si le poate sterge", () => {
    render(
      <OrderDocuments
        {...props({
          orderDocuments: [
            doc({ id: "doc-2", ownerType: "order", ownerId: "order-1", fileName: "nota.pdf" }),
          ],
        })}
      />,
    );
    expect(screen.getByRole("button", { name: "Încarcă" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Șterge" })).toBeInTheDocument();
  });

  it("clientul: fara upload, fara stergere, fara aviz", () => {
    render(
      <OrderDocuments
        {...props({
          canManage: false,
          traceabilityHref: "/comenzile-mele/order-1/trasabilitate",
          generalDocuments: [doc()],
          orderDocuments: [doc({ id: "doc-2", ownerType: "order", fileName: "nota.pdf" })],
        })}
      />,
    );
    expect(screen.queryByRole("button", { name: "Încarcă" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Șterge" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Aviz de însoțire/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Vezi fișa de trasabilitate" })).toBeInTheDocument();
  });

  it("clientul fara documente generale vede un mesaj neutru, nu trimiterea la Setari", () => {
    render(<OrderDocuments {...props({ canManage: false })} />);
    expect(screen.getByText(/nu a publicat încă documente generale/)).toBeInTheDocument();
    expect(screen.queryByText(/Setări/)).not.toBeInTheDocument();
  });
});

describe("groupProductDocuments", () => {
  const lab = doc({
    id: "d1",
    ownerType: "item",
    ownerId: "item-beton",
    fileName: "Reteta 173.pdf",
  });
  const sheet = doc({
    id: "d2",
    ownerType: "item",
    ownerId: "item-nisip",
    fileName: "Fisa nisip.pdf",
  });

  it("grupeaza pe produs, in ordinea liniilor, fara duplicate si fara produse goale", () => {
    const groups = groupProductDocuments(
      [
        { itemId: "item-beton", itemTitle: "Beton C25/30" },
        { itemId: "item-pompa", itemTitle: "Pompare" },
        { itemId: "item-beton", itemTitle: "Beton C25/30" },
      ],
      [lab, sheet],
    );
    expect(groups).toEqual([{ itemId: "item-beton", itemTitle: "Beton C25/30", documents: [lab] }]);
  });
});

describe("OrderDocuments - documentele produselor", () => {
  it("arata documentele fiecarui produs sub numele lui", () => {
    render(
      <OrderDocuments
        {...props({
          productDocuments: [
            {
              itemId: "item-beton",
              itemTitle: "Beton C25/30",
              documents: [
                doc({ ownerType: "item", ownerId: "item-beton", fileName: "Reteta 173.pdf" }),
              ],
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/Documentele produselor/)).toBeInTheDocument();
    expect(screen.getByText("Beton C25/30")).toBeInTheDocument();
    expect(screen.getByText("Reteta 173.pdf")).toBeInTheDocument();
  });

  it("fara documente de produs, subsectiunea nu apare", () => {
    render(<OrderDocuments {...props()} />);
    expect(screen.queryByText(/Documentele produselor/)).not.toBeInTheDocument();
  });
});
