import { NextConfig } from "next";

const nextConfig = {
  serverExternalPackages: ["tesseract.js"],
  experimental: {
    outputFileTracingIncludes: {
      "/api/**/*": ["./node_modules/**/*.wasm", "./node_modules/**/*.proto"],
    },
  },
} as NextConfig;

export default nextConfig;
