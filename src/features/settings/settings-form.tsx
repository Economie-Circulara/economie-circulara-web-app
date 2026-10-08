"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { updateOrganizationAction } from "./actions";
import { initialSettingsState } from "./action-state";
import { THEME_PRESETS, colorPickerValue } from "./theme-presets";
import { LogoUpload } from "./logo-upload";
import type { CurrentOrg } from "@/features/auth/queries";
import { themeAllowsOrgColors } from "@/features/branding/brand-colors";
import { THEMES, resolveThemeKey } from "@/features/branding/themes";

const FORM_ID = "settings-form";

export function SettingsForm({ org }: { org: CurrentOrg }) {
  const [state, action, pending] = useActionState(updateOrganizationAction, initialSettingsState);
  const [primaryColor, setPrimaryColor] = useState(org.primaryColor ?? "");
  const [secondaryColor, setSecondaryColor] = useState(org.secondaryColor ?? "");
  // Pe o tema aleasa de platforma culorile din Setari nu se aplica (tema are prioritate).
  const colorsEditable = themeAllowsOrgColors(org.theme);

  return (
    <div className="space-y-6">
      {/*
        Un singur <form id="settings-form"> ar include si LogoUpload, dar acesta
        are propriile forms interne (upload/remove), iar HTML nu permite forms
        imbricate. In loc, campul "Nume organizatie" foloseste `form={FORM_ID}`
        ca sa ramana parte din submit-ul principal desi e randat inainte de <form>.
      */}
      <Card>
        <CardHeader>
          <CardTitle>Identitate</CardTitle>
          <CardDescription>Numele si logo-urile afisate in aplicatie.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Nume organizatie" required>
            {(id) => <Input id={id} name="name" form={FORM_ID} defaultValue={org.name} required />}
          </FormField>
          <FormField label="Logo orizontal">
            {() => (
              <LogoUpload
                orgName={org.name}
                logoUrl={org.logoUrl}
                variant="inline"
                hint="Simbol + nume pe un rând. Apare în meniul lateral, pe login și pe pagina de start. PNG, JPEG, WEBP, SVG sau GIF, max 2MB; marginile albe se decupează automat."
              />
            )}
          </FormField>
          <FormField label="Logo pătrat">
            {() => (
              <LogoUpload
                orgName={org.name}
                logoUrl={org.logoSquareUrl}
                variant="square"
                hint="Simbolul (sau simbol + nume dedesubt). Apare ca iconiță în tab-ul browserului. Dacă lipsește una dintre variante, se folosește cealaltă."
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      <form id={FORM_ID} action={action} className="space-y-6">
        {colorsEditable ? (
          <Card>
            <CardHeader>
              <CardTitle>Culori (white-label)</CardTitle>
              <CardDescription>
                Valori CSS valide (ex. <code>#1f5e3a</code> sau <code>oklch(...)</code>). Se aplica
                in sidebar si pe butoane.
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
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Culori</CardTitle>
              <CardDescription>
                Aspectul aplicatiei (culori, font, meniu) e dat de tema{" "}
                <strong>{THEMES[resolveThemeKey(org.theme)].label}</strong>, aleasa de echipa
                platformei. Pentru alte culori, cere schimbarea temei la suport.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Date firmă</CardTitle>
            <CardDescription>
              Apar pe fișa de trasabilitate, ca date ale emitentului. Fără CUI, fișa nu poate fi
              folosită comercial.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="CUI">
                {(id) => (
                  <Input id={id} name="cui" defaultValue={org.cui ?? ""} placeholder="RO12345678" />
                )}
              </FormField>
              <FormField label="Nr. Registrul Comerțului">
                {(id) => (
                  <Input
                    id={id}
                    name="reg_com"
                    defaultValue={org.regCom ?? ""}
                    placeholder="J40/1234/2020"
                  />
                )}
              </FormField>
            </div>
            <FormField label="Adresă sediu">
              {(id) => (
                <Input
                  id={id}
                  name="address"
                  defaultValue={org.address ?? ""}
                  placeholder="Str. Exemplu nr. 1, București"
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
              hint="Se configureaza de echipa platformei (DNS, Vercel, autentificare) - cere-l la suport."
            >
              {(id) => <Input id={id} value={org.customDomain ?? "-"} readOnly disabled />}
            </FormField>
            <FormField
              label="Adresa expeditor email"
              hint="Emailurile pleaca de pe domeniul organizatiei dupa ce echipa platformei il verifica (DNS); pana atunci, de pe adresa platformei, cu numele organizatiei - cere-l la suport."
            >
              {(id) => (
                <Input
                  id={id}
                  value={org.emailSendingAddress ?? "adresa platformei"}
                  readOnly
                  disabled
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
              <FormField
                label="Adresa de raspuns (reply-to)"
                hint="Unde ajung raspunsurile clientilor la emailurile automate."
              >
                {(id) => (
                  <Input
                    id={id}
                    name="email_reply_to"
                    type="email"
                    defaultValue={org.emailReplyTo ?? ""}
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
    </div>
  );
}
