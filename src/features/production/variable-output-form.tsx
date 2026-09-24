"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import type { RecipeDetail } from "@/features/recipes/types";
import type { ItemOption } from "@/features/items/types";
import type { FifoAllocation } from "@/features/stock/service";
import { confirmProcessAction, getFifoPreview, getRecipeForItem } from "./actions";
import { computeIdealOutput, roundQty, sumQty, toRecipeUnit } from "./calc";
import { SankeyDiagram } from "./sankey-diagram";
import { buildProcessSankeyData } from "./sankey-data";
import { PRODUCTION_KIND_LABELS, PRODUCTION_KIND_OPTIONS } from "./labels";
import { PRODUCTION_KIND_TO_PROVENANCE } from "./types";
import type { ProductionKind, UnitOfMeasure } from "./types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none";

interface OutputRow {
  itemId: string;
  itemTitle: string;
  unit: UnitOfMeasure;
  percentage: number | null;
  conversionFactor: number;
  isTracked: boolean;
  idealQty: number | null;
  realQty: string;
}

export interface VariableOutputFormProps {
  inputItems: ItemOption[];
  inputItemId: string;
  onInputItemIdChange: (itemId: string) => void;
  /** Deschide acelasi item in fluxul 4a (cand rețeta lui e de compunere). */
  onOpenInFixedFlow: (itemId: string) => void;
}

/**
 * 4b - Reciclare (input fix / output variabil): alegi materialul de reciclat +
 * cantitatea, sistemul afișează materialele rezultate ideale pe baza rețetei de
 * DESCOMPUNERE a itemului (`recipes.direction = 'descompunere'`, migrarea 0028),
 * convertite in UM-ul fiecarei fracții, apoi utilizatorul ajustează cantitățile
 * reale.
 *
 * Daca itemul ales are o rețetă de `compunere` (el e produsul, nu materia primă),
 * fracțiile ar fi de fapt componentele lui consumate - afișarea lor ca output e
 * exact inversarea raportata de utilizator. In cazul asta nu se genereaza randuri
 * si se ofera trecerea in fluxul 4a.
 */
