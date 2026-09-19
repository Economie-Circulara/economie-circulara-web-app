import type { Client, ClientAddress } from "@/features/clients/types";
import type { ItemOption } from "@/features/items/types";
import type { OrderType } from "@/features/orders/types";

/**
 * Cardul de confirmare (docs/plans/asistent-contract-capabilitati.md) - doi
 * randere, nu unul generic pentru orice: `"generic"` acopera orice tool cu campuri
 * plate (text/boolean, eventual doar-afisare), `"order_draft"` e singurul care are
 * nevoie STRUCTURAL de o lista de linii cu add/remove + selectii cascadate
 * client -> adresa (reutilizeaza `OrderEditor`, ca la /comenzi/nou).
 */
export type CardPresentation = GenericPresentation | OrderDraftPresentation;

export interface PresentationField {
  name: string;
  label: string;
  /** Valoare de afisat - REZOLVATA (denumire/CUI/numar comanda), nu ID brut. */
  displayValue: string;
  /** false = doar informativ (ex. un ID rezolvat la o eticheta) - nu devine input. */
  editable: boolean;
  kind: "text" | "boolean";
  /** Valoarea tipata curenta - `defaultValue`/`defaultChecked` al inputului editabil. */
  value?: string | boolean;
}

export interface GenericPresentation {
  renderer: "generic";
  fields: PresentationField[];
}

/** Starea editabila a unui draft de comanda - acelasi shape in `/comenzi/nou` si card. */
export interface OrderDraftValue {
  /** Tipul comenzii (migrarea 0030). Asistentul propune `material` daca nu s-a cerut altceva. */
  orderType: OrderType;
  clientId: string;
  deliveryAddressId: string;
  deliveryDate: string;
  /** Data estimata de retur - relevanta doar pentru `orderType === "serviciu"`. */
  expectedReturnDate: string;
  notes: string;
  lines: { itemId: string; quantity: number }[];
}

/** Optiunile disponibile pentru editor - identic cu ce incarca azi `/comenzi/nou`. */
export interface OrderDraftOptions {
  clients: Client[];
  addressesByClient: Record<string, ClientAddress[]>;
  itemOptions: ItemOption[];
}

export interface OrderDraftPresentation {
  renderer: "order_draft";
  draft: OrderDraftValue;
  options: OrderDraftOptions;
}
