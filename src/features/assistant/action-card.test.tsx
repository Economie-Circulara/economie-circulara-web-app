import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Client, ClientAddress } from "@/features/clients/types";
import type { ItemOption } from "@/features/items/types";
import { ActionCard } from "./action-card";
import type { PendingAction } from "./types";

describe("ActionCard - randerul generic", () => {
  it("un camp needitabil (ID rezolvat la eticheta) nu produce niciun input", () => {
    const action: PendingAction = {
      toolCallId: "call-1",
      tool: "trimite_comanda",
      toolVersion: 1,
      summary: "Trimite comanda către acceptare",
      presentation: {
        renderer: "generic",
        fields: [
          {
            name: "order_id",
            label: "Comandă",
            displayValue: "CMD-2026-0002 · Client Demo SRL",
            editable: false,
            kind: "text",
          },
        ],
      },
    };

    render(<ActionCard action={action} busy={false} onConfirm={vi.fn()} onReject={vi.fn()} />);

    expect(screen.getByText("CMD-2026-0002 · Client Demo SRL")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("un camp boolean se editeaza ca checkbox si se trimite TIPAT (nu ca text)", () => {
    const onConfirm = vi.fn();
    const action: PendingAction = {
      toolCallId: "call-1",
      tool: "creeaza_client",
      toolVersion: 1,
      summary: "Creează clientul ACME SRL",
      presentation: {
        renderer: "generic",
        fields: [
          {
            name: "denumire",
            label: "Denumire",
            displayValue: "ACME SRL",
            editable: true,
            kind: "text",
            value: "ACME SRL",
          },
          {
            name: "platitor_tva",
            label: "Plătitor de TVA",
            displayValue: "Nu",
            editable: true,
            kind: "boolean",
            value: false,
          },
        ],
      },
    };

    render(<ActionCard action={action} busy={false} onConfirm={onConfirm} onReject={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Plătitor de TVA"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmă și execută" }));

    expect(onConfirm).toHaveBeenCalledWith({ denumire: "ACME SRL", platitor_tva: true });
  });
});

describe("ActionCard - randerul order_draft", () => {
  const CLIENTS: Client[] = [
    {
      id: "c1",
      name: "ACME SRL",
      cui: "111",
      regCom: null,
      isVatPayer: false,
      hqAddress: null,
      email: null,
      phone: null,
      contactPerson: null,
      isSupplier: false,
      notes: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];
  const ADDRESSES: Record<string, ClientAddress[]> = {};
  const ITEMS: ItemOption[] = [
    { id: "i1", title: "Agregat reciclat", unit: "tona", kind: "physical" },
  ];

  it("confirmarea trimite liniile ca ARRAY structurat, nu ca text serializat", () => {
    const onConfirm = vi.fn();
    const action: PendingAction = {
      toolCallId: "call-1",
      tool: "creeaza_comanda",
      toolVersion: 1,
      summary: "Creează o comandă cu 1 linie",
      presentation: {
        renderer: "order_draft",
        draft: {
          orderType: "material",
          clientId: "c1",
          deliveryAddressId: "",
          deliveryDate: "",
          expectedReturnDate: "",
          notes: "",
          lines: [{ itemId: "i1", quantity: 2 }],
        },
        options: { clients: CLIENTS, addressesByClient: ADDRESSES, itemOptions: ITEMS },
      },
    };

    render(<ActionCard action={action} busy={false} onConfirm={onConfirm} onReject={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Confirmă și execută" }));

    expect(onConfirm).toHaveBeenCalledWith({
      tip_comanda: "material",
      client_id: "c1",
      adresa_livrare_id: null,
      data_livrare: null,
      data_retur_estimata: null,
      observatii: null,
      linii: [{ item_id: "i1", cantitate: 2 }],
    });
  });
});
