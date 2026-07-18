import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks (nu spies — AGENTS.md §2.2): inlocuim clientii Supabase, sesiunea,
// fetch-ul de trasabilitate (repository.ts) si randarea PDF (grea/lenta —
// izolam orchestrarea din service.ts de randarea reala @react-pdf/renderer).
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { createAdminClient } = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireRole }));

const { fetchOrderTraceabilityRawData } = vi.hoisted(() => ({
  fetchOrderTraceabilityRawData: vi.fn(),
}));
vi.mock("./repository", () => ({ fetchOrderTraceabilityRawData }));

const { renderToBuffer } = vi.hoisted(() => ({ renderToBuffer: vi.fn() }));
vi.mock("@react-pdf/renderer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-pdf/renderer")>();
  return { ...actual, renderToBuffer };
});

import {
  CertificateAccessError,
  CertificateOrderNotFoundError,
  generateCertificateForOrder,
  generateCertificateNumber,
  getCertificateByOrderId,
  getCertificateDownloadUrl,
} from "./service";

afterEach(() => {
  vi.clearAllMocks();
});

function certificateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "cert-1",
    organization_id: "org-1",
    order_id: "order-1",
    number: "CRT-2026-0001",
    issued_at: "2026-07-01T00:00:00.000Z",
    pdf_path: "org-1/order-1/CRT-2026-0001.pdf",
    traceability_snapshot: {
      version: 1,
      generatedAt: "2026-07-01T00:00:00.000Z",
      order: { id: "order-1", number: "CMD-2026-0001", clientName: "Apex SRL", clientCui: "RO123" },
      deliveredItems: [],
      graph: { nodes: [], links: [] },
      materials: [],
    },
    ...overrides,
  };
}

/** Client mock generic: `from(table)` -> select().eq().maybeSingle() rezolva la `data`. */
function readOnlyClient(dataByTable: Record<string, unknown>) {
  return {
    from: vi.fn((table: string) => {
      const maybeSingle = vi
        .fn()
        .mockResolvedValue({ data: dataByTable[table] ?? null, error: null });
      const eq = vi.fn().mockReturnValue({ maybeSingle });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    }),
  };
}

describe("generateCertificateNumber", () => {
  it("apeleaza RPC generate_certificate_number si returneaza numarul", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "CRT-2026-0005", error: null });
    createClient.mockResolvedValue({ rpc });

    const result = await generateCertificateNumber("org-1");

    expect(rpc).toHaveBeenCalledWith("generate_certificate_number", { p_org: "org-1" });
    expect(result).toBe("CRT-2026-0005");
  });

  it("arunca eroare cand RPC esueaza", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    createClient.mockResolvedValue({ rpc });

    await expect(generateCertificateNumber("org-1")).rejects.toThrow("boom");
  });
});

describe("getCertificateByOrderId", () => {
  it("intoarce null cand nu exista inca certificat pentru comanda", async () => {
    createClient.mockResolvedValue(readOnlyClient({}));

    const result = await getCertificateByOrderId("order-x");

    expect(result).toBeNull();
  });

  it("mapeaza randul existent", async () => {
    createClient.mockResolvedValue(readOnlyClient({ certificates: certificateRow() }));

    const result = await getCertificateByOrderId("order-1");

    expect(result?.number).toBe("CRT-2026-0001");
    expect(result?.snapshot.order.clientName).toBe("Apex SRL");
  });
});

