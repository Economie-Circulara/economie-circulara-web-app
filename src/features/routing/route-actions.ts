"use server";

import { getCurrentOrg } from "@/features/auth/queries";
import { requireRole } from "@/features/auth/session";
import { getSiteById } from "./site-queries";
import { computeRouteBetween, renderRouteStaticMapDataUrl } from "./route-service";
import { AddressNotFoundError, RoutingNotConfiguredError, RoutingProviderError } from "./types";

/** Reprezentarea serializabila a unei variante de ruta, trimisa catre client component. */
export interface RouteChoiceView {
  distanceMeters: number;
  durationSeconds: number;
  polyline: string;
  label: string;
}

export interface PreviewRouteResult {
  error: string | null;
  routes: RouteChoiceView[];
  bestIndex: number;
  /** Imagine Maps Static ca data-URI (base64) - `null` in mod mock sau daca cererea a esuat. */
  mapDataUrl: string | null;
}

function routingErrorMessage(err: unknown): string {
  if (
    err instanceof RoutingNotConfiguredError ||
    err instanceof AddressNotFoundError ||
    err instanceof RoutingProviderError
  ) {
    return err.message;
  }
  return err instanceof Error ? err.message : "Nu am putut calcula rutele.";
}

/**
 * Calculeaza rutele intre un punct de plecare al organizatiei si o adresa de
 * livrare (ecranul /livrari/nou, buton "Calculează rute") - DOAR staff. Rezultatul
 * NU se salveaza aici - operatorul alege o varianta in UI, iar alegerea se
 * trimite (campuri ascunse) o data cu restul formularului catre `planDeliveryAction`
 * (`src/features/deliveries/actions.ts`), care persista prin `planDelivery`.
 */
export async function previewDeliveryRouteAction(
  originSiteId: string,
  destinationAddress: string,
): Promise<PreviewRouteResult> {
  await requireRole(["admin", "operator"]);

  const empty: PreviewRouteResult = { error: null, routes: [], bestIndex: -1, mapDataUrl: null };
  if (!originSiteId) return { ...empty, error: "Selectează un punct de plecare." };
  if (!destinationAddress.trim()) return { ...empty, error: "Introdu adresa de livrare." };

  const site = await getSiteById(originSiteId);
  if (!site) return { ...empty, error: "Punctul de plecare selectat nu a fost găsit." };

  try {
    const org = await getCurrentOrg();
    const computation = await computeRouteBetween(
      { address: site.address },
      { address: destinationAddress },
    );
    const mapDataUrl = await renderRouteStaticMapDataUrl({
      origin: computation.origin,
      destination: computation.destination,
      routes: computation.routes,
      bestIndex: computation.bestIndex,
      recommendedColor: org?.primaryColor,
    });

    return {
      error: null,
      routes: computation.routes.map((route) => ({
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
        polyline: route.polyline,
        label: route.label,
      })),
      bestIndex: computation.bestIndex,
      mapDataUrl,
    };
  } catch (err) {
    return { ...empty, error: routingErrorMessage(err) };
  }
}
