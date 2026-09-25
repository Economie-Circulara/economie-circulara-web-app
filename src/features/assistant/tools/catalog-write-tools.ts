import { normalizeCui } from "@/features/clients/cui-lookup";
import { getClient } from "@/features/clients/queries";
import { setClientArchived, updateClientRecord } from "@/features/clients/service";
import { itemHref } from "@/features/items/item-links";
import { KIND_LABELS, UNIT_LABELS } from "@/features/items/labels";
import { getItemById } from "@/features/items/queries";
import { createItem, setItemArchived, updateItem } from "@/features/items/service";
import type { ItemKind, UnitOfMeasure } from "@/features/items/types";
import { getRecipeByItemId } from "@/features/recipes/queries";
import { setRecipeArchived } from "@/features/recipes/service";
import { resultField } from "../result-summary";
import type { ToolContext } from "../types";
import { booleanField, infoField, textField } from "./fields";
import type { CardPresentation } from "./presentation-types";
import {
  asObject,
  InvalidToolArgumentsError,
  optionalBoolean,
  optionalString,
  requiredString,
  type AssistantTool,
} from "./types";

/**
 * Tool-uri de scriere pe catalog: editare client, material/abonament nou sau editat,
 * arhivare. Aceleasi servicii ca formularele din `/clienti`, `/itemi`, `/abonamente`,
 * `/retete`; stergerea fizica NU exista (AGENTS.md §4 - doar arhivare reversibila).
 */

const UNITS = Object.keys(UNIT_LABELS) as UnitOfMeasure[];
const UNIT_HINT = `UM (${UNITS.join(" / ")})`;

function parseUnit(value: string | null): UnitOfMeasure | null {
  if (value === null) return null;
  const unit = value.toLowerCase() as UnitOfMeasure;
  if (!UNITS.includes(unit)) {
    throw new InvalidToolArgumentsError(
      `UM invalidă „${value}". Valori permise: ${UNITS.join(", ")}.`,
    );
  }
  return unit;
}

function requireOrg(ctx: ToolContext): string {
  if (!ctx.organizationId) {
    throw new InvalidToolArgumentsError("Utilizatorul curent nu are o organizație asociată.");
  }
  return ctx.organizationId;
}

// ---------------------------------------------------------------------------
// editeaza_client

interface EditClientInput {
  client_id: string;
  denumire: string | null;
  cui: string | null;
  reg_com: string | null;
  adresa: string | null;
  email: string | null;
  telefon: string | null;
  persoana_contact: string | null;
  platitor_tva: boolean | null;
}

/** Valorile finale: ce a propus modelul peste datele actuale ale clientului. */
function mergedClient(
  client: NonNullable<Awaited<ReturnType<typeof getClient>>>,
  input: EditClientInput,
) {
  return {
    denumire: input.denumire ?? client.name,
    cui: input.cui ?? client.cui,
    reg_com: input.reg_com ?? client.regCom,
    adresa: input.adresa ?? client.hqAddress,
    email: input.email ?? client.email,
    telefon: input.telefon ?? client.phone,
    persoana_contact: input.persoana_contact ?? client.contactPerson,
    platitor_tva: input.platitor_tva ?? client.isVatPayer,
  };
}

async function requireClient(id: string) {
  const client = await getClient(id);
  if (!client) throw new InvalidToolArgumentsError("Clientul nu există sau nu este accesibil.");
  return client;
}

