// ARQUIVO: app/api/base-nacional/cidades/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Autocompletar de cidades da Base Nacional (somente leitura, máx. 20 resultados).

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { buscarCidades } from "@/lib/base-nacional/consulta";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const usuario = await getCurrentUser();
  if (!usuario) return NextResponse.json({ message: "Autenticacao obrigatoria." }, { status: 401 });
  const url = new URL(request.url);
  const uf = url.searchParams.get("uf")?.toUpperCase();
  const termo = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
  const cidades = await buscarCidades(uf && /^[A-Z]{2}$/.test(uf) ? uf : undefined, termo);
  return NextResponse.json({ cidades });
}
