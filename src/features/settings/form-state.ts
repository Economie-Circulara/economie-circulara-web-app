/**
 * Starea formularelor de setari (branding organizatie + management utilizatori). Traieste
 * separat de `actions.ts` / `user-actions.ts` fiindca un fisier "use server" poate exporta
 * doar functii async, nu si obiecte (starile initiale).
 */
export interface SettingsState {
  error: string | null;
  message: string | null;
}

export const initialSettingsState: SettingsState = { error: null, message: null };

export interface UserMgmtState {
  error: string | null;
  message: string | null;
}

export const initialUserMgmtState: UserMgmtState = { error: null, message: null };
