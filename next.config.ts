import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@neondatabase/serverless"],
};

export default nextConfig;
