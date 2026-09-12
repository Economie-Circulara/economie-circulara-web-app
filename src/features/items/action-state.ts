// Separat de `actions.ts` ("use server"): un fisier cu directiva "use server" poate
// exporta DOAR functii async - o constanta simpla (starea initiala pt. useActionState)
// arunca la RUNTIME, la primul submit, "A 'use server' file can only export async
// functions" (GET-ul paginii merge, deci nu se vede nici la build, nici in testele
// unitare). Tipurile + valorile initiale traiesc aici, fara directiva (vezi si
// src/features/orders/action-state.ts).

export interface ItemFormState {
  error: string | null;
}

export const initialItemFormState: ItemFormState = { error: null };
