"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { RoutePreview, type RoutePreviewState } from "@/features/routing/route-preview";
import type { OrganizationSite } from "@/features/routing/site-types";
import { initialDeliveryFormState } from "./action-state";
import { planDeliveryAction } from "./actions";
import type { PlanDeliveryRouteChoice } from "./types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export interface DeliveryFormProps {
  orderId: string;
  orderNumber: string | null;
  clientName: string;
  /** Punctele de plecare ale organizatiei - selector pt. calculul rutei (Task X7). */
  sites: OrganizationSite[];
  /** Adresa de livrare a comenzii (client_addresses) - precompleteaza "Punct de sosire". */
  destinationAddress: string | null;
}

/**
 * Formular de planificare livrare (ecranul /livrari/nou) - creeaza un singur rand
 * `deliveries` pt. o comanda ACCEPTATA (`planDeliveryAction`, care redirectioneaza
 * la ecranul de detaliu al livrarii nou-create). Camp cerute de Task X5: data
 * programata, transportator, nr. inmatriculare, sofer, ruta (plecare/sosire).
 *
 * Task X7 (planificare optimizata a rutelor): un selector de punct de plecare +
 * butonul "Calculează rute" (`RoutePreview`) sunt OPTIONALE - operatorul poate in
 * continuare completa manual "Punct de plecare"/"Punct de sosire" ca text liber,
 * fara sa calculeze nicio ruta (comportament identic cu inainte de X7). Cand
 * calculul e folosit, alegerea (varianta selectata + toate alternativele) e
 * trimisa catre `planDeliveryAction` intr-un singur camp ascuns JSON (`route_choice`).
 */
export function DeliveryForm({
  orderId,
  orderNumber,
  clientName,
  sites,
  destinationAddress,
}: DeliveryFormProps) {
  const [state, formAction, pending] = useActionState(planDeliveryAction, initialDeliveryFormState);

  const defaultSite = useMemo(() => sites.find((s) => s.isDefault) ?? sites[0], [sites]);
  const [originSiteId, setOriginSiteId] = useState(defaultSite?.id ?? "");
  const [routeOrigin, setRouteOrigin] = useState(defaultSite?.address ?? "");
  const [routeDestination, setRouteDestination] = useState(destinationAddress ?? "");

  const [routePreviewState, setRoutePreviewState] = useState<RoutePreviewState | null>(null);
  const [routePreviewError, setRoutePreviewError] = useState<string | null>(null);

  function handleOriginSiteChange(siteId: string) {
    setOriginSiteId(siteId);
    const site = sites.find((s) => s.id === siteId);
    if (site) setRouteOrigin(site.address);
    // Punctul de plecare s-a schimbat - ruta calculata anterior nu mai e valida.
    setRoutePreviewState(null);
  }

  const routeChoice: PlanDeliveryRouteChoice | null =
    routePreviewState && originSiteId
      ? {
          originSiteId,
          distanceMeters: routePreviewState.routes[routePreviewState.selectedIndex].distanceMeters,
          durationSeconds:
            routePreviewState.routes[routePreviewState.selectedIndex].durationSeconds,
          polyline: routePreviewState.routes[routePreviewState.selectedIndex].polyline,
          selectedIndex: routePreviewState.selectedIndex,
          selection: routePreviewState.manualOverride ? "manual" : "auto",
          alternatives: routePreviewState.routes,
        }
      : null;

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <input type="hidden" name="order_id" value={orderId} />
      {routeChoice ? (
        <input type="hidden" name="route_choice" value={JSON.stringify(routeChoice)} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Comandă</CardTitle>
          <CardDescription>
            {orderNumber ?? "Draft"} · {clientName}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalii transport</CardTitle>
          <CardDescription>
            Vehicul, șofer și rută - necesare pt. avizul de însoțire.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Data programată" required>
            {(id) => <Input id={id} name="scheduled_date" type="date" required />}
          </FormField>
          <FormField label="Transportator" required>
            {(id) => <Input id={id} name="carrier_name" placeholder="Ex. Transport SRL" required />}
          </FormField>
          <FormField
            label="Nr. înmatriculare"
            required
            hint="Identifică vehiculul (pregătit pt. monitorizare GPS, v2)."
          >
            {(id) => <Input id={id} name="vehicle_plate" placeholder="Ex. B 123 ABC" required />}
          </FormField>
          <FormField label="Șofer" required>
            {(id) => <Input id={id} name="driver_name" placeholder="Nume și prenume" required />}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rută</CardTitle>
          <CardDescription>
            Alege un punct de plecare și calculează rutele posibile - se marchează automat cea mai
            rapidă ca „Recomandată”. Poți alege o altă variantă, sau poți completa ruta manual, fără
            calcul.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sites.length > 0 ? (
            <FormField label="Punct de plecare (stație/depozit)">
              {(id) => (
                <select
                  id={id}
                  value={originSiteId}
                  onChange={(e) => handleOriginSiteChange(e.target.value)}
                  className={selectClassName}
                >
                  <option value="" disabled>
                    Alege un punct de plecare...
                  </option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nu există niciun punct de plecare configurat - adaugă unul în{" "}
              <a href="/setari/statii" className="underline">
                Setări → Puncte de plecare
              </a>{" "}
              pentru a calcula rute, sau completează ruta manual mai jos.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Punct de plecare" required>
              {(id) => (
                <Input
                  id={id}
                  name="route_origin"
                  required
                  value={routeOrigin}
                  onChange={(e) => setRouteOrigin(e.target.value)}
                  placeholder="Ex. Depozit central"
                />
              )}
            </FormField>
            <FormField label="Punct de sosire" required>
              {(id) => (
                <Input
                  id={id}
                  name="route_destination"
                  required
                  value={routeDestination}
                  onChange={(e) => {
                    setRouteDestination(e.target.value);
                    setRoutePreviewState(null);
                  }}
                  placeholder="Adresa de livrare"
                />
              )}
            </FormField>
          </div>

          {sites.length > 0 ? (
            <RoutePreview
              originSiteId={originSiteId}
              destinationAddress={routeDestination}
              state={routePreviewState}
              onStateChange={setRoutePreviewState}
              error={routePreviewError}
              onError={setRoutePreviewError}
            />
          ) : null}
        </CardContent>
      </Card>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Se planifică..." : "Planifică livrarea"}
        </Button>
      </div>
    </form>
  );
}
