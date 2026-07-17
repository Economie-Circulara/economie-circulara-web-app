"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cancelProcessAction } from "./actions";

export function CancelProcessButton({ processId }: { processId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onCancel() {
    if (!window.confirm("Anulezi acest proces? Nicio mișcare de stoc nu a avut loc.")) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelProcessAction(processId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" onClick={onCancel} disabled={isPending}>
        {isPending ? "Se anulează…" : "Anulează procesul"}
      </Button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
