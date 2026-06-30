"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePasswordAction } from "./actions";
import { initialAuthState } from "./form-state";

/** Folosit atat la invitatie (prima parola) cat si la resetare. */
export function SetPasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, initialAuthState);

  return (
    <div className="w-full space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Seteaza parola</h1>
        <p className="text-sm text-muted-foreground">Alege o parola pentru contul tau.</p>
      </div>
      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Parola noua</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirma parola</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Se salveaza..." : "Salveaza parola"}
        </Button>
      </form>
    </div>
  );
}
