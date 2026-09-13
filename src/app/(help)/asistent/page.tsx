import type { Metadata } from "next";
import { AssistantPageContent } from "@/features/assistant/assistant-page-content";

export const metadata: Metadata = { title: "Asistent AI" };

export default async function AssistantPage() {
  return <AssistantPageContent />;
}
