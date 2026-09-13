import { normalizeCui } from "@/features/clients/cui-lookup";
import { createClientRecord } from "@/features/clients/service";
import { createOrderWithItems, sendOrder } from "@/features/orders/service";
import type { ToolContext } from "../types";
import {
  asObject,
  InvalidToolArgumentsError,
  optionalBoolean,
  optionalString,
  positiveNumber,
  requiredString,
  type AssistantTool,
} from "./types";

/**
 * Tool-urile care SCRIU. Nu se executa niciodata direct din raspunsul modelului: `run.ts`
 * le salveaza ca propunere (`assistant_tool_calls.status = 'proposed'`), UI-ul arata
 * argumentele intr-un card editabil, iar executia are loc dupa confirmare umana.
 *
 * Toate apeleaza SERVICIILE existente (nu SQL), deci regulile de business - CUI unic per
 * organizatie, status initial `draft`, compensarea la esecul liniilor - raman intr-un
 * singur loc, iar RLS-ul se aplica pe sesiunea utilizatorului.
 */

interface CreateClientToolInput {
  cui: string;
  denumire: string;
  reg_com: string | null;
  adresa: string | null;
  email: string | null;
  telefon: string | null;
  persoana_contact: string | null;
  platitor_tva: boolean | null;
}

export const creeazaClient: AssistantTool<CreateClientToolInput> = {
  name: "creeaza_client",
  description:
    "Propune crearea unui client nou în organizație. Caută întâi datele firmei cu " +
    "`cauta_firma_dupa_cui` și completează câmpurile cu ce ai găsit. " +
    "Acțiunea NU se execută până când utilizatorul nu o confirmă.",
  parameters: {
    type: "object",
    properties: {
      cui: { type: "string", description: "CUI-ul firmei." },
      denumire: { type: "string", description: "Denumirea oficială." },
      reg_com: { type: "string", description: "Nr. de înregistrare la Registrul Comerțului." },
      adresa: { type: "string", description: "Adresa sediului social." },
      email: { type: "string" },
      telefon: { type: "string" },
      persoana_contact: { type: "string" },
      platitor_tva: { type: "boolean" },
    },
    required: ["cui", "denumire"],
  },
  roles: ["admin", "operator"],
  kind: "write",
  parse: (args) => {
    const raw = asObject(args);
    return {
      cui: normalizeCui(requiredString(raw, "cui")),
      denumire: requiredString(raw, "denumire"),
      reg_com: optionalString(raw, "reg_com"),
      adresa: optionalString(raw, "adresa"),
      email: optionalString(raw, "email"),
      telefon: optionalString(raw, "telefon"),
      persoana_contact: optionalString(raw, "persoana_contact"),
      platitor_tva: optionalBoolean(raw, "platitor_tva"),
    };
  },
  summary: (input) => `Creează clientul „${input.denumire}" (CUI ${input.cui})`,
  fields: (input) => [
    { name: "denumire", label: "Denumire", value: input.denumire },
    { name: "cui", label: "CUI", value: input.cui },
    { name: "reg_com", label: "Nr. reg. com.", value: input.reg_com ?? "" },
    { name: "adresa", label: "Adresă sediu", value: input.adresa ?? "" },
    { name: "email", label: "Email", value: input.email ?? "" },
    { name: "telefon", label: "Telefon", value: input.telefon ?? "" },
    { name: "persoana_contact", label: "Persoană de contact", value: input.persoana_contact ?? "" },
  ],
  execute: async (input, ctx: ToolContext) => {
    if (!ctx.organizationId) {
      throw new InvalidToolArgumentsError("Utilizatorul curent nu are o organizație asociată.");
    }
    const client = await createClientRecord({
      organizationId: ctx.organizationId,
      cui: input.cui,
      name: input.denumire,
      regCom: input.reg_com,
      hqAddress: input.adresa,
      email: input.email,
      phone: input.telefon,
      contactPerson: input.persoana_contact,
      isVatPayer: input.platitor_tva ?? false,
    });
    return { client_id: client.id, denumire: client.name, link: `/clienti/${client.id}` };
  },
};

interface CreateOrderToolInput {
  client_id: string;
  linii: { item_id: string; cantitate: number }[];
  data_livrare: string | null;
  observatii: string | null;
}

