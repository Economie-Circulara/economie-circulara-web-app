import { normalizeCui } from "@/features/clients/cui-lookup";
import { createClientRecord } from "@/features/clients/service";
import {
  listClientAddressesGrouped,
  listIntakeItemOptions,
  listSellableItemOptions,
} from "@/features/orders/queries";
import { ORDER_TYPE_LABELS } from "@/features/orders/labels";
import type { OrderType } from "@/features/orders/types";
import { listClients } from "@/features/clients/queries";
import { createOrderWithItems, sendOrder } from "@/features/orders/service";
import { getOrderDetail } from "@/features/orders/queries";
import { planDelivery } from "@/features/deliveries/service";
import type { PlanDeliveryRouteChoice } from "@/features/deliveries/types";
import { computeRouteBetween } from "@/features/routing/route-service";
import { getDefaultSite, getSiteById } from "@/features/routing/site-queries";
import type { OrganizationSite } from "@/features/routing/site-types";
import { resultField } from "../result-summary";
import type { ToolContext } from "../types";
import { CATALOG_WRITE_TOOLS } from "./catalog-write-tools";
import { ORDER_WRITE_TOOLS } from "./order-write-tools";
import { PRODUCTION_WRITE_TOOLS } from "./production-tools";
import type { CardPresentation } from "./presentation-types";
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
 * argumentele intr-un card TIPAT (`presentation()` - vezi
 * docs/plans/asistent-contract-capabilitati.md), iar executia are loc dupa confirmare
 * umana, revendicata atomic (`run.ts#confirmAction`).
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
    additionalProperties: false,
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
  version: 1,
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
  resultSummary: (input, result) =>
    `Am adăugat clientul **${resultField(result, "denumire") ?? input.denumire}** (CUI ${input.cui}).`,
  presentation: async (input): Promise<CardPresentation> => ({
    renderer: "generic",
    fields: [
      {
        name: "denumire",
        label: "Denumire",
        displayValue: input.denumire,
        editable: true,
        kind: "text",
        value: input.denumire,
      },
      {
        name: "cui",
        label: "CUI",
        displayValue: input.cui,
        editable: true,
        kind: "text",
        value: input.cui,
      },
      {
        name: "reg_com",
        label: "Nr. reg. com.",
        displayValue: input.reg_com ?? "-",
        editable: true,
        kind: "text",
        value: input.reg_com ?? "",
      },
      {
        name: "adresa",
        label: "Adresă sediu",
        displayValue: input.adresa ?? "-",
        editable: true,
        kind: "text",
        value: input.adresa ?? "",
      },
      {
        name: "email",
        label: "Email",
        displayValue: input.email ?? "-",
        editable: true,
        kind: "text",
        value: input.email ?? "",
      },
      {
        name: "telefon",
        label: "Telefon",
        displayValue: input.telefon ?? "-",
        editable: true,
        kind: "text",
        value: input.telefon ?? "",
      },
      {
        name: "persoana_contact",
        label: "Persoană de contact",
        displayValue: input.persoana_contact ?? "-",
        editable: true,
        kind: "text",
        value: input.persoana_contact ?? "",
      },
      {
        name: "platitor_tva",
        label: "Plătitor de TVA",
        displayValue: input.platitor_tva ? "Da" : "Nu",
        editable: true,
        kind: "boolean",
        value: input.platitor_tva ?? false,
      },
    ],
  }),
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
  tip_comanda: OrderType;
  linii: { item_id: string; cantitate: number }[];
  adresa_livrare_id: string | null;
  data_livrare: string | null;
  data_retur_estimata: string | null;
  observatii: string | null;
}

/**
 * Tipul implicit cand modelul nu il precizeaza. Diferit fata de ecranul
 * `/comenzi/nou` (unde alegerea e OBLIGATORIE): tool-ul exista de dinaintea
 * migrarii 0030 si trebuie sa ramana compatibil cu conversatiile care nu stiu de
 * tipuri - `material` (vanzare clasica) e comportamentul de pana acum. Utilizatorul
 * vede si poate corecta tipul in cardul de confirmare inainte de executie.
 */
const DEFAULT_ORDER_TYPE: OrderType = "material";

const ORDER_TYPE_VALUES: OrderType[] = ["material", "serviciu", "aport"];

/** Cate linii accepta o comanda propusa de asistent - suficient pentru orice comanda reala, apara modelul sa produca un array uriaș. */
const MAX_ORDER_LINES = 50;

