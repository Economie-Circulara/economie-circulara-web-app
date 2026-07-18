import type { Database } from "@/lib/database.types";

export type UnitOfMeasure = Database["public"]["Enums"]["unit_of_measure"];

/** O componentă a rețetei (alt item + procent). */
export interface RecipeComponent {
  id: string;
  componentItemId: string;
  componentItemTitle: string;
  unit: UnitOfMeasure;
  percentage: number;
}

/** Rand agregat din lista /retete: itemul + nr. componente + suma procentelor. */
export interface RecipeListRow {
  recipeId: string;
  itemId: string;
  itemTitle: string;
  unit: UnitOfMeasure;
  componentCount: number;
  percentageSum: number;
}

/** Rețeta unui item, cu toate componentele — ecranul /retete/[itemId]. */
export interface RecipeDetail {
  recipeId: string;
  itemId: string;
  itemTitle: string;
  unit: UnitOfMeasure;
  components: RecipeComponent[];
  percentageSum: number;
}

/** Optiune de item fizic, pentru select-urile din formulare (item tinta / componentă). */
export interface RecipeItemOption {
  id: string;
  title: string;
  unit: UnitOfMeasure;
}
