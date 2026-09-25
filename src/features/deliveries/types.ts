import type { Database } from "@/lib/database.types";
import type { RouteChoiceView } from "@/features/routing/route-actions";

export type DeliveryDeclarationStatus = Database["public"]["Enums"]["delivery_declaration_status"];
export type RouteSelectionMode = Database["public"]["Enums"]["route_selection_mode"];

/**
 * Rezultatul planificarii optimizate a rutei (Task X7) - stocat pe `deliveries` la
 * planificare/recalculare. `null` pt. livrarile fara calcul de ruta (planificate
 * inainte de X7, sau manual, fara "Calculează rute").
 */
export interface DeliveryRouteInfo {
  originSiteId: string | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  polyline: string | null;
  /** Toate variantele calculate la ultimul calcul - vezi comentariul pe coloana din 0024_route_planning.sql. */
  alternatives: RouteChoiceView[] | null;
  selectedIndex: number | null;
  selection: RouteSelectionMode | null;
  computedAt: string | null;
}

/** Confirmarea receptiei (caracteristica #4 din clarificarea AM) - inregistrare manuala. */
export interface DeliveryReceiptInfo {
  receivedAt: string | null;
  receivedByName: string | null;
  receiptNotes: string | null;
  /** Confirmata de client din portal (0045, `client_confirm_delivery_receipt`). */
  receivedViaPortal: boolean;
}

/** O linie de produs a livrarii (preluata din liniile comenzii - vezi AGENTS.md §4: fara livrari partiale). */
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
  route: DeliveryRouteInfo;
  receipt: DeliveryReceiptInfo;
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

/** Rand in lista `/livrari` - subset suficient pt. tabel. */
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
  /** Ruta a fost calculata (nu doar text liber) - vezi Task X7. */
  hasComputedRoute: boolean;
}

/** Varianta de ruta aleasa la planificare - vine din `previewDeliveryRouteAction` (client). */
export interface PlanDeliveryRouteChoice {
  originSiteId: string;
  distanceMeters: number;
  durationSeconds: number;
  polyline: string;
  selectedIndex: number;
  selection: RouteSelectionMode;
  alternatives: RouteChoiceView[];
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
  /** Prezent doar daca operatorul a folosit "Calculează rute" - optional, planificarea manuala ramane posibila. */
  route?: PlanDeliveryRouteChoice | null;
  /** Userul care planifica livrarea (ca `orders.created_by`/`documents.uploaded_by`). */
  createdBy?: string | null;
}
