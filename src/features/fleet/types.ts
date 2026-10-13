export type CapacityUnit = "t" | "mc" | "kg" | "l";

/** Un vehicul din flota proprie (`vehicles`, migrarea 0056). */
export interface Vehicle {
  id: string;
  name: string;
  plate: string | null;
  vehicleType: string | null;
  fuelType: string | null;
  /** Consumul mediu declarat, litri / 100 km. */
  consumptionLPer100km: number;
  capacity: number | null;
  capacityUnit: CapacityUnit | null;
  defaultDriverName: string | null;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Datele editabile ale unui vehicul (formular / asistent). */
export interface VehicleInput {
  name: string;
  plate: string | null;
  vehicleType: string | null;
  fuelType: string | null;
  consumptionLPer100km: number;
  capacity: number | null;
  capacityUnit: CapacityUnit | null;
  defaultDriverName: string | null;
  notes: string | null;
}

/** Bonul atasat unei alimentari (obiect in bucketul privat `fleet-receipts`). */
export interface FuelReceipt {
  path: string;
  fileName: string;
  mimeType: string;
}

/** O alimentare din jurnal (`fuel_entries`, migrarea 0056). */
export interface FuelEntry {
  id: string;
  vehicleId: string;
  vehicleName: string;
  vehiclePlate: string | null;
  filledOn: string;
  liters: number;
  /** Suma platita (lei) - optionala. */
  amount: number | null;
  odometerKm: number | null;
  station: string | null;
  notes: string | null;
  receipt: FuelReceipt | null;
  createdAt: string;
  updatedAt: string;
}

/** Datele editabile ale unei alimentari. */
export interface FuelEntryInput {
  vehicleId: string;
  filledOn: string;
  liters: number;
  amount: number | null;
  odometerKm: number | null;
  station: string | null;
  notes: string | null;
}

/** Totalurile unei liste de alimentari (pagina vehiculului, jurnal). */
export interface FuelSummary {
  count: number;
  liters: number;
  /** Suma doar pe alimentarile cu suma completata. */
  amount: number;
  /** Cate alimentari au suma completata (ca totalul de lei sa nu para complet cand nu e). */
  amountCount: number;
  lastFilledOn: string | null;
}
