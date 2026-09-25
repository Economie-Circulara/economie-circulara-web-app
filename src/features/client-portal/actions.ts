"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/features/auth/session";
import { createOrderWithItems, deleteDraftOrder, sendOrder } from "@/features/orders/service";
import { listIntakeItemOptions } from "@/features/orders/queries";
import type { OrderLineInput } from "@/features/orders/types";
import { splitAvailableLines } from "./cart-logic";
import { listCatalogItems } from "./queries";
import type { AddressFormState } from "@/features/clients/action-state";
import { listClientAddresses } from "@/features/clients/queries";
import { removeAddress, upsertAddress } from "@/features/clients/service";
import { onOrderStatusChanged } from "@/features/orders/notifications";
import type { ClientOrderFormState, ClientReceiptFormState } from "./action-state";
import { confirmClientDeliveryReceipt } from "./delivery-receipt";

function clean(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}

function parseQty(value: FormDataEntryValue | null): number | null {
  const s = clean(value);
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Liniile cosului vin ca perechi de campuri repetate `item_id`/`quantity` (acelasi
 * contract ca `orders/actions.ts#readLines`) - populate de `catalog-view.tsx` din
 * starea cosului (`useCart`) chiar inainte de submit.
 */
function readLines(formData: FormData): OrderLineInput[] {
  const itemIds = formData.getAll("item_id");
  const quantities = formData.getAll("quantity");
  const lines: OrderLineInput[] = [];

  for (let i = 0; i < itemIds.length; i++) {
    const itemId = clean(itemIds[i] ?? null);
    const quantity = parseQty(quantities[i] ?? null);
    if (itemId && quantity) lines.push({ itemId, quantity });
  }
  return lines;
}

/**
 * Garda server-side: liniile trimise din portal trebuie sa fie in lista CURENTA de
 * itemi permisi clientului (catalogul vandabil, respectiv materialele de aport) -
 * ambele liste exclud itemii arhivati (0035). Fara ea, un item arhivat ajuns in cos
 * prin "Repetă comanda" sau dintr-un cos vechi ar trece: trigger-ul DB
 * `reject_archived_references` lasa clientul sa foloseasca un item arhivat deja
 * livrat lui (exceptia pentru retur/garantie), iar RLS nu verifica `sellable`.
 */
function unavailableLinesError(lines: OrderLineInput[], allowed: { id: string }[]): string | null {
  const { unavailable } = splitAvailableLines(lines, new Set(allowed.map((i) => i.id)));
  return unavailable.length > 0
    ? "Unele produse nu mai sunt disponibile (au fost scoase din catalog). Elimină-le și încearcă din nou."
    : null;
}

/** Valoarea optiunii "+ Adresă nouă…" din `DeliveryAddressField`. */
const NEW_ADDRESS_VALUE = "__new__";

/**
 * Adresa de livrare/aport aleasa in portal (0046), rezolvata pe server:
 * - "" -> fara adresa;
 * - o adresa ACTIVA a clientului (inainte nu se verifica - orice id trecea);
 * - "+ Adresă nouă…" -> o creeaza acum: in agenda (bifa "Salvează în adresele mele")
 *   sau AD HOC (arhivata - doar pe aceasta comanda).
 */
async function resolveDeliveryAddress(
  formData: FormData,
  clientId: string,
  organizationId: string,
): Promise<{ addressId: string | null; error: string | null }> {
  const choice = clean(formData.get("delivery_address_id"));
  if (!choice) return { addressId: null, error: null };

  if (choice === NEW_ADDRESS_VALUE) {
    const address = clean(formData.get("new_address"));
    if (!address) return { addressId: null, error: "Completează adresa nouă." };
    try {
      const created = await upsertAddress({
        clientId,
        organizationId,
        label: clean(formData.get("new_address_label")),
        address,
        isDefault: false,
        adHoc: formData.get("save_address") !== "on",
      });
      return { addressId: created.id, error: null };
    } catch (err) {
      return {
        addressId: null,
        error: err instanceof Error ? err.message : "Nu am putut salva adresa.",
      };
    }
  }

  const own = await listClientAddresses(clientId);
  if (!own.some((a) => a.id === choice)) {
    return { addressId: null, error: "Adresa aleasă nu mai este disponibilă. Alege alta." };
  }
  return { addressId: choice, error: null };
}

/**
 * Pasul "trimite" comun comenzilor create din portal (catalog si aport): `draft` ->
 * `sent` + numar de comanda. Din punctul de vedere al clientului comanda e trimisa
 * spre aprobare in momentul in care apasa butonul - nu ramane ciorna.
 */
async function sendCreatedOrder(
  orderId: string,
  organizationId: string,
): Promise<ClientOrderFormState> {
  try {
    await sendOrder(orderId, organizationId);
  } catch (err) {
    // Comanda a fost salvata ca draft, dar nu a putut fi trimisa (ex. generarea
    // numarului a esuat) - semnalam eroarea, dar orderId ramane util (utilizatorul
    // o vede in /comenzile-mele ca "Ciornă" si o poate sterge / reface).
    revalidatePath("/comenzile-mele");
    return {
      error:
        err instanceof Error
          ? `Comanda a fost salvată, dar nu a putut fi trimisă: ${err.message}`
          : "Comanda a fost salvată, dar nu a putut fi trimisă.",
      orderId,
    };
  }

  revalidatePath("/comenzile-mele");
  return { error: null, orderId };
}

/**
 * Creeaza + trimite o comanda in numele clientului curent (`created_by_admin:
 * false`): un singur pas din UI (buton "Trimite comanda", ca in mockup), desi la
 * nivel de date trece prin doua stari (`draft` -> `sent`, RLS `orders_client_update`
 * din 0003_rls_hardening.sql permite tranzitia). Nu exista rol admin/operator aici
 * - un singur user per firma-client (AGENTS.md §4), deci nicio distinctie de rol
 * de facut in interiorul acestei actiuni.
 */
export async function createClientOrderAction(
  _prev: ClientOrderFormState,
  formData: FormData,
): Promise<ClientOrderFormState> {
  const user = await requireRole(["client"]);
  if (!user.organizationId || !user.clientId) {
    return { error: "Contul curent nu este asociat unei firme client.", orderId: null };
  }

  const lines = readLines(formData);
  if (lines.length === 0) {
    return { error: "Coșul este gol - adaugă cel puțin un produs.", orderId: null };
  }
  const unavailableError = unavailableLinesError(lines, await listCatalogItems());
  if (unavailableError) return { error: unavailableError, orderId: null };
  const delivery = await resolveDeliveryAddress(formData, user.clientId, user.organizationId);
  if (delivery.error) return { error: delivery.error, orderId: null };

  let orderId: string;
  try {
    const order = await createOrderWithItems({
      organizationId: user.organizationId,
      clientId: user.clientId,
      // Portalul clientului comanda DOAR din catalogul vandabil, deci o comanda
      // clasica de material (migrarea 0030). Serviciul/aportul raman initiate de
      // staff: aportul (client -> organizatie) va primi un flux self-service
      // separat, in afara scope-ului acestui task.
      orderType: "material",
      createdByAdmin: false,
      deliveryAddressId: delivery.addressId,
      deliveryDate: clean(formData.get("delivery_date")),
      notes: clean(formData.get("notes")),
      lines,
    });
    orderId = order.id;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Nu am putut crea comanda.",
      orderId: null,
    };
  }

  return sendCreatedOrder(orderId, user.organizationId);
}

