import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/database.types";
import { onOrderStatusChanged } from "@/features/orders/notifications";
import { getOrderStatus } from "@/features/orders/queries";
import { setOrderStatus } from "@/features/orders/service";
import { pickBestRouteIndex } from "@/features/routing/rank";
import { computeRouteBetween } from "@/features/routing/route-service";
import { getSiteById } from "@/features/routing/site-queries";
import {
  ETransportDeclarationError,
  ETransportNotConfiguredError,
  getETransportProvider,
} from "./e-transport";
import {
  DELIVERY_CORE_COLUMNS,
  getDeliveryByOrderId,
  getDeliveryDetail,
  mapDelivery,
} from "./queries";
import { AvizPdfDocument } from "./pdf";
import type { DeliveryDetail, DeliveryRecord, PlanDeliveryInput } from "./types";

type OrderStatus = Database["public"]["Enums"]["order_status"];

/** Comanda pentru care se planifica livrarea nu exista sau nu e accesibila (RLS). */
export class DeliveryOrderNotFoundError extends Error {
  constructor(message = "Comanda nu există sau nu este accesibilă.") {
    super(message);
    this.name = "DeliveryOrderNotFoundError";
  }
}

/** Regula de business incalcata (status comanda invalid, camp obligatoriu lipsa, livrare deja existenta). */
export class DeliveryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeliveryValidationError";
  }
}

/** Livrarea ceruta nu exista sau nu e accesibila apelantului (RLS). */
export class DeliveryNotFoundError extends Error {
  constructor(message = "Livrarea nu există sau nu este accesibilă.") {
    super(message);
    this.name = "DeliveryNotFoundError";
  }
}

/** Doar comenzile ACCEPTATE pot avea o livrare planificata (docs/plans/implementation-plan.md, Task X5). */
const PLANNABLE_ORDER_STATUS: OrderStatus = "accepted";

function requireNonEmpty(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new DeliveryValidationError(`Câmpul "${field}" este obligatoriu.`);
  return trimmed;
}

/**
 * Planifica o livrare noua pt. o comanda ACCEPTATA: valideaza campurile + statusul
 * comenzii + absenta unei livrari existente (unique(order_id) - o comanda are cel
 * mult o livrare, AGENTS.md §4 "fara livrari partiale"), apoi insereaza randul.
 * Nu foloseste RPC dedicat (spre deosebire de `accept_return_order`): un singur
 * insert, fara efecte secundare pe alte tabele - RLS (`deliveries_staff_all`,
 * 0013_deliveries.sql) e suficienta ca linie de aparare.
 */
export async function planDelivery(input: PlanDeliveryInput): Promise<DeliveryRecord> {
  const scheduledDate = requireNonEmpty(input.scheduledDate, "Data programată");
  const carrierName = requireNonEmpty(input.carrierName, "Transportator");
  const vehiclePlate = requireNonEmpty(input.vehiclePlate, "Nr. înmatriculare");
  const driverName = requireNonEmpty(input.driverName, "Șofer");
  const routeOrigin = requireNonEmpty(input.routeOrigin, "Punct de plecare");
  const routeDestination = requireNonEmpty(input.routeDestination, "Punct de sosire");

  if (Number.isNaN(Date.parse(scheduledDate))) {
    throw new DeliveryValidationError("Data programată nu este validă.");
  }

  const supabase = await createClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, organization_id, status")
    .eq("id", input.orderId)
    .maybeSingle();
  if (orderError) throw new Error("Nu am putut încărca comanda pentru planificarea livrării.");
  if (!order) throw new DeliveryOrderNotFoundError();

  if (order.status !== PLANNABLE_ORDER_STATUS) {
    throw new DeliveryValidationError(
      `Doar comenzile acceptate pot avea o livrare planificată (status curent: "${order.status}").`,
    );
  }

  const existing = await getDeliveryByOrderId(input.orderId);
  if (existing) {
    throw new DeliveryValidationError("Comanda are deja o livrare planificată.");
  }

  const route = input.route;
  const { data: inserted, error: insertError } = await supabase
    .from("deliveries")
    .insert({
      organization_id: order.organization_id,
      order_id: order.id,
      scheduled_date: scheduledDate,
      carrier_name: carrierName,
      vehicle_plate: vehiclePlate,
      driver_name: driverName,
      route_origin: routeOrigin,
      route_destination: routeDestination,
      created_by: input.createdBy ?? null,
      // Rezultatul planificarii optimizate a rutei (Task X7) - optional, prezent
      // doar daca operatorul a folosit "Calculează rute" (vezi PlanDeliveryRouteChoice).
      ...(route
        ? {
            origin_site_id: route.originSiteId,
            route_distance_m: route.distanceMeters,
            route_duration_s: route.durationSeconds,
            route_polyline: route.polyline,
            // Cast documentat: RouteChoiceView[] e o structura de date simpla
            // (numere/siruri), compatibila structural cu Json, dar TS nu poate
            // verifica asta automat pt. un tip cu proprietati numite (fara index
            // signature) - acelasi motiv ca la `renderAvizPdfBuffer` de mai jos.
            route_alternatives: route.alternatives as unknown as Json,
            route_selected_index: route.selectedIndex,
            route_selection: route.selection,
            route_computed_at: new Date().toISOString(),
          }
        : {}),
    })
    .select(DELIVERY_CORE_COLUMNS)
    .single();
  if (insertError || !inserted) {
    // unique(order_id) - o cursa cu alt request care a planificat intre timp aceeasi comanda.
    throw new DeliveryValidationError(
      insertError?.message ?? "Nu am putut planifica livrarea (posibil deja planificată).",
    );
  }

  return mapDelivery(inserted);
}

