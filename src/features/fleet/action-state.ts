// Separat de `actions.ts` ("use server" poate exporta doar functii async) - vezi
// src/features/items/action-state.ts.

export interface FleetFormState {
  error: string | null;
  message: string | null;
}

export const initialFleetFormState: FleetFormState = { error: null, message: null };
