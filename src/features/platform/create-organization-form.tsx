"use client";

import { useActionState, useState } from "react";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createOrganizationAction, initialCreateOrganizationState } from "./actions";
import { slugify } from "./slug";

/**
 * Creare organizatie + admin initial, intr-un singur formular. Daca invitatia
 * esueaza dupa ce organizatia a fost creata (esec partial), formularul comuta in
 * mod "re-incercare": numele/slug-ul devin needitabile (organizatia exista deja),
 * doar emailul poate fi corectat inainte de a retrimite invitatia.
 */
export function CreateOrganizationForm() {
  const [state, action, pending] = useActionState(
    createOrganizationAction,
    initialCreateOrganizationState,
  );
  const orgExists = Boolean(state.organizationId);

  const [slug, setSlug] = useState(state.orgSlug);
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <form action={action} className="max-w-xl space-y-4">
      <input type="hidden" name="organization_id" value={state.organizationId ?? ""} />

      {orgExists ? (
        <p className="rounded-md border border-warn/40 bg-warn-bg px-3 py-2 text-sm text-warn">
          Organizatia <strong>{state.orgName}</strong> (slug <strong>{state.orgSlug}</strong>)
          exista deja — a fost creata la o incercare anterioara, dar invitatia adminului nu a plecat
          cu succes. Corecteaza emailul daca e nevoie si retrimite invitatia.
        </p>
      ) : null}

      <FormField label="Nume organizatie" required>
        {(id) => (
          <Input
            id={id}
            name="name"
            defaultValue={state.orgName}
            readOnly={orgExists}
            required
            placeholder="Acme Recycling SRL"
            onChange={(e) => {
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
          />
        )}
      </FormField>

      <FormField
        label="Slug"
        required
        hint="Folosit in URL-ul organizatiei (subdomeniu sau /slug). Doar litere mici, cifre si cratime, fara cratima la inceput/sfarsit."
      >
        {(id) => (
          <Input
            id={id}
            name="slug"
            value={slug}
            readOnly={orgExists}
            required
            placeholder="acme-recycling"
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
          />
        )}
      </FormField>

      <FormField
        label="Email admin initial"
        required
        hint="Primeste invitatia Supabase pentru a-si seta parola si a deveni admin al organizatiei."
      >
        {(id) => (
          <Input
            id={id}
            name="admin_email"
            type="email"
            defaultValue={state.adminEmail}
            required
            placeholder="admin@acme.ro"
          />
        )}
      </FormField>

      <Button type="submit" disabled={pending}>
        {pending ? "Se salveaza..." : orgExists ? "Retrimite invitatia" : "Creeaza organizatia"}
      </Button>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-primary">{state.message}</p> : null}
    </form>
  );
}
