import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["sharp", "zerox"],
  // Add empty turbopack config to silence warning and use default Turbopack
  turbopack: {},
};

export default nextConfig;
