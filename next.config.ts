import { NextConfig } from "next";

const nextConfig = {
  serverExternalPackages: ["mupdf"],
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/**/*.wasm", "./node_modules/**/*.proto"],
  },
  turbopack: {
    root: __dirname,
  },
} as NextConfig;

export default nextConfig;
