import { describe, expect, it, vi } from "vitest";
import {
  EmailDomainProviderError,
  ResendDomainProvider,
  resendApiKeyFromEnv,
} from "./email-domain-provider";

const DOMAIN = {
  id: "dom-1",
  name: "etora.ro",
  status: "not_started",
  records: [
    {
      record: "SPF",
      type: "MX",
      name: "send",
      value: "feedback-smtp.eu-west-1.amazonses.com",
      priority: 10,
      status: "not_started",
    },
    {
      record: "DKIM",
      type: "TXT",
      name: "resend._domainkey",
      value: "p=ABC",
      status: "not_started",
    },
  ],
};

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    text: async () => JSON.stringify(body),
  };
}

/** fetch mock: raspunsuri in ordine, retine cererile. */
function fetchSequence(...responses: ReturnType<typeof response>[]) {
  const queue = [...responses];
  return vi.fn(async () => queue.shift() ?? response(500, { message: "neasteptat" }));
}

describe("ResendDomainProvider", () => {
  it("createDomain: creeaza in regiunea EU, opreste tracking-ul, intoarce inregistrarile", async () => {
    const fetchMock = fetchSequence(
      response(200, { id: "dom-1", name: "etora.ro" }),
      response(200, {}),
      response(200, DOMAIN),
    );
    const provider = new ResendDomainProvider("re_key", fetchMock as unknown as typeof fetch);

    const info = await provider.createDomain("etora.ro");

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls[0][0]).toBe("https://api.resend.com/domains");
    expect(JSON.parse(calls[0][1].body as string)).toEqual({
      name: "etora.ro",
      region: "eu-west-1",
    });
    expect(calls[1][1].method).toBe("PATCH");
    expect(JSON.parse(calls[1][1].body as string)).toEqual({
      click_tracking: false,
      open_tracking: false,
    });
    expect(info.status).toBe("pending");
    expect(info.records[0]).toEqual({
      type: "MX",
      name: "send",
      value: "feedback-smtp.eu-west-1.amazonses.com",
      priority: 10,
      status: "not_started",
    });
  });

  it("createDomain: domeniul exista deja in cont -> il reia din lista", async () => {
    const fetchMock = fetchSequence(
      response(422, { message: "already registered" }),
      response(200, { data: [{ id: "dom-1", name: "etora.ro" }] }),
      response(200, {}),
      response(200, { ...DOMAIN, status: "verified" }),
    );
    const provider = new ResendDomainProvider("re_key", fetchMock as unknown as typeof fetch);

    const info = await provider.createDomain("etora.ro");

    expect(info.id).toBe("dom-1");
    expect(info.status).toBe("verified");
  });

  it("verifyDomain: cere verificarea, apoi citeste starea", async () => {
    const fetchMock = fetchSequence(
      response(200, {}),
      response(200, { ...DOMAIN, status: "verified" }),
    );
    const provider = new ResendDomainProvider("re_key", fetchMock as unknown as typeof fetch);

    const info = await provider.verifyDomain("dom-1");

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls[0][0]).toBe("https://api.resend.com/domains/dom-1/verify");
    expect(info.status).toBe("verified");
  });

  it("eroare de la Resend -> EmailDomainProviderError cu mesajul lor", async () => {
    const fetchMock = fetchSequence(response(401, { message: "API key is invalid" }));
    const provider = new ResendDomainProvider("re_key", fetchMock as unknown as typeof fetch);

    await expect(provider.getDomain("dom-1")).rejects.toThrow(EmailDomainProviderError);
    await expect(
      new ResendDomainProvider(
        "re_key",
        fetchSequence(response(401, { message: "API key is invalid" })) as unknown as typeof fetch,
      ).getDomain("x"),
    ).rejects.toThrow(/API key is invalid/);
  });
});

describe("resendApiKeyFromEnv", () => {
  it("RESEND_API_KEY are prioritate", () => {
    expect(resendApiKeyFromEnv({ RESEND_API_KEY: "re_1", EMAIL_API_KEY: "re_2" })).toBe("re_1");
  });

  it("refoloseste EMAIL_API_KEY cand EMAIL_API_URL e Resend", () => {
    expect(
      resendApiKeyFromEnv({
        EMAIL_API_URL: "https://api.resend.com/emails",
        EMAIL_API_KEY: "re_2",
      }),
    ).toBe("re_2");
  });

  it("nu trimite cheia altui provider catre Resend", () => {
    expect(
      resendApiKeyFromEnv({
        EMAIL_API_URL: "https://api.postmarkapp.com/email",
        EMAIL_API_KEY: "pm",
      }),
    ).toBeNull();
    expect(resendApiKeyFromEnv({})).toBeNull();
  });
});