/**
 * Creeaza o cerere de aport (client -> organizatie, materialul e adus DE CATRE
 * client, ex. moloz de demolare) in numele clientului curent: comanda de tip
 * `aport`, `created_by_admin: false`, apoi TRIMISA (`draft` -> `sent`), exact ca
 * `createClientOrderAction`: pentru client cererea e trimisa spre aprobare, nu o
 * ciorna (decizie 2026-09-25, migrarea 0042 - `accept_intake_order` accepta acum si
 * din `sent`; staff-ul o accepta sau o anuleaza de acolo).
 * Acceptarea (care CRESTE stocul) ramane exclusiv la staff - portalul clientului
 * nu apeleaza niciodata `accept_intake_order`, doar creeaza cererea; RPC-ul are
 * oricum propria garda `app.is_staff_of` (AP004) daca ar fi apelat direct prin
 * Data API.
 */
export async function createClientAportAction(
  _prev: ClientOrderFormState,
  formData: FormData,
): Promise<ClientOrderFormState> {
  const user = await requireRole(["client"]);
  if (!user.organizationId || !user.clientId) {
    return { error: "Contul curent nu este asociat unei firme client.", orderId: null };
  }

  const lines = readLines(formData);
  if (lines.length === 0) {
    return {
      error: "Adaugă cel puțin un material, cu o cantitate estimată.",
      orderId: null,
    };
  }
  const unavailableError = unavailableLinesError(lines, await listIntakeItemOptions());
  if (unavailableError) return { error: unavailableError, orderId: null };
  const delivery = await resolveDeliveryAddress(formData, user.clientId, user.organizationId);
  if (delivery.error) return { error: delivery.error, orderId: null };

  let orderId: string;
  try {
    const order = await createOrderWithItems({
      organizationId: user.organizationId,
      clientId: user.clientId,
      orderType: "aport",
      createdByAdmin: false,
      deliveryAddressId: delivery.addressId,
      deliveryDate: clean(formData.get("delivery_date")),
      notes: clean(formData.get("notes")),
      lines,
    });
    orderId = order.id;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Nu am putut trimite cererea de aport.",
      orderId: null,
    };
  }

  return sendCreatedOrder(orderId, user.organizationId);
}

