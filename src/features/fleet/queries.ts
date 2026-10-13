import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { CapacityUnit, FuelEntry, Vehicle } from "./types";

type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];
type FuelEntryRow = Database["public"]["Tables"]["fuel_entries"]["Row"];

export const VEHICLE_COLUMNS =
  "id, name, plate, vehicle_type, fuel_type, consumption_l_per_100km, capacity, capacity_unit, default_driver_name, notes, archived_at, created_at, updated_at";

export const FUEL_ENTRY_COLUMNS =
  "id, vehicle_id, filled_on, liters, amount, odometer_km, station, notes, receipt_path, receipt_file_name, receipt_mime_type, created_at, updated_at, vehicles(name, plate)";

export function mapVehicle(
  row: Pick<
    VehicleRow,
    | "id"
    | "name"
    | "plate"
    | "vehicle_type"
    | "fuel_type"
    | "consumption_l_per_100km"
    | "capacity"
    | "capacity_unit"
    | "default_driver_name"
    | "notes"
    | "archived_at"
    | "created_at"
    | "updated_at"
  >,
): Vehicle {
  return {
    id: row.id,
    name: row.name,
    plate: row.plate,
    vehicleType: row.vehicle_type,
    fuelType: row.fuel_type,
    consumptionLPer100km: Number(row.consumption_l_per_100km),
    capacity: row.capacity === null ? null : Number(row.capacity),
    capacityUnit: (row.capacity_unit as CapacityUnit | null) ?? null,
    defaultDriverName: row.default_driver_name,
    notes: row.notes,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type FuelEntryQueryRow = Pick<
  FuelEntryRow,
  | "id"
  | "vehicle_id"
  | "filled_on"
  | "liters"
  | "amount"
  | "odometer_km"
  | "station"
  | "notes"
  | "receipt_path"
  | "receipt_file_name"
  | "receipt_mime_type"
  | "created_at"
  | "updated_at"
> & { vehicles: { name: string; plate: string | null } | null };

export function mapFuelEntry(row: FuelEntryQueryRow): FuelEntry {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    vehicleName: row.vehicles?.name ?? "—",
    vehiclePlate: row.vehicles?.plate ?? null,
    filledOn: row.filled_on,
    liters: Number(row.liters),
    amount: row.amount === null ? null : Number(row.amount),
    odometerKm: row.odometer_km,
    station: row.station,
    notes: row.notes,
    receipt:
      row.receipt_path && row.receipt_file_name && row.receipt_mime_type
        ? {
            path: row.receipt_path,
            fileName: row.receipt_file_name,
            mimeType: row.receipt_mime_type,
          }
        : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Vehiculele organizatiei (RLS: staff + modulul `fleet`). Arhivatele sunt ascunse
 * implicit - `includeArchived` doar pentru ecranul de lista (pickerele NU il folosesc).
 */
export async function listVehicles(
  options: { includeArchived?: boolean } = {},
): Promise<Vehicle[]> {
  const supabase = await createClient();
  let query = supabase.from("vehicles").select(VEHICLE_COLUMNS).order("name");
  if (!options.includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query;
  if (error) throw new Error("Nu am putut încărca vehiculele.");
  return (data ?? []).map(mapVehicle);
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select(VEHICLE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Nu am putut încărca vehiculul.");
  return data ? mapVehicle(data) : null;
}

export interface FuelEntryFilters {
  vehicleId?: string;
  /** Inclusiv, `YYYY-MM-DD`. */
  from?: string;
  /** Inclusiv, `YYYY-MM-DD`. */
  to?: string;
}

/** Jurnalul de alimentari, cele mai noi primele. */
export async function listFuelEntries(filters: FuelEntryFilters = {}): Promise<FuelEntry[]> {
  const supabase = await createClient();
  let query = supabase
    .from("fuel_entries")
    .select(FUEL_ENTRY_COLUMNS)
    .order("filled_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (filters.vehicleId) query = query.eq("vehicle_id", filters.vehicleId);
  if (filters.from) query = query.gte("filled_on", filters.from);
  if (filters.to) query = query.lte("filled_on", filters.to);
  const { data, error } = await query;
  if (error) throw new Error("Nu am putut încărca alimentările.");
  return (data ?? []).map(mapFuelEntry);
}

export async function getFuelEntry(id: string): Promise<FuelEntry | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fuel_entries")
    .select(FUEL_ENTRY_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Nu am putut încărca alimentarea.");
  return data ? mapFuelEntry(data) : null;
}
