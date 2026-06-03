import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/session";
import { getRelatorioPipeline } from "@/lib/relatorios/data";

export async function GET(request: Request) {
  const authResult = await requirePermission("relatorios", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const data = await getRelatorioPipeline(authResult);

  return NextResponse.json(data);
}
