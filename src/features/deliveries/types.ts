import type { Database } from "@/lib/database.types";

export type DeliveryDeclarationStatus = Database["public"]["Enums"]["delivery_declaration_status"];

/** O linie de produs a livrarii (preluata din liniile comenzii — vezi AGENTS.md §4: fara livrari partiale). */
export interface DeliveryItemLine {
  itemId: string;
  itemTitle: string;
  unit: string;
  quantity: number;
}

/** Randul brut `deliveries`, in stilul camelCase folosit in tot restul aplicatiei. */
export interface DeliveryRecord {
  id: string;
  organizationId: string;
  orderId: string;
  scheduledDate: string;
  carrierName: string;
  vehiclePlate: string;
  driverName: string;
  routeOrigin: string;
  routeDestination: string;
  uitCode: string | null;
  declarationStatus: DeliveryDeclarationStatus;
  declarationError: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `DeliveryRecord` + datele comenzii/clientului necesare pt. ecranul de detaliu si avizul PDF. */
export interface DeliveryDetail extends DeliveryRecord {
  orderNumber: string | null;
  clientName: string;
  clientCui: string;
  items: DeliveryItemLine[];
}

/** Rand in lista `/livrari` — subset suficient pt. tabel. */
export interface DeliveryListRow {
  id: string;
  orderId: string;
  orderNumber: string | null;
  clientName: string;
  scheduledDate: string;
  carrierName: string;
  vehiclePlate: string;
  declarationStatus: DeliveryDeclarationStatus;
  uitCode: string | null;
}

/** Input-ul formularului de planificare livrare (ecranul /livrari/nou). */
export interface PlanDeliveryInput {
  orderId: string;
  scheduledDate: string;
  carrierName: string;
  vehiclePlate: string;
  driverName: string;
  routeOrigin: string;
  routeDestination: string;
  /** Userul care planifica livrarea (ca `orders.created_by`/`documents.uploaded_by`). */
  createdBy?: string | null;
}
