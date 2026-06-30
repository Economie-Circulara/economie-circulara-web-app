"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  signInWithGoogleAction,
  signInWithMagicLinkAction,
  signInWithPasswordAction,
} from "./actions";
import { initialAuthState } from "./form-state";

export interface LoginFormProps {
  orgName: string;
  logoUrl?: string;
}

export function LoginForm({ orgName, logoUrl }: LoginFormProps) {
  const [pwState, pwAction, pwPending] = useActionState(signInWithPasswordAction, initialAuthState);
  const [linkState, linkAction, linkPending] = useActionState(
    signInWithMagicLinkAction,
    initialAuthState,
  );

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="flex flex-col items-center gap-3 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logoUrl ? <img src={logoUrl} alt={orgName} className="h-12 w-auto" /> : null}
        <h1 className="text-2xl font-semibold tracking-tight">{orgName}</h1>
        <p className="text-sm text-muted-foreground">Autentifica-te pentru a continua.</p>
      </div>

      {/* Email + parola */}
      <form action={pwAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Parola</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Ai uitat parola?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {pwState.error ? <p className="text-sm text-destructive">{pwState.error}</p> : null}
        <Button type="submit" className="w-full" disabled={pwPending}>
          {pwPending ? "Se conecteaza..." : "Conectare"}
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">sau</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* Google */}
      <form action={signInWithGoogleAction}>
        <Button type="submit" variant="outline" className="w-full">
          Continua cu Google
        </Button>
      </form>

      {/* Magic link */}
      <form action={linkAction} className="space-y-2">
        <Label htmlFor="magic-email" className="text-xs text-muted-foreground">
          Sau primeste un link pe email
        </Label>
        <div className="flex gap-2">
          <Input id="magic-email" name="email" type="email" placeholder="email@firma.ro" required />
          <Button type="submit" variant="accent" disabled={linkPending}>
            {linkPending ? "..." : "Trimite"}
          </Button>
        </div>
        {linkState.error ? <p className="text-sm text-destructive">{linkState.error}</p> : null}
        {linkState.message ? <p className="text-sm text-primary">{linkState.message}</p> : null}
      </form>
    </div>
  );
}
