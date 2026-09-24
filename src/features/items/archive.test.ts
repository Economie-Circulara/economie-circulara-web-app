import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks (nu spies - AGENTS.md §2.2). Testele de arhivare (migrarea 0035) traiesc
// separat de service/actions.test.ts ca sa nu atinga mock-urile existente.
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireRole }));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { archiveItemAction, restoreItemAction } from "./actions";
import { listItemOptions, listItems } from "./queries";
import { setItemArchived } from "./service";

/** Builder chainable + "thenable" (ca PostgrestFilterBuilder). */
function makeBuilder(finalResult: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    then: (resolve: (v: unknown) => void) => void;
  } = { then: (resolve: (v: unknown) => void) => resolve(finalResult) } as never;
  for (const m of ["select", "order", "eq", "ilike", "neq", "is", "update"]) {
    builder[m] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn().mockResolvedValue(finalResult);
  return builder;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("setItemArchived", () => {
  it("arhivarea seteaza archived_at (archived_by vine din trigger-ul DB, nu din input)", async () => {
    const builder = makeBuilder({ data: { id: "item-1" }, error: null });
    const from = vi.fn().mockReturnValue(builder);
    createClient.mockResolvedValue({ from });

    await setItemArchived("item-1", true);

    expect(from).toHaveBeenCalledWith("items");
    const patch = builder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof patch.archived_at).toBe("string");
    expect(patch).not.toHaveProperty("archived_by");
    expect(builder.eq).toHaveBeenCalledWith("id", "item-1");
  });

  it("restaurarea pune archived_at pe null", async () => {
    const builder = makeBuilder({ data: { id: "item-1" }, error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await setItemArchived("item-1", false);

    expect(builder.update).toHaveBeenCalledWith({ archived_at: null });
  });

  it("0 randuri afectate (RLS / alt tenant) => eroare clara, nu succes silentios", async () => {
    const builder = makeBuilder({ data: null, error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await expect(setItemArchived("item-x", true)).rejects.toThrow(/nu există|nu ai acces/i);
  });
});

describe("listItems / listItemOptions - arhivatele ascunse", () => {
  it("listItems exclude implicit arhivatele", async () => {
    const itemsBuilder = makeBuilder({ data: [], error: null });
    const recipesBuilder = makeBuilder({ data: [], error: null });
    createClient.mockResolvedValue({
      from: vi.fn((t: string) => (t === "items" ? itemsBuilder : recipesBuilder)),
    });

    await listItems();

    expect(itemsBuilder.is).toHaveBeenCalledWith("archived_at", null);
  });

  it("listItems cu includeArchived nu filtreaza si expune archivedAt", async () => {
    const itemsBuilder = makeBuilder({
      data: [
        {
          id: "item-1",
          title: "Nisip",
          description: null,
          unit: "kg",
          kind: "physical",
          is_tracked: true,
          sellable: false,
          image_url: null,
          archived_at: "2026-09-01T00:00:00.000Z",
          created_at: "t",
          updated_at: "t",
        },
      ],
      error: null,
    });
    const recipesBuilder = makeBuilder({ data: [], error: null });
    createClient.mockResolvedValue({
      from: vi.fn((t: string) => (t === "items" ? itemsBuilder : recipesBuilder)),
    });

    const result = await listItems({ includeArchived: true });

    expect(itemsBuilder.is).not.toHaveBeenCalled();
    expect(result[0].archivedAt).toBe("2026-09-01T00:00:00.000Z");
  });

  it("listItemOptions (selecturi) exclude MEREU arhivatele", async () => {
    const builder = makeBuilder({ data: [], error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await listItemOptions({ kind: "physical" });

    expect(builder.is).toHaveBeenCalledWith("archived_at", null);
  });
});

describe("archiveItemAction / restoreItemAction", () => {
  it("cere rol de staff si arhiveaza itemul", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "operator" });
    const builder = makeBuilder({ data: { id: "item-1" }, error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    const result = await archiveItemAction("item-1");

    expect(requireRole).toHaveBeenCalledWith(["admin", "operator"]);
    expect(result).toEqual({ error: null });
    expect(revalidatePath).toHaveBeenCalledWith("/itemi");
  });

  it("intoarce eroarea serviciului (fara sa arunce) pentru dialogul de confirmare", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "admin" });
    const builder = makeBuilder({ data: null, error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    const result = await restoreItemAction("item-x");

    expect(result.error).toMatch(/nu există|nu ai acces/i);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
