import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { initialClientFormState } from "@/features/clients/action-state";
import { createClientAction } from "@/features/clients/actions";
import { ClientForm } from "@/features/clients/client-form";

export const metadata = { title: "Adaugă client — Lateris Trace" };

/** Formular creare client nou (doar staff) — CUI lookup opțional pentru precompletare. */
export default async function ClientNouPage() {
  await requireRole(["admin", "operator"]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Adaugă client"
        description="Caută firma după CUI (opțional) sau completează datele manual."
        breadcrumbs={[{ label: "Clienți", href: "/clienti" }, { label: "Client nou" }]}
      />
      <ClientForm mode="create" action={createClientAction} initialState={initialClientFormState} />
    </div>
  );
}
