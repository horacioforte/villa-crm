"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Bot, History, User as UserIcon } from "lucide-react";

import { PageNavigation } from "@/components/layout/PageNavigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type RegistroPipeline = {
  id: string;
  data: string;
  acao: string;
  origem: string;
  oportunidadeId: string | null;
  oportunidadeTitulo: string | null;
  statusAnterior: string | null;
  statusNovo: string | null;
  motivoPerda: string | null;
  responsavelAnterior: string | null;
  responsavelNovo: string | null;
  realizadoPor: string;
  realizadoPorEmail: string | null;
  realizadoPorPapel: string | null;
};

const statusLabel: Record<string, string> = {
  NOVA: "Nova",
  PRE_QUALIFICADA: "Pré-qualificada",
  EM_ATENDIMENTO: "Em atendimento",
  PROPOSTA_ENVIADA: "Proposta enviada",
  NEGOCIACAO: "Negociação",
  GANHA: "Ganha",
  PERDIDA: "Perdida",
};

function formatDataHora(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AuditoriaPipelineClient({
  registrosIniciais,
}: {
  registrosIniciais: RegistroPipeline[];
}) {
  const [filtroOrigem, setFiltroOrigem] = useState("todos");

  const registros = useMemo(() => {
    if (filtroOrigem === "todos") {
      return registrosIniciais;
    }

    return registrosIniciais.filter((r) => r.origem === filtroOrigem);
  }, [registrosIniciais, filtroOrigem]);

  return (
    <main className="min-h-screen bg-[#F4F6FA] px-5 py-8 text-[#172033] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <PageNavigation
          currentPage="Auditoria do Pipeline"
          currentHref="/auditoria/pipeline"
        />
        <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#1E4FAB]">
              Villa CRM
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#1A2E5A]">
              Auditoria do Pipeline
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
              Histórico de mudanças de etapa e de responsável nas oportunidades,
              incluindo quem fez a mudança e se foi manual (Kanban) ou via CRM IA.
            </p>
          </div>
          <Select value={filtroOrigem} onValueChange={(v) => setFiltroOrigem(v ?? "todos")}>
            <SelectTrigger className="h-11 min-w-48 rounded-2xl bg-white">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as origens</SelectItem>
              <SelectItem value="MANUAL">Manual (Kanban)</SelectItem>
              <SelectItem value="CRM_IA">CRM IA (chat)</SelectItem>
            </SelectContent>
          </Select>
        </header>

        <Card className="mt-8 rounded-3xl border-[#D7DEEA] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-[#1A2E5A]">
              <History className="size-5 text-[#1E4FAB]" />
              Últimas mudanças
            </CardTitle>
            <CardDescription>
              {registros.length === 1
                ? "1 mudança registrada"
                : `${registros.length} mudanças registradas`}{" "}
              (últimas 200 no total, mais recentes primeiro).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {registros.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#D7DEEA] py-14 text-center">
                <History className="size-10 text-[#1E4FAB]" />
                <p className="mt-3 font-semibold text-[#1A2E5A]">
                  Nenhuma mudança registrada
                </p>
                <p className="mt-1 text-sm text-[#667085]">
                  Assim que uma oportunidade mudar de etapa ou de responsável, o
                  registro aparece aqui.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/hora</TableHead>
                    <TableHead>Oportunidade</TableHead>
                    <TableHead>Mudança</TableHead>
                    <TableHead>Quem fez</TableHead>
                    <TableHead>Origem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registros.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-sm text-[#667085]">
                        {formatDataHora(r.data)}
                      </TableCell>
                      <TableCell className="font-semibold text-[#1A2E5A]">
                        {r.oportunidadeId ? (
                          <Link href="/oportunidades" className="hover:underline">
                            {r.oportunidadeTitulo ?? "Oportunidade removida"}
                          </Link>
                        ) : (
                          (r.oportunidadeTitulo ?? "-")
                        )}
                      </TableCell>
                      <TableCell>
                        {r.acao === "OPORTUNIDADE_STATUS_CHANGED" ? (
                          <span className="inline-flex items-center gap-2 text-sm">
                            <Badge variant="secondary" className="bg-[#E8EEFB] text-[#1A2E5A]">
                              {statusLabel[r.statusAnterior ?? ""] ?? r.statusAnterior ?? "-"}
                            </Badge>
                            <ArrowRight className="size-3.5 text-[#667085]" />
                            <Badge variant="secondary" className="bg-[#E8EEFB] text-[#1A2E5A]">
                              {statusLabel[r.statusNovo ?? ""] ?? r.statusNovo ?? "-"}
                            </Badge>
                            {r.motivoPerda ? (
                              <span className="text-xs text-[#667085]">
                                ({r.motivoPerda})
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-sm">
                            <span>{r.responsavelAnterior ?? "Sem responsável"}</span>
                            <ArrowRight className="size-3.5 text-[#667085]" />
                            <span className="font-semibold">
                              {r.responsavelNovo ?? "Sem responsável"}
                            </span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2 text-sm">
                          <UserIcon className="size-4 text-[#1E4FAB]" />
                          {r.realizadoPor}
                        </span>
                      </TableCell>
                      <TableCell>
                        {r.origem === "CRM_IA" ? (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                            <Bot className="mr-1 size-3.5" />
                            CRM IA
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-[#F4F6FA] text-[#1A2E5A]">
                            Manual
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
