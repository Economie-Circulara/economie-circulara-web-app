"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { initialDocumentActionState } from "./action-state";
import { uploadDocumentAction } from "./actions";
import type { DocumentOwnerType } from "./types";

export interface DocumentUploadProps {
  ownerType: DocumentOwnerType;
  ownerId: string;
  /** Path de revalidat dupa upload (ex. `/clienti/{id}`). */
  revalidatePath: string;
}

/**
 * Formular reutilizabil de incarcare document, atasat unui owner (client/order/item).
 * Eticheta e text liber, cu sugestia "Contract" (decizie 2026-07: contractele
 * semnate se arhiveaza ca documente atasate clientului, fara gestiune structurata).
 */
export function DocumentUpload({ ownerType, ownerId, revalidatePath }: DocumentUploadProps) {
  const [state, action, pending] = useActionState(uploadDocumentAction, initialDocumentActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      formRef.current?.reset();
    }
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="owner_type" value={ownerType} />
      <input type="hidden" name="owner_id" value={ownerId} />
      <input type="hidden" name="revalidate_path" value={revalidatePath} />

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <FormField label="Fișier" required hint="PDF, imagine sau document Office, max 10MB.">
          {(id) => (
            <Input
              id={id}
              name="file"
              type="file"
              required
              accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
            />
          )}
        </FormField>
        <div className="flex items-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Se încarcă..." : "Încarcă"}
          </Button>
        </div>
      </div>

      <FormField
        label="Etichetă"
        hint='Opțional — ex. "Contract" pentru contracte semnate arhivate.'
      >
        {(id) => (
          <>
            <Input id={id} name="description" list={`${id}-suggestions`} placeholder="Contract" />
            <datalist id={`${id}-suggestions`}>
              <option value="Contract" />
              <option value="Certificat" />
              <option value="Aviz" />
            </datalist>
          </>
        )}
      </FormField>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}
