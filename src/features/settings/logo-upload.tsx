"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { initialSettingsState } from "./action-state";
import { removeOrgLogoAction, uploadOrgLogoAction } from "./actions";
import type { LogoVariant } from "./logo-validation";

export interface LogoUploadProps {
  orgName: string;
  logoUrl: string | null;
  /** `inline` = orizontal (sidebar, login), `square` = patrat (favicon). */
  variant: LogoVariant;
  hint: string;
}

/**
 * Incarcare a unei variante de logo ca fisier (bucket public `org-logos`), cu
 * previzualizare in forma variantei.
 */
export function LogoUpload({ orgName, logoUrl, variant, hint }: LogoUploadProps) {
  const router = useRouter();
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadOrgLogoAction,
    initialSettingsState,
  );
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removePending, startRemoveTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !uploadPending && !uploadState.error) {
      formRef.current?.reset();
    }
    wasPending.current = uploadPending;
  }, [uploadPending, uploadState.error]);

  function removeLogo() {
    setRemoveError(null);
    startRemoveTransition(async () => {
      const result = await removeOrgLogoAction(variant);
      if (result.error) {
        setRemoveError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex h-16 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted/40",
            variant === "inline" ? "w-40" : "w-16",
          )}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={orgName} className="size-full rounded object-contain p-1" />
          ) : (
            <span className="text-[10px] text-muted-foreground">Fără logo</span>
          )}
        </div>

        <form ref={formRef} action={uploadAction} className="flex-1 space-y-2">
          <input type="hidden" name="variant" value={variant} />
          <FormField label="Fișier logo" hint={hint}>
            {(id) => (
              <div className="flex gap-2">
                <Input
                  id={id}
                  name="logo"
                  type="file"
                  required
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                  className="cursor-pointer"
                />
                <Button type="submit" variant="outline" disabled={uploadPending}>
                  {uploadPending ? "Se încarcă..." : logoUrl ? "Înlocuiește" : "Încarcă"}
                </Button>
                {logoUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={removePending}
                    onClick={removeLogo}
                  >
                    {removePending ? "..." : "Elimină"}
                  </Button>
                ) : null}
              </div>
            )}
          </FormField>
        </form>
      </div>

      {uploadState.error ? <p className="text-sm text-danger">{uploadState.error}</p> : null}
      {removeError ? <p className="text-sm text-danger">{removeError}</p> : null}
    </div>
  );
}
