import type { NextConfig } from "next";

const nextConfig = {
  // TypeScript com zero erros — verificação ativa no build.
  // Corrigido em 15/11/2026: fila.ts referral (DbNull) + auth.config.ts secret.
  typescript: {
    ignoreBuildErrors: false,
  },
  // Temporário: suprime warnings de variáveis não utilizadas no build.
  // Causa: imports em page.tsx (Bot, FolderOpen, formatHorario, joao) ainda não referenciados no JSX.
  // Não remover sem autorização de Horacio.
  eslint: {
    ignoreDuringBuilds: true,
  },
} as NextConfig;

export default nextConfig;
