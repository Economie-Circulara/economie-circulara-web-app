"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ActionCard } from "./action-card";
import {
  confirmAssistantActionAction,
  rejectAssistantActionAction,
  sendAssistantMessageAction,
} from "./actions";
import { QuotaCard } from "./quota-card";
import type { AssistantTurn, PendingAction, QuotaStatus } from "./types";

interface Bubble {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function AssistantChat({
  initialQuota,
  suggestions,
  providerConfigured,
}: {
  initialQuota: QuotaStatus;
  suggestions: string[];
  providerConfigured: boolean;
}) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [quota, setQuota] = useState(initialQuota);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const nextId = useRef(0);

  const blocked = quota.blockedReason !== null;

  function push(role: Bubble["role"], content: string) {
    nextId.current += 1;
    setBubbles((current) => [...current, { id: `b${nextId.current}`, role, content }]);
  }

  function apply(turn: AssistantTurn) {
    if (turn.conversationId) setConversationId(turn.conversationId);
    setQuota(turn.quota);
    setPending(turn.pendingAction);
    push("assistant", turn.reply);
  }

  function send(message: string) {
    const text = message.trim();
    if (!text || isPending) return;

    push("user", text);
    setDraft("");
    setPending(null);

    startTransition(async () => {
      const turn = await sendAssistantMessageAction({ conversationId, message: text });
      apply(turn);
    });
  }

  function confirm(overrides: Record<string, string>) {
    if (!pending || isPending) return;
    const toolCallId = pending.toolCallId;
    setPending(null);

    startTransition(async () => {
      const turn = await confirmAssistantActionAction({ toolCallId, overrides });
      apply(turn);
    });
  }

  function reject() {
    if (!pending || isPending) return;
    const toolCallId = pending.toolCallId;
    setPending(null);

    startTransition(async () => {
      apply(await rejectAssistantActionAction({ toolCallId }));
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-4">
        {bubbles.length === 0 ? (
          <div className="rounded-lg border bg-card p-5">
            <p className="text-sm font-medium">Cu ce te pot ajuta?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pot răspunde din manualul aplicației și pot pregăti acțiuni (client nou, comandă
              nouă). Orice acțiune ți-o arăt întâi spre confirmare.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={blocked}
                  onClick={() => send(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          {bubbles.map((bubble) => (
            <div
              key={bubble.id}
              className={cn(
                "max-w-[85%] rounded-lg border px-4 py-3 text-sm whitespace-pre-wrap",
                bubble.role === "user" ? "ml-auto bg-secondary/60" : "bg-card text-card-foreground",
              )}
            >
              {bubble.content}
            </div>
          ))}
          {isPending ? (
            <p className="text-sm text-muted-foreground" role="status">
              Mă gândesc...
            </p>
          ) : null}
        </div>

        {pending ? (
          <ActionCard action={pending} busy={isPending} onConfirm={confirm} onReject={reject} />
        ) : null}

        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            send(draft);
          }}
        >
          <label htmlFor="assistant-input" className="sr-only">
            Mesaj pentru asistent
          </label>
          <Input
            id="assistant-input"
            value={draft}
            disabled={blocked || isPending}
            placeholder={
              blocked ? "Ai atins limita de mesaje" : "Ex: adaugă clientul cu CUI 12345678"
            }
            onChange={(event) => setDraft(event.target.value)}
            className="min-w-0 flex-1"
          />
          <Button type="submit" disabled={blocked || isPending || draft.trim() === ""}>
            Trimite
          </Button>
        </form>

        {!providerConfigured ? (
          <p className="text-xs text-muted-foreground">
            Rulează pe furnizorul de test (nicio cheie API configurată): răspunsurile sunt limitate,
            dar fluxul de confirmare funcționează identic.
          </p>
        ) : null}
      </div>

      <QuotaCard quota={quota} className="lg:sticky lg:top-6 lg:self-start" />
    </div>
  );
}
