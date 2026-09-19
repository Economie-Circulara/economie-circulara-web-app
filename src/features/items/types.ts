import type { Database } from "@/lib/database.types";

export type ItemKind = Database["public"]["Enums"]["item_kind"];
export type UnitOfMeasure = Database["public"]["Enums"]["unit_of_measure"];

/** Un item din catalog, asa cum e afisat/editat in ecranele /itemi. */
export interface Item {
  id: string;
  title: string;
  description: string | null;
  unit: UnitOfMeasure;
  kind: ItemKind;
  /**
   * Doar pentru `kind = 'physical'` (migrarea 0029): `false` = material generic,
   * fara cantitate limitata (apa, aer) - nu se consuma/scade din stoc si nu
   * participa la consumul FIFO. Itemii `service` au mereu `true` (irelevant - ei
   * sunt sariti oricum, pe ramura de `kind`).
   */
  isTracked: boolean;
  sellable: boolean;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Rand din lista /itemi - itemul + daca are reteta definita. */
export interface ItemListRow extends Item {
  hasRecipe: boolean;
}

/** Optiune simpla de item, pentru select-uri (stoc, retete). */
export interface ItemOption {
  id: string;
  title: string;
  unit: UnitOfMeasure;
  kind: ItemKind;
  /** Vezi `Item.isTracked` - wizard-urile de productie sar itemii netrasati de la FIFO. */
  isTracked: boolean;
}
