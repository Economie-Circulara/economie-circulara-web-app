import { itemHref } from "@/features/items/item-links";
import { uploadItemImage } from "@/features/items/image-storage";
import { KIND_LABELS } from "@/features/items/labels";
import { getItemById } from "@/features/items/queries";
import { setItemImageUrl } from "@/features/items/service";
import { isImage } from "../attachment-rules";
import { attachmentPreviewUrl, downloadAttachment, getAttachment } from "../attachments";
import { infoField } from "./fields";
import type { CardPresentation } from "./presentation-types";
import { asObject, InvalidToolArgumentsError, requiredString, type AssistantTool } from "./types";

/**
 * Tool-uri care folosesc atasamentele din chat (docs/plans/asistent-atasamente.md).
 * `getAttachment` citeste atasamentul pe sesiunea utilizatorului (RLS) - un ID care
 * nu e al lui da „atașament indisponibil”, nu fisierul altcuiva.
 */

interface SetItemImageInput {
  item_id: string;
  attachment_id: string;
}

async function requireImageAttachment(id: string) {
  const attachment = await getAttachment(id);
  if (!attachment) {
    throw new InvalidToolArgumentsError("Atașamentul nu există sau nu e al utilizatorului curent.");
  }
  if (!isImage(attachment.mimeType)) {
    throw new InvalidToolArgumentsError(
      `„${attachment.fileName}” nu e o imagine - doar imaginile pot deveni poza unui produs.`,
    );
  }
  return attachment;
}

export const seteazaImagineProdus: AssistantTool<SetItemImageInput> = {
  name: "seteaza_imagine_produs",
  description:
    "Propune setarea unei IMAGINI atașate de utilizator în chat (linia `📎 [nume](attachment:<id>)`, " +
    "`attachment_id` = <id>) ca poză a unui material/abonament (`item_id`). Înlocuiește poza " +
    "existentă. Acțiunea NU se execută până la confirmare.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      item_id: { type: "string" },
      attachment_id: { type: "string", description: "ID-ul din `attachment:<id>`." },
    },
    required: ["item_id", "attachment_id"],
  },
  roles: ["admin", "operator"],
  version: 1,
  kind: "write",
  parse: (args) => {
    const raw = asObject(args);
    return {
      item_id: requiredString(raw, "item_id"),
      attachment_id: requiredString(raw, "attachment_id").replace(/^attachment:/, ""),
    };
  },
  summary: () => "Setează imaginea produsului",
  resultSummary: (_input, result) => {
    const name =
      result && typeof result === "object" ? (result as { denumire?: string }).denumire : null;
    return `Am setat imaginea produsului${name ? ` **${name}**` : ""}.`;
  },
  presentation: async (input): Promise<CardPresentation> => {
    const [item, attachment] = await Promise.all([
      getItemById(input.item_id),
      getAttachment(input.attachment_id),
    ]);
    const preview =
      attachment && isImage(attachment.mimeType) ? await attachmentPreviewUrl(attachment) : null;
    return {
      renderer: "generic",
      fields: [
        infoField(
          "item_id",
          "Produs",
          item ? `${KIND_LABELS[item.kind]}: ${item.title}` : "Produs indisponibil",
        ),
        preview && attachment
          ? {
              name: "attachment_id",
              label: "Imagine nouă",
              displayValue: attachment.fileName,
              editable: false,
              kind: "image",
              previewUrl: preview,
            }
          : infoField("attachment_id", "Imagine nouă", "Atașament indisponibil sau nu e imagine"),
        infoField(
          "efect",
          "Ce se întâmplă",
          item?.imageUrl
            ? "Poza actuală a produsului se înlocuiește."
            : "Produsul primește prima lui poză.",
        ),
      ],
    };
  },
  execute: async (input) => {
    const item = await getItemById(input.item_id);
    if (!item) throw new InvalidToolArgumentsError("Produsul nu există sau nu e accesibil.");
    const attachment = await requireImageAttachment(input.attachment_id);
    const file = await downloadAttachment(attachment);
    // `uploadItemImage` revalideaza tipul si marimea - aceleasi reguli ca formularul.
    const url = await uploadItemImage(item.id, file, attachment.mimeType);
    await setItemImageUrl(item.id, url);
    return { item_id: item.id, denumire: item.title, link: itemHref(item) };
  },
};

export const ATTACHMENT_WRITE_TOOLS = [seteazaImagineProdus];
