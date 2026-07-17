// Separat de `actions.ts` ("use server"): un fisier cu directiva "use server" poate
// exporta DOAR functii async — o constanta simpla (starea initiala pt. useActionState)
// declansa eroare de build Next.js ("A 'use server' file can only export async
// functions"). Tipurile + valorile initiale traiesc aici, fara directiva.

export interface DocumentActionState {
  error: string | null;
}

export const initialDocumentActionState: DocumentActionState = { error: null };
