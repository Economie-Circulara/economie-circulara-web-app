// Separat de `actions.ts` ("use server"): un fisier cu directiva "use server" poate
// exporta DOAR functii async - vezi nota identica in `src/features/orders/action-state.ts`.

export interface DeliveryFormState {
  error: string | null;
}

export const initialDeliveryFormState: DeliveryFormState = { error: null };

/** Formularul „Editează transportul” (/livrari/[id], 0057). */
export interface DeliveryTransportState {
  error: string | null;
  message: string | null;
}

export const initialDeliveryTransportState: DeliveryTransportState = {
  error: null,
  message: null,
};
