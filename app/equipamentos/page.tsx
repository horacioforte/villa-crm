"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Truck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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

type EquipamentoRow = {
  id: string;
  nome: string;
  tipo: "BOMBA_CONCRETO" | "BETONEIRA" | "OUTRO";
  codigoInterno: string;
};

const tipoConfig = {
  BOMBA_CONCRETO: {
    label: "Bomba de concreto",
    className: "bg-[#E8EEFB] text-[#1A2E5A]",
  },
  BETONEIRA: {
    label: "Betoneira",
    className: "bg-blue-100 text-blue-700",
  },
  OUTRO: {
    label: "Outro",
    className: "bg-slate-100 text-slate-700",
  },
};

export default function EquipamentosPage() {
  const [equipamentos, setEquipamentos] = useState<EquipamentoRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadEquipamentos() {
      try {
        const response = await fetch("/api/equipamentos");

        if (!response.ok) {
          throw new Error("Falha ao carregar equipamentos.");
        }

        setEquipamentos(await response.json());
      } catch {
        toast.error("Nao foi possivel carregar os equipamentos.");
      } finally {
        setIsLoading(false);
      }
    }

    loadEquipamentos();
  }, []);

  const totalPorTipo = useMemo(
    () =>
      equipamentos.reduce(
        (total, equipamento) => ({
          ...total,
          [equipamento.tipo]: total[equipamento.tipo] + 1,
        }),
        {
          BOMBA_CONCRETO: 0,
          BETONEIRA: 0,
          OUTRO: 0,
        },
      ),
    [equipamentos],
  );

  return (
    <main className="min-h-screen bg-[#F4F6FA] px-5 py-8 text-[#172033] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <PageNavigation
          currentPage="Equipamentos"
          currentHref="/equipamentos"
        />
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#1E4FAB]">
            Villa CRM
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#1A2E5A]">
            Equipamentos
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
            Consulte bombas de concreto, betoneiras e outros equipamentos
            disponiveis para oportunidades comerciais.
          </p>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <Card className="rounded-3xl border-[#D7DEEA]">
            <CardHeader>
              <CardDescription>Equipamentos disponiveis</CardDescription>
              <CardTitle className="text-3xl font-bold text-[#1A2E5A]">
                {equipamentos.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-3xl border-[#D7DEEA]">
            <CardHeader>
              <CardDescription>Bombas de concreto</CardDescription>
              <CardTitle className="text-3xl font-bold text-[#1A2E5A]">
                {totalPorTipo.BOMBA_CONCRETO}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-3xl border-[#D7DEEA]">
            <CardHeader>
              <CardDescription>Betoneiras</CardDescription>
              <CardTitle className="text-3xl font-bold text-[#1A2E5A]">
                {totalPorTipo.BETONEIRA}
              </CardTitle>
            </CardHeader>
          </Card>
        </section>

        <Card className="mt-8 rounded-3xl border-[#D7DEEA] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-[#1A2E5A]">
              Equipamentos cadastrados
            </CardTitle>
            <CardDescription>
              Lista de equipamentos disponiveis retornada pela API.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-[#667085]">
                <Loader2 className="mr-2 size-5 animate-spin" />
                Carregando equipamentos...
              </div>
            ) : equipamentos.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#D7DEEA] py-14 text-center">
                <Truck className="size-10 text-[#1E4FAB]" />
                <p className="mt-3 font-semibold text-[#1A2E5A]">
                  Nenhum equipamento disponivel
                </p>
                <p className="mt-1 text-sm text-[#667085]">
                  Quando houver equipamentos disponiveis, eles aparecerao aqui.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Codigo</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipamentos.map((equipamento) => (
                    <TableRow key={equipamento.id}>
                      <TableCell className="font-semibold text-[#1A2E5A]">
                        {equipamento.codigoInterno}
                      </TableCell>
                      <TableCell>{equipamento.nome}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={tipoConfig[equipamento.tipo].className}
                        >
                          {tipoConfig[equipamento.tipo].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="bg-emerald-100 text-emerald-700"
                        >
                          Disponivel
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