export const creeazaComanda: AssistantTool<CreateOrderToolInput> = {
  name: "creeaza_comanda",
  description:
    "Propune o comandă nouă pentru un client. Ai nevoie de `client_id` (din `listeaza_clienti` " +
    "sau din rezultatul creării clientului) și de `item_id`-uri (din `itemi_vandabili`). " +
    "Comanda se creează în status Ciornă. Acțiunea NU se execută până la confirmare.",
  parameters: {
    type: "object",
    properties: {
      client_id: { type: "string", description: "ID-ul clientului." },
      linii: {
        type: "array",
        description: "Liniile comenzii.",
        items: {
          type: "object",
          properties: {
            item_id: { type: "string" },
            cantitate: { type: "number" },
          },
          required: ["item_id", "cantitate"],
        },
      },
      data_livrare: { type: "string", description: "Data livrării, format YYYY-MM-DD." },
      observatii: { type: "string" },
    },
    required: ["client_id", "linii"],
  },
  roles: ["admin", "operator"],
  kind: "write",
  parse: (args) => {
    const raw = asObject(args);
    const lines = raw.linii;
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new InvalidToolArgumentsError("Comanda trebuie să aibă cel puțin o linie.");
    }

    const date = optionalString(raw, "data_livrare");
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new InvalidToolArgumentsError('„data_livrare" trebuie să fie în formatul YYYY-MM-DD.');
    }

    return {
      client_id: requiredString(raw, "client_id"),
      linii: lines.map((line) => {
        const item = asObject(line);
        return {
          item_id: requiredString(item, "item_id"),
          cantitate: positiveNumber(item, "cantitate"),
        };
      }),
      data_livrare: date,
      observatii: optionalString(raw, "observatii"),
    };
  },
  summary: (input) =>
    `Creează o comandă cu ${input.linii.length} ${input.linii.length === 1 ? "linie" : "linii"}`,
  fields: (input) => [
    { name: "client_id", label: "Client (ID)", value: input.client_id },
    {
      name: "linii",
      label: "Linii",
      value: input.linii.map((line) => `${line.item_id} x ${line.cantitate}`).join(", "),
    },
    { name: "data_livrare", label: "Dată livrare", value: input.data_livrare ?? "" },
    { name: "observatii", label: "Observații", value: input.observatii ?? "" },
  ],
  execute: async (input, ctx) => {
    if (!ctx.organizationId) {
      throw new InvalidToolArgumentsError("Utilizatorul curent nu are o organizație asociată.");
    }
    const order = await createOrderWithItems({
      organizationId: ctx.organizationId,
      clientId: input.client_id,
      createdByAdmin: true,
      deliveryDate: input.data_livrare,
      notes: input.observatii,
      lines: input.linii.map((line) => ({ itemId: line.item_id, quantity: line.cantitate })),
    });
    return { order_id: order.id, numar: order.orderNumber, link: `/comenzi/${order.id}` };
  },
};

export const trimiteComanda: AssistantTool<{ order_id: string }> = {
  name: "trimite_comanda",
  description:
    "Propune trimiterea unei comenzi din Ciornă în Trimisă. Nu mișcă stoc. " +
    "Acțiunea NU se execută până la confirmare.",
  parameters: {
    type: "object",
    properties: { order_id: { type: "string" } },
    required: ["order_id"],
  },
  roles: ["admin", "operator"],
  kind: "write",
  parse: (args) => ({ order_id: requiredString(asObject(args), "order_id") }),
  summary: () => "Trimite comanda către acceptare",
  fields: (input) => [{ name: "order_id", label: "Comandă (ID)", value: input.order_id }],
  execute: async (input, ctx) => {
    if (!ctx.organizationId) {
      throw new InvalidToolArgumentsError("Utilizatorul curent nu are o organizație asociată.");
    }
    const order = await sendOrder(input.order_id, ctx.organizationId);
    return { order_id: order.id, status: order.status, link: `/comenzi/${order.id}` };
  },
};

export const WRITE_TOOLS = [
  creeazaClient,
  creeazaComanda,
  trimiteComanda,
] as unknown as AssistantTool<never>[];
