import { itemHref } from "@/features/items/item-links";
import { getItemById, listItemOptions } from "@/features/items/queries";
import { computeRequiredConsumption, type DistributedLine } from "@/features/production/calc";
import { PRODUCTION_KIND_LABELS } from "@/features/production/labels";
import { confirmProcess } from "@/features/production/service";
import { PRODUCTION_KIND_TO_PROVENANCE, type ProductionKind } from "@/features/production/types";
import { DIRECTION_LABELS, DIRECTION_SHORT_LABELS } from "@/features/recipes/labels";
import { getRecipeByItemId } from "@/features/recipes/queries";
import { addOrUpdateComponents, createRecipe } from "@/features/recipes/service";
import type { RecipeDetail, RecipeDirection } from "@/features/recipes/types";
import {
  sumPercentages,
  validateNotSelfReference,
  validatePercentage,
} from "@/features/recipes/validation";
import { listLots } from "@/features/stock/queries";
import {
  InsufficientStockError,
  planFifoConsumption,
  type FifoAllocation,
} from "@/features/stock/service";
import { resultField } from "../result-summary";
import { infoField, textField } from "./fields";
import type { CardPresentation } from "./presentation-types";
import {
  asObject,
  InvalidToolArgumentsError,
  optionalString,
  positiveNumber,
  requiredString,
  type AssistantTool,
} from "./types";

/**
 * Retete si productie. Citirea retetei + doua scrieri:
 *  - `creeaza_reteta` (card dedicat `recipe_draft` - lista de materii prime);
 *  - `porneste_productie` - DOAR fluxul „cantitate fixă de produs” (reteta `compunere`,
 *    ca `fixed-output-form.tsx`): consumul se calculeaza din reteta si se aloca FIFO.
 *    Descompunerea (reciclare) cere cantitatile REALE rezultate, masurate de om dupa
 *    proces - ramane in wizard-ul `/productie/nou`, unde se inregistreaza si pierderea.
 */

/** O reteta arhivata (ea sau itemul ei) nu mai porneste procese - ca `getRecipeForItem`. */
async function activeRecipe(itemId: string): Promise<RecipeDetail | null> {
  const recipe = await getRecipeByItemId(itemId);
  return recipe && recipe.archivedAt === null ? recipe : null;
}

export const retetaProdus: AssistantTool<{ item_id: string }> = {
  name: "reteta_produs",
  description:
    "Arată rețeta unui produs (`item_id`): metoda (compunere = produsul se obține din " +
    "materiile prime; descompunere = produsul se desface în materiale) și materiile prime cu " +
    "procentele lor. Întoarce `null` dacă produsul nu are rețetă activă.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: { item_id: { type: "string" } },
    required: ["item_id"],
  },
  roles: ["super_admin", "admin", "operator"],
  version: 1,
  kind: "read",
  parse: (args) => ({ item_id: requiredString(asObject(args), "item_id") }),
  execute: async (input) => {
    const recipe = await activeRecipe(input.item_id);
    if (!recipe) return null;
    return {
      item_id: recipe.itemId,
      denumire: recipe.itemTitle,
      um: recipe.unit,
      metoda: recipe.direction,
      suma_procente: recipe.percentageSum,
      componente: recipe.components.map((component) => ({
        item_id: component.componentItemId,
        denumire: component.componentItemTitle,
        um: component.unit,
        procent: component.percentage,
        nelimitat: !component.isTracked,
      })),
      link: `/retete/${recipe.itemId}`,
    };
  },
};

// ---------------------------------------------------------------------------
// creeaza_reteta

interface CreateRecipeInput {
  item_id: string;
  directie: RecipeDirection;
  componente: { item_id: string; procent: number }[];
}

const MAX_COMPONENTS = 30;