describe("generateCertificateForOrder", () => {
  it("cere rol de staff inainte de orice altceva (gating acces)", async () => {
    requireRole.mockRejectedValue(new Error("REDIRECT"));

    await expect(generateCertificateForOrder("order-1")).rejects.toThrow("REDIRECT");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("idempotent: daca certificatul exista deja, nu regenereaza (nici PDF, nici storage)", async () => {
    requireRole.mockResolvedValue({ id: "user-1", role: "admin" });
    createClient.mockResolvedValue(readOnlyClient({ certificates: certificateRow() }));

    const result = await generateCertificateForOrder("order-1");

    expect(result.created).toBe(false);
    expect(result.certificate.number).toBe("CRT-2026-0001");
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(fetchOrderTraceabilityRawData).not.toHaveBeenCalled();
    expect(renderToBuffer).not.toHaveBeenCalled();
  });

  it("arunca CertificateOrderNotFoundError cand comanda nu exista/nu e accesibila", async () => {
    requireRole.mockResolvedValue({ id: "user-1", role: "admin" });
    createClient.mockResolvedValue(readOnlyClient({})); // certificates=null, orders=null

    await expect(generateCertificateForOrder("order-x")).rejects.toBeInstanceOf(
      CertificateOrderNotFoundError,
    );
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("genereaza certificatul nou: snapshot + numar + PDF + upload + insert", async () => {
    requireRole.mockResolvedValue({ id: "user-1", role: "admin" });

    const rpc = vi.fn().mockResolvedValue({ data: "CRT-2026-0002", error: null });
    createClient.mockResolvedValue({
      ...readOnlyClient({
        certificates: null,
        orders: {
          id: "order-1",
          organization_id: "org-1",
          order_number: "CMD-2026-0001",
          clients: { name: "Apex SRL", cui: "RO123" },
        },
        organizations: { name: "Lateris", primary_color: null, secondary_color: null },
      }),
      rpc,
    });

    fetchOrderTraceabilityRawData.mockResolvedValue({
      delivered: [],
      lots: {},
      processes: {},
      outputByLot: {},
      inputsByProcess: {},
    });
    renderToBuffer.mockResolvedValue(Buffer.from("pdf-content"));

    const upload = vi.fn().mockResolvedValue({ data: { path: "x" }, error: null });
    const remove = vi.fn();
    const single = vi
      .fn()
      .mockResolvedValue({ data: certificateRow({ number: "CRT-2026-0002" }), error: null });
    const insertSelect = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });
    createAdminClient.mockReturnValue({
      storage: { from: vi.fn().mockReturnValue({ upload, remove }) },
      from: vi.fn().mockReturnValue({ insert }),
    });

    const result = await generateCertificateForOrder("order-1");

    expect(result.created).toBe(true);
    expect(result.certificate.number).toBe("CRT-2026-0002");

    expect(upload).toHaveBeenCalledTimes(1);
    const [path, , options] = upload.mock.calls[0];
    expect(path).toBe("org-1/order-1/CRT-2026-0002.pdf");
    expect(options).toMatchObject({ contentType: "application/pdf", upsert: false });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-1",
        order_id: "order-1",
        number: "CRT-2026-0002",
        pdf_path: "org-1/order-1/CRT-2026-0002.pdf",
      }),
    );
    expect(remove).not.toHaveBeenCalled();
  });

  it("sterge PDF-ul deja incarcat si recitesc certificatul existent daca insertul esueaza (cursa la concurenta)", async () => {
    requireRole.mockResolvedValue({ id: "user-1", role: "admin" });

    const rpc = vi.fn().mockResolvedValue({ data: "CRT-2026-0003", error: null });
    let certificatesReadCount = 0;
    const from = vi.fn((table: string) => {
      if (table === "certificates") {
        certificatesReadCount += 1;
        // Primul citit (idempotenta): null. Al doilea (dupa insert esuat, cursa
        // cu alt request): certificatul deja creat de celalalt request.
        const data = certificatesReadCount === 1 ? null : certificateRow({ number: "CRT-RACE" });
        const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
        const eq = vi.fn().mockReturnValue({ maybeSingle });
        return { select: vi.fn().mockReturnValue({ eq }) };
      }
      if (table === "orders") {
        const maybeSingle = vi.fn().mockResolvedValue({
          data: {
            id: "order-1",
            organization_id: "org-1",
            order_number: "CMD-2026-0001",
            clients: { name: "Apex SRL", cui: "RO123" },
          },
          error: null,
        });
        return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }),
        };
      }
      if (table === "organizations") {
        const maybeSingle = vi.fn().mockResolvedValue({
          data: { name: "Lateris", primary_color: null, secondary_color: null },
          error: null,
        });
        return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }),
        };
      }
      throw new Error(`tabel neasteptat in test: ${table}`);
    });
    createClient.mockResolvedValue({ from, rpc });

    fetchOrderTraceabilityRawData.mockResolvedValue({
      delivered: [],
      lots: {},
      processes: {},
      outputByLot: {},
      inputsByProcess: {},
    });
    renderToBuffer.mockResolvedValue(Buffer.from("pdf-content"));

    const upload = vi.fn().mockResolvedValue({ data: { path: "x" }, error: null });
    const remove = vi.fn().mockResolvedValue({ data: null, error: null });
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: { message: "duplicate key" } }),
      }),
    });
    createAdminClient.mockReturnValue({
      storage: { from: vi.fn().mockReturnValue({ upload, remove }) },
      from: vi.fn().mockReturnValue({ insert }),
    });

    const result = await generateCertificateForOrder("order-1");

    expect(result.created).toBe(false);
    expect(result.certificate.number).toBe("CRT-RACE");
    expect(remove).toHaveBeenCalledWith(["org-1/order-1/CRT-2026-0003.pdf"]);
  });
});

describe("getCertificateDownloadUrl", () => {
  it("arunca CertificateAccessError cand randul nu e accesibil (RLS)", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: "no rows" } });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ select }) });

    await expect(getCertificateDownloadUrl("cert-x")).rejects.toBeInstanceOf(
      CertificateAccessError,
    );
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("semneaza URL-ul cu clientul admin dupa ce RLS confirma accesul", async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: { pdf_path: "org-1/order-1/CRT.pdf" }, error: null });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ select }) });

    const createSignedUrl = vi
      .fn()
      .mockResolvedValue({ data: { signedUrl: "https://signed.example/cert.pdf" }, error: null });
    createAdminClient.mockReturnValue({
      storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) },
    });

    const url = await getCertificateDownloadUrl("cert-1");

    expect(createSignedUrl).toHaveBeenCalledWith("org-1/order-1/CRT.pdf", 60);
    expect(url).toBe("https://signed.example/cert.pdf");
  });
});