export const editeazaClient: AssistantTool<EditClientInput> = {
  name: "editeaza_client",
  description:
    "Propune modificarea datelor unui client existent (`client_id` din `listeaza_clienti`). " +
    "Trimite DOAR câmpurile care se schimbă; restul rămân cum sunt. " +
    "Acțiunea NU se execută până la confirmare.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      client_id: { type: "string" },
      denumire: { type: "string" },
      cui: { type: "string" },
      reg_com: { type: "string" },
      adresa: { type: "string", description: "Adresa sediului social." },
      email: { type: "string" },
      telefon: { type: "string" },
      persoana_contact: { type: "string" },
      platitor_tva: { type: "boolean" },
    },
    required: ["client_id"],
  },
  roles: ["admin", "operator"],
  version: 1,
  kind: "write",
  parse: (args) => {
    const raw = asObject(args);
    const cui = optionalString(raw, "cui");
    return {
      client_id: requiredString(raw, "client_id"),
      denumire: optionalString(raw, "denumire"),
      cui: cui ? normalizeCui(cui) : null,
      reg_com: optionalString(raw, "reg_com"),
      adresa: optionalString(raw, "adresa"),
      email: optionalString(raw, "email"),
      telefon: optionalString(raw, "telefon"),
      persoana_contact: optionalString(raw, "persoana_contact"),
      platitor_tva: optionalBoolean(raw, "platitor_tva"),
    };
  },
  summary: (input) => `Modifică clientul${input.denumire ? ` „${input.denumire}"` : ""}`,
  resultSummary: (_input, result) =>
    `Am actualizat datele clientului **${resultField(result, "denumire") ?? ""}**.`,
  presentation: async (input): Promise<CardPresentation> => {
    const client = await getClient(input.client_id);
    if (!client) {
      return {
        renderer: "generic",
        fields: [infoField("client_id", "Client", "Client indisponibil")],
      };
    }
    const next = mergedClient(client, input);
    return {
      renderer: "generic",
      fields: [
        infoField("client_id", "Client", `${client.name} (CUI ${client.cui})`),
        textField("denumire", "Denumire", next.denumire),
        textField("cui", "CUI", next.cui),
        textField("reg_com", "Nr. reg. com.", next.reg_com),
        textField("adresa", "Adresă sediu", next.adresa),
        textField("email", "Email", next.email),
        textField("telefon", "Telefon", next.telefon),
        textField("persoana_contact", "Persoană de contact", next.persoana_contact),
        booleanField("platitor_tva", "Plătitor de TVA", next.platitor_tva),
      ],
    };
  },
  execute: async (input) => {
    const client = await requireClient(input.client_id);
    const next = mergedClient(client, input);
    const updated = await updateClientRecord({
      id: client.id,
      name: next.denumire,
      cui: next.cui,
      regCom: next.reg_com,
      hqAddress: next.adresa,
      email: next.email,
      phone: next.telefon,
      contactPerson: next.persoana_contact,
      isVatPayer: next.platitor_tva,
      // Campuri pe care tool-ul nu le atinge - pastrate explicit (update-ul le suprascrie).
      isSupplier: client.isSupplier,
      notes: client.notes,
    });
    return { client_id: updated.id, denumire: updated.name, link: `/clienti/${updated.id}` };
  },
};

// ---------------------------------------------------------------------------
// creeaza_item / editeaza_item

type ItemTypeArg = "material" | "abonament";
const KIND_BY_TYPE: Record<ItemTypeArg, ItemKind> = { material: "physical", abonament: "service" };

interface CreateItemToolInput {
  tip: ItemTypeArg;
  denumire: string;
  um: UnitOfMeasure;
  vandabil: boolean;
  nelimitat: boolean;
  descriere: string | null;
}

export const creeazaItem: AssistantTool<CreateItemToolInput> = {
  name: "creeaza_item",
  description:
    "Propune adăugarea unui MATERIAL (produs fizic, cu stoc) sau ABONAMENT (produs-ca-serviciu) " +
    "în catalog. `nelimitat` = material generic fără stoc real (apă, aer). Verifică întâi cu " +
    "`itemi_vandabili` că nu există deja. Acțiunea NU se execută până la confirmare.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      tip: { type: "string", enum: ["material", "abonament"] },
      denumire: { type: "string" },
      um: { type: "string", enum: UNITS, description: "Unitatea de măsură." },
      vandabil: { type: "boolean", description: "Poate fi pus pe o comandă de vânzare." },
      nelimitat: {
        type: "boolean",
        description: "Doar pentru materiale: fără stoc urmărit (apă, aer). Implicit false.",
      },
      descriere: { type: "string" },
    },
    required: ["tip", "denumire", "um"],
  },
  roles: ["admin", "operator"],
  version: 1,
  kind: "write",
  parse: (args) => {
    const raw = asObject(args);
    const tip = requiredString(raw, "tip");
    if (tip !== "material" && tip !== "abonament") {
      throw new InvalidToolArgumentsError('„tip" trebuie să fie „material" sau „abonament".');
    }
    return {
      tip,
      denumire: requiredString(raw, "denumire"),
      um: parseUnit(requiredString(raw, "um"))!,
      vandabil: optionalBoolean(raw, "vandabil") ?? true,
      nelimitat: tip === "material" ? (optionalBoolean(raw, "nelimitat") ?? false) : false,
      descriere: optionalString(raw, "descriere"),
    };
  },
  summary: (input) =>
    `Adaugă ${input.tip === "abonament" ? "abonamentul" : "materialul"} „${input.denumire}"`,
  resultSummary: (input) =>
    `Am adăugat ${input.tip === "abonament" ? "abonamentul" : "materialul"} **${input.denumire}** (${input.um}${input.vandabil ? ", vandabil" : ""}).`,
  presentation: async (input): Promise<CardPresentation> => ({
    renderer: "generic",
    fields: [
      infoField("tip", "Tip", KIND_LABELS[KIND_BY_TYPE[input.tip]]),
      textField("denumire", "Denumire", input.denumire),
      textField("um", UNIT_HINT, input.um),
      booleanField("vandabil", "Vandabil", input.vandabil),
      ...(input.tip === "material"
        ? [booleanField("nelimitat", "Nelimitat (fără stoc urmărit)", input.nelimitat)]
        : []),
      textField("descriere", "Descriere", input.descriere),
    ],
  }),
  execute: async (input, ctx) => {
    const item = await createItem({
      organizationId: requireOrg(ctx),
      title: input.denumire,
      description: input.descriere,
      unit: input.um,
      kind: KIND_BY_TYPE[input.tip],
      isTracked: !input.nelimitat,
      sellable: input.vandabil,
    });
    return { item_id: item.id, denumire: item.title, um: item.unit, link: itemHref(item) };
  },
};