/**
 * Declara (sau RE-incearca) declararea e-Transport a unei livrari: apeleaza
 * adapterul activ (`e-transport.ts#getETransportProvider` - mock/sandbox implicit,
 * Socrate.io cand vor exista credentiale S4) si salveaza rezultatul.
 *
 * IDEMPOTENT pe succes: daca livrarea e deja `declared`, o intoarce neschimbata,
 * fara sa mai apeleze providerul (evita costuri/duplicate la un re-click accidental).
 * Pe eroare (`not_declared` sau retry dupa `failed`): salveaza `declaration_status =
 * 'failed'` + mesajul in `declaration_error`, ca eroarea sa fie VIZIBILA in UI si
 * RE-INCERCABILA (chemarea urmatoare a acestei functii incearca din nou) - nu
 * arunca mai departe (apelantul citeste rezultatul din randul returnat, nu dintr-o
 * exceptie).
 */
export async function declareETransport(deliveryId: string): Promise<DeliveryRecord> {
  const supabase = await createClient();
  const detail = await getDeliveryDetail(deliveryId);
  if (!detail) throw new DeliveryNotFoundError();

  if (detail.declarationStatus === "declared") {
    return detail;
  }

  const provider = getETransportProvider();

  try {
    const result = await provider.declare({
      deliveryId: detail.id,
      organizationId: detail.organizationId,
      orderNumber: detail.orderNumber,
      scheduledDate: detail.scheduledDate,
      carrierName: detail.carrierName,
      vehiclePlate: detail.vehiclePlate,
      driverName: detail.driverName,
      routeOrigin: detail.routeOrigin,
      routeDestination: detail.routeDestination,
    });

    const { data: updated, error: updateError } = await supabase
      .from("deliveries")
      .update({ uit_code: result.uit, declaration_status: "declared", declaration_error: null })
      .eq("id", deliveryId)
      .select(DELIVERY_CORE_COLUMNS)
      .single();
    if (updateError || !updated) {
      throw new Error(updateError?.message ?? "Nu am putut salva codul UIT.");
    }

    return mapDelivery(updated);
  } catch (err) {
    const message =
      err instanceof ETransportNotConfiguredError || err instanceof ETransportDeclarationError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Nu am putut declara livrarea la e-Transport.";

    const { data: failed, error: updateError } = await supabase
      .from("deliveries")
      .update({ declaration_status: "failed", declaration_error: message })
      .eq("id", deliveryId)
      .select(DELIVERY_CORE_COLUMNS)
      .single();
    if (updateError || !failed) {
      // Nu am putut nici macar salva eroarea - intoarcem eroarea originala, mai utila.
      throw new Error(message);
    }

    return mapDelivery(failed);
  }
}

/**
 * Randeaza avizul PDF (buffer) - folosit de ruta de descarcare
 * (`src/app/(admin)/livrari/[id]/aviz/route.ts`). Randare ON-DEMAND, nu stocata
 * (vezi comentariul din 0013_deliveries.sql) - mereu cu UIT-ul/statusul curent.
 */
export async function renderAvizPdfBuffer(
  delivery: DeliveryDetail,
  orgName: string,
  brandColor?: string | null,
  accentColor?: string | null,
): Promise<Buffer> {
  const element = createElement(AvizPdfDocument, {
    delivery,
    orgName,
    brandColor: brandColor ?? undefined,
    accentColor: accentColor ?? undefined,
  });
  // Cast documentat, acelasi motiv ca `certificates/service.ts#renderCertificatePdf`.
  return renderToBuffer(element as unknown as Parameters<typeof renderToBuffer>[0]);
}

/**
 * Recalculeaza ruta unei livrari EXISTENTE (buton "Recalculează", ecranul
 * /livrari/[id]) - geocodeaza din nou originea (punctul de plecare salvat pe
 * livrare) si destinatia (`route_destination`, text liber), pastreaza automat
 * varianta recomandata (`selection: "auto"`) - spre deosebire de planificarea
 * initiala, aici NU exista un pas de selectie manuala in UI (scope redus fata de
 * Etapa 4 din plan - vezi docs/plans/rute-optimizate-livrari.md).
 */
