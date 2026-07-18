// Separat de `actions.ts` ("use server"): un fisier cu directiva "use server" poate
// exporta DOAR functii async — vezi acelasi pattern in
// src/features/orders/action-state.ts / src/features/documents/action-state.ts.

export interface ClientOrderFormState {
  error: string | null;
  orderId: string | null;
}

export const initialClientOrderFormState: ClientOrderFormState = { error: null, orderId: null };
