import type { Metadata } from "next";
import { AssistantPageContent } from "@/features/assistant/assistant-page-content";

export const metadata: Metadata = { title: "Asistent AI" };

interface AssistantConversationPageProps {
  params: Promise<{ id: string }>;
}

export default async function AssistantConversationPage({
  params,
}: AssistantConversationPageProps) {
  const { id } = await params;
  return <AssistantPageContent conversationId={id} />;
}
