import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/features/auth/session";
import { platformFromAddress } from "@/features/notifications/email-brand";
import { removeOrganizationEmailDomainAction } from "@/features/platform/actions";
import { getEmailDomainProvider } from "@/features/platform/email-domain-provider";
import { OrgAppearanceForm } from "@/features/platform/org-appearance-form";
import { OrgEmailForm } from "@/features/platform/org-email-form";
import { getOrganizationSummary } from "@/features/platform/queries";

export const metadata = { title: "Organizatie - Platforma" };

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Tema vizuala, organizarea, domeniul propriu si emailul unei organizatii (super-admin). */
export default async function OrganizationPage({ params }: PageProps) {
  await requireRole(["super_admin"]);
  const { id } = await params;
  const org = await getOrganizationSummary(id);
  if (!org) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={org.name}
        breadcrumbs={[{ label: "Organizatii", href: "/platform" }, { label: org.name }]}
        description={`Slug ${org.slug} · acces ${org.accessUrl}`}
        actions={
          <Button asChild variant="outline">
            <Link href="/platform">Inapoi la lista</Link>
          </Button>
        }
      />
      <OrgAppearanceForm
        organizationId={org.id}
        theme={org.theme}
        layout={org.layout}
        customDomain={org.customDomain}
      />
      <OrgEmailForm
        organizationId={org.id}
        email={org.email}
        providerConfigured={getEmailDomainProvider() !== null}
        platformAddress={platformFromAddress()}
        removeAction={removeOrganizationEmailDomainAction.bind(null, org.id)}
      />
    </div>
  );
}
