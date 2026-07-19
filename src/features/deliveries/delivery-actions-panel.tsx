"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Download, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { declareETransportAction } from "./actions";
import { DECLARATION_STATUS_BADGE_VARIANT, DECLARATION_STATUS_LABELS } from "./labels";
import type { DeliveryDeclarationStatus } from "./types";

export interface DeliveryActionsPanelProps {
  deliveryId: string;
  declarationStatus: DeliveryDeclarationStatus;
  uitCode: string | null;
  declarationError: string | null;
}

/**
 * Panoul de declarare e-Transport (ecranul /livrari/[id]): buton "Declară" (status
 * `not_declared`) sau "Reîncearcă" (status `failed`, cu eroarea vizibilă) — ambele
 * apeleaza aceeasi `declareETransportAction` (apelata direct din `onClick`, in
 * stilul `ReturnActions`). Cand e deja `declared`, arata doar codul UIT (fara
 * buton — actiunea repetata e idempotenta, dar re-click-ul nu are sens in UI).
 */
export function DeliveryActionsPanel({
  deliveryId,
  declarationStatus,
  uitCode,
  declarationError,
}: DeliveryActionsPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(declarationError);

  function declare() {
    setError(null);
    startTransition(async () => {
      const result = await declareETransportAction(deliveryId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant={DECLARATION_STATUS_BADGE_VARIANT[declarationStatus]}>
          {DECLARATION_STATUS_LABELS[declarationStatus]}
        </Badge>
        {uitCode ? <span className="font-mono text-sm">{uitCode}</span> : null}
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {declarationStatus !== "declared" ? (
        <Button type="button" size="sm" disabled={pending} onClick={declare}>
          <Radio className="size-4" />
          {pending
            ? "Se declară..."
            : declarationStatus === "failed"
              ? "Reîncearcă declararea"
              : "Declară la e-Transport"}
        </Button>
      ) : null}

      <div>
        <Button asChild variant="outline" size="sm">
          {/* Ruta de descarcare randeaza avizul ON-DEMAND (vezi pdf.tsx) — mereu cu UIT-ul curent. */}
          <a href={`/livrari/${deliveryId}/aviz`} target="_blank" rel="noopener noreferrer">
            <Download className="size-4" />
            Descarcă avizul (PDF)
          </a>
        </Button>
      </div>
    </div>
  );
}
