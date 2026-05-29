"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, CalendarDays, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageNavigation } from "@/components/layout/PageNavigation";
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

type ObraRow = {
  id: string;
  nome: string;
  cidade: string | null;
  estado: string | null;
  volumeEstimado: string | number | null;
  dataTermino: string | null;
  status: "PLANEJADA" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA";
  empresa: {
    razaoSocial: string;
    nomeFantasia: string | null;
  };
  _count: {
    oportunidades: number;
  };
};

const statusConfig = {
  PLANEJADA: {
    label: "Planejada",
    className: "bg-[#E8EEFB] text-[#1A2E5A]",
  },
  EM_ANDAMENTO: {
    label: "Em andamento",
    className: "bg-blue-100 text-blue-700",
  },
  CONCLUIDA: {
    label: "Concluida",
    className: "bg-emerald-100 text-emerald-700",
  },
  CANCELADA: {
    label: "Cancelada",
    className: "bg-red-100 text-red-700",
  },
};

function formatDate(value: string | null) {
  if (!value) {
    return "Sem prazo";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export default function ObrasPage() {
  const router = useRouter();
  const [obras, setObras] = useState<ObraRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const obrasAtivasLabel =
    obras.length === 1 ? "1 obra ativa" : `${obras.length} obras ativas`;

  useEffect(() => {
    async function loadObras() {
      try {
        const response = await fetch("/api/obras");

        if (!response.ok) {
          throw new Error("Falha ao carregar obras.");
        }

        setObras(await response.json());
      } catch {
        toast.error("Nao foi possivel carregar as obras.");
      } finally {
        setIsLoading(false);
      }
    }

    loadObras();
  }, []);

  return (
    <main className="min-h-screen bg-[#F4F6FA] px-5 py-8 text-[#172033] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <PageNavigation currentPage="Obras" currentHref="/obras" />
        <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#1E4FAB]">
              Villa CRM
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#1A2E5A]">Obras</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
              Acompanhe obras vinculadas a empresas e oportunidades comerciais.
            </p>
          </div>
          <Button
            render={<Link href="/obras/nova" />}
            className="h-11 rounded-2xl bg-[#1A2E5A] px-5 text-white hover:bg-[#1E4FAB]"
          >
            <Plus className="size-4" />
            Nova obra
          </Button>
        </header>

        <Card className="mt-8 rounded-3xl border-[#D7DEEA] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-[#1A2E5A]">
              Obras cadastradas
            </CardTitle>
            <CardDescription>
              {obrasAtivasLabel} no pipeline da Villa. A coluna final mostra
              oportunidades vinculadas a cada obra.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-[#667085]">
                <Loader2 className="mr-2 size-5 animate-spin" />
                Carregando obras...
              </div>
            ) : obras.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#D7DEEA] py-14 text-center">
                <Building2 className="size-10 text-[#1E4FAB]" />
                <p className="mt-3 font-semibold text-[#1A2E5A]">
                  Nenhuma obra cadastrada
                </p>
                <p className="mt-1 text-sm text-[#667085]">
                  Crie a primeira obra para conectar oportunidades.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome da obra</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Volume m3</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">
                      Oportunidades vinculadas
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {obras.map((obra) => (
                    <TableRow
                      key={obra.id}
                      tabIndex={0}
                      role="link"
                      aria-label={`Editar obra ${obra.nome}`}
                      onClick={() => router.push(`/obras/${obra.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(`/obras/${obra.id}`);
                        }
                      }}
                      className="cursor-pointer hover:bg-[#E8EEFB]/70 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#1E4FAB]/30"
                    >
                      <TableCell className="font-semibold text-[#1A2E5A]">
                        {obra.nome}
                      </TableCell>
                      <TableCell>
                        {obra.empresa.nomeFantasia ?? obra.empresa.razaoSocial}
                      </TableCell>
                      <TableCell>
                        {obra.cidade && obra.estado
                          ? `${obra.cidade}/${obra.estado}`
                          : "Nao informado"}
                      </TableCell>
                      <TableCell>
                        {obra.volumeEstimado
                          ? Number(obra.volumeEstimado).toLocaleString("pt-BR")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2">
                          <CalendarDays className="size-4 text-[#1E4FAB]" />
                          {formatDate(obra.dataTermino)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={statusConfig[obra.status].className}
                        >
                          {statusConfig[obra.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {obra._count.oportunidades}
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
