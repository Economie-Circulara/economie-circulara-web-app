import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getCurrentOrg } from "@/features/auth/queries";
import { requireRole } from "@/features/auth/session";
import { DocumentList } from "@/features/documents/document-list";
import { DocumentUpload } from "@/features/documents/document-upload";
import { listOrganizationDocuments } from "@/features/documents/service";
import { SettingsForm } from "@/features/settings/settings-form";

export const metadata = { title: "Setari" };

/**
 * Ecranul Setari (doar admin): white-label + acces la managementul utilizatorilor
 * si la punctele de plecare (Task X7 - planificarea rutelor de livrare) + documentele
 * generale ale organizatiei (declaratii de conformitate, 0057), vizibile clientilor.
 */
export default async function SettingsPage() {
  await requireRole(["admin"]);
  const org = await getCurrentOrg();
  if (!org) redirect("/dashboard");
  const generalDocuments = await listOrganizationDocuments(org.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Setari organizatie"
        description="Personalizeaza identitatea si gestioneaza utilizatorii."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/setari/statii">Puncte de plecare</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/setari/utilizatori">Utilizatori</Link>
            </Button>
          </div>
        }
      />
      <SettingsForm org={org} />

      <section className="max-w-3xl space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Documente generale</h2>
          <p className="text-sm text-muted-foreground">
            Declarații de conformitate, fișe tehnice și alte documente valabile pentru toate
            comenzile. Apar la fiecare comandă, în secțiunea „Documente”, și sunt vizibile tuturor
            clienților în portal.
          </p>
        </div>
        <DocumentUpload
          ownerType="organization"
          ownerId={org.id}
          revalidatePath="/setari"
          suggestions={["Declarație de conformitate", "Fișă tehnică"]}
        />
        <DocumentList documents={generalDocuments} canDelete revalidatePath="/setari" />
      </section>
    </div>
  );
}
