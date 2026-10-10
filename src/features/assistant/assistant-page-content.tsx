import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import type { Bubble } from "./assistant-chat";
import { AssistantChat } from "./assistant-chat";
import { requireAssistantUser } from "./guard";
import { ConversationSidebar, MobileConversationSidebar } from "./conversation-sidebar";
import { isChatProviderConfigured } from "./provider";
import { getQuotaStatus } from "./quota";
import { getConversation, listConversations, listMessages } from "./service";

const SUGGESTIONS = [
  "Cum adaug un lot în stoc?",
  "Caută firma cu CUI 12345678",
  "Ce materiale și abonamente vandabile am?",
  "Cât stoc mai am la agregate?",
  "Planifică livrarea pentru comanda acceptată a clientului X",
];

/**
 * Continutul paginii de asistent, partajat intre `/asistent` (conversatie noua) si
 * `/asistent/[id]` (conversatie existenta), ca sa nu se dubleze data-loading-ul.
 */
export async function AssistantPageContent({ conversationId }: { conversationId?: string }) {
  // Clientul nu are asistent (ASSISTANT_ROLES) - e redirectionat la pagina lui; o
  // organizatie cu modulul `assistant` dezactivat primeste 404.
  const user = await requireAssistantUser();
  const ctx = {
    userId: user.id,
    role: user.role,
    organizationId: user.organizationId,
    clientId: user.clientId,
  };

  let initialMessages: Bubble[] = [];
  if (conversationId) {
    const conversation = await getConversation(conversationId);
    if (!conversation) notFound();

    const messages = await listMessages(conversationId);
    initialMessages = messages
      .filter((message) => message.role !== "tool")
      .map((message) => ({
        id: message.id,
        role: message.role as "user" | "assistant",
        content: message.content,
      }));
  }

  const [quota, conversations] = await Promise.all([getQuotaStatus(ctx), listConversations()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asistent AI"
        description="Întreabă despre aplicație sau cere-i să pregătească o acțiune. Orice modificare ți-o arată întâi spre confirmare."
        actions={<MobileConversationSidebar conversations={conversations} />}
      />
      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <ConversationSidebar conversations={conversations} />
        <AssistantChat
          key={conversationId ?? "new"}
          initialConversationId={conversationId ?? null}
          initialMessages={initialMessages}
          initialQuota={quota}
          suggestions={SUGGESTIONS}
          providerConfigured={isChatProviderConfigured()}
          canAttach={user.role === "admin" || user.role === "operator"}
        />
      </div>
    </div>
  );
}