export const creeazaReteta: AssistantTool<CreateRecipeInput> = {
  name: "creeaza_reteta",
  description:
    "Propune rețeta unui MATERIAL care nu are încă una. `directie`: `compunere` (produsul se " +
    "obține din materiile prime - ex. beton din nisip, ciment, apă) sau `descompunere` (produsul " +
    "se desface - ex. moloz în nisip și pietriș). `procent` = cât din componentă raportat la " +
    "cantitatea de produs. `item_id`-urile vin din `itemi_vandabili`/`itemi_aport`. " +
    "Acțiunea NU se execută până la confirmare.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      item_id: { type: "string", description: "Produsul rețetei." },
      directie: { type: "string", enum: ["compunere", "descompunere"] },
      componente: {
        type: "array",
        minItems: 1,
        maxItems: MAX_COMPONENTS,
        items: {
          type: "object",
          additionalProperties: false,
          properties: { item_id: { type: "string" }, procent: { type: "number" } },
          required: ["item_id", "procent"],
        },
      },
    },
    required: ["item_id", "directie", "componente"],
  },
  roles: ["admin", "operator"],
  version: 1,
  kind: "write",
  parse: (args) => {
    const raw = asObject(args);
    const itemId = requiredString(raw, "item_id");
    const directie = requiredString(raw, "directie");
    if (directie !== "compunere" && directie !== "descompunere") {
      throw new InvalidToolArgumentsError(
        '„directie" trebuie să fie „compunere" sau „descompunere".',
      );
    }
    const rows = raw.componente;
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new InvalidToolArgumentsError("Rețeta trebuie să aibă cel puțin o materie primă.");
    }
    if (rows.length > MAX_COMPONENTS) {
      throw new InvalidToolArgumentsError(`Maxim ${MAX_COMPONENTS} materii prime.`);
    }
    const componente = rows.map((row, index) => {
      const entry = asObject(row);
      const componentId = requiredString(entry, "item_id");
      const procent = positiveNumber(entry, "procent");
      const error = validateNotSelfReference(itemId, componentId) ?? validatePercentage(procent);
      if (error) throw new InvalidToolArgumentsError(`Materia primă #${index + 1}: ${error}`);
      return { item_id: componentId, procent };
    });
    if (new Set(componente.map((row) => row.item_id)).size !== componente.length) {
      throw new InvalidToolArgumentsError("Aceeași materie primă apare de două ori.");
    }
    return { item_id: itemId, directie, componente };
  },
  summary: () => "Creează rețeta",
  resultSummary: (input, result) =>
    `Am creat rețeta (${DIRECTION_SHORT_LABELS[input.directie].toLowerCase()}, ${input.componente.length} ${input.componente.length === 1 ? "materie primă" : "materii prime"}, total ${resultField(result, "suma_procente") ?? "?"}%).`,
  presentation: async (input): Promise<CardPresentation> => {
    const [item, options] = await Promise.all([
      getItemById(input.item_id),
      listItemOptions({ kind: "physical", excludeId: input.item_id }),
    ]);
    return {
      renderer: "recipe_draft",
      itemTitle: item?.title ?? "Produs indisponibil",
      itemUnit: item?.unit ?? "",
      draft: {
        direction: input.directie,
        components: input.componente.map((row) => ({
          itemId: row.item_id,
          percentage: row.procent,
        })),
      },
      componentOptions: options.map((option) => ({
        id: option.id,
        title: option.title,
        unit: option.unit,
      })),
    };
  },
  execute: async (input) => {
    if (await getRecipeByItemId(input.item_id)) {
      throw new InvalidToolArgumentsError(
        "Produsul are deja o rețetă (una singură per produs) - modific-o din editorul rețetei.",
      );
    }
    const recipe = await createRecipe(input.item_id, input.directie);
    await addOrUpdateComponents(
      recipe.id,
      input.componente.map((row) => ({ componentItemId: row.item_id, percentage: row.procent })),
    );
    return {
      item_id: input.item_id,
      reteta_id: recipe.id,
      metoda: input.directie,
      suma_procente: sumPercentages(input.componente.map((row) => ({ percentage: row.procent }))),
      link: `/retete/${input.item_id}`,
    };
  },
};

// ---------------------------------------------------------------------------
// porneste_productie

interface StartProductionInput {
  item_id: string;
  cantitate: number;
  tip: ProductionKind;
  observatii: string | null;
}

const KINDS: ProductionKind[] = ["productie", "reciclare", "reconditionare"];

interface PlannedLine extends DistributedLine {
  allocation: FifoAllocation[];
  error: string | null;
}

/** Consumul calculat din reteta + alocarea FIFO - identic cu preview-ul din wizard. */
async function planProduction(input: StartProductionInput) {
  const recipe = await activeRecipe(input.item_id);
  if (!recipe) throw new InvalidToolArgumentsError("Produsul nu are o rețetă activă.");
  if (recipe.direction !== "compunere") {
    throw new InvalidToolArgumentsError(
      "Rețeta e de descompunere: cantitățile rezultate se măsoară după proces - folosește " +
        "fluxul „Cantitate fixă de materie primă” din /productie/nou.",
    );
  }
  if (recipe.components.length === 0) {
    throw new InvalidToolArgumentsError("Rețeta nu are materii prime.");
  }

  const required = computeRequiredConsumption(recipe.components, input.cantitate);
  const lines: PlannedLine[] = await Promise.all(
    required.map(async (line) => {
      // Materialele nelimitate (apa, aer) nu au loturi - sarite si de RPC (0029).
      if (!line.isTracked) return { ...line, allocation: [], error: null };
      const lots = await listLots({ itemId: line.itemId });
      const candidates = lots
        .filter((lot) => !lot.isBlocked && lot.remainingQty > 0)
        .map((lot) => ({
          lotId: lot.id,
          entryDate: lot.entryDate,
          remainingQty: lot.remainingQty,
          isBlocked: lot.isBlocked,
        }));
      try {
        return { ...line, allocation: planFifoConsumption(candidates, line.qty), error: null };
      } catch (err) {
        const available = candidates.reduce((sum, lot) => sum + lot.remainingQty, 0);
        const error =
          err instanceof InsufficientStockError
            ? `stoc insuficient: disponibil ${available}, necesar ${line.qty}`
            : err instanceof Error
              ? err.message
              : "nu am putut calcula consumul";
        return { ...line, allocation: [], error };
      }
    }),
  );
  return { recipe, lines };
}

