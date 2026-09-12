// Separat de `actions.ts` ("use server"): un fisier cu directiva "use server" poate
// exporta DOAR functii async - o constanta simpla (starea initiala pt. useActionState)
// arunca la RUNTIME, la primul submit, "A 'use server' file can only export async
// functions" (GET-ul paginii merge, deci nu se vede nici la build, nici in testele
// unitare). Tipurile + valorile initiale traiesc aici, fara directiva (vezi si
// src/features/orders/action-state.ts).

export interface LotFormState {
  error: string | null;
  message: string | null;
}

export const initialLotFormState: LotFormState = { error: null, message: null };

export interface BlockFormState {
  error: string | null;
}

export const initialBlockFormState: BlockFormState = { error: null };
