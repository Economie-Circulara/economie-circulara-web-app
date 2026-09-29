import { describe, expect, it } from "vitest";
import { signWebhook, verifyWebhookSignature } from "./webhook-signature";

const SECRET = `v1,whsec_${Buffer.from("secret-de-test-32-bytes-lungime!").toString("base64")}`;
const BODY = '{"user":{"id":"u1"}}';
const NOW = 1_800_000_000;

function headers(signature: string, timestamp = String(NOW)) {
  return { id: "msg_1", timestamp, signature };
}

describe("verifyWebhookSignature", () => {
  const valid = signWebhook(SECRET, "msg_1", String(NOW), BODY);

  it("accepta semnatura corecta (si printre mai multe semnaturi)", () => {
    expect(verifyWebhookSignature(SECRET, headers(valid), BODY, NOW)).toBe(true);
    expect(verifyWebhookSignature(SECRET, headers(`v1,altceva ${valid}`), BODY, NOW)).toBe(true);
  });

  it("respinge corpul modificat sau secretul gresit", () => {
    expect(verifyWebhookSignature(SECRET, headers(valid), `${BODY} `, NOW)).toBe(false);
    const other = `v1,whsec_${Buffer.from("alt-secret").toString("base64")}`;
    expect(verifyWebhookSignature(other, headers(valid), BODY, NOW)).toBe(false);
  });

  it("respinge un timestamp in afara ferestrei (replay)", () => {
    const old = String(NOW - 3600);
    const sig = signWebhook(SECRET, "msg_1", old, BODY);
    expect(verifyWebhookSignature(SECRET, headers(sig, old), BODY, NOW)).toBe(false);
  });

  it("respinge headere lipsa", () => {
    expect(
      verifyWebhookSignature(
        SECRET,
        { id: null, timestamp: String(NOW), signature: valid },
        BODY,
        NOW,
      ),
    ).toBe(false);
  });
});
