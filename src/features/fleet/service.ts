import { createClient } from "@/lib/supabase/server";
import { FUEL_ENTRY_COLUMNS, VEHICLE_COLUMNS, mapFuelEntry, mapVehicle } from "./queries";
import type { FuelEntry, FuelEntryInput, FuelReceipt, Vehicle, VehicleInput } from "./types";

// Codul Postgres pentru violare de UNIQUE (`vehicles_plate_unique`).
const ERR_UNIQUE_VIOLATION = "23505";

export class FleetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FleetValidationError";
  }
}

function vehicleRow(input: VehicleInput) {
  return {
    name: input.name,
    plate: input.plate,
    vehicle_type: input.vehicleType,
    fuel_type: input.fuelType,
    consumption_l_per_100km: input.consumptionLPer100km,
    capacity: input.capacity,
    capacity_unit: input.capacityUnit,
    default_driver_name: input.defaultDriverName,
    notes: input.notes,
  };
}

function vehicleWriteError(
  error: { code?: string; message?: string },
  plate: string | null,
): Error {
  if (error.code === ERR_UNIQUE_VIOLATION && plate) {
    return new FleetValidationError(`Numărul de înmatriculare ${plate} există deja în flotă.`);
  }
  return new Error("Nu am putut salva vehiculul.");
}

export async function createVehicle(
  organizationId: string,
  createdBy: string,
  input: VehicleInput,
): Promise<Vehicle> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .insert({ organization_id: organizationId, created_by: createdBy, ...vehicleRow(input) })
    .select(VEHICLE_COLUMNS)
    .single();
  if (error || !data) throw vehicleWriteError(error ?? {}, input.plate);
  return mapVehicle(data);
}

export async function updateVehicle(id: string, input: VehicleInput): Promise<Vehicle> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .update(vehicleRow(input))
    .eq("id", id)
    .select(VEHICLE_COLUMNS)
    .single();
  if (error || !data) throw vehicleWriteError(error ?? {}, input.plate);
  return mapVehicle(data);
}

/** Arhivare reversibila (`archived_by` il stampileaza triggerul din 0056). */
export async function setVehicleArchived(id: string, archived: boolean): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) throw new Error("Nu am putut actualiza vehiculul.");
}

/**
 * Vehiculul ales pe o alimentare trebuie sa fie ACTIV (pickerul ascunde arhivatele;
 * aici e garda pentru un formular vechi sau o cerere construita de mana). La editare,
 * o alimentare veche isi poate pastra vehiculul chiar daca intre timp a fost arhivat.
 */
async function assertVehicleUsable(vehicleId: string, keepVehicleId?: string): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vehicles")
    .select("id, archived_at")
    .eq("id", vehicleId)
    .maybeSingle();
  if (!data) throw new FleetValidationError("Vehiculul ales nu există.");
  if (data.archived_at && vehicleId !== keepVehicleId) {
    throw new FleetValidationError("Vehiculul ales este arhivat.");
  }
}

function fuelEntryRow(input: FuelEntryInput) {
  return {
    vehicle_id: input.vehicleId,
    filled_on: input.filledOn,
    liters: input.liters,
    amount: input.amount,
    odometer_km: input.odometerKm,
    station: input.station,
    notes: input.notes,
  };
}

function receiptRow(receipt: FuelReceipt | null) {
  return {
    receipt_path: receipt?.path ?? null,
    receipt_file_name: receipt?.fileName ?? null,
    receipt_mime_type: receipt?.mimeType ?? null,
  };
}

export async function createFuelEntry(
  organizationId: string,
  input: FuelEntryInput,
  receipt: FuelReceipt | null,
): Promise<FuelEntry> {
  await assertVehicleUsable(input.vehicleId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fuel_entries")
    .insert({ organization_id: organizationId, ...fuelEntryRow(input), ...receiptRow(receipt) })
    .select(FUEL_ENTRY_COLUMNS)
    .single();
  if (error || !data) throw new Error("Nu am putut salva alimentarea.");
  return mapFuelEntry(data);
}

/**
 * Corecteaza o alimentare (nu se sterg - decizie 2026-10-10). `receipt`: `undefined` =
 * bonul ramane neschimbat, `null` = bonul e scos, altfel bonul nou.
 */
export async function updateFuelEntry(
  id: string,
  previousVehicleId: string,
  input: FuelEntryInput,
  receipt: FuelReceipt | null | undefined,
): Promise<FuelEntry> {
  await assertVehicleUsable(input.vehicleId, previousVehicleId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fuel_entries")
    .update({ ...fuelEntryRow(input), ...(receipt === undefined ? {} : receiptRow(receipt)) })
    .eq("id", id)
    .select(FUEL_ENTRY_COLUMNS)
    .single();
  if (error || !data) throw new Error("Nu am putut salva alimentarea.");
  return mapFuelEntry(data);
}
