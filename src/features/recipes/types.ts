import type { Database } from "@/lib/database.types";

export type UnitOfMeasure = Database["public"]["Enums"]["unit_of_measure"];

/**
 * Directia unei retete (migrarea 0028) - explicita, nu dedusa din ecranul folosit:
 * `compunere` = itemul retetei e OUTPUT-ul, componentele sunt INPUT-urile (BOM);
 * `descompunere` = itemul retetei e INPUT-ul, componentele sunt OUTPUT-urile
 * (reciclare). Ambele directii sunt suportate complet.
 */
export type RecipeDirection = Database["public"]["Enums"]["recipe_direction"];

/** O componentă a rețetei (alt item + procent + factor de conversie de UM). */
export interface RecipeComponent {
  id: string;
  componentItemId: string;
  componentItemTitle: string;
  unit: UnitOfMeasure;
  percentage: number;
  /**
   * Cate unitati din UM-ul itemului retetei corespund unei unitati din UM-ul
   * acestei componente (migrarea 0028). Ex: reteta pe kg de beton, componenta
   * nisip in mc, 1 mc ≈ 1500 kg -> 1500. Implicit 1 (UM-uri identice).
   */
  conversionFactor: number;
  /**
   * `items.is_tracked` (migrarea 0029) - `false` = material nelimitat (apa, aer):
   * nu se consuma/creeaza din stoc, deci wizard-urile de productie il sar de la
   * preview-ul FIFO.
   */
  isTracked: boolean;
}

/** Rand agregat din lista /retete: itemul + nr. componente + suma procentelor. */
export interface RecipeListRow {
  recipeId: string;
  itemId: string;
  itemTitle: string;
  unit: UnitOfMeasure;
  direction: RecipeDirection;
  componentCount: number;
  percentageSum: number;
}

/** Rețeta unui item, cu toate componentele - ecranul /retete/[itemId]. */
export interface RecipeDetail {
  recipeId: string;
  itemId: string;
  itemTitle: string;
  unit: UnitOfMeasure;
  direction: RecipeDirection;
  components: RecipeComponent[];
  percentageSum: number;
}

/** Optiune de item fizic, pentru select-urile din formulare (item tinta / componentă). */
export interface RecipeItemOption {
  id: string;
  title: string;
  unit: UnitOfMeasure;
}
