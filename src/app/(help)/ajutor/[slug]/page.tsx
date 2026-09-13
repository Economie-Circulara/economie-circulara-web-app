import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/features/auth/session";
import { readManualFile } from "@/features/manual/loader";
import { ManualContent } from "@/features/manual/manual-content";
import { ManualToc } from "@/features/manual/manual-toc";
import { findManualDoc } from "@/features/manual/registry";
import { extractToc } from "@/features/manual/toc";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const user = await requireUser();
  const doc = findManualDoc(slug, user.role);

  return { title: doc ? `${doc.title} - Ajutor` : "Ajutor" };
}

/** Un document din manual + cuprinsul lui. */
export default async function HelpDocPage({ params }: PageProps) {
  const { slug } = await params;
  const user = await requireUser();

  // Acelasi raspuns pentru slug inexistent si pentru slug interzis rolului, ca sa
  // nu divulgam existenta unui document pe care utilizatorul nu-l poate citi.
  const doc = findManualDoc(slug, user.role);
  if (!doc) notFound();

  const markdown = await readManualFile(doc.file);
  const toc = extractToc(markdown);

  return (
    <>
      <PageHeader
        title={doc.title}
        breadcrumbs={[{ label: "Ajutor", href: "/ajutor" }, { label: doc.title }]}
        description={doc.description}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <article className="min-w-0">
          {toc.length > 0 ? (
            <details className="mb-6 rounded-lg border p-4 lg:hidden">
              <summary className="cursor-pointer text-sm font-medium">Cuprins</summary>
              <ManualToc entries={toc} className="mt-3" />
            </details>
          ) : null}
          <ManualContent markdown={markdown} />
        </article>

        <ManualToc entries={toc} className="hidden lg:sticky lg:top-6 lg:block lg:self-start" />
      </div>
    </>
  );
}
