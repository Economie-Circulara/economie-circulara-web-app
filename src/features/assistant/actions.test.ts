import { afterEach, describe, expect, it, vi } from "vitest";

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireUser }));

vi.mock("./attachments", () => ({
  AttachmentError: class extends Error {},
  getAttachment: vi.fn(),
  registerAttachment: vi.fn(),
}));
vi.mock("./run", () => ({
  runAssistantTurn: vi.fn().mockResolvedValue({ reply: "ok" }),
  confirmAction: vi.fn(),
  rejectAction: vi.fn(),
}));

const { getAttachment, registerAttachment } = await import("./attachments");
const { runAssistantTurn } = await import("./run");
const { sendAssistantMessageAction, prepareAssistantAttachmentAction } = await import("./actions");

const ID = "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
const STAFF = { id: "u1", role: "operator", organizationId: "org-1", clientId: null };

afterEach(() => {
  vi.clearAllMocks();
});

describe("sendAssistantMessageAction - atasamente", () => {
  it("adauga referintele DOAR pentru atasamentele gasite (RLS), ignora restul", async () => {
    requireUser.mockResolvedValue(STAFF);
    vi.mocked(getAttachment).mockImplementation(async (id) =>
      id === ID
        ? { id, fileName: "nisip.jpg", mimeType: "image/jpeg", sizeBytes: 1, storagePath: "p" }
        : null,
    );

    await sendAssistantMessageAction({
      conversationId: null,
      message: "pune poza pe nisip",
      attachmentIds: [ID, "4f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f"],
    });

    expect(vi.mocked(runAssistantTurn).mock.calls[0][0].message).toBe(
      `pune poza pe nisip\n📎 [nisip.jpg](attachment:${ID})`,
    );
  });

  it("un mesaj doar cu atasament (fara text) e acceptat", async () => {
    requireUser.mockResolvedValue(STAFF);
    vi.mocked(getAttachment).mockResolvedValue({
      id: ID,
      fileName: "r.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1,
      storagePath: "p",
    });

    await sendAssistantMessageAction({ conversationId: null, message: " ", attachmentIds: [ID] });

    expect(vi.mocked(runAssistantTurn).mock.calls[0][0].message).toBe(
      `Am atașat:\n📎 [r.pdf](attachment:${ID})`,
    );
  });

  it("clientul nu poate atasa: nici URL de upload, nici referinte", async () => {
    requireUser.mockResolvedValue({ ...STAFF, role: "client", clientId: "c1" });

    const prepared = await prepareAssistantAttachmentAction({
      name: "a.png",
      type: "image/png",
      size: 1,
    });
    await sendAssistantMessageAction({ conversationId: null, message: "x", attachmentIds: [ID] });

    expect(prepared.ok).toBe(false);
    expect(registerAttachment).not.toHaveBeenCalled();
    expect(getAttachment).not.toHaveBeenCalled();
    expect(vi.mocked(runAssistantTurn).mock.calls[0][0].message).toBe("x");
  });
});
