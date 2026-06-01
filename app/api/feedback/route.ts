import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auditLog } from "@/lib/audit";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { feedbackCreateSchema } from "@/lib/validations/feedback";

function isFeedbackManager(papel: string) {
  return papel === "ADMIN" || papel === "GERENTE";
}

async function createFeedbackWithNumero(data: {
  tipo: "BUG" | "SUGESTAO";
  titulo: string;
  descricao: string;
  area: string | null;
  autorId: string;
}) {
  const ultimo = await prisma.feedback.findFirst({
    orderBy: {
      numero: "desc",
    },
    select: {
      numero: true,
    },
  });

  return prisma.feedback.create({
    data: {
      ...data,
      numero: (ultimo?.numero ?? 0) + 1,
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
}

export async function GET(request: Request) {
  const authResult = await requireAuth(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const feedbacks = await prisma.feedback.findMany({
    where: isFeedbackManager(authResult.papel) ? {} : { autorId: authResult.id },
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
    orderBy: {
      numero: "desc",
    },
  });

  return NextResponse.json({
    canManage: isFeedbackManager(authResult.papel),
    currentUserId: authResult.id,
    feedbacks,
  });
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const data = feedbackCreateSchema.parse(await request.json());
    let feedback;

    try {
      feedback = await createFeedbackWithNumero({
        ...data,
        autorId: authResult.id,
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        feedback = await createFeedbackWithNumero({
          ...data,
          autorId: authResult.id,
        });
      } else {
        throw error;
      }
    }

    await auditLog({
      action: "FEEDBACK_CREATED",
      entity: "Feedback",
      entityId: feedback.id,
      after: feedback,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(feedback, { status: 201 });
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
      { message: "Nao foi possivel registrar o feedback." },
      { status: 500 },
    );
  }
}
