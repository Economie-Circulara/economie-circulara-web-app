"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Inaltimea maxima (px) pana la care textarea creste singura; apoi scroleaza. */
const MAX_HEIGHT_PX = 160;

/**
 * Campul de mesaj al asistentului: textarea care creste cu textul. Enter trimite,
 * Shift+Enter adauga un rand nou (ca in orice chat). In timpul compunerii cu IME
 * (diacritice pe unele tastaturi) Enter-ul apartine IME-ului, nu trimite.
 */
export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      id="assistant-input"
      rows={1}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault();
          onSubmit();
        }
      }}
      className={cn(
        "flex min-h-9 w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs transition-colors",
        "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    />
  );
}
