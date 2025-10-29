const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["tesseract.js", "zerox", "sharp"],
    outputFileTracingIncludes: {
      "/api/**/*": ["./node_modules/**/*.wasm", "./node_modules/**/*.proto"],
    },
  },
};
