"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { AssistantConversation } from "./types";

export interface ConversationSidebarProps {
  conversations: AssistantConversation[];
}

/** Data relativa, in stilul Intl folosit in restul aplicatiei (fara dependinta noua). */
function relativeDate(iso: string): string {
  const date = new Date(iso);
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);
  const rtf = new Intl.RelativeTimeFormat("ro-RO", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 1) return "acum";
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) return rtf.format(diffDays, "day");
  return new Intl.DateTimeFormat("ro-RO", { dateStyle: "short" }).format(date);
}

function NewConversationButton({
  active,
  onNavigate,
}: {
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href="/asistent"
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-dashed text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      <MessageSquarePlus className="size-4 shrink-0" />
      Conversație nouă
    </Link>
  );
}

function ConversationList({
  conversations,
  activeId,
  onNavigate,
}: {
  conversations: AssistantConversation[];
  activeId: string | null;
  onNavigate?: () => void;
}) {
  if (conversations.length === 0) {
    return <p className="px-3 py-2 text-sm text-muted-foreground">Nicio conversație încă.</p>;
  }

  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto">
      {conversations.map((conversation) => {
        const active = conversation.id === activeId;
        return (
          <Link
            key={conversation.id}
            href={`/asistent/${conversation.id}`}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "block rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <p className="truncate font-medium">{conversation.title ?? "Conversație"}</p>
            <p
              className={cn(
                "text-xs",
                active ? "text-primary-foreground/80" : "text-muted-foreground/80",
              )}
              // Textul depinde de `Date.now()`: randarea pe server si hidratarea pe client
              // se intampla la momente diferite, deci pot iesi valori diferite ("acum" vs
              // "acum 1 minut") - e asteptat, nu o eroare reala de hidratare.
              suppressHydrationWarning
            >
              {relativeDate(conversation.updatedAt)}
            </p>
          </Link>
        );
      })}
    </nav>
  );
}

export function ConversationSidebar({ conversations }: ConversationSidebarProps) {
  const pathname = usePathname();
  const activeId = pathname.startsWith("/asistent/") ? pathname.split("/")[2] : null;

  return (
    <aside className="hidden w-full flex-col gap-2 lg:sticky lg:top-6 lg:flex lg:h-fit lg:max-h-[calc(100svh-3rem)]">
      <NewConversationButton active={activeId === null} />
      <ConversationList conversations={conversations} activeId={activeId} />
    </aside>
  );
}

export function MobileConversationSidebar({ conversations }: ConversationSidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const activeId = pathname.startsWith("/asistent/") ? pathname.split("/")[2] : null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="lg:hidden">
          <Menu className="size-4" />
          <span className="sr-only">Deschide conversațiile</span>
        </Button>
      </SheetTrigger>
      <SheetContent aria-describedby="mobile-conversations-description">
        <SheetTitle className="sr-only">Conversații</SheetTitle>
        <SheetDescription id="mobile-conversations-description" className="sr-only">
          Istoricul conversațiilor cu asistentul AI.
        </SheetDescription>
        <div className="flex h-full flex-col gap-2 p-2">
          <NewConversationButton active={activeId === null} onNavigate={() => setOpen(false)} />
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            onNavigate={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
