import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ws / @neondatabase/serverless rely on optional native bindings (bufferutil)
  // — when webpack bundles them, the Sender.mask path throws at runtime.
  // Externalize so Node's native require resolves them with their full package.
  serverExternalPackages: [
    "ws",
    "@neondatabase/serverless",
    "@prisma/adapter-neon",
  ],
};

export default nextConfig;
