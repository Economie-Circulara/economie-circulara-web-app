// Tipuri generate din schema Supabase. NU edita manual.
// Regenereaza cu: pnpm gen:types  (necesita stack-ul local pornit: pnpm db:start)
// Schema completa de business se adauga in T1.1; pana atunci fisierul este gol.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: { [_ in never]: never };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