export const creeazaComanda: AssistantTool<CreateOrderToolInput> = {
  name: "creeaza_comanda",
  description:
    "Propune o comandă nouă pentru un client. Ai nevoie de `client_id` (din `listeaza_clienti` " +
    "sau din rezultatul creării clientului), de `item_id`-uri (din `itemi_vandabili`) și, opțional, " +
    "de `adresa_livrare_id` (din adresele clientului, dacă utilizatorul a precizat una). " +
    "Comanda se creează în status Ciornă. Acțiunea NU se execută până la confirmare.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      client_id: { type: "string", description: "ID-ul clientului." },
      tip_comanda: {
        type: "string",
        enum: ["material", "serviciu", "aport"],
        description:
          "Tipul comenzii: `material` (vânzare de produse, implicit), `serviciu` " +
          "(abonament / product-as-a-service, permite `data_retur_estimata`) sau `aport` " +
          "(clientul aduce material către organizație - crește stocul). " +
          "Dacă utilizatorul nu precizează, lasă gol (se folosește `material`).",
      },
      linii: {
        type: "array",
        description: "Liniile comenzii.",
        minItems: 1,
        maxItems: MAX_ORDER_LINES,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            item_id: { type: "string" },
            cantitate: { type: "number" },
          },
          required: ["item_id", "cantitate"],
        },
      },
      adresa_livrare_id: { type: "string", description: "ID-ul adresei de livrare a clientului." },
      data_livrare: { type: "string", description: "Data livrării, format YYYY-MM-DD." },
      data_retur_estimata: {
        type: "string",
        description:
          "Data estimată de retur (doar pentru `tip_comanda = serviciu`, abonament), " +
          "format YYYY-MM-DD.",
      },
      observatii: { type: "string" },
    },
    required: ["client_id", "linii"],
  },
  roles: ["admin", "operator"],
  // v2 (migrarea 0030): schema are `tip_comanda`/`data_retur_estimata`, iar o
  // comanda are acum obligatoriu un tip. Un apel vechi (v1, fara `tip_comanda`) se
  // interpreteaza ca `material` - vezi DEFAULT_ORDER_TYPE.
  version: 2,
  kind: "write",
  parse: (args) => {
    const raw = asObject(args);
    const lines = raw.linii;
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new InvalidToolArgumentsError("Comanda trebuie să aibă cel puțin o linie.");
    }
    if (lines.length > MAX_ORDER_LINES) {
      throw new InvalidToolArgumentsError(
        `Comanda poate avea cel mult ${MAX_ORDER_LINES} de linii.`,
      );
    }

    const date = optionalString(raw, "data_livrare");
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new InvalidToolArgumentsError('„data_livrare" trebuie să fie în formatul YYYY-MM-DD.');
    }

    const returnDate = optionalString(raw, "data_retur_estimata");
    if (returnDate && !/^\d{4}-\d{2}-\d{2}$/.test(returnDate)) {
      throw new InvalidToolArgumentsError(
        '„data_retur_estimata" trebuie să fie în formatul YYYY-MM-DD.',
      );
    }

    const rawType = optionalString(raw, "tip_comanda");
    const orderType = ORDER_TYPE_VALUES.find((type) => type === rawType);
    if (rawType && !orderType) {
      throw new InvalidToolArgumentsError(
        '„tip_comanda" trebuie să fie „material", „serviciu" sau „aport".',
      );
    }

    return {
      client_id: requiredString(raw, "client_id"),
      tip_comanda: orderType ?? DEFAULT_ORDER_TYPE,
      linii: lines.map((line) => {
        const item = asObject(line);
        return {
          item_id: requiredString(item, "item_id"),
          cantitate: positiveNumber(item, "cantitate"),
        };
      }),
      adresa_livrare_id: optionalString(raw, "adresa_livrare_id"),
      data_livrare: date,
      data_retur_estimata: returnDate,
      observatii: optionalString(raw, "observatii"),
    };
  },
  summary: (input) =>
    `Creează o comandă cu ${input.linii.length} ${input.linii.length === 1 ? "linie" : "linii"}`,
  resultSummary: (input, result) => {
    const number = resultField(result, "numar");
    return `Am creat comanda${number ? ` **${number}**` : ""} (${ORDER_TYPE_LABELS[input.tip_comanda].toLowerCase()}, ${input.linii.length} ${input.linii.length === 1 ? "linie" : "linii"}), în status Ciornă.`;
  },
  presentation: async (input): Promise<CardPresentation> => {
    // AMBELE cataloage, ca ecranul /comenzi/nou: `material`/`serviciu` folosesc
    // itemii vandabili, `aport` itemii fizici trasati (inclusiv nevandabili - ex.
    // moloz, care exista tocmai ca sa fie ADUS, nu vandut). Incarcate mereu
    // amandoua, nu doar cel al tipului propus: tipul e editabil in card, iar la
    // schimbarea lui liniile deja propuse trebuie sa ramana afisabile.
    const [clients, addressesByClient, itemOptions, intakeItemOptions] = await Promise.all([
      listClients(),
      listClientAddressesGrouped(),
      listSellableItemOptions(),
      listIntakeItemOptions(),
    ]);

    return {
      renderer: "order_draft",
      draft: {
        orderType: input.tip_comanda,
        clientId: input.client_id,
        deliveryAddressId: input.adresa_livrare_id ?? "",
        deliveryDate: input.data_livrare ?? "",
        expectedReturnDate: input.data_retur_estimata ?? "",
        notes: input.observatii ?? "",
        lines: input.linii.map((line) => ({ itemId: line.item_id, quantity: line.cantitate })),
      },
      options: { clients, addressesByClient, itemOptions, intakeItemOptions },
    };
  },
  execute: async (input, ctx) => {
    if (!ctx.organizationId) {
      throw new InvalidToolArgumentsError("Utilizatorul curent nu are o organizație asociată.");
    }
    const order = await createOrderWithItems({
      organizationId: ctx.organizationId,
      clientId: input.client_id,
      orderType: input.tip_comanda,
      createdByAdmin: true,
      deliveryAddressId: input.adresa_livrare_id,
      deliveryDate: input.data_livrare,
      expectedReturnDate: input.data_retur_estimata,
      notes: input.observatii,
      lines: input.linii.map((line) => ({ itemId: line.item_id, quantity: line.cantitate })),
    });
    return { order_id: order.id, numar: order.orderNumber, link: `/comenzi/${order.id}` };
  },
};

