"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { extractRecipeFromTextAction, type RecipeAiDraftRow } from "./ai-extract-actions";
import type { QuantityDraft } from "./quantity-editor";

const textareaClassName =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Tab "Din text (AI)" (docs/plans/reteta-ai.md): utilizatorul lipeste un text liber
 * (fisa tehnica, tabel copiat din Excel), modelul AI extrage cantitatea de baza si
 * materiile prime, iar rezultatul se incarca drept CIORNA in tab-ul "Cantități reale"
 * (`onApplyDraft`) - NIMIC nu se salveaza aici, confirmarea/salvarea ramane in
 * editorul de cantitati. Textul lipit e tratat ca date de extras, nu ca instructiuni
 * (siguranta la prompt injection - vezi `ai-extract-prompt.ts`/`ai-extract-parse.ts`).
 */
export function AiExtractTab({
  itemId,
  recipeUnit,
  providerConfigured,
  onApplyDraft,
}: {
  itemId: string;
  recipeUnit: string;
  providerConfigured: boolean;
  onApplyDraft: (draft: QuantityDraft) => void;
}) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<RecipeAiDraftRow[] | null>(null);
  const [batchQuantity, setBatchQuantity] = useState<number | null>(null);
  const [unit, setUnit] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  if (!providerConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Din text (AI)</CardTitle>
          <CardDescription>
            Extragerea rețetei dintr-un text lipit nu este configurată pentru această organizație.
            Un administrator poate activa asistentul AI din variabilele de mediu (ASSISTANT_API_URL,
            ASSISTANT_API_KEY, ASSISTANT_MODEL).
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  function handleExtract() {
    setError(null);
    setApplied(false);
    startTransition(async () => {
      const result = await extractRecipeFromTextAction({ itemId, text });
      if (!result.ok) {
        setError(result.error ?? "Nu am putut extrage rețeta din text.");
        setRows(null);
        return;
      }
      setRows(result.rows);
      setBatchQuantity(result.batchQuantity);
      setUnit(result.unit);
    });
  }

  function handleApply() {
    if (!rows || batchQuantity === null) return;
    onApplyDraft({
      batchQty: batchQuantity,
      rows: rows.map((r) => ({
        // O potrivire cu UM diferita de a rețetei ramane nerezolvata (utilizatorul o
        // leaga manual, in editorul de cantitati) - faza 1 nu face conversii aici.
        componentItemId: r.itemId && r.itemUnit === recipeUnit ? r.itemId : "",
        quantity: r.quantity,
        label: r.unit === recipeUnit ? r.name : `${r.name} (${r.quantity} ${r.unit})`,
      })),
    });
    setApplied(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Din text (AI)</CardTitle>
        <CardDescription>
          Lipește textul rețetei (fișă tehnică, tabel copiat din Excel) - modelul AI extrage
          cantitatea de bază și materiile prime. Rezultatul se încarcă drept ciornă în tab-ul
          „Cantități reale” - nimic nu se salvează până nu revizuiești și apeși „Salvează rețeta”.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="ex: La 1000 kg beton: 150 kg ciment, 200 kg apă, 650 kg nisip"
          className={textareaClassName}
          aria-label="Text sursă pentru extragerea rețetei"
        />
        <Button type="button" onClick={handleExtract} disabled={pending || !text.trim()}>
          {pending ? "Se extrage..." : "Extrage rețeta"}
        </Button>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {rows ? (
          <div className="space-y-3 border-t pt-4">
            <p className="text-sm text-muted-foreground">
              Cantitate de bază detectată: {batchQuantity} {unit}. Verifică potrivirile de mai jos
              înainte de a le încărca.
            </p>
            <ul className="divide-y rounded-lg border">
              {rows.map((row, index) => (
                <li
                  key={`${row.name}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
                >
                  <span>
                    {row.quantity} {row.unit} - {row.name}
                  </span>
                  {row.itemId ? (
                    <Badge variant={row.confidence >= 0.9 ? "ok" : "warn"}>
                      {row.itemTitle} - {Math.round(row.confidence * 100)}% potrivire
                    </Badge>
                  ) : (
                    <Badge variant="neutral">Nepotrivit - alege manual</Badge>
                  )}
                </li>
              ))}
            </ul>
            <Button type="button" variant="outline" onClick={handleApply}>
              Încarcă în „Cantități reale”
            </Button>
            {applied ? (
              <p className="text-sm text-ok">
                Încărcat ca ciornă - deschide tab-ul „Cantități reale” ca să revizuiești și să
                salvezi.
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
