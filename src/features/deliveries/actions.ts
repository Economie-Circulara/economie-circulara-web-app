"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/features/auth/session";
import type { DeliveryFormState } from "./action-state";
import {
  DeliveryNotFoundError,
  DeliveryOrderNotFoundError,
  DeliveryValidationError,
  declareETransport,
  planDelivery,
} from "./service";
import type { DeliveryRecord } from "./types";

function clean(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
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
 * Planifica livrarea unei comenzi ACCEPTATE (ecranul /livrari/nou) — DOAR staff.
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
 * e-Transport a unei livrari — DOAR staff. Acelasi buton din UI apeleaza aceasta
 * actiune de fiecare data (prima declarare SAU reincercare) — `service.ts` decide
 * ce se intampla in functie de statusul curent (idempotent daca deja `declared`).
 * Apelata direct din `onClick` (nu ca form action), la fel ca `ReturnActions` —
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
