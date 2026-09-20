import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ assistantDb: vi.fn() }));

const { assistantDb } = await import("./db");
const { appendMessage, deleteConversation, getConversation, listConversations } =
  await import("./service");

const CONVERSATIONS = [
  {
    id: "conv-2",
    title: "A doua conversație",
    created_at: "2026-09-13T10:00:00Z",
    updated_at: "2026-09-13T10:05:00Z",
  },
  {
    id: "conv-1",
    title: "Prima conversație",
    created_at: "2026-09-12T10:00:00Z",
    updated_at: "2026-09-12T10:00:00Z",
  },
];

beforeEach(() => {
  vi.mocked(assistantDb).mockReset();
});

describe("listConversations", () => {
  it("citeste conversatiile ordonate dupa activitate recenta", async () => {
    const order = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: CONVERSATIONS }),
    });
    const is = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ is });
    vi.mocked(assistantDb).mockResolvedValue({
      from: vi.fn().mockReturnValue({ select }),
    } as never);

    const result = await listConversations();

    expect(result).toEqual([
      {
        id: "conv-2",
        title: "A doua conversație",
        createdAt: "2026-09-13T10:00:00Z",
        updatedAt: "2026-09-13T10:05:00Z",
      },
      {
        id: "conv-1",
        title: "Prima conversație",
        createdAt: "2026-09-12T10:00:00Z",
        updatedAt: "2026-09-12T10:00:00Z",
      },
    ]);
    expect(is).toHaveBeenCalledWith("deleted_at", null);
    expect(order).toHaveBeenCalledWith("updated_at", { ascending: false });
  });
});

describe("getConversation", () => {
  it("intoarce conversatia gasita", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: CONVERSATIONS[0] });
    const is = vi.fn().mockReturnValue({ maybeSingle });
    const eq = vi.fn().mockReturnValue({ is });
    const select = vi.fn().mockReturnValue({ eq });
    vi.mocked(assistantDb).mockResolvedValue({
      from: vi.fn().mockReturnValue({ select }),
    } as never);

    const result = await getConversation("conv-2");

    expect(result).toEqual({
      id: "conv-2",
      title: "A doua conversație",
      createdAt: "2026-09-13T10:00:00Z",
      updatedAt: "2026-09-13T10:05:00Z",
    });
  });

  it("intoarce null cand nu exista (sau nu e a userului curent, via RLS)", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null });
    const is = vi.fn().mockReturnValue({ maybeSingle });
    const eq = vi.fn().mockReturnValue({ is });
    const select = vi.fn().mockReturnValue({ eq });
    vi.mocked(assistantDb).mockResolvedValue({
      from: vi.fn().mockReturnValue({ select }),
    } as never);

    expect(await getConversation("altcineva")).toBeNull();
  });
});

describe("deleteConversation", () => {
  it("marcheaza conversatia ca stearsa (deleted_at) doar pt. proprietarul ei", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "conv-1" }, error: null });
    const is = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ maybeSingle }) });
    const eqUser = vi.fn().mockReturnValue({ is });
    const eqId = vi.fn().mockReturnValue({ eq: eqUser });
    const update = vi.fn().mockReturnValue({ eq: eqId });
    vi.mocked(assistantDb).mockResolvedValue({
      from: vi.fn().mockReturnValue({ update }),
    } as never);

    await expect(deleteConversation("conv-1", "user-1")).resolves.toBeUndefined();

    expect(update).toHaveBeenCalledWith({ deleted_at: expect.any(String) });
    expect(eqId).toHaveBeenCalledWith("id", "conv-1");
    expect(eqUser).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("arunca daca nu exista/nu apartine userului (0 randuri afectate)", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const is = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ maybeSingle }) });
    const eqUser = vi.fn().mockReturnValue({ is });
    const eqId = vi.fn().mockReturnValue({ eq: eqUser });
    const update = vi.fn().mockReturnValue({ eq: eqId });
    vi.mocked(assistantDb).mockResolvedValue({
      from: vi.fn().mockReturnValue({ update }),
    } as never);

    await expect(deleteConversation("straina", "user-1")).rejects.toThrow(
      "Conversația nu există sau nu îți aparține.",
    );
  });
});

describe("appendMessage", () => {
  it("salveaza mesajul si actualizeaza updated_at pe conversatie", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const conversationEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq: conversationEq });
    const from = vi.fn((table: string) => {
      if (table === "assistant_messages") return { insert };
      if (table === "assistant_conversations") return { update };
      throw new Error(`tabel neasteptat: ${table}`);
    });
    vi.mocked(assistantDb).mockResolvedValue({ from } as never);

    await appendMessage({ conversationId: "conv-1", role: "user", content: "Salut" });

    expect(insert).toHaveBeenCalledWith({
      conversation_id: "conv-1",
      role: "user",
      content: "Salut",
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ updated_at: expect.any(String) }),
    );
    expect(conversationEq).toHaveBeenCalledWith("id", "conv-1");
  });

  it("nu esueaza daca actualizarea updated_at esueaza - mesajul deja s-a salvat", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => {
      if (table === "assistant_messages") return { insert };
      if (table === "assistant_conversations") {
        return {
          update: () => ({
            eq: () => {
              throw new Error("boom");
            },
          }),
        };
      }
      throw new Error(`tabel neasteptat: ${table}`);
    });
    vi.mocked(assistantDb).mockResolvedValue({ from } as never);

    await expect(
      appendMessage({ conversationId: "conv-1", role: "user", content: "Salut" }),
    ).resolves.toBeUndefined();
  });

  it("arunca daca insert-ul mesajului esueaza", async () => {
    const insert = vi.fn().mockResolvedValue({ error: new Error("db down") });
    const from = vi.fn((table: string) => {
      if (table === "assistant_messages") return { insert };
      throw new Error(`tabel neasteptat: ${table}`);
    });
    vi.mocked(assistantDb).mockResolvedValue({ from } as never);

    await expect(
      appendMessage({ conversationId: "conv-1", role: "user", content: "Salut" }),
    ).rejects.toThrow("Nu am putut salva mesajul.");
  });
});
