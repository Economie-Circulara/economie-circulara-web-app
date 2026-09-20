"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  OrderEditor,
  type OrderEditorLine,
  type OrderEditorValue,
} from "@/features/orders/order-editor";
import type { OrderDraftPresentation } from "./tools/presentation-types";
import type { PendingAction } from "./types";

function toEditorValue(draft: OrderDraftPresentation["draft"]): OrderEditorValue {
  return {
    orderType: draft.orderType,
    clientId: draft.clientId,
    deliveryAddressId: draft.deliveryAddressId,
    deliveryDate: draft.deliveryDate,
    expectedReturnDate: draft.expectedReturnDate,
    notes: draft.notes,
    lines: draft.lines.map(
      (line, index): OrderEditorLine => ({
        key: `${line.itemId}-${index}`,
        itemId: line.itemId,
        quantity: line.quantity,
      }),
    ),
  };
}

/**
 * Cardul de confirmare pentru `creeaza_comanda` - reutilizeaza `OrderEditor`
 * (identic cu ecranul `/comenzi/nou`, vezi docs/plans/asistent-contract-capabilitati.md
 * obiectivul 4). Starea editata traieste DOAR in acest component (`useState`,
 * initializata o singura data din propunere) - la "Confirmă" se trimite un obiect
 * STRUCTURAT (linii ca array, nu text), fixul direct al bug-ului raportat.
 */
export function OrderDraftCard({
  action,
  presentation,
  busy,
  onConfirm,
  onReject,
}: {
  action: PendingAction;
  presentation: OrderDraftPresentation;
  busy: boolean;
  onConfirm: (overrides: Record<string, unknown>) => void;
  onReject: () => void;
}) {
  const [draft, setDraft] = useState<OrderEditorValue>(() => toEditorValue(presentation.draft));

  function confirm() {
    onConfirm({
      // Tipul e editabil in card (selectorul din `OrderEditor`) - se trimite inapoi
      // ca override, deci utilizatorul poate corecta propunerea asistentului.
      tip_comanda: draft.orderType || "material",
      client_id: draft.clientId,
      adresa_livrare_id: draft.deliveryAddressId || null,
      data_livrare: draft.deliveryDate || null,
      data_retur_estimata: draft.expectedReturnDate || null,
      observatii: draft.notes || null,
      linii: draft.lines.map((line) => ({ item_id: line.itemId, cantitate: line.quantity })),
    });
  }

  return (
    <Card className="border-primary">
      <CardContent className="space-y-4 p-5">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Acțiune propusă - neexecutată
          </p>
          <p className="mt-1 font-semibold">{action.summary}</p>
        </div>

        <OrderEditor
          clients={presentation.options.clients}
          addressesByClient={presentation.options.addressesByClient}
          itemOptions={presentation.options.itemOptions}
          intakeItemOptions={presentation.options.intakeItemOptions}
          value={draft}
          onChange={setDraft}
        />

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy || draft.lines.length === 0} onClick={confirm}>
            Confirmă și execută
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={onReject}>
            Renunță
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
