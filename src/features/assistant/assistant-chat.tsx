"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ActionCard } from "./action-card";
import {
  confirmAssistantActionAction,
  rejectAssistantActionAction,
  sendAssistantMessageAction,
} from "./actions";
import { MessageMarkdown } from "./message-markdown";
import { PendingIndicator } from "./pending-indicator";
import { QuotaCard } from "./quota-card";
import type { AssistantTurn, PendingAction, QuotaStatus } from "./types";

export interface Bubble {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function AssistantChat({
  initialConversationId,
  initialMessages,
  initialQuota,
  suggestions,
  providerConfigured,
}: {
  initialConversationId: string | null;
  initialMessages: Bubble[];
  initialQuota: QuotaStatus;
  suggestions: string[];
  providerConfigured: boolean;
}) {
  const router = useRouter();
  const [bubbles, setBubbles] = useState<Bubble[]>(initialMessages);
  const [quota, setQuota] = useState(initialQuota);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const nextId = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);

  const blocked = quota.blockedReason !== null;

  // Scroll la ultimul mesaj - si la aparitia indicatorului de lucru (`PendingIndicator`), ca userul sa vada
  // imediat ca a pornit un raspuns, nu doar cand acesta soseste.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [bubbles, isPending]);

  // Coloana de chat se intinde pana jos, ca sa scroleze doar zona de mesaje, nu toata
  // pagina. `main` din AppShell n-are inaltime fixa (creste cu continutul), deci nu
  // exista un procent CSS de "restul paginii" - masuram efectiv cat spatiu de viewport
  // ramane sub coloana (Topbar-ul de deasupra isi schimba inaltimea responsiv, n-are
  // sens fix). `p-4 sm:p-6` de pe `main` (AppShell) da padding-ul de jos de scazut.
  useEffect(() => {
    function updateHeight() {
      const el = columnRef.current;
      if (!el) return;
      const bottomPadding = window.innerWidth >= 640 ? 24 : 16;
      const available = window.innerHeight - el.getBoundingClientRect().top - bottomPadding;
      el.style.height = `${Math.max(available, 320)}px`;
    }
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  function push(role: Bubble["role"], content: string) {
    nextId.current += 1;
    setBubbles((current) => [...current, { id: `b${nextId.current}`, role, content }]);
  }

  function apply(turn: AssistantTurn) {
    // Conversatie noua: doar actualizam URL-ul, fara reload - remount-ul complet (prin
    // `key` pe AssistantChat, vezi assistant-page-content.tsx) se intampla doar la
    // navigarea intre conversatii diferite, nu la aceasta tranzitie.
    if (turn.conversationId && conversationId === null) {
      setConversationId(turn.conversationId);
      router.replace(`/asistent/${turn.conversationId}`, { scroll: false });
    }
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

  function confirm(overrides: Record<string, unknown>) {
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
      <div ref={columnRef} className="flex min-w-0 flex-col gap-4">
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

        <div
          className="min-h-0 flex-1 space-y-3 overflow-y-auto scroll-smooth"
          data-testid="chat-messages"
        >
          {bubbles.map((bubble) => (
            <div
              key={bubble.id}
              className={cn(
                "max-w-[85%] rounded-lg border px-4 py-3 text-sm",
                bubble.role === "user"
                  ? "ml-auto bg-secondary/60 whitespace-pre-wrap"
                  : "bg-card text-card-foreground",
              )}
            >
              {bubble.role === "assistant" ? (
                <MessageMarkdown content={bubble.content} />
              ) : (
                bubble.content
              )}
            </div>
          ))}
          {isPending ? <PendingIndicator /> : null}
          <div ref={messagesEndRef} />
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
