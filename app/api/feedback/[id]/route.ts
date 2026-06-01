import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auditLog } from "@/lib/audit";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { feedbackPatchSchema } from "@/lib/validations/feedback";

type FeedbackRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function isFeedbackManager(papel: string) {
  return papel === "ADMIN" || papel === "GERENTE";
}

export async function PATCH(request: Request, context: FeedbackRouteContext) {
  const authResult = await requireAuth(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  if (!isFeedbackManager(authResult.papel)) {
    await auditLog({
      action: "FEEDBACK_PERMISSION_DENIED",
      entity: "Feedback",
      userId: authResult.id,
      request,
    });

    return NextResponse.json(
      { message: "Voce nao tem permissao para alterar feedbacks." },
      { status: 403 },
    );
  }

  const { id } = await context.params;

  try {
    const data = feedbackPatchSchema.parse(await request.json());
    const before = await prisma.feedback.findUnique({
      where: {
        id,
      },
      include: {
        autor: {
          select: {
            id: true,
            nome: true,
            email: true,
            papel: true,
          },
        },
      },
    });

    if (!before) {
      return NextResponse.json(
        { message: "Feedback nao encontrado." },
        { status: 404 },
      );
    }

    const feedback = await prisma.feedback.update({
      where: {
        id,
      },
      data,
      include: {
        autor: {
          select: {
            id: true,
            nome: true,
            email: true,
            papel: true,
          },
        },
      },
    });

    await auditLog({
      action: "FEEDBACK_UPDATED",
      entity: "Feedback",
      entityId: feedback.id,
      before,
      after: feedback,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(feedback);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: error.issues[0]?.message ?? "Dados invalidos.",
          errors: error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Nao foi possivel atualizar o feedback." },
      { status: 500 },
    );
  }
}
