"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { previewDeliveryRouteAction, type RouteChoiceView } from "./route-actions";

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
  mapDataUrl: string | null;
}

export interface RoutePreviewProps {
  originSiteId: string;
  destinationAddress: string;
  state: RoutePreviewState | null;
  onStateChange: (state: RoutePreviewState | null) => void;
  error: string | null;
  onError: (error: string | null) => void;
}

/**
 * Preview-ul rutelor calculate (Task X7 - caracteristica #5 din clarificarea AM):
 * buton "Calculează rute" -> apeleaza `previewDeliveryRouteAction` (direct, ca
 * `lookupCuiAction` in `client-form.tsx` - NU e un submit de formular), afiseaza
 * harta (daca exista `GOOGLE_MAPS_API_KEY`) si lista de variante, cu selectie.
 * Rezultatul (varianta aleasa + toate alternativele) e trimis de parinte
 * (`DeliveryForm`) ca un camp ascuns JSON, o data cu restul formularului.
 */
export function RoutePreview({
  originSiteId,
  destinationAddress,
  state,
  onStateChange,
  error,
  onError,
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
        mapDataUrl: result.mapDataUrl,
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
          {state.mapDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data-URI generat server-side, nu un asset optimizabil.
            <img
              src={state.mapDataUrl}
              alt="Previzualizare rută pe hartă"
              className="w-full rounded-md border"
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Previzualizare hartă indisponibilă (mod test/fără cheie Google configurată) - lista de
              rute rămâne validă.
            </p>
          )}

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