/** Rezultatul stergerii unei ciorne din portal (dialogul de confirmare). */
export interface DeleteOwnDraftResult {
  error: string | null;
}

/**
 * Clientul isi sterge (logic) propria comanda `draft` din portal (migrarea 0035).
 * Autorizarea reala e in RPC-ul `delete_draft_order`: doar comanda propriei firme,
 * din organizatia lui, si doar cat e ciorna - o comanda straina da aceeasi eroare ca
 * una inexistenta. Legata cu `.bind(null, id)` in pagina; la succes duce la lista.
 */
export async function deleteOwnDraftOrderAction(orderId: string): Promise<DeleteOwnDraftResult> {
  await requireRole(["client"]);
  if (!orderId) return { error: "Comandă invalidă." };

  try {
    await deleteDraftOrder(orderId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut șterge ciorna." };
  }

  revalidatePath("/comenzile-mele");
  redirect("/comenzile-mele");
}

/**
 * Clientul confirma receptia livrarii comenzii proprii (cardul "Transport" din
 * /comenzile-mele/[id], migrarea 0045). Legata cu `.bind(null, orderId)` in pagina.
 * RPC-ul face autorizarea si tranzitia `accepted -> delivered` atomic; aici doar
 * validam numele si trimitem emailul "Livrată" (ca la confirmarea facuta de staff,
 * `deliveries/service.ts#confirmDeliveryReceipt`). Inchiderea ramane la staff.
 */
export async function confirmOwnDeliveryReceiptAction(
  orderId: string,
  _prev: ClientReceiptFormState,
  formData: FormData,
): Promise<ClientReceiptFormState> {
  const user = await requireRole(["client"]);
  const receivedByName = clean(formData.get("received_by_name"));
  if (!receivedByName) {
    return { error: "Completează numele persoanei care a primit marfa.", done: false };
  }

  try {
    await confirmClientDeliveryReceipt(orderId, receivedByName, clean(formData.get("notes")));
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Nu am putut confirma recepția.",
      done: false,
    };
  }

  try {
    await onOrderStatusChanged({
      orderId,
      organizationId: user.organizationId ?? "",
      clientId: user.clientId ?? "",
      fromStatus: "accepted",
      toStatus: "delivered",
    });
  } catch (err) {
    // Receptia e deja salvata - emailul nu trebuie sa anuleze confirmarea.
    console.error(`[client-portal] notificarea "Livrată" a eșuat pentru ${orderId}:`, err);
  }

  revalidatePath("/comenzile-mele");
  revalidatePath(`/comenzile-mele/${orderId}`);
  return { error: null, done: true };
}

function revalidateAddressPages(): void {
  revalidatePath("/adresele-mele");
  revalidatePath("/catalog");
  revalidatePath("/aport-nou");
}

/**
 * Clientul isi adauga / editeaza o adresa in agenda (/adresele-mele, 0046). Firma si
 * organizatia vin din sesiune, nu din formular; RLS (`client_addresses_client_*`,
 * 0014/0016) impune oricum `client_id = app.client_id()`.
 */
export async function upsertOwnAddressAction(
  _prev: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const user = await requireRole(["client"]);
  if (!user.organizationId || !user.clientId) {
    return { error: "Contul curent nu este asociat unei firme client." };
  }
  const address = clean(formData.get("address"));
  if (!address) return { error: "Adresa este obligatorie." };

  try {
    await upsertAddress({
      id: clean(formData.get("id")) ?? undefined,
      clientId: user.clientId,
      organizationId: user.organizationId,
      label: clean(formData.get("label")),
      address,
      isDefault: formData.get("is_default") === "on",
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut salva adresa." };
  }

  revalidateAddressPages();
  return { error: null };
}

/**
 * Clientul isi "sterge" o adresa din agenda: arhivata daca a fost folosita pe o
 * comanda (istoricul ramane), stearsa fizic altfel - `removeAddress` (0046).
 */
export async function deleteOwnAddressAction(
  _prev: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  await requireRole(["client"]);
  const id = clean(formData.get("id"));
  if (!id) return { error: "Adresă invalidă." };

  try {
    await removeAddress(id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut șterge adresa." };
  }

  revalidateAddressPages();
  return { error: null };
}
