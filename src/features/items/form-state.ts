/**
 * Starea formularelor de itemi (server actions + useActionState). Traieste separat de
 * `actions.ts` fiindca un fisier "use server" poate exporta doar functii async.
 */
export interface ItemFormState {
  error: string | null;
}

export const initialItemFormState: ItemFormState = { error: null };
