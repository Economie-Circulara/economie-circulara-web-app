import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
