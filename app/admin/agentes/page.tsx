import { redirect } from "next/navigation";

import { AgentesClient, type AgenteConfigView } from "@/components/agentes/AgentesClient";
import { gerarPromptCompleto, initialAgenteConfigs } from "@/lib/agentes";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

async function ensureAgenteConfigs() {
  await Promise.all(
    initialAgenteConfigs.map((config) =>
      prisma.agenteConfig.upsert({
        where: {
          agente: config.agente,
        },
        update: {},
        create: {
          ...config,
          promptCompleto: gerarPromptCompleto(config),
        },
      }),
    ),
  );
}

export default async function AgentesPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.papel !== "ADMIN") {
    redirect("/");
  }

  await ensureAgenteConfigs();

  const configs = await prisma.agenteConfig.findMany({
    where: {
      agente: {
        in: ["MARIA", "JOAO"],
      },
    },
    orderBy: {
      agente: "asc",
    },
  });

  const initialConfigs = configs.map<AgenteConfigView>((config) => ({
    ...config,
    agente: config.agente as "MARIA" | "JOAO",
    atualizadoEm: config.atualizadoEm.toISOString(),
  }));

  return <AgentesClient initialConfigs={initialConfigs} />;
}
