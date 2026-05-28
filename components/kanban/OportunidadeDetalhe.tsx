"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Building2,
  Calendar,
  Hammer,
  Loader2,
  Package,
  Pencil,
  Trash2,
  User,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { statusOportunidadeValues } from "@/lib/validations/oportunidade";

type StatusOportunidade = (typeof statusOportunidadeValues)[number];

type OportunidadeDetalheData = {
  id: string;
  titulo: string;
  descricao: string | null;
  motivoPerda: string | null;
  tipo: "LOCACAO" | "VENDA";
  status: StatusOportunidade;
  valor: string | number | null;
  createdAt: string;
  empresa: {
    razaoSocial: string;
    nomeFantasia: string | null;
  };
  pessoa: {
    nome: string;
  } | null;
  obra: {
    nome: string;
  } | null;
  equipamento: {
    nome: string;
    codigo: string;
  } | null;
  responsavel: {
    nome: string;
  } | null;
};

type OportunidadeDetalheProps = {
  id: string;
  onFechar: () => void;
  onEditar: (id: string) => void;
  onDeletar: (id: string) => void;
};

const STATUS_CONFIG: Record<
  StatusOportunidade,
  { label: string; className: string }
> = {
  NOVA: { label: "Nova", className: "bg-[#E8EEFB] text-[#1A2E5A]" },
  EM_ATENDIMENTO: {
    label: "Em Atendimento",
    className: "bg-blue-100 text-blue-700",
  },
  PROPOSTA_ENVIADA: {
    label: "Proposta Enviada",
    className: "bg-amber-100 text-amber-700",
  },
  NEGOCIACAO: {
    label: "Negociacao",
    className: "bg-violet-100 text-violet-700",
  },
  GANHA: { label: "Ganha", className: "bg-emerald-100 text-emerald-700" },
  PERDIDA: { label: "Perdida", className: "bg-red-100 text-red-700" },
};

function formatCurrency(value: string | number | null) {
  if (value === null) {
    return "Nao informado";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

export function OportunidadeDetalhe({
  id,
  onFechar,
  onEditar,
  onDeletar,
}: OportunidadeDetalheProps) {
  const [oportunidade, setOportunidade] =
    useState<OportunidadeDetalheData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    async function loadOportunidade() {
      setIsLoading(true);

      try {
        const response = await fetch(`/api/oportunidades/${id}`);

        if (!response.ok) {
          throw new Error("Falha ao carregar oportunidade.");
        }

        setOportunidade(await response.json());
      } catch {
        toast.error("Nao foi possivel carregar a oportunidade.");
      } finally {
        setIsLoading(false);
      }
    }

    loadOportunidade();
  }, [id]);

  async function handleDelete() {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/oportunidades/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Falha ao excluir oportunidade.");
      }

      toast.success("Oportunidade excluida com sucesso.");
      onDeletar(id);
      setConfirmOpen(false);
      onFechar();
    } catch {
      toast.error("Nao foi possivel excluir a oportunidade.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <Sheet
        open
        onOpenChange={(open) => {
          if (!open) {
            onFechar();
          }
        }}
      >
        <SheetContent side="right" className="w-[420px] max-w-[calc(100vw-1rem)]">
          <SheetHeader className="border-b border-[#D7DEEA] p-6">
            <SheetTitle className="pr-8 text-2xl font-bold text-[#1A2E5A]">
              Detalhe da oportunidade
            </SheetTitle>
            <SheetDescription>
              Informacoes comerciais e relacionamentos vinculados.
            </SheetDescription>
          </SheetHeader>

          {isLoading ? (
            <div className="flex flex-1 items-center justify-center text-[#667085]">
              <Loader2 className="mr-2 size-5 animate-spin" />
              Carregando oportunidade...
            </div>
          ) : oportunidade ? (
            <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-6">
              <div className="pt-2">
                <Badge
                  variant="secondary"
                  className={STATUS_CONFIG[oportunidade.status].className}
                >
                  {STATUS_CONFIG[oportunidade.status].label}
                </Badge>
                <h2 className="mt-3 text-2xl font-bold text-[#1A2E5A]">
                  {oportunidade.titulo}
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Card className="rounded-3xl border-[#D7DEEA] bg-[#1A2E5A] text-white">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-white/65">Valor</p>
                    <p className="mt-2 text-lg font-bold">
                      {formatCurrency(oportunidade.valor)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="rounded-3xl border-emerald-200 bg-emerald-50 text-emerald-800">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-emerald-700/70">
                      Tipo
                    </p>
                    <p className="mt-2 text-lg font-bold">
                      {oportunidade.tipo === "LOCACAO" ? "Locacao" : "Venda"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <div className="space-y-4">
                <RelatedInfo
                  icon={Building2}
                  label="Empresa"
                  value={
                    oportunidade.empresa.nomeFantasia ??
                    oportunidade.empresa.razaoSocial
                  }
                />
                <RelatedInfo
                  icon={Hammer}
                  label="Obra"
                  value={oportunidade.obra?.nome ?? "Nao vinculada"}
                />
                <RelatedInfo
                  icon={User}
                  label="Contato"
                  value={oportunidade.pessoa?.nome ?? "Nao informado"}
                />
                <RelatedInfo
                  icon={Package}
                  label="Equipamento"
                  value={
                    oportunidade.equipamento
                      ? `${oportunidade.equipamento.nome} - ${oportunidade.equipamento.codigo}`
                      : "Nao vinculado"
                  }
                />
                <RelatedInfo
                  icon={UserCheck}
                  label="Responsavel"
                  value={oportunidade.responsavel?.nome ?? "Nao informado"}
                />
                <RelatedInfo
                  icon={Calendar}
                  label="Criada em"
                  value={format(new Date(oportunidade.createdAt), "dd/MM/yyyy", {
                    locale: ptBR,
                  })}
                />
              </div>

              {oportunidade.descricao ? (
                <>
                  <Separator />
                  <section>
                    <h3 className="font-bold text-[#1A2E5A]">Descricao</h3>
                    <p className="mt-2 text-sm leading-6 text-[#667085]">
                      {oportunidade.descricao}
                    </p>
                  </section>
                </>
              ) : null}

              {oportunidade.motivoPerda ? (
                <>
                  <Separator />
                  <section>
                    <h3 className="font-bold text-[#1A2E5A]">Motivo da perda</h3>
                    <p className="mt-2 text-sm leading-6 text-[#667085]">
                      {oportunidade.motivoPerda}
                    </p>
                  </section>
                </>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-[#667085]">
              Oportunidade nao encontrada.
            </div>
          )}

          <SheetFooter className="border-t border-[#D7DEEA] p-6">
            <Button
              type="button"
              disabled={!oportunidade || isDeleting}
              onClick={() => onEditar(id)}
              className="h-11 rounded-2xl bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]"
            >
              <Pencil className="size-4" />
              Editar
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!oportunidade || isDeleting}
              onClick={() => setConfirmOpen(true)}
              className="h-11 rounded-2xl border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
            >
              <Trash2 className="size-4" />
              Excluir
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir oportunidade?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao remove a oportunidade do pipeline. Confirme apenas se
              deseja continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RelatedInfo({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-2xl bg-[#E8EEFB] p-2 text-[#1E4FAB]">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
          {label}
        </p>
        <p className="mt-1 font-semibold text-[#1A2E5A]">{value}</p>
      </div>
    </div>
  );
}
