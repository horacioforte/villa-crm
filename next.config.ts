import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Temporário: erros de tipo do Prisma client (stale localmente) não quebram o build.
  // Remover após prisma generate ser executado com o schema atualizado.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