export const trimiteComanda: AssistantTool<{ order_id: string }> = {
  name: "trimite_comanda",
  description:
    "Propune trimiterea unei comenzi din Ciornă în Înaintată. Nu mișcă stoc. " +
    "Acțiunea NU se execută până la confirmare.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: { order_id: { type: "string" } },
    required: ["order_id"],
  },
  roles: ["admin", "operator"],
  version: 1,
  kind: "write",
  parse: (args) => ({ order_id: requiredString(asObject(args), "order_id") }),
  summary: () => "Înaintează comanda spre aprobare",
  resultSummary: () => "Am înaintat comanda spre aprobare. Stocul se scade abia la acceptare.",
  presentation: async (input): Promise<CardPresentation> => {
    // ID-ul comenzii ramane o valoare interna - utilizatorul vede eticheta rezolvata
    // (numar + client), nu UUID-ul brut. Campul NU e editabil: schimbarea comenzii
    // tinta prin text liber n-are sens - o alta comanda inseamna o alta propunere.
    const order = await getOrderDetail(input.order_id);
    const displayValue = order
      ? `${order.orderNumber ?? "Comandă fără număr"} · ${order.clientName}`
      : "Comandă indisponibilă";
    return {
      renderer: "generic",
      fields: [{ name: "order_id", label: "Comandă", displayValue, editable: false, kind: "text" }],
    };
  },
  execute: async (input, ctx) => {
    if (!ctx.organizationId) {
      throw new InvalidToolArgumentsError("Utilizatorul curent nu are o organizație asociată.");
    }
    const order = await sendOrder(input.order_id, ctx.organizationId);
    return { order_id: order.id, status: order.status, link: `/comenzi/${order.id}` };
  },
};

interface PlanDeliveryToolInput {
  order_id: string;
  data_programata: string;
  transportator: string;
  nr_inmatriculare: string;
  sofer: string;
  punct_plecare_id: string | null;
  punct_plecare: string | null;
  punct_sosire: string | null;
}

/** Ce s-a putut rezolva din DB pt. o propunere de livrare - partajat de `presentation` si `execute`. */
interface ResolvedPlanDelivery {
  orderLabel: string;
  /** Punctul de plecare ales explicit (`punct_plecare_id`) sau cel implicit al organizatiei. */
  site: OrganizationSite | null;
  routeOrigin: string;
  routeDestination: string;
}

