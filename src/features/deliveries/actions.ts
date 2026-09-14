"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/features/auth/session";
import type { DeliveryFormState } from "./action-state";
import {
  DeliveryNotFoundError,
  DeliveryOrderNotFoundError,
  DeliveryValidationError,
  confirmDeliveryReceipt,
  declareETransport,
  planDelivery,
  recalculateDeliveryRoute,
} from "./service";
import type { DeliveryRecord, PlanDeliveryRouteChoice } from "./types";

function clean(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

/**
 * Alegerea de ruta trimisa de `RoutePreview` (client component) ca un singur
 * camp ascuns JSON (`route_choice`) - mai simplu decat sa desfacem manual N
 * campuri primitive, iar continutul e needitabil de utilizator (populat exclusiv
 * de handler-ul JS al butonului "Calculează rute"/selectiei de ruta).
 */
function readRouteChoice(formData: FormData): PlanDeliveryRouteChoice | null {
  const raw = formData.get("route_choice");
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return JSON.parse(raw) as PlanDeliveryRouteChoice;
  } catch {
    return null;
  }
}

function errorMessage(err: unknown, fallback: string): string {
  if (
    err instanceof DeliveryValidationError ||
    err instanceof DeliveryOrderNotFoundError ||
    err instanceof DeliveryNotFoundError
  ) {
    return err.message;
  }
  return err instanceof Error ? err.message : fallback;
}

/**
 * Planifica livrarea unei comenzi ACCEPTATE (ecranul /livrari/nou) - DOAR staff.
 * Foloseste `useActionState`/`<form action=...>` (ca `createOrderAction`, Task E):
 * redirect direct la ecranul de detaliu al livrarii nou-create la succes.
 */
export async function planDeliveryAction(
  _prev: DeliveryFormState,
  formData: FormData,
): Promise<DeliveryFormState> {
  const user = await requireRole(["admin", "operator"]);

  const orderId = clean(formData.get("order_id"));
  if (!orderId) return { error: "Comanda este obligatorie." };

  let deliveryId: string;
  try {
    const delivery = await planDelivery({
      orderId,
      scheduledDate: clean(formData.get("scheduled_date")),
      carrierName: clean(formData.get("carrier_name")),
      vehiclePlate: clean(formData.get("vehicle_plate")),
      driverName: clean(formData.get("driver_name")),
      routeOrigin: clean(formData.get("route_origin")),
      routeDestination: clean(formData.get("route_destination")),
      route: readRouteChoice(formData),
      createdBy: user.id,
    });
    deliveryId = delivery.id;
  } catch (err) {
    return { error: errorMessage(err, "Nu am putut planifica livrarea.") };
  }

  revalidatePath("/livrari");
  revalidatePath(`/comenzi/${orderId}`);
  redirect(`/livrari/${deliveryId}`);
}

export interface DeclareETransportResult {
  delivery: DeliveryRecord | null;
  error: string | null;
}

/**
 * Declara (sau RE-incearca, dupa un `declaration_status = 'failed'`) declararea
 * e-Transport a unei livrari - DOAR staff. Acelasi buton din UI apeleaza aceasta
 * actiune de fiecare data (prima declarare SAU reincercare) - `service.ts` decide
 * ce se intampla in functie de statusul curent (idempotent daca deja `declared`).
 * Apelata direct din `onClick` (nu ca form action), la fel ca `ReturnActions` -
 * fara FormData de trimis, doar id-ul livrarii.
 */
export async function declareETransportAction(
  deliveryId: string,
): Promise<DeclareETransportResult> {
  await requireRole(["admin", "operator"]);

  try {
    const delivery = await declareETransport(deliveryId);
    revalidatePath(`/livrari/${deliveryId}`);
    revalidatePath("/livrari");
    return { delivery, error: null };
  } catch (err) {
    return {
      delivery: null,
      error: errorMessage(err, "Nu am putut declara livrarea la e-Transport."),
    };
  }
}

export interface RecalculateRouteResult {
  delivery: DeliveryRecord | null;
  error: string | null;
}

/**
 * Recalculeaza ruta unei livrari existente (buton "Recalculează", ecranul
 * /livrari/[id]) - DOAR staff. Apelata direct din `onClick`, ca `declareETransportAction`.
 */
export async function recalculateDeliveryRouteAction(
  deliveryId: string,
): Promise<RecalculateRouteResult> {
  await requireRole(["admin", "operator"]);

  try {
    const delivery = await recalculateDeliveryRoute(deliveryId);
    revalidatePath(`/livrari/${deliveryId}`);
    return { delivery, error: null };
  } catch (err) {
    return { delivery: null, error: errorMessage(err, "Nu am putut recalcula ruta.") };
  }
}

/**
 * Confirma receptia livrarii de catre client (caracteristica #4 din clarificarea
 * AM) - DOAR staff, inregistrare manuala (ecranul /livrari/[id]).
 */
export async function confirmDeliveryReceiptAction(
  _prev: DeliveryFormState,
  formData: FormData,
): Promise<DeliveryFormState> {
  await requireRole(["admin", "operator"]);

  const deliveryId = clean(formData.get("delivery_id"));
  const receivedByName = clean(formData.get("received_by_name"));
  if (!deliveryId) return { error: "Livrare invalidă." };
  if (!receivedByName) return { error: "Numele persoanei care confirmă este obligatoriu." };

  try {
    await confirmDeliveryReceipt({
      deliveryId,
      receivedByName,
      notes: clean(formData.get("receipt_notes")),
    });
  } catch (err) {
    return { error: errorMessage(err, "Nu am putut salva confirmarea recepției.") };
  }

  revalidatePath(`/livrari/${deliveryId}`);
  return { error: null };
}
