"use client";

import { useActionState, useState } from "react";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LAYOUTS, LAYOUT_KEYS, resolveLayoutKey } from "@/features/branding/layouts";
import { THEMES, THEME_KEYS, resolveThemeKey, type ThemeKey } from "@/features/branding/themes";
import { cn } from "@/lib/utils";
import { updateOrganizationAppearanceAction } from "./actions";
import { initialOrgAppearanceState } from "./form-state";

/**
 * Previzualizare miniaturala a unei teme: e randata chiar cu `data-theme`, deci
 * foloseste CSS-ul real al temei (culori, font, colturi, pattern, sidebar).
 */
function ThemePreview({ themeKey }: { themeKey: ThemeKey }) {
  return (
    <div
      data-theme={themeKey}
      aria-hidden="true"
      className="flex h-24 overflow-hidden rounded-lg border bg-background text-foreground"
    >
      <div className="app-sidebar flex w-16 flex-col gap-1.5 border-r p-2">
        <span className="h-2 w-8 rounded-sm bg-foreground/60" />
        <span className="h-3 rounded-sm bg-primary" />
        <span className="h-2 w-9 rounded-sm bg-muted-foreground/50" />
        <span className="h-2 w-7 rounded-sm bg-muted-foreground/50" />
      </div>
      <div className="bg-pattern flex flex-1 flex-col gap-2 p-2.5">
        <span className="text-xs font-semibold">Comenzi</span>
        <div className="flex gap-1.5">
          <span className="h-8 flex-1 rounded-md border bg-card" />
          <span className="h-8 flex-1 rounded-md border bg-card" />
        </div>
        <div className="flex gap-1.5">
          <span className="h-3 w-10 rounded-md bg-primary" />
          <span className="h-3 w-6 rounded-md bg-accent" />
        </div>
      </div>
    </div>
  );
}

export interface OrgAppearanceFormProps {
  organizationId: string;
  theme: string;
  layout: string;
  customDomain: string | null;
}

/** Tema vizuala + domeniul propriu ale unei organizatii (doar super-admin). */
export function OrgAppearanceForm({
  organizationId,
  theme,
  layout,
  customDomain,
}: OrgAppearanceFormProps) {
  const [state, action, pending] = useActionState(
    updateOrganizationAppearanceAction,
    initialOrgAppearanceState,
  );
  const [selected, setSelected] = useState<ThemeKey>(resolveThemeKey(theme));

  return (
    <form action={action} className="max-w-3xl space-y-6">
      <input type="hidden" name="organization_id" value={organizationId} />

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Tema vizuala</legend>
        <p className="text-sm text-muted-foreground">
          Aspectul aplicatiei pentru toti userii organizatiei: culori, font, colturi, fundal, meniu
          lateral si ecranul de autentificare. Tema are prioritate: culorile din setarile
          organizatiei se aplica doar pe tema Clasic (pe celelalte, adminul organizatiei nu le mai
          poate schimba).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {THEME_KEYS.map((key) => {
            const def = THEMES[key];
            const checked = selected === key;
            return (
              <label
                key={key}
                className={cn(
                  "cursor-pointer space-y-2 rounded-lg border bg-card p-3 transition-colors",
                  checked ? "border-primary ring-2 ring-ring" : "hover:border-foreground/30",
                )}
              >
                <input
                  type="radio"
                  name="theme"
                  value={key}
                  checked={checked}
                  onChange={() => setSelected(key)}
                  className="sr-only"
                />
                <ThemePreview themeKey={key} />
                <span className="block text-sm font-semibold">{def.label}</span>
                <span className="block text-xs text-muted-foreground">{def.description}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Organizare</legend>
        <p className="text-sm text-muted-foreground">
          Gruparea meniului si aranjamentul panoului de control. Paginile si drepturile raman
          aceleasi - se schimba doar prezentarea.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {LAYOUT_KEYS.map((key) => (
            <label
              key={key}
              className="flex cursor-pointer gap-3 rounded-lg border bg-card p-3 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-ring"
            >
              <input
                type="radio"
                name="layout"
                value={key}
                defaultChecked={resolveLayoutKey(layout) === key}
                className="mt-1"
              />
              <span className="space-y-1">
                <span className="block text-sm font-semibold">{LAYOUTS[key].label}</span>
                <span className="block text-xs text-muted-foreground">
                  {LAYOUTS[key].description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <FormField
        label="Domeniu propriu"
        hint="Doar hostul, ex. app.firma.ro. Inainte de salvare: CNAME catre Vercel, domeniul adaugat in Vercel si in Redirect URLs din Supabase (docs/setup.md, 3.1) - altfel userii organizatiei sunt trimisi pe un domeniu care nu raspunde. Gol = domeniul platformei."
      >
        {(id) => (
          <Input
            id={id}
            name="custom_domain"
            defaultValue={customDomain ?? ""}
            placeholder="app.firma.ro"
          />
        )}
      </FormField>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-ok">{state.message}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Se salveaza..." : "Salveaza"}
      </Button>
    </form>
  );
}