interface EditItemToolInput {
  item_id: string;
  denumire: string | null;
  um: UnitOfMeasure | null;
  vandabil: boolean | null;
  nelimitat: boolean | null;
  descriere: string | null;
}

async function requireItem(id: string) {
  const item = await getItemById(id);
  if (!item)
    throw new InvalidToolArgumentsError("Materialul/abonamentul nu există sau nu e accesibil.");
  return item;
}

function mergedItem(item: Awaited<ReturnType<typeof requireItem>>, input: EditItemToolInput) {
  return {
    denumire: input.denumire ?? item.title,
    um: input.um ?? item.unit,
    vandabil: input.vandabil ?? item.sellable,
    nelimitat: item.kind === "physical" ? (input.nelimitat ?? !item.isTracked) : false,
    descriere: input.descriere ?? item.description,
  };
}

export const editeazaItem: AssistantTool<EditItemToolInput> = {
  name: "editeaza_item",
  description:
    "Propune modificarea unui material/abonament existent (`item_id`). Trimite DOAR câmpurile " +
    "care se schimbă. Tipul (material/abonament) nu se poate schimba. " +
    "Acțiunea NU se execută până la confirmare.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      item_id: { type: "string" },
      denumire: { type: "string" },
      um: { type: "string", enum: UNITS },
      vandabil: { type: "boolean" },
      nelimitat: { type: "boolean" },
      descriere: { type: "string" },
    },
    required: ["item_id"],
  },
  roles: ["admin", "operator"],
  version: 1,
  kind: "write",
  parse: (args) => {
    const raw = asObject(args);
    return {
      item_id: requiredString(raw, "item_id"),
      denumire: optionalString(raw, "denumire"),
      um: parseUnit(optionalString(raw, "um")),
      vandabil: optionalBoolean(raw, "vandabil"),
      nelimitat: optionalBoolean(raw, "nelimitat"),
      descriere: optionalString(raw, "descriere"),
    };
  },
  summary: () => "Modifică materialul/abonamentul",
  resultSummary: (_input, result) => `Am actualizat **${resultField(result, "denumire") ?? ""}**.`,
  presentation: async (input): Promise<CardPresentation> => {
    const item = await getItemById(input.item_id);
    if (!item) {
      return { renderer: "generic", fields: [infoField("item_id", "Produs", "Indisponibil")] };
    }
    const next = mergedItem(item, input);
    return {
      renderer: "generic",
      fields: [
        infoField("item_id", KIND_LABELS[item.kind], item.title),
        textField("denumire", "Denumire", next.denumire),
        textField("um", UNIT_HINT, next.um),
        booleanField("vandabil", "Vandabil", next.vandabil),
        ...(item.kind === "physical"
          ? [booleanField("nelimitat", "Nelimitat (fără stoc urmărit)", next.nelimitat)]
          : []),
        textField("descriere", "Descriere", next.descriere),
      ],
    };
  },
  execute: async (input) => {
    const item = await requireItem(input.item_id);
    const next = mergedItem(item, input);
    // Fara cheia `imageUrl` - poza existenta ramane neatinsa (vezi `UpdateItemInput`).
    const updated = await updateItem(item.id, {
      title: next.denumire,
      description: next.descriere,
      unit: next.um,
      kind: item.kind,
      isTracked: !next.nelimitat,
      sellable: next.vandabil,
    });
    return { item_id: updated.id, denumire: updated.title, link: itemHref(updated) };
  },
};

