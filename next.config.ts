import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployments
  output: "standalone",

  // Disable x-powered-by header for security
  poweredByHeader: false,

  // Server external packages (Firebase Admin needs native modules)
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
