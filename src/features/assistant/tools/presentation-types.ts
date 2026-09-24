import type { Client, ClientAddress } from "@/features/clients/types";
import type { ItemOption } from "@/features/items/types";
import type { OrderType } from "@/features/orders/types";
import type { RecipeDirection } from "@/features/recipes/types";

/**
 * Cardul de confirmare (docs/plans/asistent-contract-capabilitati.md) - doi
 * randere, nu unul generic pentru orice: `"generic"` acopera orice tool cu campuri
 * plate (text/boolean, eventual doar-afisare), `"order_draft"` e singurul care are
 * nevoie STRUCTURAL de o lista de linii cu add/remove + selectii cascadate
 * client -> adresa (reutilizeaza `OrderEditor`, ca la /comenzi/nou).
 */
export type CardPresentation =
  | GenericPresentation
  | OrderDraftPresentation
  | RecipeDraftPresentation;

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
  /** Catalogul vandabil - liniile permise pe o comanda `material`/`serviciu`. */
  itemOptions: ItemOption[];
  /**
   * Catalogul de APORT (itemi fizici trasati, inclusiv NEVANDABILI - vezi
   * `listIntakeItemOptions`). Fara el, o comanda `aport` propusa de asistent cu un
   * item nevandabil (ex. moloz) ajungea intr-un card care nu-i stia denumirea si
   * nu-l mai putea re-adauga. Optional doar din compatibilitate cu prezentarile
   * care nu-l trimit (cad inapoi pe `itemOptions`, ca `OrderEditor`).
   */
  intakeItemOptions?: ItemOption[];
}

export interface OrderDraftPresentation {
  renderer: "order_draft";
  draft: OrderDraftValue;
  options: OrderDraftOptions;
}

/**
 * Cardul pentru `creeaza_reteta` - o lista de materii prime (item + procent) cu
 * add/remove, care n-are ce cauta intr-o lista plata de campuri (AGENTS.md §2.4).
 */
export interface RecipeDraftValue {
  direction: RecipeDirection;
  components: { itemId: string; percentage: number }[];
}

export interface RecipeDraftPresentation {
  renderer: "recipe_draft";
  /** Produsul retetei - rezolvat, nu editabil (alt produs = alta propunere). */
  itemTitle: string;
  itemUnit: string;
  draft: RecipeDraftValue;
  /** Materialele (fizice, nearhivate) care pot fi materii prime - fara produsul insusi. */
  componentOptions: { id: string; title: string; unit: string }[];
}
