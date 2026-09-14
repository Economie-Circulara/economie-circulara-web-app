"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recalculateDeliveryRouteAction } from "./actions";

export interface RoutePanelProps {
  deliveryId: string;
  distanceMeters: number | null;
  durationSeconds: number | null;
  mapDataUrl: string | null;
}

const distanceFormatter = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 });

function formatDistance(meters: number): string {
  return `${distanceFormatter.format(meters / 1000)} km`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/**
 * Panoul rutei calculate (ecranul /livrari/[id], Task X7 - caracteristica #5):
 * distanta/durata + harta (daca a fost generata) + buton "Recalculează" (alege
 * automat cea mai rapidă variantă la momentul recalculării - fără pas de selecție
 * manuală aici, spre deosebire de planificarea inițială - vezi
 * `src/features/deliveries/service.ts#recalculateDeliveryRoute`).
 */
export function RoutePanel({
  deliveryId,
  distanceMeters,
  durationSeconds,
  mapDataUrl,
}: RoutePanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function recalculate() {
    setError(null);
    startTransition(async () => {
      const result = await recalculateDeliveryRouteAction(deliveryId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {distanceMeters !== null && durationSeconds !== null ? (
        <p className="text-sm">
          <span className="text-muted-foreground">Distanță estimată: </span>
          {formatDistance(distanceMeters)} · {formatDuration(durationSeconds)}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ruta nu a fost calculată (planificată manual, fără puncte de plecare/rute).
        </p>
      )}

      {mapDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- data-URI generat server-side.
        <img
          src={mapDataUrl}
          alt="Previzualizare rută pe hartă"
          className="w-full rounded-md border"
        />
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {distanceMeters !== null ? (
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={recalculate}>
          <RefreshCw className="size-4" />
          {pending ? "Se recalculează..." : "Recalculează"}
        </Button>
      ) : null}
    </div>
  );
}
