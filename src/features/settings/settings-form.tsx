"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { initialSettingsState, updateOrganizationAction } from "./actions";
import type { CurrentOrg } from "@/features/auth/queries";

export function SettingsForm({ org }: { org: CurrentOrg }) {
  const [state, action, pending] = useActionState(updateOrganizationAction, initialSettingsState);

  return (
    <form action={action} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Identitate</CardTitle>
          <CardDescription>Numele si logo-ul afisate in aplicatie.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Nume organizatie" required>
            {(id) => <Input id={id} name="name" defaultValue={org.name} required />}
          </FormField>
          <FormField label="URL logo" hint="Adresa publica a imaginii (PNG/SVG).">
            {(id) => (
              <Input
                id={id}
                name="logo_url"
                defaultValue={org.logoUrl ?? ""}
                placeholder="https://..."
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Culori (white-label)</CardTitle>
          <CardDescription>
            Valori CSS valide (ex. <code>#1f5e3a</code> sau <code>oklch(...)</code>). Se aplica in
            sidebar si pe butoane.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Culoare principala (brand)">
            {(id) => (
              <Input
                id={id}
                name="primary_color"
                defaultValue={org.primaryColor ?? ""}
                placeholder="#1f5e3a"
              />
            )}
          </FormField>
          <FormField label="Culoare accent">
            {(id) => (
              <Input
                id={id}
                name="secondary_color"
                defaultValue={org.secondaryColor ?? ""}
                placeholder="#c8862b"
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Domeniu & email</CardTitle>
          <CardDescription>Domeniu white-label si expeditorul emailurilor.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            label="Domeniu personalizat"
            hint="Ex. trace.firma.ro (configurat separat in DNS/Vercel)."
          >
            {(id) => (
              <Input
                id={id}
                name="custom_domain"
                defaultValue={org.customDomain ?? ""}
                placeholder="trace.firma.ro"
              />
            )}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nume expeditor email">
              {(id) => (
                <Input
                  id={id}
                  name="email_from_name"
                  defaultValue={org.emailFromName ?? ""}
                  placeholder="Firma SRL"
                />
              )}
            </FormField>
            <FormField label="Adresa expeditor email">
              {(id) => (
                <Input
                  id={id}
                  name="email_from_address"
                  type="email"
                  defaultValue={org.emailFromAddress ?? ""}
                  placeholder="comenzi@firma.ro"
                />
              )}
            </FormField>
          </div>
        </CardContent>
      </Card>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-primary">{state.message}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Se salveaza..." : "Salveaza setarile"}
      </Button>
    </form>
  );
}
