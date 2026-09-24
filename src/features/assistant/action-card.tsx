"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OrderDraftCard } from "./order-draft-card";
import { RecipeDraftCard } from "./recipe-draft-card";
import type { PendingAction } from "./types";

export interface ActionCardProps {
  action: PendingAction;
  busy: boolean;
  onConfirm: (overrides: Record<string, unknown>) => void;
  onReject: () => void;
}

/**
 * Cardul de confirmare - piesa centrala de siguranta a asistentului: modelul doar
 * PROPUNE, omul confirma. Dispatch pe `presentation.renderer` (docs/plans/
 * asistent-contract-capabilitati.md): `"order_draft"` are nevoie STRUCTURAL de un
 * editor cu linii + selectii cascadate (`OrderDraftCard`, reutilizeaza `OrderEditor`);
 * `"recipe_draft"` - lista de materii prime cu procente (`RecipeDraftCard`);
 * orice alt tool de scriere foloseste randerul generic de mai jos.
 */
export function ActionCard({ action, busy, onConfirm, onReject }: ActionCardProps) {
  if (action.presentation.renderer === "order_draft") {
    return (
      <OrderDraftCard
        action={action}
        presentation={action.presentation}
        busy={busy}
        onConfirm={onConfirm}
        onReject={onReject}
      />
    );
  }

  if (action.presentation.renderer === "recipe_draft") {
    return (
      <RecipeDraftCard
        action={action}
        presentation={action.presentation}
        busy={busy}
        onConfirm={onConfirm}
        onReject={onReject}
      />
    );
  }

  return (
    <GenericActionCard
      action={action}
      presentation={action.presentation}
      busy={busy}
      onConfirm={onConfirm}
      onReject={onReject}
    />
  );
}

/**
 * Randerul generic: campuri TIPATE (text editabil, boolean ca checkbox, sau
 * doar-afisare pt. valori rezolvate - ex. un ID intern aratat ca denumire). Spre
 * deosebire de vechiul card (orice camp = `<Input>` de text), valorile trimise la
 * "Confirmă" pastreaza tipul original - fixul direct al bug-ului raportat
 * (un array/boolean serializat ca text si retrimis ca override suprascria
 * valoarea tipata din propunere).
 */
function GenericActionCard({
  action,
  presentation,
  busy,
  onConfirm,
  onReject,
}: ActionCardProps & {
  presentation: Extract<PendingAction["presentation"], { renderer: "generic" }>;
}) {
  const editableFields = presentation.fields.filter((field) => field.editable);
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(
      editableFields.map((field) => [
        field.name,
        field.value ?? (field.kind === "boolean" ? false : ""),
      ]),
    ),
  );

  return (
    <Card className="border-primary">
      <CardContent className="space-y-4 p-5">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Acțiune propusă - neexecutată
          </p>
          <p className="mt-1 font-semibold">{action.summary}</p>
        </div>

        {presentation.fields.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {presentation.fields.map((field) =>
              !field.editable ? (
                <div key={field.name} className="space-y-1.5">
                  <Label>{field.label}</Label>
                  <p className="text-sm text-muted-foreground">{field.displayValue}</p>
                </div>
              ) : field.kind === "boolean" ? (
                <label key={field.name} className="flex items-center gap-2 self-end pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(values[field.name])}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, [field.name]: event.target.checked }))
                    }
                    className="size-4 rounded border-input"
                  />
                  {field.label}
                </label>
              ) : (
                <div key={field.name} className="space-y-1.5">
                  <Label htmlFor={`action-${field.name}`}>{field.label}</Label>
                  <Input
                    id={`action-${field.name}`}
                    value={(values[field.name] as string) ?? ""}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, [field.name]: event.target.value }))
                    }
                  />
                </div>
              ),
            )}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy} onClick={() => onConfirm(values)}>
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
