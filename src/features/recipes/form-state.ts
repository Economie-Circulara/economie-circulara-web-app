/**
 * Starea formularelor de rețete (server actions + useActionState). Traieste separat de
 * `actions.ts` fiindca un fisier "use server" poate exporta doar functii async.
 */
export interface RecipeFormState {
  error: string | null;
}

export const initialRecipeFormState: RecipeFormState = { error: null };
