"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RichNote } from "@/components/rich-note";
import { RICH_NOTE_HINT } from "@/lib/text/rich-note";
import { initialOrderFormState, type OrderFormState } from "./action-state";

const textareaClassName =
  "flex min-h-28 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export interface OrderNoteCardProps {
  note: string | null;
  /**
   * Actiunea de salvare (`updateOrderNoteAction.bind(null, orderId)`). Lipsa = doar
   * citire (portalul clientului, sau comanda inchisa/anulata).
   */
  saveAction?: (prev: OrderFormState, formData: FormData) => Promise<OrderFormState>;
}

/**
 * Nota de comanda, vizibila pe toata durata comenzii (decizie 2026-10-08): ce s-a
 * discutat cu clientul - lucrare, element turnat, ritm, recepție. Se preia pe aviz.
 * Staff-ul o editeaza de la ciorna pana la livrare; clientul o vede formatata.
 */
export function OrderNoteCard({ note, saveAction }: OrderNoteCardProps) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(
    saveAction ?? (async (prev: OrderFormState) => prev),
    initialOrderFormState,
  );
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) setEditing(false);
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Notă de comandă</CardTitle>
        {saveAction && !editing ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            {note ? "Editează" : "Adaugă notă"}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {editing && saveAction ? (
          <form action={action} className="space-y-3">
            <textarea
              name="notes"
              aria-label="Notă de comandă"
              rows={6}
              defaultValue={note ?? ""}
              className={textareaClassName}
            />
            <p className="text-xs text-muted-foreground">
              Apare pe aviz și clientului, în portal. {RICH_NOTE_HINT}
            </p>
            {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Se salvează..." : "Salvează"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Renunță
              </Button>
            </div>
          </form>
        ) : note ? (
          <RichNote text={note} />
        ) : (
          <p className="text-sm text-muted-foreground">Nicio notă.</p>
        )}
      </CardContent>
    </Card>
  );
}
