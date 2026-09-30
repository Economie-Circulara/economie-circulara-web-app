import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuoteDeps } from "./submit";
import { hashIp, submitQuoteRequest } from "./submit";

const org = {
  id: "org-1",
  name: "Macon XCX",
  slug: "maconxcx",
  custom_domain: "abonamente.maconxcx.ro",
  logo_url: null,
  logo_square_url: null,
  primary_color: null,
  secondary_color: null,
  theme: null,
  email_from_name: null,
  email_from_address: null,
  email_domain: null,
  email_domain_status: null,
  email_reply_to: null as string | null,
  cui: null,
  reg_com: null,
  address: null,
};

/** Builder PostgREST minimal: lant de `select/eq`, terminat cu `maybeSingle` sau `await`. */
function query(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: typeof result) => unknown) => resolve(result),
  };
  return builder;
}

const originalError = console.error;
const rpc = vi.fn();
const send = vi.fn();
let orgRow: typeof org | null;
let admins: { email: string | null }[];

function deps(): QuoteDeps {
  return {
    admin: {
      rpc,
      from: vi.fn((table: string) =>
        table === "organizations"
          ? query({ data: orgRow, error: null })
          : query({ data: admins, error: null }),
      ),
    } as unknown as QuoteDeps["admin"],
    provider: { send },
    allowLocalOrigins: false,
    ipSalt: "sare",
  };
}

const body = {
  service: "Beton",
  name: "Ion Pop",
  phone: "0722 123 456",
  email: "ion@exemplu.ro",
  message: "20 mc",
  consent: true,
  website: "",
};

const input = {
  host: "abonamente.maconxcx.ro",
  origin: "https://maconxcx.ro",
  ip: "10.0.0.1, 10.0.0.2",
  body,
};

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: "q-1", error: null });
  send.mockReset().mockResolvedValue(undefined);
  orgRow = { ...org };
  admins = [{ email: "admin@maconxcx.ro" }];
  console.error = vi.fn();
});

afterAll(() => {
  console.error = originalError;
});

describe("submitQuoteRequest", () => {
  it("salveaza cererea prin RPC si trimite emailul adminilor", async () => {
    const result = await submitQuoteRequest(input, deps());

    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(rpc).toHaveBeenCalledWith("submit_quote_request", {
      p_domain: "abonamente.maconxcx.ro",
      p_service: "Beton",
      p_name: "Ion Pop",
      p_phone: "0722 123 456",
      p_email: "ion@exemplu.ro",
      p_message: "20 mc",
      p_ip_hash: hashIp("10.0.0.1", "sare"),
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({
      to: "admin@maconxcx.ro",
      replyTo: "ion@exemplu.ro",
      subject: "Cerere de ofertă: Beton - Ion Pop",
    });
    expect(send.mock.calls[0][0].html).toContain("https://abonamente.maconxcx.ro/cereri-oferta");
  });

  it("trimite la inboxul organizatiei cand e setat", async () => {
    orgRow = { ...org, email_reply_to: "contact@maconxcx.ro" };
    await submitQuoteRequest(input, deps());
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toBe("contact@maconxcx.ro");
  });

  it("refuza o origine straina, fara sa salveze", async () => {
    const result = await submitQuoteRequest({ ...input, origin: "https://altsite.ro" }, deps());
    expect(result.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("raspunde ok botului, fara sa salveze sau sa trimita", async () => {
    const result = await submitQuoteRequest(
      { ...input, body: { ...body, website: "spam" } },
      deps(),
    );
    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(rpc).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("intoarce 400 pentru date invalide", async () => {
    const result = await submitQuoteRequest(
      { ...input, body: { ...body, consent: false } },
      deps(),
    );
    expect(result.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["QR002", 429],
    ["QR003", 429],
    ["QR001", 404],
    ["QR004", 400],
    ["XX000", 500],
  ])("mapeaza eroarea RPC %s la %i, fara email", async (code, status) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: "x" } });
    const result = await submitQuoteRequest(input, deps());
    expect(result.status).toBe(status);
    expect(result.body.ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("un email esuat nu pica cererea (e deja salvata)", async () => {
    send.mockRejectedValue(new Error("provider jos"));
    const result = await submitQuoteRequest(input, deps());
    expect(result).toEqual({ status: 200, body: { ok: true } });
  });

  it("fara email de raspuns al solicitantului, reply-to e al organizatiei", async () => {
    orgRow = { ...org, email_reply_to: "contact@maconxcx.ro" };
    await submitQuoteRequest({ ...input, body: { ...body, email: "" } }, deps());
    expect(send.mock.calls[0][0].replyTo).toBe("contact@maconxcx.ro");
  });
});

describe("hashIp", () => {
  it("foloseste primul IP din lista si sarea", () => {
    expect(hashIp("1.2.3.4, 5.6.7.8", "s")).toBe(hashIp("1.2.3.4", "s"));
    expect(hashIp("1.2.3.4", "s")).not.toBe(hashIp("1.2.3.4", "alta"));
    expect(hashIp("1.2.3.4", "s")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp(null, "s")).toBeNull();
  });
});
