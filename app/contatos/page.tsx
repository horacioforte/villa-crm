"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, Plus, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ContatoRow = {
  id: string;
  nome: string;
  cargo: string | null;
  whatsapp: string | null;
  influenciaDecisao:
    | "DECISOR"
    | "INFLUENCIADOR"
    | "TECNICO"
    | "OPERACIONAL"
    | "BLOQUEADOR";
  nivelRelacionamento: "FRIO" | "NEUTRO" | "BOM" | "EXCELENTE";
  empresa: {
    razaoSocial: string;
    nomeFantasia: string | null;
  };
};

const influenciaConfig = {
  DECISOR: { label: "Decisor", className: "bg-[#1A2E5A] text-white" },
  INFLUENCIADOR: {
    label: "Influenciador",
    className: "bg-[#E8EEFB] text-[#1A2E5A]",
  },
  TECNICO: { label: "Tecnico", className: "bg-slate-100 text-slate-700" },
  OPERACIONAL: {
    label: "Operacional",
    className: "bg-blue-100 text-blue-700",
  },
  BLOQUEADOR: { label: "Bloqueador", className: "bg-red-100 text-red-700" },
};

const relacionamentoConfig = {
  FRIO: { label: "Frio", className: "bg-slate-100 text-slate-700" },
  NEUTRO: { label: "Neutro", className: "bg-[#E8EEFB] text-[#1A2E5A]" },
  BOM: { label: "Bom", className: "bg-blue-100 text-blue-700" },
  EXCELENTE: {
    label: "Excelente",
    className: "bg-emerald-100 text-emerald-700",
  },
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function ContatosPage() {
  const [contatos, setContatos] = useState<ContatoRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadContatos() {
      try {
        const response = await fetch("/api/contatos");

        if (!response.ok) {
          throw new Error("Falha ao carregar contatos.");
        }

        setContatos(await response.json());
      } catch {
        toast.error("Nao foi possivel carregar os contatos.");
      } finally {
        setIsLoading(false);
      }
    }

    loadContatos();
  }, []);

  return (
    <main className="min-h-screen bg-[#F4F6FA] px-5 py-8 text-[#172033] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#1E4FAB]">
              Villa CRM
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#1A2E5A]">
              Pessoas e contatos
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
              Mapeie decisores, influenciadores e relacionamento comercial por
              empresa.
            </p>
          </div>
          <Button
            render={<Link href="/contatos/novo" />}
            className="h-11 rounded-2xl bg-[#1A2E5A] px-5 text-white hover:bg-[#1E4FAB]"
          >
            <Plus className="size-4" />
            Novo contato
          </Button>
        </header>

        <Card className="mt-8 rounded-3xl border-[#D7DEEA] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-[#1A2E5A]">
              Contatos cadastrados
            </CardTitle>
            <CardDescription>
              {contatos.length} contatos ativos na base comercial.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-[#667085]">
                <Loader2 className="mr-2 size-5 animate-spin" />
                Carregando contatos...
              </div>
            ) : contatos.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#D7DEEA] py-14 text-center">
                <UserRound className="size-10 text-[#1E4FAB]" />
                <p className="mt-3 font-semibold text-[#1A2E5A]">
                  Nenhum contato cadastrado
                </p>
                <p className="mt-1 text-sm text-[#667085]">
                  Cadastre pessoas para enriquecer o relacionamento comercial.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Influencia</TableHead>
                    <TableHead>Relacionamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contatos.map((contato) => (
                    <TableRow key={contato.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-2xl bg-[#1A2E5A] text-sm font-bold text-white">
                            {getInitials(contato.nome)}
                          </div>
                          <span className="font-semibold text-[#1A2E5A]">
                            {contato.nome}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{contato.cargo ?? "-"}</TableCell>
                      <TableCell>
                        {contato.empresa.nomeFantasia ??
                          contato.empresa.razaoSocial}
                      </TableCell>
                      <TableCell>{contato.whatsapp ?? "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            influenciaConfig[contato.influenciaDecisao]
                              .className
                          }
                        >
                          {influenciaConfig[contato.influenciaDecisao].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            relacionamentoConfig[contato.nivelRelacionamento]
                              .className
                          }
                        >
                          {
                            relacionamentoConfig[contato.nivelRelacionamento]
                              .label
                          }
                        </Badge>
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
