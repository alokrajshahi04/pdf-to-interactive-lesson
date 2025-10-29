import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["sharp", "zerox"],
  // Add empty turbopack config to silence warning and use default Turbopack
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark sharp as external
      config.externals.push("sharp");
    }

    // Ignore Tesseract worker files that cause issues in serverless
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      // Mock tesseract.js worker to prevent it from loading
      // We don't need it since we're using a custom vision model
      "tesseract.js/src/worker-script/node/index.js": false,
    };

    return config;
  },
};

export default nextConfig;