function describeLine(line: PlannedLine): string {
  const base = `${line.itemTitle}: ${line.qty} ${line.unit}`;
  if (!line.isTracked) return `${base} (nelimitat)`;
  if (line.error) return `${base} - ${line.error}`;
  return `${base} (${line.allocation.length} ${line.allocation.length === 1 ? "lot" : "loturi"}, FIFO)`;
}

export const pornesteProductie: AssistantTool<StartProductionInput> = {
  name: "porneste_productie",
  description:
    "Propune un proces de producție cu CANTITATE FIXĂ DE PRODUS: consumul materiilor prime se " +
    "calculează din rețeta de compunere a produsului și se scade din stoc FIFO; rezultă un lot " +
    "nou din produs. Verifică întâi rețeta cu `reteta_produs`. `tip`: productie / reciclare / " +
    "reconditionare (proveniența lotului). NU funcționează pentru rețete de descompunere. " +
    "Acțiunea NU se execută până la confirmare.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      item_id: { type: "string", description: "Produsul obținut (are rețetă de compunere)." },
      cantitate: { type: "number", description: "Cantitatea produsă, în UM-ul produsului." },
      tip: { type: "string", enum: KINDS },
      observatii: { type: "string" },
    },
    required: ["item_id", "cantitate"],
  },
  roles: ["admin", "operator"],
  version: 1,
  kind: "write",
  parse: (args) => {
    const raw = asObject(args);
    const tip = (optionalString(raw, "tip") ?? "productie") as ProductionKind;
    if (!KINDS.includes(tip)) {
      throw new InvalidToolArgumentsError(`„tip" trebuie să fie unul din: ${KINDS.join(", ")}.`);
    }
    return {
      item_id: requiredString(raw, "item_id"),
      cantitate: positiveNumber(raw, "cantitate"),
      tip,
      observatii: optionalString(raw, "observatii"),
    };
  },
  summary: (input) => `Pornește ${PRODUCTION_KIND_LABELS[input.tip].toLowerCase()}`,
  resultSummary: (input, result) =>
    `Am înregistrat procesul: ${input.cantitate} din **${resultField(result, "denumire") ?? "produs"}** (${PRODUCTION_KIND_LABELS[input.tip].toLowerCase()}). Materiile prime s-au scăzut din stoc, iar produsul a intrat ca lot nou.`,
  presentation: async (input): Promise<CardPresentation> => {
    let product = "Produs indisponibil";
    let consumption: string;
    try {
      const { recipe, lines } = await planProduction(input);
      product = `${recipe.itemTitle} · ${DIRECTION_LABELS[recipe.direction]}`;
      consumption = lines.map(describeLine).join("; ");
    } catch (err) {
      consumption = err instanceof Error ? err.message : "Nu am putut calcula consumul.";
    }
    return {
      renderer: "generic",
      fields: [
        infoField("item_id", "Produs", product),
        infoField("cantitate", "Cantitate produsă", String(input.cantitate)),
        infoField("tip", "Tip proces", PRODUCTION_KIND_LABELS[input.tip]),
        infoField("consum", "Consum estimat", consumption),
        infoField(
          "efect",
          "Ce se întâmplă",
          "Stocul materiilor prime scade acum (FIFO, recalculat la confirmare) și se creează " +
            "un lot nou din produs. Procesul confirmat nu se mai poate șterge.",
        ),
        textField("observatii", "Observații", input.observatii),
      ],
    };
  },
  execute: async (input) => {
    const { recipe, lines } = await planProduction(input);
    const failed = lines.find((line) => line.error);
    if (failed) {
      throw new InvalidToolArgumentsError(`${failed.itemTitle}: ${failed.error}.`);
    }
    const process = await confirmProcess({
      type: "output_fixed",
      outputItemId: recipe.itemId,
      recipeId: recipe.recipeId,
      notes: input.observatii,
      inputs: lines.map((line) => ({
        itemId: line.itemId,
        lotIds: line.allocation.map((allocation) => allocation.lotId),
        qty: line.qty,
      })),
      outputs: [
        {
          itemId: recipe.itemId,
          qty: input.cantitate,
          provenance: PRODUCTION_KIND_TO_PROVENANCE[input.tip],
        },
      ],
    });
    const item = await getItemById(recipe.itemId);
    return {
      proces_id: process.id,
      item_id: recipe.itemId,
      denumire: recipe.itemTitle,
      link: `/productie/${process.id}`,
      ...(item ? { link_produs: itemHref(item) } : {}),
    };
  },
};

export const PRODUCTION_READ_TOOLS = [retetaProdus];
export const PRODUCTION_WRITE_TOOLS = [creeazaReteta, pornesteProductie];
