"use client";

import { useActionState, useState } from "react";
import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { FormField } from "@/components/form-field";
import { initialSiteFormState } from "./site-action-state";
import { deleteSiteAction, upsertSiteAction } from "./site-actions";
import type { OrganizationSite } from "./site-types";

function SiteFormCard({ site, onCancel }: { site?: OrganizationSite; onCancel?: () => void }) {
  const [state, action, pending] = useActionState(upsertSiteAction, initialSiteFormState);

  return (
    <form action={action} className="space-y-3 rounded-lg border bg-card p-4">
      {site ? <input type="hidden" name="id" value={site.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <FormField label="Nume" required hint='Ex. "Stație centrală Iași".'>
          {(id) => <Input id={id} name="name" required defaultValue={site?.name ?? ""} />}
        </FormField>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
          <input
            type="checkbox"
            name="is_default"
            defaultChecked={site?.isDefault ?? false}
            className="size-4 rounded border-input"
          />
          Implicit
        </label>
      </div>

      <FormField
        label="Adresă"
        required
        hint="Folosită ca punct de plecare la calculul rutelor de livrare."
      >
        {(id) => <Input id={id} name="address" required defaultValue={site?.address ?? ""} />}
      </FormField>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Se salvează..." : site ? "Salvează" : "Adaugă punctul de plecare"}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Anulează
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function SiteRow({ site }: { site: OrganizationSite }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteSiteAction,
    initialSiteFormState,
  );

  if (editing) {
    return <SiteFormCard site={site} onCancel={() => setEditing(false)} />;
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium">
          {site.name}
          {site.isDefault ? <Badge variant="ok">Implicit</Badge> : null}
        </p>
        <p className="text-sm text-muted-foreground">{site.address}</p>
        {deleteState.error ? <p className="text-xs text-danger">{deleteState.error}</p> : null}
      </div>

      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
          Editează
        </Button>
        {confirmingDelete ? (
          <form action={deleteAction} className="flex items-center gap-2">
            <input type="hidden" name="id" value={site.id} />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirmingDelete(false)}
            >
              Anulează
            </Button>
            <Button type="submit" size="sm" variant="destructive" disabled={deletePending}>
              {deletePending ? "Se șterge..." : "Confirmă"}
            </Button>
          </form>
        ) : (
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingDelete(true)}>
            Șterge
          </Button>
        )}
      </div>
    </div>
  );
}

export interface SiteSectionProps {
  sites: OrganizationSite[];
}

/** Sectiunea "Puncte de plecare" din /setari/statii - CRUD + un singur punct implicit. */
export function SiteSection({ sites }: SiteSectionProps) {
  const [addingNew, setAddingNew] = useState(false);

  return (
    <div className="space-y-3">
      {sites.length === 0 && !addingNew ? (
        <EmptyState
          icon={<Building2 />}
          title="Niciun punct de plecare"
          description="Adaugă prima stație/depozit de unde pleacă livrările, pentru calculul rutelor."
        />
      ) : (
        <div className="space-y-2">
          {sites.map((site) => (
            <SiteRow key={site.id} site={site} />
          ))}
        </div>
      )}

      {addingNew ? (
        <SiteFormCard onCancel={() => setAddingNew(false)} />
      ) : (
        <Button type="button" variant="outline" onClick={() => setAddingNew(true)}>
          + Adaugă punct de plecare
        </Button>
      )}
    </div>
  );
}
