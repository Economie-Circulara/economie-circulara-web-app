"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/** Rezultatul standard al unei actiuni distructive (server action). */
export interface ConfirmActionResult {
  error: string | null;
}

export interface ConfirmActionButtonProps {
  /** Textul butonului care deschide dialogul (ex. "Arhivează"). */
  triggerLabel: string;
  /** Titlul dialogului - intrebarea, in romana simpla (ex. "Arhivezi acest client?"). */
  title: string;
  /** Ce se intampla concret, in cuvinte simple (si ce NU se pierde). */
  description: string;
  /** Textul butonului de confirmare (ex. "Da, arhivează"). */
  confirmLabel: string;
  /** Textul afisat pe butonul de confirmare cat ruleaza actiunea. */
  pendingLabel?: string;
  /**
   * Daca e setat, dialogul cere un MOTIV (camp obligatoriu) - trimis ca argument
   * actiunii (ex. anularea unui lot / a unei livrari).
   */
  reasonLabel?: string;
  /** Varianta vizuala a butonului declansator (implicit `outline`). */
  triggerVariant?: ButtonProps["variant"];
  /** Varianta butonului de confirmare (implicit `destructive`). */
  confirmVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  /**
   * Actiunea de rulat dupa confirmare. De regula un server action legat cu `.bind`
   * dintr-un Server Component (ex. `archiveItemAction.bind(null, item.id)`) - singura
   * forma de functie care poate trece granita RSC (AGENTS.md 4.2).
   */
  action: (reason?: string) => Promise<ConfirmActionResult | void>;
}

/**
 * Buton + dialog de confirmare pentru ORICE actiune distructiva (arhivare, stergere
 * ciorna, anulare lot/livrare, dezactivare utilizator). Nimic nu se executa fara
 * confirmarea explicita din dialog; dupa succes pagina se reincarca
 * (`router.refresh()`), iar un `redirect()` din actiune e respectat de Next.
 */
export function ConfirmActionButton({
  triggerLabel,
  title,
  description,
  confirmLabel,
  pendingLabel = "Se procesează...",
  reasonLabel,
  triggerVariant = "outline",
  confirmVariant = "destructive",
  triggerSize,
  action,
}: ConfirmActionButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const reasonId = React.useId();

  const needsReason = Boolean(reasonLabel);
  const canConfirm = !isPending && (!needsReason || reason.trim().length > 0);

  function onOpenChange(next: boolean) {
    if (isPending) return;
    setOpen(next);
    if (!next) {
      setError(null);
      setReason("");
    }
  }

  function onConfirm() {
    if (!canConfirm) return;
    setError(null);
    startTransition(async () => {
      const result = await action(needsReason ? reason.trim() : undefined);
      if (result && result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger asChild>
        <Button type="button" variant={triggerVariant} size={triggerSize}>
          {triggerLabel}
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/35 backdrop-blur-[1px]" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-lg border bg-card p-5 shadow-lg outline-none">
          <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-sm text-muted-foreground">
            {description}
          </DialogPrimitive.Description>

          {needsReason ? (
            <div className="space-y-1.5">
              <Label htmlFor={reasonId}>{reasonLabel}</Label>
              <textarea
                id={reasonId}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none"
              />
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Renunță
              </Button>
            </DialogPrimitive.Close>
            <Button
              type="button"
              variant={confirmVariant}
              onClick={onConfirm}
              disabled={!canConfirm}
            >
              {isPending ? pendingLabel : confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
