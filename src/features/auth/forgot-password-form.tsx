"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAction } from "./actions";
import { initialAuthState } from "./form-state";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initialAuthState);

  return (
    <div className="w-full space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Resetare parola</h1>
        <p className="text-sm text-muted-foreground">
          Iti trimitem un link pentru a-ti seta o parola noua.
        </p>
      </div>
      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        {state.message ? <p className="text-sm text-primary">{state.message}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Se trimite..." : "Trimite link-ul"}
        </Button>
      </form>
      <p className="text-center text-sm">
        <Link href="/login" className="text-muted-foreground underline-offset-4 hover:underline">
          Inapoi la autentificare
        </Link>
      </p>
    </div>
  );
}
