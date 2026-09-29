import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { handleSendEmailHook } = vi.hoisted(() => ({ handleSendEmailHook: vi.fn() }));
vi.mock("@/features/notifications/auth-hook", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/notifications/auth-hook")>()),
  handleSendEmailHook,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { NextRequest } from "next/server";
import { signWebhook } from "@/features/notifications/webhook-signature";
import { POST } from "./route";

const SECRET = `v1,whsec_${Buffer.from("secret-de-test").toString("base64")}`;
const BODY = JSON.stringify({
  user: { id: "u1", email: "a@b.ro" },
  email_data: { email_action_type: "magiclink", token_hash: "h" },
});

function request(body: string, signature?: string) {
  const ts = String(Math.floor(Date.now() / 1000));
  return new NextRequest("https://www.lotculot.eu/auth/email-hook", {
    method: "POST",
    body,
    headers: {
      "webhook-id": "msg_1",
      "webhook-timestamp": ts,
      "webhook-signature": signature ?? signWebhook(SECRET, "msg_1", ts, body),
    },
  });
}

beforeEach(() => {
  process.env.SEND_EMAIL_HOOK_SECRET = SECRET;
});
afterEach(() => {
  delete process.env.SEND_EMAIL_HOOK_SECRET;
  vi.clearAllMocks();
});

describe("POST /auth/email-hook", () => {
  it("semnatura valida -> trimite si raspunde {}", async () => {
    handleSendEmailHook.mockResolvedValue(1);
    const res = await POST(request(BODY));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
    expect(handleSendEmailHook).toHaveBeenCalledTimes(1);
  });

  it("semnatura invalida -> 401, nimic trimis", async () => {
    const res = await POST(request(BODY, "v1,invalid"));
    expect(res.status).toBe(401);
    expect(handleSendEmailHook).not.toHaveBeenCalled();
  });

  it("fara secret configurat -> 500 in formatul hook-ului", async () => {
    delete process.env.SEND_EMAIL_HOOK_SECRET;
    const res = await POST(request(BODY));
    expect(res.status).toBe(500);
    expect((await res.json()).error.http_code).toBe(500);
  });

  it("esecul trimiterii -> 500 (Supabase intoarce eroarea actiunii)", async () => {
    handleSendEmailHook.mockRejectedValue(new Error("provider jos"));
    const res = await POST(request(BODY));
    expect(res.status).toBe(500);
  });
});
