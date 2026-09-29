import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConsoleEmailProvider,
  HttpApiEmailProvider,
  RESEND_SEND_URL,
  getEmailProvider,
} from "./provider";

const MESSAGE = {
  to: "client@example.ro",
  from: { name: "Reciclare Prod SRL", address: "notificari@reciclare-prod.ro" },
  subject: "Subiect test",
  html: "<p>Continut</p>",
  text: "Continut",
};

describe("ConsoleEmailProvider", () => {
  it("nu trimite nimic (mock) - doar jurnalizeaza, nu depinde de un SMTP real", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const provider = new ConsoleEmailProvider();

    await expect(provider.send(MESSAGE)).resolves.toBeUndefined();

    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0][0]).toContain(MESSAGE.to);
    info.mockRestore();
  });
});

describe("HttpApiEmailProvider", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("trimite un POST JSON cu autentificare Bearer catre URL-ul configurat", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new HttpApiEmailProvider("https://email.example.com/send", "secret-key");
    await provider.send(MESSAGE);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://email.example.com/send",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer secret-key",
        }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toMatchObject({
      to: MESSAGE.to,
      from: "Reciclare Prod SRL <notificari@reciclare-prod.ro>",
      subject: MESSAGE.subject,
    });
  });

  it("trimite reply_to doar cand mesajul il are", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;
    const provider = new HttpApiEmailProvider("https://email.example.com/send", "secret-key");

    await provider.send({ ...MESSAGE, replyTo: "contact@firma.ro" });
    await provider.send(MESSAGE);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).reply_to).toBe("contact@firma.ro");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).not.toHaveProperty("reply_to");
  });

  it("arunca daca raspunsul nu e ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Error",
      text: async () => "boom",
    }) as unknown as typeof fetch;

    const provider = new HttpApiEmailProvider("https://email.example.com/send", "secret-key");
    await expect(provider.send(MESSAGE)).rejects.toThrow(/500/);
  });
});

describe("getEmailProvider", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.EMAIL_API_URL;
    delete process.env.EMAIL_API_KEY;
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("intoarce providerul mock cand lipsesc credentialele", () => {
    expect(getEmailProvider()).toBeInstanceOf(ConsoleEmailProvider);
  });

  it("intoarce providerul real cand EMAIL_API_URL si EMAIL_API_KEY sunt setate", () => {
    process.env.EMAIL_API_URL = "https://email.example.com/send";
    process.env.EMAIL_API_KEY = "secret-key";

    expect(getEmailProvider()).toBeInstanceOf(HttpApiEmailProvider);
  });

  it("cade pe Resend cand exista doar RESEND_API_KEY", async () => {
    process.env.RESEND_API_KEY = "re_key";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const originalFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      const provider = getEmailProvider();
      expect(provider).toBeInstanceOf(HttpApiEmailProvider);
      await provider.send(MESSAGE);
      expect(fetchMock).toHaveBeenCalledWith(RESEND_SEND_URL, expect.anything());
    } finally {
      global.fetch = originalFetch;
    }
  });
});
