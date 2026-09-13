"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PendingAction } from "./types";

/**
 * Cardul de confirmare - piesa centrala de siguranta a asistentului: modelul doar
 * PROPUNE, omul confirma. Campurile sunt editabile, ca o valoare gresita sa poata fi
 * corectata pe loc, fara reformularea cererii. Valorile corectate se re-valideaza pe
 * server (`tool.parse`), exact ca un formular normal.
 */
export function ActionCard({
  action,
  busy,
  onConfirm,
  onReject,
}: {
  action: PendingAction;
  busy: boolean;
  onConfirm: (overrides: Record<string, string>) => void;
  onReject: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(action.fields.map((field) => [field.name, field.value])),
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

        {action.fields.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {action.fields.map((field) => (
              <div key={field.name} className="space-y-1.5">
                <Label htmlFor={`action-${field.name}`}>{field.label}</Label>
                <Input
                  id={`action-${field.name}`}
                  value={values[field.name] ?? ""}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [field.name]: event.target.value }))
                  }
                />
              </div>
            ))}
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