/**
 * Completeaza golurile pe care modelul n-are de unde sa le stie: punctul de plecare
 * (statia implicita a organizatiei, ca preselectia din /livrari/nou) si punctul de
 * sosire (adresa de livrare a comenzii). Nu ARUNCA daca lipsesc - cardul de
 * confirmare arata campurile goale si utilizatorul le completeaza; validarea dura
 * ramane in `planDelivery` (`DeliveryValidationError`).
 */
async function resolvePlanDelivery(input: PlanDeliveryToolInput): Promise<ResolvedPlanDelivery> {
  const [order, site] = await Promise.all([
    getOrderDetail(input.order_id),
    input.punct_plecare_id ? getSiteById(input.punct_plecare_id) : getDefaultSite(),
  ]);

  return {
    orderLabel: order
      ? `${order.orderNumber ?? "Comandă fără număr"} · ${order.clientName}`
      : "Comandă indisponibilă",
    site,
    routeOrigin: input.punct_plecare ?? site?.address ?? "",
    routeDestination: input.punct_sosire ?? order?.deliveryAddress ?? "",
  };
}

export const planificaLivrare: AssistantTool<PlanDeliveryToolInput> = {
  name: "planifica_livrare",
  description:
    "Propune planificarea livrării unei comenzi ACCEPTATE care nu are deja o livrare " +
    "(verifică întâi cu `context_livrare`). Ai nevoie de dată, transportator, nr. de " +
    "înmatriculare și șofer - cere-le utilizatorului dacă nu le-a spus. Punctul de plecare " +
    "(`punct_plecare_id`, din `context_livrare`) și punctul de sosire se completează automat " +
    "cu stația implicită, respectiv adresa de livrare a comenzii, dacă nu le dai. " +
    "Acțiunea NU se execută până la confirmare.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      order_id: { type: "string", description: "ID-ul comenzii (status Acceptată)." },
      data_programata: { type: "string", description: "Data livrării, format YYYY-MM-DD." },
      transportator: { type: "string", description: "Firma de transport." },
      nr_inmatriculare: { type: "string", description: "Nr. de înmatriculare al vehiculului." },
      sofer: { type: "string", description: "Numele șoferului." },
      punct_plecare_id: {
        type: "string",
        description:
          "ID-ul punctului de plecare al organizației (din `context_livrare`). " +
          "Dacă e dat, ruta se calculează automat și se salvează pe livrare.",
      },
      punct_plecare: {
        type: "string",
        description: "Adresa de plecare ca text liber - doar dacă nu se potrivește nicio stație.",
      },
      punct_sosire: {
        type: "string",
        description: "Adresa de sosire. Lipsă = adresa de livrare a comenzii.",
      },
    },
    required: ["order_id", "data_programata", "transportator", "nr_inmatriculare", "sofer"],
  },
  roles: ["admin", "operator"],
  version: 1,
  kind: "write",
  parse: (args) => {
    const raw = asObject(args);
    const date = requiredString(raw, "data_programata");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new InvalidToolArgumentsError(
        '„data_programata" trebuie să fie în formatul YYYY-MM-DD.',
      );
    }

    return {
      order_id: requiredString(raw, "order_id"),
      data_programata: date,
      transportator: requiredString(raw, "transportator"),
      nr_inmatriculare: requiredString(raw, "nr_inmatriculare"),
      sofer: requiredString(raw, "sofer"),
      punct_plecare_id: optionalString(raw, "punct_plecare_id"),
      punct_plecare: optionalString(raw, "punct_plecare"),
      punct_sosire: optionalString(raw, "punct_sosire"),
    };
  },
  summary: (input) => `Planifică livrarea comenzii pe ${input.data_programata}`,
  resultSummary: (input, result) => {
    const km = resultField(result, "distanta_km");
    const routeError = resultField(result, "ruta_eroare");
    const route = km
      ? ` Ruta recomandată: ${km} km.`
      : routeError
        ? ` Ruta nu s-a putut calcula (${routeError}) - o poți recalcula din ecranul livrării.`
        : "";
    return `Am planificat livrarea pe ${input.data_programata}.${route}`;
  },
  presentation: async (input): Promise<CardPresentation> => {
    const resolved = await resolvePlanDelivery(input);
    return {
      renderer: "generic",
      fields: [
        // Ca la `trimite_comanda`: comanda tinta e o valoare interna, afisata
        // rezolvata si NEeditabila - alta comanda inseamna alta propunere.
        {
          name: "order_id",
          label: "Comandă",
          displayValue: resolved.orderLabel,
          editable: false,
          kind: "text",
        },
        {
          name: "data_programata",
          label: "Data programată",
          displayValue: input.data_programata,
          editable: true,
          kind: "text",
          value: input.data_programata,
        },
        {
          name: "transportator",
          label: "Transportator",
          displayValue: input.transportator,
          editable: true,
          kind: "text",
          value: input.transportator,
        },
        {
          name: "nr_inmatriculare",
          label: "Nr. înmatriculare",
          displayValue: input.nr_inmatriculare,
          editable: true,
          kind: "text",
          value: input.nr_inmatriculare,
        },
        {
          name: "sofer",
          label: "Șofer",
          displayValue: input.sofer,
          editable: true,
          kind: "text",
          value: input.sofer,
        },
        {
          name: "punct_plecare",
          label: "Punct de plecare",
          displayValue: resolved.routeOrigin || "-",
          editable: true,
          kind: "text",
          value: resolved.routeOrigin,
        },
        {
          name: "punct_sosire",
          label: "Punct de sosire",
          displayValue: resolved.routeDestination || "-",
          editable: true,
          kind: "text",
          value: resolved.routeDestination,
        },
        // Statia aleasa nu e editabila ca text (ar rupe legatura cu `origin_site_id`):
        // se vede doar ca informatie, iar ruta se calculeaza pornind de la ea.
        {
          name: "statie_plecare",
          label: "Stație (calcul rută)",
          displayValue: resolved.site ? resolved.site.name : "fără calcul de rută",
          editable: false,
          kind: "text",
        },
      ],
    };
  },
  execute: async (input, ctx) => {
    if (!ctx.organizationId) {
      throw new InvalidToolArgumentsError("Utilizatorul curent nu are o organizație asociată.");
    }
    const resolved = await resolvePlanDelivery(input);

    // Planificarea optimizata a rutei (Task X7) - posibila DOAR cu o statie de
    // plecare (`deliveries.origin_site_id` e obligatoriu in `PlanDeliveryRouteChoice`).
    // Fara pas de selectie manuala, ca la `recalculateDeliveryRoute`: se pastreaza
    // varianta recomandata (`selection: "auto"`). BEST-EFFORT: daca furnizorul de
    // rutare nu e configurat sau adresa nu se poate geocoda, livrarea se planifica
    // oricum (text liber, ca inainte de X7), iar motivul se intoarce modelului.
    let route: PlanDeliveryRouteChoice | null = null;
    let routeError: string | null = null;
    if (resolved.site && resolved.routeOrigin && resolved.routeDestination) {
      try {
        const computation = await computeRouteBetween(
          { address: resolved.routeOrigin },
          { address: resolved.routeDestination },
        );
        const best = computation.routes[computation.bestIndex];
        if (best) {
          route = {
            originSiteId: resolved.site.id,
            distanceMeters: best.distanceMeters,
            durationSeconds: best.durationSeconds,
            polyline: best.polyline,
            selectedIndex: computation.bestIndex,
            selection: "auto",
            alternatives: computation.routes,
          };
        }
      } catch (err) {
        routeError = err instanceof Error ? err.message : "Nu am putut calcula ruta.";
      }
    }

    const delivery = await planDelivery({
      orderId: input.order_id,
      scheduledDate: input.data_programata,
      carrierName: input.transportator,
      vehiclePlate: input.nr_inmatriculare,
      driverName: input.sofer,
      routeOrigin: resolved.routeOrigin,
      routeDestination: resolved.routeDestination,
      route,
      createdBy: ctx.userId,
    });

    return {
      livrare_id: delivery.id,
      data_programata: delivery.scheduledDate,
      punct_plecare: delivery.routeOrigin,
      punct_sosire: delivery.routeDestination,
      ruta_calculata: route !== null,
      distanta_km: route ? Math.round(route.distanceMeters / 100) / 10 : null,
      ruta_eroare: routeError,
      link: `/livrari/${delivery.id}`,
    };
  },
};

export const WRITE_TOOLS = [
  creeazaClient,
  creeazaComanda,
  trimiteComanda,
  planificaLivrare,
  ...ORDER_WRITE_TOOLS,
  ...CATALOG_WRITE_TOOLS,
  ...PRODUCTION_WRITE_TOOLS,
] as unknown as AssistantTool<never>[];
