"use server";

import { requireUser } from "@/features/auth/session";
import { confirmAction, rejectAction, runAssistantTurn } from "./run";
import type { AssistantTurn, ToolContext } from "./types";

/** Contextul de tool pentru utilizatorul autentificat curent. */
async function currentContext(): Promise<ToolContext> {
  const user = await requireUser();
  return {
    userId: user.id,
    role: user.role,
    organizationId: user.organizationId,
    clientId: user.clientId,
  };
}

export async function sendAssistantMessageAction(input: {
  conversationId: string | null;
  message: string;
}): Promise<AssistantTurn> {
  const ctx = await currentContext();
  const message = input.message.trim();

  if (!message) {
    const { getQuotaStatus } = await import("./quota");
    return {
      conversationId: input.conversationId ?? "",
      reply: "Scrie o întrebare sau o cerere.",
      pendingAction: null,
      quota: await getQuotaStatus(ctx),
    };
  }

  return runAssistantTurn({ conversationId: input.conversationId, message, ctx });
}

export async function confirmAssistantActionAction(input: {
  toolCallId: string;
  overrides?: Record<string, unknown>;
}): Promise<AssistantTurn> {
  const ctx = await currentContext();
  return confirmAction({ toolCallId: input.toolCallId, ctx, overrides: input.overrides });
}

export async function rejectAssistantActionAction(input: {
  toolCallId: string;
}): Promise<AssistantTurn> {
  const ctx = await currentContext();
  return rejectAction({ toolCallId: input.toolCallId, ctx });
}