export async function recalculateDeliveryRoute(deliveryId: string): Promise<DeliveryRecord> {
  const supabase = await createClient();
  const detail = await getDeliveryDetail(deliveryId);
  if (!detail) throw new DeliveryNotFoundError();
  if (!detail.route.originSiteId) {
    throw new DeliveryValidationError(
      "Livrarea nu are un punct de plecare salvat - planific-o din nou cu un punct de plecare selectat.",
    );
  }

  const site = await getSiteById(detail.route.originSiteId);
  if (!site) throw new DeliveryValidationError("Punctul de plecare salvat nu mai există.");

  const computation = await computeRouteBetween(
    { address: site.address },
    { address: detail.routeDestination },
  );
  const bestIndex = pickBestRouteIndex(computation.routes);
  const best = computation.routes[bestIndex];
  if (!best) throw new DeliveryValidationError("Nu am putut calcula nicio rută.");

  const { data: updated, error } = await supabase
    .from("deliveries")
    .update({
      route_distance_m: best.distanceMeters,
      route_duration_s: best.durationSeconds,
      route_polyline: best.polyline,
      route_alternatives: computation.routes as unknown as Json,
      route_selected_index: bestIndex,
      route_selection: "auto",
      route_computed_at: new Date().toISOString(),
    })
    .eq("id", deliveryId)
    .select(DELIVERY_CORE_COLUMNS)
    .single();
  if (error || !updated) throw new Error(error?.message ?? "Nu am putut salva ruta recalculată.");

  return mapDelivery(updated);
}

export interface ConfirmReceiptInput {
  deliveryId: string;
  receivedByName: string;
  notes?: string | null;
}

/**
 * Confirma receptia livrarii de catre client (caracteristica #4 din scrisoarea de
 * clarificari AM - inregistrare MANUALA, nu o noua integrare). `receivedByName` e
 * text liber (nu neaparat un cont din platforma - sofer, gestionar de santier etc.).
 *
 * Dupa ce receptia e salvata cu succes, tranzitioneaza AUTOMAT comanda parinte pe
 * `delivered` (Task de legatura livrare<->status comanda - pana acum
 * `confirmDeliveryReceipt` scria DOAR in `deliveries`, lasand `orders.status`
 * dezactualizat daca livrarea era planificata). Reutilizeaza `setOrderStatus` +
 * `onOrderStatusChanged` (acelasi mecanism ca `deliverOrderAction` din
 * orders/actions.ts) in loc sa duplice logica de tranzitie/efecte secundare
 * (notificare email etc.) - nu exista RPC unic care sa scrie ambele tabele
 * intr-o singura tranzactie, asa ca sunt doua apeluri secventiale (livrarea
 * intai). Idempotent: daca statusul comenzii nu mai poate trece pe "delivered"
 * (deja `delivered`/`closed`, sau `cancelled` - desincronizare neasteptata), nu
 * facem nimic silentios - jurnalizam vizibil, dar NU aruncam mai departe:
 * receptia livrarii ramane salvata indiferent (starea ei e sursa de adevar aici,
 * la fel ca certificatul/notificarea din `onOrderStatusChanged`).
 */
export async function confirmDeliveryReceipt(input: ConfirmReceiptInput): Promise<DeliveryRecord> {
  const receivedByName = requireNonEmpty(input.receivedByName, "Numele persoanei care confirmă");

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("deliveries")
    .update({
      received_at: new Date().toISOString(),
      received_by_name: receivedByName,
      receipt_notes: input.notes?.trim() || null,
    })
    .eq("id", input.deliveryId)
    .select(DELIVERY_CORE_COLUMNS)
    .single();
  if (error || !updated) {
    throw new Error(error?.message ?? "Nu am putut salva confirmarea recepției.");
  }

  const delivery = mapDelivery(updated);

  try {
    const currentStatus = await getOrderStatus(delivery.orderId);
    if (currentStatus === "accepted") {
      const order = await setOrderStatus(delivery.orderId, "delivered");
      await onOrderStatusChanged({
        orderId: order.id,
        organizationId: delivery.organizationId,
        clientId: order.clientId,
        fromStatus: currentStatus,
        toStatus: "delivered",
      });
    } else if (currentStatus && currentStatus !== "delivered" && currentStatus !== "closed") {
      // Stare neasteptata (draft/sent/cancelled): receptia a fost confirmata pe o
      // livrare a carei comanda nu era "accepted" - desincronizare demna de
      // investigat, dar NU trebuie sa piarda confirmarea de receptie deja salvata.
      console.error(
        `[deliveries] receptie confirmata pentru livrarea ${delivery.id}, dar comanda ${delivery.orderId} e in status "${currentStatus}" (nu poate trece automat pe "delivered").`,
      );
    }
  } catch (err) {
    console.error(
      `[deliveries] nu am putut actualiza automat statusul comenzii ${delivery.orderId} la "delivered" dupa confirmarea receptiei livrarii ${delivery.id}:`,
      err,
    );
  }

  return delivery;
}