export function VariableOutputForm({
  inputItems,
  inputItemId,
  onInputItemIdChange,
  onOpenInFixedFlow,
}: VariableOutputFormProps) {
  const [inputQty, setInputQty] = useState("");
  const [kind, setKind] = useState<ProductionKind>("reciclare");
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  // Editarile utilizatorului pe coloana "Real" (cheie: itemId fractie). Se
  // reseteaza cand se schimba itemul de input (vezi pattern-ul de mai jos -
  // "adjusting state when a prop changes", render-time, nu intr-un efect:
  // https://react.dev/learn/you-might-not-need-an-effect).
  const [realQtyOverrides, setRealQtyOverrides] = useState<Record<string, string>>({});
  const [resetKey, setResetKey] = useState(inputItemId);
  if (inputItemId !== resetKey) {
    setResetKey(inputItemId);
    setRealQtyOverrides({});
  }

  const [fifoResult, setFifoResult] = useState<{
    allocation: FifoAllocation[];
    availableQty: number;
    error: string | null;
  } | null>(null);
  // Cheia (item + cantitate) pentru care `fifoResult` e valid - vezi comentariul
  // din fixed-output-form.tsx pentru motivul evitarii unui `loadingPreview`
  // setat sincron in efect.
  const [fifoResultKey, setFifoResultKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedInput = inputItems.find((i) => i.id === inputItemId) ?? null;
  const qtyNum = Number(inputQty.replace(",", "."));
  // Itemii nelimitati (apa, aer) nu au loturi - nu se cere preview FIFO pt. ei
  // si nici RPC-ul nu ii consuma (migrarea 0029).
  const inputIsTracked = selectedInput?.isTracked ?? true;
  // Directia vine din reteta itemului, nu din tab-ul deschis (migrarea 0028).
  const directionMismatch = recipe !== null && recipe.direction !== "descompunere";

  useEffect(() => {
    if (!inputItemId) return;
    getRecipeForItem(inputItemId).then(setRecipe);
  }, [inputItemId]);

  // Outputul ideal (fractii) e derivat pur din rețetă + cantitate - nu are
  // nevoie de state/efect propriu.
  const idealLines = useMemo(() => {
    if (!recipe || recipe.direction !== "descompunere" || recipe.components.length === 0) return [];
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) return [];
    return computeIdealOutput(recipe.components, qtyNum);
  }, [recipe, qtyNum]);

  const rows: OutputRow[] = useMemo(() => {
    if (!recipe || recipe.direction !== "descompunere") return [];
    return recipe.components.map((c) => {
      const ideal = idealLines.find((l) => l.itemId === c.componentItemId);
      const override = realQtyOverrides[c.componentItemId];
      return {
        itemId: c.componentItemId,
        itemTitle: c.componentItemTitle,
        unit: c.unit,
        percentage: c.percentage,
        conversionFactor: c.conversionFactor,
        isTracked: c.isTracked,
        idealQty: ideal?.qty ?? null,
        realQty: override !== undefined ? override : ideal ? String(ideal.qty) : "",
      };
    });
  }, [recipe, idealLines, realQtyOverrides]);

  const inputAllocation = fifoResult?.allocation ?? [];
  const inputAvailable = fifoResult?.availableQty ?? 0;
  const inputError = inputIsTracked ? (fifoResult?.error ?? null) : null;
  const previewKey = `${inputItemId}:${qtyNum}`;
  const loadingPreview =
    inputIsTracked &&
    Boolean(inputItemId) &&
    Number.isFinite(qtyNum) &&
    qtyNum > 0 &&
    fifoResultKey !== previewKey;

  useEffect(() => {
    if (!inputItemId || !inputIsTracked || !Number.isFinite(qtyNum) || qtyNum <= 0) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      getFifoPreview([{ itemId: inputItemId, qty: qtyNum }]).then(([result]) => {
        if (cancelled) return;
        setFifoResult({
          allocation: result?.allocation ?? [],
          availableQty: result?.availableQty ?? 0,
          error: result?.error ?? null,
        });
        setFifoResultKey(previewKey);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- previewKey deriva din inputItemId+qtyNum
  }, [inputItemId, inputIsTracked, qtyNum]);

  function updateRealQty(itemId: string, value: string) {
    setRealQtyOverrides((prev) => ({ ...prev, [itemId]: value }));
  }

  const parsedRows = useMemo(
    () =>
      rows.map((row) => {
        const realQtyNum = Number(row.realQty.replace(",", ".")) || 0;
        return {
          ...row,
          realQtyNum,
          // Convertita in UM-ul itemului de input, ca totalul/balanta sa compare
          // marimi omogene (migrarea 0028).
          realQtyInInputUnit: toRecipeUnit(realQtyNum, row.conversionFactor),
        };
      }),
    [rows],
  );
  const totalReal = sumQty(parsedRows.map((r) => ({ qty: r.realQtyInInputUnit })));
  const balance = roundQty(qtyNum - totalReal);

  const canConfirm =
    Boolean(selectedInput) &&
    !directionMismatch &&
    qtyNum > 0 &&
    !inputError &&
    !loadingPreview &&
    parsedRows.some((r) => r.realQtyNum > 0);

  const sankeyData = useMemo(
    () =>
      buildProcessSankeyData({
        inputs:
          selectedInput && qtyNum > 0 && !directionMismatch
            ? [
                {
                  lotId: "preview-in",
                  itemId: selectedInput.id,
                  itemTitle: selectedInput.title,
                  unit: selectedInput.unit,
                  quantity: qtyNum,
                },
              ]
            : [],
        outputs: parsedRows
          .filter((r) => r.realQtyNum > 0)
          .map((r, i) => ({
            lotId: `preview-out-${i}`,
            itemId: r.itemId,
            itemTitle: r.itemTitle,
            unit: r.unit,
            quantity: r.realQtyNum,
            baseQuantity: r.realQtyInInputUnit,
          })),
      }),
    [selectedInput, qtyNum, parsedRows, directionMismatch],
  );

  function onConfirm() {
    if (!selectedInput || !canConfirm) return;
    // `processes.output_item_id` e un singur camp (schema) - la 4b, cu output
    // multiplu, folosim prima fracție cu cantitate > 0 ca item "reprezentativ"
    // (informativ; trasabilitatea reala vine din `process_outputs`, cu toate
    // itemii/loturile create).
    const primaryOutput = parsedRows.find((r) => r.realQtyNum > 0);
    if (!primaryOutput) return;
    setError(null);
    startTransition(async () => {
      const result = await confirmProcessAction({
        type: "input_fixed",
        outputItemId: primaryOutput.itemId,
        recipeId: recipe?.recipeId ?? null,
        inputs: [
          { itemId: selectedInput.id, lotIds: inputAllocation.map((a) => a.lotId), qty: qtyNum },
        ],
        outputs: parsedRows
          .filter((r) => r.realQtyNum > 0)
          .map((r) => ({
            itemId: r.itemId,
            qty: r.realQtyNum,
            provenance: PRODUCTION_KIND_TO_PROVENANCE[kind],
          })),
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-0 rounded-b-lg border border-t-0 bg-card md:grid-cols-2">
      <div className="space-y-4 border-b p-6 md:border-r md:border-b-0">
        <FormField label="Material de reciclat" required>
          {(id) => (
            <div className="flex gap-2">
              <select
                id={id}
                className={selectClassName}
                value={inputItemId}
                onChange={(e) => onInputItemIdChange(e.target.value)}
              >
                {inputItems.length === 0 ? <option value="">Niciun material</option> : null}
                {inputItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.title}
                  </option>
                ))}
              </select>
              <div className="flex w-32 shrink-0 overflow-hidden rounded-md border border-input bg-card">
                <input
                  className="w-full px-3 py-1 text-sm outline-none"
                  inputMode="decimal"
                  value={inputQty}
                  onChange={(e) => setInputQty(e.target.value)}
                  placeholder="0"
                />
                <span className="flex items-center border-l bg-secondary/60 px-2 text-xs text-muted-foreground">
                  {selectedInput?.unit ?? ""}
                </span>
              </div>
            </div>
          )}
        </FormField>

        {directionMismatch && selectedInput && recipe ? (
          <div className="space-y-2 rounded-md border border-warn bg-warn/10 px-3 py-2 text-sm">
            <p className="text-warn">
              Rețeta materialului &quot;{selectedInput.title}&quot; este de{" "}
              <strong>producție</strong>: materiile prime de mai jos sunt CONSUMATE ca să îl obții,
              nu materialele care rezultă din el. Afișarea lor ca materiale rezultate ar inversa
              fluxul, așa că nu propunem nimic aici.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenInFixedFlow(selectedInput.id)}
            >
              Deschide în &quot;Fabricație&quot; {"->"}
            </Button>
          </div>
        ) : null}

        <FormField label="Tip proces" required>
          {(id) => (
            <select
              id={id}
              className={selectClassName}
              value={kind}
              onChange={(e) => setKind(e.target.value as ProductionKind)}
            >
              {PRODUCTION_KIND_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {PRODUCTION_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          )}
        </FormField>

        {inputError ? (
          <div className="rounded-md border border-danger bg-danger/10 px-3 py-2 text-sm text-danger">
            {inputError} (disponibil {inputAvailable})
          </div>
        ) : null}

        {!inputIsTracked && selectedInput ? (
          <p className="text-xs text-muted-foreground">
            &quot;{selectedInput.title}&quot; este un material nelimitat - nu se consumă din stoc la
            confirmare.
          </p>
        ) : null}

        <div>
          <div className="mb-2 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            Rezultat real - ajustează fracțiile
          </div>
          {directionMismatch ? (
            <p className="text-sm text-muted-foreground">
              Folosește fluxul de fabricație pentru acest material (vezi mesajul de mai sus).
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Materialul ales nu are o rețetă de reciclare definită - creeaz-o din /retete (metodă
              &quot;Reciclare&quot;) pentru a vedea materialele ideale aici.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 font-medium">Fracție</th>
                  <th className="py-1 text-right font-medium">Ideal</th>
                  <th className="py-1 text-right font-medium">Real</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.itemId} className="border-t">
                    <td className="py-2">
                      <div className="font-medium">{row.itemTitle}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.percentage}% teoretic · {row.unit}
                        {row.unit === selectedInput?.unit
                          ? null
                          : ` (1 ${row.unit} = ${row.conversionFactor} ${selectedInput?.unit ?? ""})`}
                      </div>
                    </td>
                    <td className="py-2 text-right text-muted-foreground tabular-nums">
                      {row.idealQty ?? "-"}
                    </td>
                    <td className="py-2 text-right">
                      <Input
                        value={row.realQty}
                        onChange={(e) => updateRealQty(row.itemId, e.target.value)}
                        className="ml-auto w-24 text-right tabular-nums"
                        inputMode="decimal"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-3 flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              Total rezultat{" "}
              <span className="font-medium tabular-nums text-foreground">{totalReal}</span>{" "}
              {selectedInput?.unit}
            </span>
            <span className={"font-semibold " + (balance === 0 ? "text-ok" : "text-warn")}>
              Balanță {balance}
            </span>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-danger bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col p-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">Flux reciclare</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {"input -> proces -> fracții"}
          </span>
        </div>
        <div className="flex min-h-[250px] flex-1 items-center">
          <SankeyDiagram data={sankeyData} />
        </div>
        <div className="flex justify-end border-t pt-4">
          <Button onClick={onConfirm} disabled={!canConfirm || isPending}>
            {isPending ? "Se finalizează..." : "Finalizează procesul ->"}
          </Button>
        </div>
      </div>
    </div>
  );
}
