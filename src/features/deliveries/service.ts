import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
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
  if (!trimmed) throw new DeliveryValidationError(`Câmpul „${field}” este obligatoriu.`);
  return trimmed;
}

/**
 * Planifica o livrare noua pt. o comanda ACCEPTATA: valideaza campurile + statusul
 * comenzii + absenta unei livrari existente (unique(order_id) — o comanda are cel
 * mult o livrare, AGENTS.md §4 "fara livrari partiale"), apoi insereaza randul.
 * Nu foloseste RPC dedicat (spre deosebire de `accept_return_order`): un singur
 * insert, fara efecte secundare pe alte tabele — RLS (`deliveries_staff_all`,
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
    })
    .select(DELIVERY_CORE_COLUMNS)
    .single();
  if (insertError || !inserted) {
    // unique(order_id) — o cursa cu alt request care a planificat intre timp aceeasi comanda.
    throw new DeliveryValidationError(
      insertError?.message ?? "Nu am putut planifica livrarea (posibil deja planificată).",
    );
  }

  return mapDelivery(inserted);
}

/**
 * Declara (sau RE-incearca) declararea e-Transport a unei livrari: apeleaza
 * adapterul activ (`e-transport.ts#getETransportProvider` — mock/sandbox implicit,
 * Socrate.io cand vor exista credentiale S4) si salveaza rezultatul.
 *
 * IDEMPOTENT pe succes: daca livrarea e deja `declared`, o intoarce neschimbata,
 * fara sa mai apeleze providerul (evita costuri/duplicate la un re-click accidental).
 * Pe eroare (`not_declared` sau retry dupa `failed`): salveaza `declaration_status =
 * 'failed'` + mesajul in `declaration_error`, ca eroarea sa fie VIZIBILA in UI si
 * RE-INCERCABILA (chemarea urmatoare a acestei functii incearca din nou) — nu
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
      // Nu am putut nici macar salva eroarea — intoarcem eroarea originala, mai utila.
      throw new Error(message);
    }

    return mapDelivery(failed);
  }
}

/**
 * Randeaza avizul PDF (buffer) — folosit de ruta de descarcare
 * (`src/app/(admin)/livrari/[id]/aviz/route.ts`). Randare ON-DEMAND, nu stocata
 * (vezi comentariul din 0013_deliveries.sql) — mereu cu UIT-ul/statusul curent.
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
