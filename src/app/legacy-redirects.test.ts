import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

/**
 * „Certificat” -> „Fișă de trasabilitate” (2026-10-08): linkurile vechi din emailuri
 * si PDF-uri trebuie sa duca in continuare la fisa comenzii.
 */
describe("redirect-urile rutelor vechi /certificat", () => {
  it("trimite rutele staff si client pe /trasabilitate, permanent", async () => {
    const redirects = await nextConfig.redirects!();
    expect(redirects).toEqual(
      expect.arrayContaining([
        {
          source: "/comenzi/:id/certificat",
          destination: "/comenzi/:id/trasabilitate",
          permanent: true,
        },
        {
          source: "/comenzile-mele/:id/certificat",
          destination: "/comenzile-mele/:id/trasabilitate",
          permanent: true,
        },
      ]),
    );
  });
});
