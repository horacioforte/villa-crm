import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/diagnostico-central-de-concreto",
        destination: "/diagnostico-central.html",
      },
    ];
  },
};

export default nextConfig;
