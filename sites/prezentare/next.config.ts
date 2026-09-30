import path from "node:path";
import type { NextConfig } from "next";

// Site static (fara server): `next build` scrie totul in `out/`, servit ca atare de
// Vercel. Imaginile nu trec prin optimizatorul Next (nu exista server).
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: false,
  // Radacina explicita: altfel Next detecteaza lockfile-ul aplicatiei din radacina
  // repo-ului si ii preia `postcss.config.mjs` / `middleware.ts`.
  turbopack: { root: path.resolve(import.meta.dirname) },
  outputFileTracingRoot: path.resolve(import.meta.dirname),
};

export default nextConfig;
