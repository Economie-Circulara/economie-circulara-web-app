"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { blockLotAction, initialBlockFormState, unblockLotAction } from "./actions";
import type { LotWithItem } from "./types";

/**
 * Blocare/deblocare lot cu motiv — formular inline (nu dialog modal, ca sa ramanem
 * in scope-ul featurii: nu adaugam un primitive `Dialog` nou in `src/components/ui/`).
 */
export function LotBlockControls({ lot }: { lot: LotWithItem }) {
  const [open, setOpen] = useState(false);
  const [blockState, blockAction, blockPending] = useActionState(
    blockLotAction,
    initialBlockFormState,
  );
  const [unblockState, unblockAction, unblockPending] = useActionState(
    unblockLotAction,
    initialBlockFormState,
  );

  if (lot.isBlocked) {
    return (
      <form action={unblockAction} className="flex flex-col items-end gap-1">
        <input type="hidden" name="lot_id" value={lot.id} />
        <Button type="submit" size="sm" variant="outline" disabled={unblockPending}>
          {unblockPending ? "Se deblocheaza..." : "Deblochează"}
        </Button>
        {unblockState.error ? (
          <span className="text-xs text-danger">{unblockState.error}</span>
        ) : null}
      </form>
    );
  }

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Blochează
      </Button>
    );
  }

  return (
    <form action={blockAction} className="flex flex-col items-end gap-2">
      <input type="hidden" name="lot_id" value={lot.id} />
      <Input name="reason" placeholder="Motivul blocării" required className="h-8 w-48 text-xs" />
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Anulează
        </Button>
        <Button type="submit" size="sm" variant="destructive" disabled={blockPending}>
          {blockPending ? "Se blochează..." : "Confirmă"}
        </Button>
      </div>
      {blockState.error ? <span className="text-xs text-danger">{blockState.error}</span> : null}
    </form>
  );
}
