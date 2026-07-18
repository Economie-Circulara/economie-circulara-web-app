import { describe, expect, it } from "vitest";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, validateFile } from "./validation";

describe("validateFile", () => {
  it("accepta un PDF sub limita de marime", () => {
    expect(validateFile({ size: 1024, type: "application/pdf" })).toBeNull();
  });

  it.each(ALLOWED_MIME_TYPES)("accepta tipul permis %s", (type) => {
    expect(validateFile({ size: 100, type })).toBeNull();
  });

  it("respinge fisierele peste limita maxima", () => {
    const error = validateFile({ size: MAX_FILE_SIZE_BYTES + 1, type: "application/pdf" });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("too_large");
    expect(error?.message).toMatch(/10MB/);
  });

  it("accepta fisierul exact la limita maxima", () => {
    expect(validateFile({ size: MAX_FILE_SIZE_BYTES, type: "application/pdf" })).toBeNull();
  });

  it("respinge un tip de fisier neacceptat", () => {
    const error = validateFile({ size: 100, type: "application/x-msdownload" });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("unsupported_type");
  });

  it("respinge un fisier fara tip MIME cunoscut (browser nu l-a putut determina)", () => {
    const error = validateFile({ size: 100, type: "" });
    expect(error?.code).toBe("unsupported_type");
  });
});
