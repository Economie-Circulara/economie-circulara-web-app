"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { updateOrganizationAction } from "./actions";
import { initialSettingsState } from "./action-state";
import { THEME_PRESETS, colorPickerValue } from "./theme-presets";
import type { CurrentOrg } from "@/features/auth/queries";

export function SettingsForm({ org }: { org: CurrentOrg }) {
  const [state, action, pending] = useActionState(updateOrganizationAction, initialSettingsState);
  const [primaryColor, setPrimaryColor] = useState(org.primaryColor ?? "");
  const [secondaryColor, setSecondaryColor] = useState(org.secondaryColor ?? "");

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
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-4">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => {
                  setPrimaryColor(preset.primaryColor);
                  setSecondaryColor(preset.secondaryColor);
                }}
                className="flex h-11 items-center gap-2 rounded-md border border-border px-3 text-left text-sm font-medium transition-colors hover:bg-muted"
              >
                <span className="flex -space-x-1" aria-hidden="true">
                  <span
                    className="size-5 rounded-full border border-background"
                    style={{ backgroundColor: preset.primaryColor }}
                  />
                  <span
                    className="size-5 rounded-full border border-background"
                    style={{ backgroundColor: preset.secondaryColor }}
                  />
                </span>
                {preset.name}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Culoare principala (brand)">
              {(id) => (
                <div className="grid grid-cols-[3rem_1fr] gap-2">
                  <Input
                    aria-label="Alege culoarea principala"
                    type="color"
                    value={colorPickerValue(primaryColor, THEME_PRESETS[0].primaryColor)}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 cursor-pointer p-1"
                  />
                  <Input
                    id={id}
                    name="primary_color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#1f5e3a"
                  />
                </div>
              )}
            </FormField>
            <FormField label="Culoare accent">
              {(id) => (
                <div className="grid grid-cols-[3rem_1fr] gap-2">
                  <Input
                    aria-label="Alege culoarea accent"
                    type="color"
                    value={colorPickerValue(secondaryColor, THEME_PRESETS[0].secondaryColor)}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-10 cursor-pointer p-1"
                  />
                  <Input
                    id={id}
                    name="secondary_color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    placeholder="#c8862b"
                  />
                </div>
              )}
            </FormField>
          </div>
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
