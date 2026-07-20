/**
 * Starea formularelor de stoc (loturi + blocare/deblocare). Traieste separat de
 * `actions.ts` fiindca un fisier "use server" poate exporta doar functii async.
 */
export interface LotFormState {
  error: string | null;
  message: string | null;
}

export const initialLotFormState: LotFormState = { error: null, message: null };

export interface BlockFormState {
  error: string | null;
}

export const initialBlockFormState: BlockFormState = { error: null };
