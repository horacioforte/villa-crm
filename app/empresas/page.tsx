"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Building2, Loader2, MapPin, Plus, Target, Users } from "lucide-react";
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

type EmpresaCard = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  segmento: string | null;
  cidade: string | null;
  estado: string | null;
  _count: {
    obras: number;
    oportunidades: number;
  };
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

export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState<EmpresaCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadEmpresas() {
      try {
        const response = await fetch("/api/empresas");

        if (!response.ok) {
          throw new Error("Falha ao carregar empresas.");
        }

        setEmpresas(await response.json());
      } catch {
        toast.error("Nao foi possivel carregar as empresas.");
      } finally {
        setIsLoading(false);
      }
    }

    loadEmpresas();
  }, []);

  const totalOportunidades = useMemo(
    () =>
      empresas.reduce(
        (total, empresa) => total + empresa._count.oportunidades,
        0,
      ),
    [empresas],
  );

  return (
    <main className="min-h-screen bg-[#F4F6FA] px-5 py-8 text-[#172033] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <PageNavigation currentPage="Empresas" currentHref="/empresas" />
        <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#1E4FAB]">
              Villa CRM
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#1A2E5A]">
              Empresas
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
              Gerencie clientes, construtoras e parceiros ligados a obras,
              oportunidades e equipamentos.
            </p>
          </div>
          <Button
            render={<Link href="/empresas/nova" />}
            className="h-11 rounded-2xl bg-[#1A2E5A] px-5 text-white hover:bg-[#1E4FAB]"
          >
            <Plus className="size-4" />
            Nova empresa
          </Button>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <Card className="rounded-3xl border-[#D7DEEA]">
            <CardHeader>
              <CardDescription>Empresas ativas</CardDescription>
              <CardTitle className="text-3xl font-bold text-[#1A2E5A]">
                {empresas.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-3xl border-[#D7DEEA]">
            <CardHeader>
              <CardDescription>Oportunidades vinculadas</CardDescription>
              <CardTitle className="text-3xl font-bold text-[#1A2E5A]">
                {totalOportunidades}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-3xl border-[#D7DEEA]">
            <CardHeader>
              <CardDescription>Base comercial</CardDescription>
              <CardTitle className="text-3xl font-bold text-[#1A2E5A]">
                CRM
              </CardTitle>
            </CardHeader>
          </Card>
        </section>

        {isLoading ? (
          <div className="mt-12 flex items-center justify-center rounded-3xl border border-dashed border-[#D7DEEA] bg-white p-12 text-[#667085]">
            <Loader2 className="mr-2 size-5 animate-spin" />
            Carregando empresas...
          </div>
        ) : empresas.length === 0 ? (
          <Card className="mt-8 rounded-3xl border-dashed border-[#D7DEEA] bg-white">
            <CardContent className="flex flex-col items-center py-14 text-center">
              <Building2 className="size-10 text-[#1E4FAB]" />
              <h2 className="mt-4 text-xl font-bold text-[#1A2E5A]">
                Nenhuma empresa cadastrada
              </h2>
              <p className="mt-2 max-w-md text-sm text-[#667085]">
                Cadastre a primeira empresa para iniciar o pipeline comercial da
                Villa.
              </p>
            </CardContent>
          </Card>
        ) : (
          <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {empresas.map((empresa) => {
              const displayName = empresa.nomeFantasia ?? empresa.razaoSocial;

              return (
                <Link
                  key={empresa.id}
                  href={`/empresas/${empresa.id}`}
                  className="block focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#1E4FAB]/30"
                >
                  <Card className="h-full rounded-3xl border-[#D7DEEA] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#1A2E5A] text-lg font-bold text-white">
                          {getInitials(displayName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="truncate text-xl font-bold text-[#1A2E5A]">
                            {displayName}
                          </CardTitle>
                          <CardDescription className="mt-1 flex items-center gap-1">
                            <MapPin className="size-4" />
                            {empresa.cidade && empresa.estado
                              ? `${empresa.cidade}/${empresa.estado}`
                              : "Localizacao nao informada"}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Badge
                        variant="secondary"
                        className="bg-[#E8EEFB] text-[#1A2E5A]"
                      >
                        {empresa.segmento ?? "Sem segmento"}
                      </Badge>

                      <div className="mt-6 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-[#F4F6FA] p-4">
                          <Users className="size-5 text-[#1E4FAB]" />
                          <p className="mt-3 text-2xl font-bold text-[#1A2E5A]">
                            {empresa._count.obras}
                          </p>
                          <p className="text-xs font-semibold text-[#667085]">
                            Obras
                          </p>
                        </div>
                        <div className="rounded-2xl bg-[#F4F6FA] p-4">
                          <Target className="size-5 text-[#1E4FAB]" />
                          <p className="mt-3 text-2xl font-bold text-[#1A2E5A]">
                            {empresa._count.oportunidades}
                          </p>
                          <p className="text-xs font-semibold text-[#667085]">
                            Oportunidades
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
