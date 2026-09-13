import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/features/auth/session";
import { manualDocsForRole } from "@/features/manual/registry";

export const metadata: Metadata = { title: "Ajutor" };

/** Indexul manualului: documentele pe care rolul curent are voie sa le citeasca. */
export default async function HelpIndexPage() {
  const user = await requireUser();
  const docs = manualDocsForRole(user.role);

  return (
    <>
      <PageHeader
        title="Ajutor"
        description="Manualele de utilizare ale platformei - aceleași documente livrate cu proiectul, cu tot cu capturi de ecran."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {docs.map((doc) => (
          <Link key={doc.slug} href={`/ajutor/${doc.slug}`} className="group block">
            <Card className="h-full transition-colors group-hover:border-primary">
              <CardHeader>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {doc.audience}
                </p>
                <CardTitle>{doc.title}</CardTitle>
                <CardDescription>{doc.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
