import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { AssistantChat } from "@/features/assistant/assistant-chat";
import { isChatProviderConfigured } from "@/features/assistant/provider";
import { getQuotaStatus } from "@/features/assistant/quota";
import { requireUser } from "@/features/auth/session";

export const metadata: Metadata = { title: "Asistent AI" };

/** Sugestii diferite pe rol - clientul n-are acces la actiuni de organizatie. */
const SUGGESTIONS: Record<string, string[]> = {
  staff: [
    "Cum adaug un lot în stoc?",
    "Caută firma cu CUI 12345678",
    "Ce itemi vandabili am?",
    "Cât stoc mai am la agregate?",
  ],
  client: ["Cum plasez o comandă?", "Unde îmi găsesc certificatele?", "Cum fac un retur?"],
};

export default async function AssistantPage() {
  const user = await requireUser();
  const quota = await getQuotaStatus({
    userId: user.id,
    role: user.role,
    organizationId: user.organizationId,
    clientId: user.clientId,
  });

  return (
    <>
      <PageHeader
        title="Asistent AI"
        description="Întreabă despre aplicație sau cere-i să pregătească o acțiune. Orice modificare ți-o arată întâi spre confirmare."
      />
      <AssistantChat
        initialQuota={quota}
        suggestions={SUGGESTIONS[user.role === "client" ? "client" : "staff"]}
        providerConfigured={isChatProviderConfigured()}
      />
    </>
  );
}
