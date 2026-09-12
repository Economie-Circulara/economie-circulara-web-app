import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/*": ["./src/assets/fonts/**/*"],
  },
};

export default nextConfig;
