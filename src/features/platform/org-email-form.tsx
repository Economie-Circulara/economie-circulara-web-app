"use client";

import { useActionState } from "react";
import { ConfirmActionButton, type ConfirmActionResult } from "@/components/confirm-action-button";
import { FormField } from "@/components/form-field";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  updateOrganizationEmailDomainAction,
  verifyOrganizationEmailDomainAction,
} from "./actions";
import { EMAIL_DOMAIN_STATUS_LABELS, localPartOf, type EmailDomainStatus } from "./email-domain";
import { initialOrgEmailState } from "./form-state";
import type { OrganizationEmailSettings } from "./types";

const STATUS_VARIANT: Record<EmailDomainStatus, BadgeVariant> = {
  not_configured: "neutral",
  pending: "warn",
  verified: "ok",
  failed: "danger",
};

export interface OrgEmailFormProps {
  organizationId: string;
  email: OrganizationEmailSettings;
  /** `RESEND_API_KEY` lipseste - gestionarea domeniilor nu e disponibila. */
  providerConfigured: boolean;
  /** Adresa platformei, folosita pana la verificarea domeniului. */
  platformAddress: string;
  /** `removeOrganizationEmailDomainAction.bind(null, id)` (server action legat). */
  removeAction: (reason?: string) => Promise<ConfirmActionResult | void>;
}

/**
 * Sectiunea „Email” din `/platform/<id>` (super-admin; plan
 * docs/plans/email-white-label-per-domeniu.md): domeniul de trimitere, inregistrarile
 * DNS cerute de Resend (de adaugat in Cloudflare) si verificarea lor.
 */
export function OrgEmailForm({
  organizationId,
  email,
  providerConfigured,
  platformAddress,
  removeAction,
}: OrgEmailFormProps) {
  const [saveState, saveAction, saving] = useActionState(
    updateOrganizationEmailDomainAction,
    initialOrgEmailState,
  );
  const [verifyState, verifyAction, verifying] = useActionState(
    verifyOrganizationEmailDomainAction,
    initialOrgEmailState,
  );

  const sendingFrom =
    email.status === "verified" && email.fromAddress ? email.fromAddress : platformAddress;

  return (
    <section className="max-w-3xl space-y-4 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Email</h2>
        <Badge variant={STATUS_VARIANT[email.status]}>
          {EMAIL_DOMAIN_STATUS_LABELS[email.status]}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Emailurile organizatiei (invitatii, autentificare, notificari de comenzi) folosesc logo-ul,
        tema si datele ei. Pleaca de pe domeniul ei doar dupa ce domeniul e verificat; pana atunci
        pleaca de pe <strong>{platformAddress}</strong>, cu numele organizatiei. Acum:{" "}
        <strong>{sendingFrom}</strong>
        {email.replyTo ? ` (raspunsuri catre ${email.replyTo})` : ""}.
      </p>

      {!providerConfigured ? (
        <p className="text-sm text-warn">
          Gestionarea domeniilor nu e configurata: lipseste RESEND_API_KEY (cheie Resend cu acces
          complet) in Vercel. Vezi docs/setup.md.
        </p>
      ) : null}

      <form action={saveAction} className="space-y-4">
        <input type="hidden" name="organization_id" value={organizationId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Domeniu de trimitere"
            hint="Domeniul firmei, ex. etora.ro. Inregistrarile DNS cerute sunt pe subdomenii (send, resend._domainkey) - nu afecteaza emailul existent al firmei. Gol = fara domeniu propriu."
          >
            {(id) => (
              <Input
                id={id}
                name="email_domain"
                defaultValue={email.domain ?? ""}
                placeholder="firma.ro"
              />
            )}
          </FormField>
          <FormField label="Adresa expeditorului" hint="Partea din fata lui @.">
            {(id) => (
              <div className="flex items-center gap-2">
                <Input
                  id={id}
                  name="email_local_part"
                  defaultValue={localPartOf(email.fromAddress)}
                  placeholder="notificari"
                />
                <span className="text-sm text-muted-foreground">@{email.domain ?? "domeniu"}</span>
              </div>
            )}
          </FormField>
        </div>
        {saveState.error ? <p className="text-sm text-destructive">{saveState.error}</p> : null}
        {saveState.message ? <p className="text-sm text-ok">{saveState.message}</p> : null}
        <Button type="submit" disabled={saving || !providerConfigured}>
          {saving ? "Se salveaza..." : "Salveaza domeniul"}
        </Button>
      </form>

      {email.domain ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Adauga inregistrarile de mai jos in Cloudflare (zona {email.domain}, DNS -&gt; Records,
            Proxy status = DNS only), apoi apasa „Verifica DNS”. Recomandat si un TXT{" "}
            <code>_dmarc</code> = <code>v=DMARC1; p=none;</code> daca zona nu are deja unul.
          </p>
          {email.records.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tip</TableHead>
                    <TableHead>Nume</TableHead>
                    <TableHead>Valoare</TableHead>
                    <TableHead>Prioritate</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {email.records.map((record) => (
                    <TableRow key={`${record.type}-${record.name}-${record.value}`}>
                      <TableCell>{record.type}</TableCell>
                      <TableCell className="font-mono text-xs">{record.name}</TableCell>
                      <TableCell className="max-w-72 break-all font-mono text-xs">
                        {record.value}
                      </TableCell>
                      <TableCell>{record.priority ?? "-"}</TableCell>
                      <TableCell>{record.status || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <form action={verifyAction}>
              <input type="hidden" name="organization_id" value={organizationId} />
              <Button type="submit" variant="outline" disabled={verifying || !providerConfigured}>
                {verifying ? "Se verifica..." : "Verifica DNS"}
              </Button>
            </form>
            <ConfirmActionButton
              triggerLabel="Scoate domeniul"
              title="Scoti domeniul de email?"
              description="Emailurile organizatiei vor pleca din nou de pe adresa platformei (cu numele organizatiei). Inregistrarile DNS din Cloudflare nu se sterg automat."
              confirmLabel="Da, scoate domeniul"
              action={removeAction}
            />
          </div>
          {verifyState.error ? (
            <p className="text-sm text-destructive">{verifyState.error}</p>
          ) : null}
          {verifyState.message ? <p className="text-sm text-ok">{verifyState.message}</p> : null}
          {email.checkedAt ? (
            <p className="text-xs text-muted-foreground">
              Ultima verificare: {new Date(email.checkedAt).toLocaleString("ro-RO")}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
