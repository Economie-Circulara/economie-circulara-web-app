// Separat de `actions.ts` ("use server"): un fisier cu directiva "use server" poate
// exporta DOAR functii async — vezi nota identica in `src/features/orders/action-state.ts`.

export interface DeliveryFormState {
  error: string | null;
}

export const initialDeliveryFormState: DeliveryFormState = { error: null };