// ---------------------------------------------------------------------------
// arhiveaza

type ArchiveTarget = "client" | "item" | "reteta";
const ARCHIVE_TARGETS: ArchiveTarget[] = ["client", "item", "reteta"];

interface ArchiveInput {
  tip: ArchiveTarget;
  id: string;
}

const ARCHIVE_EFFECT: Record<ArchiveTarget, string> = {
  client:
    "Clientul dispare din liste și selecturi, iar contul lui din portal se blochează. " +
    "Comenzile și certificatele rămân. Se poate restaura din pagina clientului.",
  item:
    "Produsul dispare din liste și selecturi (comenzi, rețete, producție). Istoricul rămâne. " +
    "Se poate restaura din pagina lui.",
  reteta:
    "Rețeta nu mai poate porni procese noi. Procesele vechi rămân. Se poate restaura din editorul rețetei.",
};

async function archiveLabel(input: ArchiveInput): Promise<string> {
  if (input.tip === "client") {
    const client = await getClient(input.id);
    return client ? `Client: ${client.name}` : "Client indisponibil";
  }
  const item = await getItemById(input.id);
  if (!item) return "Produs indisponibil";
  return input.tip === "reteta"
    ? `Rețeta produsului ${item.title}`
    : `${KIND_LABELS[item.kind]}: ${item.title}`;
}

export const arhiveaza: AssistantTool<ArchiveInput> = {
  name: "arhiveaza",
  description:
    "Propune ARHIVAREA (ștergere reversibilă) unui client, material/abonament sau a rețetei " +
    "unui produs. Nimic nu se șterge fizic. `id` = `client_id` pentru client, `item_id` pentru " +
    "item și pentru rețetă (rețeta produsului respectiv). Acțiunea NU se execută până la confirmare.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      tip: { type: "string", enum: ARCHIVE_TARGETS },
      id: { type: "string" },
    },
    required: ["tip", "id"],
  },
  roles: ["admin", "operator"],
  version: 1,
  kind: "write",
  parse: (args) => {
    const raw = asObject(args);
    const tip = requiredString(raw, "tip") as ArchiveTarget;
    if (!ARCHIVE_TARGETS.includes(tip)) {
      throw new InvalidToolArgumentsError(
        `„tip" trebuie să fie unul din: ${ARCHIVE_TARGETS.join(", ")}.`,
      );
    }
    return { tip, id: requiredString(raw, "id") };
  },
  summary: (input) =>
    input.tip === "client"
      ? "Arhivează clientul"
      : input.tip === "item"
        ? "Arhivează produsul"
        : "Arhivează rețeta",
  resultSummary: (input) =>
    `Am arhivat ${input.tip === "client" ? "clientul" : input.tip === "item" ? "produsul" : "rețeta"}. Nu s-a pierdut nimic din istoric; se poate restaura din aplicație.`,
  presentation: async (input): Promise<CardPresentation> => ({
    renderer: "generic",
    fields: [
      infoField("id", "Ce se arhivează", await archiveLabel(input)),
      infoField("efect", "Ce se întâmplă", ARCHIVE_EFFECT[input.tip]),
    ],
  }),
  execute: async (input) => {
    if (input.tip === "client") {
      await setClientArchived(input.id, true);
      return { client_id: input.id, arhivat: true };
    }
    if (input.tip === "item") {
      await setItemArchived(input.id, true);
      return { item_id: input.id, arhivat: true };
    }
    const recipe = await getRecipeByItemId(input.id);
    if (!recipe) throw new InvalidToolArgumentsError("Produsul nu are o rețetă.");
    await setRecipeArchived(recipe.recipeId, true);
    return { item_id: input.id, reteta_arhivata: true };
  },
};

export const CATALOG_WRITE_TOOLS = [editeazaClient, creeazaItem, editeazaItem, arhiveaza];
