import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MANUAL_DIR, readManualFile } from "./loader";

vi.mock("node:fs/promises", () => {
  const readFile = vi.fn();
  return { readFile, default: { readFile } };
});

const readFileMock = vi.mocked(readFile);

describe("readManualFile", () => {
  beforeEach(() => {
    readFileMock.mockReset();
    readFileMock.mockResolvedValue("# Manual" as never);
  });

  it("citeste fisierul din docs/manual", async () => {
    await expect(readManualFile("utilizare-client.md")).resolves.toBe("# Manual");
    expect(readFileMock).toHaveBeenCalledWith(path.join(MANUAL_DIR, "utilizare-client.md"), "utf8");
  });

  it("citeste din docs/manual, nu din alt folder", async () => {
    await readManualFile("ghid-administrare.md");
    const [calledWith] = readFileMock.mock.calls[0];
    expect(String(calledWith).endsWith(path.join("docs", "manual", "ghid-administrare.md"))).toBe(
      true,
    );
  });
});
