"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { previewDeliveryRouteAction, type RouteChoiceView } from "./route-actions";
import { RouteMap } from "./route-map";

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

export interface RoutePreviewState {
  routes: RouteChoiceView[];
  bestIndex: number;
  selectedIndex: number;
  /** true = operatorul a ales explicit alta varianta decat cea recomandata. */
  manualOverride: boolean;
}

export interface RoutePreviewProps {
  originSiteId: string;
  destinationAddress: string;
  state: RoutePreviewState | null;
  onStateChange: (state: RoutePreviewState | null) => void;
  error: string | null;
  onError: (error: string | null) => void;
  /** Culoarea primara a organizatiei (hex) - traseul recomandat pe harta. */
  recommendedColor?: string | null;
}

/**
 * Preview-ul rutelor calculate (Task X7 - caracteristica #5 din clarificarea AM):
 * buton "Calculează rute" -> apeleaza `previewDeliveryRouteAction` (direct, ca
 * `lookupCuiAction` in `client-form.tsx` - NU e un submit de formular), afiseaza
 * harta interactiva (`RouteMap`, client-side, fara alt round-trip) si lista de
 * variante, cu selectie. Rezultatul (varianta aleasa + toate alternativele) e
 * trimis de parinte (`DeliveryForm`) ca un camp ascuns JSON, o data cu restul
 * formularului.
 */
export function RoutePreview({
  originSiteId,
  destinationAddress,
  state,
  onStateChange,
  error,
  onError,
  recommendedColor,
}: RoutePreviewProps) {
  const [pending, startTransition] = useTransition();

  function handleCompute() {
    if (!originSiteId) {
      onError("Selectează mai întâi un punct de plecare.");
      return;
    }
    if (!destinationAddress.trim()) {
      onError("Completează adresa de livrare (punctul de sosire) înainte de a calcula rutele.");
      return;
    }
    onError(null);
    startTransition(async () => {
      const result = await previewDeliveryRouteAction(originSiteId, destinationAddress);
      if (result.error) {
        onError(result.error);
        onStateChange(null);
        return;
      }
      onStateChange({
        routes: result.routes,
        bestIndex: result.bestIndex,
        selectedIndex: result.bestIndex,
        manualOverride: false,
      });
    });
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" size="sm" onClick={handleCompute} disabled={pending}>
        {pending ? "Se calculează..." : "Calculează rute"}
      </Button>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {state ? (
        <div className="space-y-3 rounded-lg border bg-card p-3">
          <RouteMap
            routes={state.routes}
            selectedIndex={state.selectedIndex}
            recommendedColor={recommendedColor}
          />

          <div className="space-y-2">
            {state.routes.map((route, index) => {
              const isRecommended = index === state.bestIndex;
              const isSelected = index === state.selectedIndex;
              return (
                <label
                  key={index}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-md border p-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="route_preview_choice"
                      checked={isSelected}
                      onChange={() =>
                        onStateChange({
                          ...state,
                          selectedIndex: index,
                          manualOverride: index !== state.bestIndex,
                        })
                      }
                      className="size-4"
                    />
                    {route.label}
                    {isRecommended ? <Badge variant="ok">Recomandată</Badge> : null}
                  </span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {formatDistance(route.distanceMeters)} · {formatDuration(route.durationSeconds)}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
