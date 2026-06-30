/** Starea partajata a formularelor de auth (server actions + useActionState). */
export interface AuthState {
  error: string | null;
  message: string | null;
}

export const initialAuthState: AuthState = { error: null, message: null };
