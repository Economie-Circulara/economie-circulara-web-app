// Separat de `site-actions.ts` ("use server"): un fisier cu directiva "use server"
// poate exporta DOAR functii async - vezi nota identica in
// `src/features/deliveries/action-state.ts`.

export interface SiteFormState {
  error: string | null;
}

export const initialSiteFormState: SiteFormState = { error: null };
