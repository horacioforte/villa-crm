import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/request-context";

type AuditLogInput = {
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  userId?: string | null;
  request?: Request;
};

function toJson(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value));
}

export async function auditLog({
  action,
  entity,
  entityId,
  before,
  after,
  metadata,
  userId,
  request,
}: AuditLogInput) {
  const { ip, userAgent } = getRequestContext(request);

  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        before: toJson(before),
        after: toJson(after),
        metadata: toJson(metadata),
        ip,
        userAgent,
        userId,
      },
    });
  } catch (error) {
    console.error("Falha ao registrar auditoria", error);
  }
}
