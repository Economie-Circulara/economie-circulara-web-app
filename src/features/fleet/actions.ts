"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/features/auth/session";
import { requireModule } from "@/features/modules/guard";
import type { FleetFormState } from "./action-state";
import { todayInRomania } from "./dates";
import { getFuelEntry } from "./queries";
import { removeFuelReceipt, uploadFuelReceipt } from "./receipt-storage";
import {
  FleetValidationError,
  createFuelEntry,
  createVehicle,
  setVehicleArchived,
  updateFuelEntry,
  updateVehicle,
} from "./service";
import type { FuelReceipt } from "./types";
import { parseFuelEntryForm, parseVehicleForm } from "./validation";

/** Garda modulului: staff (admin + operator) SI modulul `fleet` activ (altfel 404). */
async function requireFleetStaff() {
  const user = await requireRole(["admin", "operator"]);
  await requireModule("fleet");
  if (!user.organizationId) throw new Error("Utilizatorul nu aparține unei organizații.");
  return { ...user, organizationId: user.organizationId };
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof FleetValidationError || err instanceof Error ? err.message : fallback;
}

function revalidateFleet(vehicleId?: string) {
  revalidatePath("/flota");
  revalidatePath("/flota/alimentari");
  if (vehicleId) revalidatePath(`/flota/${vehicleId}`);
}

/** Doar o ruta interna a flotei (evita redirect deschis prin campul ascuns). */
function safeReturnTo(raw: FormDataEntryValue | null, fallback: string): string {
  const value = String(raw ?? "");
  return /^\/flota(\/[\w-]+)*$/.test(value) ? value : fallback;
}

function receiptFile(formData: FormData): File | null {
  const file = formData.get("receipt");
  return file instanceof File && file.size > 0 ? file : null;
}

export async function createVehicleAction(
  _prev: FleetFormState,
  formData: FormData,
): Promise<FleetFormState> {
  const user = await requireFleetStaff();
  const parsed = parseVehicleForm(formData);
  if (!parsed.ok) return { error: parsed.error, message: null };

  let id: string;
  try {
    id = (await createVehicle(user.organizationId, user.id, parsed.value)).id;
  } catch (err) {
    return { error: errorMessage(err, "Nu am putut salva vehiculul."), message: null };
  }
  revalidateFleet();
  redirect(`/flota/${id}`);
}

export async function updateVehicleAction(
  _prev: FleetFormState,
  formData: FormData,
): Promise<FleetFormState> {
  await requireFleetStaff();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Vehicul invalid.", message: null };
  const parsed = parseVehicleForm(formData);
  if (!parsed.ok) return { error: parsed.error, message: null };

  try {
    await updateVehicle(id, parsed.value);
  } catch (err) {
    return { error: errorMessage(err, "Nu am putut salva vehiculul."), message: null };
  }
  revalidateFleet(id);
  return { error: null, message: "Vehiculul a fost salvat." };
}

export interface ArchiveVehicleResult {
  error: string | null;
}

async function toggleVehicleArchived(id: string, archived: boolean): Promise<ArchiveVehicleResult> {
  await requireFleetStaff();
  try {
    await setVehicleArchived(id, archived);
  } catch (err) {
    return { error: errorMessage(err, "Nu am putut actualiza vehiculul.") };
  }
  revalidateFleet(id);
  return { error: null };
}

/** Legat cu `.bind(null, id)` si apelat din `ConfirmActionButton`. */
export async function archiveVehicleAction(id: string): Promise<ArchiveVehicleResult> {
  return toggleVehicleArchived(id, true);
}

export async function restoreVehicleAction(id: string): Promise<ArchiveVehicleResult> {
  return toggleVehicleArchived(id, false);
}

export async function createFuelEntryAction(
  _prev: FleetFormState,
  formData: FormData,
): Promise<FleetFormState> {
  const user = await requireFleetStaff();
  const parsed = parseFuelEntryForm(formData, todayInRomania(), { requireOdometer: true });
  if (!parsed.ok) return { error: parsed.error, message: null };

  const file = receiptFile(formData);
  let receipt: FuelReceipt | null = null;
  try {
    if (file) receipt = await uploadFuelReceipt(user.organizationId, file);
    await createFuelEntry(user.organizationId, parsed.value, receipt);
  } catch (err) {
    if (receipt) await removeFuelReceipt(receipt.path);
    return { error: errorMessage(err, "Nu am putut salva alimentarea."), message: null };
  }
  revalidateFleet(parsed.value.vehicleId);
  redirect(safeReturnTo(formData.get("return_to"), "/flota/alimentari"));
}

export async function updateFuelEntryAction(
  _prev: FleetFormState,
  formData: FormData,
): Promise<FleetFormState> {
  const user = await requireFleetStaff();
  const id = String(formData.get("id") ?? "");
  const existing = id ? await getFuelEntry(id) : null;
  if (!existing) return { error: "Alimentarea nu există.", message: null };

  // O alimentare care avea kilometraj nu il mai poate pierde la corectare; cele vechi,
  // introduse fara el, se pot corecta si asa.
  const parsed = parseFuelEntryForm(formData, todayInRomania(), {
    requireOdometer: existing.odometerKm !== null,
  });
  if (!parsed.ok) return { error: parsed.error, message: null };

  // Bonul: fisier nou -> inlocuieste; bifa "scoate bonul" -> null; altfel neschimbat.
  const file = receiptFile(formData);
  const removeReceipt = formData.get("remove_receipt") === "on";
  let receipt: FuelReceipt | null | undefined;
  try {
    if (file) receipt = await uploadFuelReceipt(user.organizationId, file);
    else if (removeReceipt) receipt = null;
    await updateFuelEntry(id, existing.vehicleId, parsed.value, receipt);
  } catch (err) {
    if (receipt) await removeFuelReceipt(receipt.path);
    return { error: errorMessage(err, "Nu am putut salva alimentarea."), message: null };
  }
  if (receipt !== undefined && existing.receipt) await removeFuelReceipt(existing.receipt.path);

  revalidateFleet(parsed.value.vehicleId);
  if (existing.vehicleId !== parsed.value.vehicleId) revalidatePath(`/flota/${existing.vehicleId}`);
  revalidatePath(`/flota/alimentari/${id}`);
  return { error: null, message: "Alimentarea a fost salvată." };
}
