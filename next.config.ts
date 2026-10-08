import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Upload-urile (logo, poza de item, documente) trec prin server actions, iar
    // implicitul Next e 1MB. Plafonul real e cel al Vercel: 4.5MB pe corpul unei
    // cereri catre o functie - peste el cererea e respinsa (413) inainte de Next.
    // Limitele per fisier raman sub el (max 4MB), ca sa incapa si restul formularului.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  // „Certificat” a devenit „Fișă de trasabilitate” (2026-10-08): rutele vechi raman
  // valide pentru linkurile deja trimise (emailuri, PDF-uri, favorite).
  async redirects() {
    return [
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
    ];
  },
  outputFileTracingIncludes: {
    "/*": ["./src/assets/fonts/**/*"],
    // Manualul din aplicatie citeste la request din `docs/manual/` (sursa unica de
    // adevar, in afara lui `public/`) - fara intrarile astea, fisierele nu ajung in
    // bundle-ul de pe Vercel si `/ajutor` cade doar in productie.
    "/ajutor/[slug]": ["./docs/manual/*.md"],
    "/ajutor/img/[...path]": ["./docs/manual/img/*.png"],
  },
};

export default nextConfig;
