"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import type { ClientFormState } from "./action-state";
import { lookupCuiAction } from "./actions";
import type { Client } from "./types";

export interface ClientFormProps {
  mode: "create" | "edit";
  action: (state: ClientFormState, formData: FormData) => Promise<ClientFormState>;
  initialState: ClientFormState;
  client?: Client;
}

/**
 * Formular client, refolosit la creare (`/clienti/nou`) si editare
 * (`/clienti/[id]`). La creare: camp CUI + buton "Caută" apeleaza direct
 * `lookupCuiAction` (nu e un submit de formular — e o precompletare) si umple
 * denumire/adresă/reg.com/TVA, ramanand complet editabile manual (lookup-ul
 * ANAF poate esua sau poate sa nu gaseasca firma — vezi cui-lookup.ts).
 */
export function ClientForm({ mode, action, initialState, client }: ClientFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  const [cui, setCui] = useState(client?.cui ?? "");
  const [name, setName] = useState(client?.name ?? "");
  const [regCom, setRegCom] = useState(client?.regCom ?? "");
  const [hqAddress, setHqAddress] = useState(client?.hqAddress ?? "");
  const [isVatPayer, setIsVatPayer] = useState(client?.isVatPayer ?? false);

  const [lookupPending, startLookup] = useTransition();
  const [lookupMessage, setLookupMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);

  function handleLookup() {
    if (!cui.trim()) {
      setLookupMessage({ tone: "error", text: "Introdu un CUI înainte de a căuta." });
      return;
    }
    setLookupMessage(null);
    startLookup(async () => {
      const { error, result } = await lookupCuiAction(cui);
      if (result) {
        if (result.name) setName(result.name);
        if (result.regCom) setRegCom(result.regCom);
        if (result.address) setHqAddress(result.address);
        setIsVatPayer(result.isVatPayer);
        setLookupMessage({
          tone: "success",
          text: "Date precompletate din ANAF — verifică și confirmă.",
        });
      } else {
        setLookupMessage({
          tone: "error",
          text: error ?? "Căutarea a eșuat. Poți completa datele manual.",
        });
      }
    });
  }

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {client ? <input type="hidden" name="id" value={client.id} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Identificare firmă</CardTitle>
          <CardDescription>
            {mode === "create"
              ? "Caută firma după CUI pentru precompletare, apoi confirmă datele manual."
              : "Datele de identificare ale firmei."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="CUI" required hint='Fără "RO" — se normalizează automat.'>
            {(id) => (
              <div className="flex gap-2">
                <Input
                  id={id}
                  name="cui"
                  required
                  value={cui}
                  onChange={(e) => setCui(e.target.value)}
                  placeholder="ex. 4183300"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLookup}
                  disabled={lookupPending}
                >
                  {lookupPending ? "Se caută..." : "Caută"}
                </Button>
              </div>
            )}
          </FormField>

          {lookupMessage ? (
            <p className={`text-sm ${lookupMessage.tone === "error" ? "text-danger" : "text-ok"}`}>
              {lookupMessage.text}
            </p>
          ) : null}

          <FormField label="Denumire" required>
            {(id) => (
              <Input
                id={id}
                name="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nr. Registrul Comerțului">
              {(id) => (
                <Input
                  id={id}
                  name="reg_com"
                  value={regCom}
                  onChange={(e) => setRegCom(e.target.value)}
                />
              )}
            </FormField>
            <FormField label="Adresă sediu">
              {(id) => (
                <Input
                  id={id}
                  name="hq_address"
                  value={hqAddress}
                  onChange={(e) => setHqAddress(e.target.value)}
                />
              )}
            </FormField>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="is_vat_payer"
              checked={isVatPayer}
              onChange={(e) => setIsVatPayer(e.target.checked)}
              className="size-4 rounded border-input"
            />
            Plătitor de TVA
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Email">
              {(id) => (
                <Input id={id} name="email" type="email" defaultValue={client?.email ?? ""} />
              )}
            </FormField>
            <FormField label="Telefon">
              {(id) => <Input id={id} name="phone" defaultValue={client?.phone ?? ""} />}
            </FormField>
          </div>
          <FormField label="Persoană de contact">
            {(id) => (
              <Input id={id} name="contact_person" defaultValue={client?.contactPerson ?? ""} />
            )}
          </FormField>
          <FormField label="Note">
            {(id) => <Input id={id} name="notes" defaultValue={client?.notes ?? ""} />}
          </FormField>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="is_supplier"
              defaultChecked={client?.isSupplier ?? false}
              className="size-4 rounded border-input"
            />
            Este și furnizor (materiale/deșeuri)
          </label>
        </CardContent>
      </Card>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Se salvează..."
            : mode === "create"
              ? "Creează clientul"
              : "Salvează modificările"}
        </Button>
      </div>
    </form>
  );
}
