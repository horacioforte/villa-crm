"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Building2,
  Calendar,
  CalendarCheck,
  Check,
  FileText,
  Hammer,
  Loader2,
  Package,
  Pencil,
  Phone,
  Plus,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PropostaModal } from "@/components/propostas/PropostaModal";
import { PropostasList } from "@/components/propostas/PropostasList";
import {
  PRIORIDADE_CONFIG,
  TIPO_CONFIG,
} from "@/components/tarefas/tarefa-config";
import {
  TarefaModal,
  type TarefaModalData,
} from "@/components/tarefas/TarefaModal";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { temProximaAcao } from "@/lib/utils";
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

type TipoContato = "TELEFONE" | "WHATSAPP" | "EMAIL" | "REUNIAO" | "VISITA" | "OUTRO";

type HistoricoContato = {
  id: string;
  tipo: TipoContato;
  resumo: string;
  detalhes: string | null;
  dataContato: string;
  proximoContato: string | null;
  usuario: { nome: string } | null;
};

type TarefaOportunidade = TarefaModalData & {
  status: "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA" | "ATRASADA";
  responsavel: { nome: string } | null;
};

const TIPO_CONTATO_LABELS: Record<TipoContato, string> = {
  TELEFONE: "📞 Telefone",
  WHATSAPP: "💬 WhatsApp",
  EMAIL: "✉️ E-mail",
  REUNIAO: "🤝 Reunião",
  VISITA: "🏗️ Visita",
  OUTRO: "📝 Outro",
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
  const [propostaModalOpen, setPropostaModalOpen] = useState(false);
  const [propostasRefresh, setPropostasRefresh] = useState(0);
  const [tarefas, setTarefas] = useState<TarefaOportunidade[]>([]);
  const [tarefaModalOpen, setTarefaModalOpen] = useState(false);
  const [tarefaEditando, setTarefaEditando] =
    useState<TarefaOportunidade | null>(null);

  // Histórico de contatos
  const [historicos, setHistoricos] = useState<HistoricoContato[]>([]);
  const [historicoFormAberto, setHistoricoFormAberto] = useState(false);
  const [historicoTipo, setHistoricoTipo] = useState<TipoContato>("TELEFONE");
  const [historicoResumo, setHistoricoResumo] = useState("");
  const [historicoDetalhes, setHistoricoDetalhes] = useState("");
  const [historicoProximoContato, setHistoricoProximoContato] = useState("");
  const [isSavingHistorico, setIsSavingHistorico] = useState(false);

  useEffect(() => {
    async function loadOportunidade() {
      setIsLoading(true);
      try {
        const [opResponse, histResponse, tarefasResponse] = await Promise.all([
          fetch(`/api/oportunidades/${id}`),
          fetch(`/api/oportunidades/${id}/historicos`),
          fetch(`/api/oportunidades/${id}/tarefas`),
        ]);

        if (!opResponse.ok) throw new Error("Falha ao carregar oportunidade.");

        setOportunidade(await opResponse.json());
        if (histResponse.ok) setHistoricos(await histResponse.json());
        if (tarefasResponse.ok) setTarefas(await tarefasResponse.json());
      } catch {
        toast.error("Nao foi possivel carregar a oportunidade.");
      } finally {
        setIsLoading(false);
      }
    }

    loadOportunidade();
  }, [id]);

  async function handleSalvarHistorico() {
    if (!historicoResumo.trim()) {
      toast.error("Informe um resumo do contato.");
      return;
    }
    setIsSavingHistorico(true);
    try {
      const response = await fetch(`/api/oportunidades/${id}/historicos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: historicoTipo,
          resumo: historicoResumo,
          detalhes: historicoDetalhes || null,
          proximoContato: historicoProximoContato
            ? new Date(historicoProximoContato).toISOString()
            : null,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Erro ao salvar.");
      }
      const novo = await response.json();
      setHistoricos((current) => [novo, ...current]);
      setHistoricoResumo("");
      setHistoricoDetalhes("");
      setHistoricoProximoContato("");
      setHistoricoTipo("TELEFONE");
      setHistoricoFormAberto(false);
      toast.success("Contato registrado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar contato.");
    } finally {
      setIsSavingHistorico(false);
    }
  }

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

  async function handleConcluirTarefa(tarefaId: string) {
    try {
      const response = await fetch(`/api/tarefas/${tarefaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CONCLUIDA" }),
      });

      if (!response.ok) {
        throw new Error("Falha ao concluir tarefa.");
      }

      const tarefa = await response.json();
      setTarefas((current) =>
        current.map((item) => (item.id === tarefaId ? tarefa : item)),
      );
      toast.success("Tarefa concluida.");
    } catch {
      toast.error("Nao foi possivel concluir a tarefa.");
    }
  }

  async function reloadTarefas() {
    const response = await fetch(`/api/oportunidades/${id}/tarefas`);

    if (response.ok) {
      setTarefas(await response.json());
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
                <Button
                  type="button"
                  onClick={() => setPropostaModalOpen(true)}
                  className="mt-4 w-full rounded-2xl bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]"
                >
                  <FileText className="size-4" />
                  Gerar proposta
                </Button>
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

              <Separator />

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-[#E8EEFB] p-2 text-[#1E4FAB]">
                      <FileText className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#1A2E5A]">
                        Propostas comerciais
                      </h3>
                      <p className="mt-1 text-sm text-[#667085]">
                        Versoes geradas para esta oportunidade.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setPropostaModalOpen(true)}
                    variant="outline"
                    className="rounded-2xl border-[#1E4FAB] text-[#1E4FAB] hover:bg-[#E8EEFB]"
                  >
                    <Plus className="size-4" />
                    Nova
                  </Button>
                </div>
                <PropostasList
                  oportunidadeId={id}
                  refreshKey={propostasRefresh}
                  onChanged={() => {
                    setOportunidade((current) =>
                      current
                        ? { ...current, status: "PROPOSTA_ENVIADA" }
                        : current,
                    );
                    setPropostasRefresh((current) => current + 1);
                  }}
                />
              </section>

              <Separator />

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-[#E8EEFB] p-2 text-[#1E4FAB]">
                      <CalendarCheck className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#1A2E5A]">
                        Proximas acoes
                      </h3>
                      <p className="mt-1 text-sm text-[#667085]">
                        Tarefas pendentes vinculadas a esta oportunidade.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setTarefaEditando(null);
                      setTarefaModalOpen(true);
                    }}
                    className="rounded-2xl border-[#1E4FAB] text-[#1E4FAB] hover:bg-[#E8EEFB]"
                  >
                    <Plus className="size-4" />
                    Nova
                  </Button>
                </div>

                {!temProximaAcao(tarefas) ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    Esta oportunidade nao tem proxima acao definida.
                  </div>
                ) : null}

                <div className="space-y-2">
                  {tarefas.length === 0 ? (
                    <p className="text-sm text-[#667085]">
                      Nenhuma tarefa registrada ainda.
                    </p>
                  ) : (
                    tarefas.slice(0, 5).map((tarefa) => {
                      const tipo = TIPO_CONFIG[tarefa.tipo];
                      const prioridade = PRIORIDADE_CONFIG[tarefa.prioridade];

                      return (
                        <div
                          key={tarefa.id}
                          className="rounded-2xl border border-[#D7DEEA] bg-white p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span>{tipo.emoji}</span>
                                <Badge className={prioridade.badgeClassName}>
                                  {prioridade.label}
                                </Badge>
                                <span className="text-sm font-semibold text-[#1A2E5A]">
                                  {tarefa.titulo}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-[#667085]">
                                {tarefa.responsavel?.nome ?? "Sem responsavel"} ·{" "}
                                {format(
                                  new Date(tarefa.dataVencimento),
                                  "dd/MM/yyyy",
                                  { locale: ptBR },
                                )}
                                {tarefa.horaVencimento
                                  ? ` as ${tarefa.horaVencimento}`
                                  : ""}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              {tarefa.status !== "CONCLUIDA" ? (
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="ghost"
                                  onClick={() => handleConcluirTarefa(tarefa.id)}
                                  className="rounded-full text-emerald-700"
                                  aria-label="Concluir tarefa"
                                >
                                  <Check className="size-4" />
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => {
                                  setTarefaEditando(tarefa);
                                  setTarefaModalOpen(true);
                                }}
                                className="rounded-full text-[#1E4FAB]"
                                aria-label="Editar tarefa"
                              >
                                <Pencil className="size-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <Separator />

              {/* HISTÓRICO DE CONTATOS */}
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-[#E8EEFB] p-2 text-[#1E4FAB]">
                      <Phone className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#1A2E5A]">Histórico de contatos</h3>
                      <p className="mt-1 text-sm text-[#667085]">
                        Ligações, visitas, WhatsApp e reuniões.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setHistoricoFormAberto((v) => !v)}
                    className="rounded-2xl border-[#1E4FAB] text-[#1E4FAB] hover:bg-[#E8EEFB]"
                  >
                    <Plus className="size-4" />
                    Registrar
                  </Button>
                </div>

                {historicoFormAberto ? (
                  <div className="rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] p-4 space-y-3">
                    <div>
                      <Label className="text-xs text-[#1A2E5A]">Tipo</Label>
                      <Select
                        value={historicoTipo}
                        onValueChange={(v) => setHistoricoTipo(v as TipoContato)}
                        items={Object.entries(TIPO_CONTATO_LABELS).map(([value, label]) => ({ value, label }))}
                      >
                        <SelectTrigger className="mt-1 h-9 rounded-xl bg-white text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.entries(TIPO_CONTATO_LABELS) as [TipoContato, string][]).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-[#1A2E5A]">Resumo *</Label>
                      <Input
                        value={historicoResumo}
                        onChange={(e) => setHistoricoResumo(e.target.value)}
                        placeholder="Ex: Cliente confirmou interesse, aguarda aprovação interna"
                        className="mt-1 h-9 rounded-xl bg-white text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-[#1A2E5A]">Detalhes (opcional)</Label>
                      <Textarea
                        value={historicoDetalhes}
                        onChange={(e) => setHistoricoDetalhes(e.target.value)}
                        placeholder="Anotações adicionais..."
                        className="mt-1 min-h-16 rounded-xl bg-white text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-[#1A2E5A]">Próximo contato (opcional)</Label>
                      <Input
                        type="datetime-local"
                        value={historicoProximoContato}
                        onChange={(e) => setHistoricoProximoContato(e.target.value)}
                        className="mt-1 h-9 rounded-xl bg-white text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={isSavingHistorico}
                        onClick={handleSalvarHistorico}
                        className="rounded-xl bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]"
                      >
                        {isSavingHistorico ? <Loader2 className="size-4 animate-spin" /> : "Salvar"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setHistoricoFormAberto(false)}
                        className="rounded-xl"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : null}

                {historicos.length === 0 ? (
                  <p className="text-sm text-[#667085]">Nenhum contato registrado ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {historicos.map((h) => (
                      <div key={h.id} className="rounded-2xl border border-[#D7DEEA] bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#1E4FAB]">
                            {TIPO_CONTATO_LABELS[h.tipo]}
                          </span>
                          <span className="text-xs text-[#667085]">
                            {format(new Date(h.dataContato), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-[#1A2E5A]">{h.resumo}</p>
                        {h.detalhes ? (
                          <p className="mt-1 text-xs text-[#667085]">{h.detalhes}</p>
                        ) : null}
                        {h.proximoContato ? (
                          <p className="mt-1 text-xs text-amber-600">
                            📅 Próximo: {format(new Date(h.proximoContato), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </p>
                        ) : null}
                        {h.usuario ? (
                          <p className="mt-1 text-xs text-[#667085]">por {h.usuario.nome}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </section>

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

      {propostaModalOpen ? (
        <PropostaModal
          aberto={propostaModalOpen}
          oportunidadeId={id}
          onFechar={() => setPropostaModalOpen(false)}
          onSalvar={() => setPropostasRefresh((current) => current + 1)}
        />
      ) : null}

      <TarefaModal
        aberto={tarefaModalOpen}
        tarefa={tarefaEditando}
        oportunidadeId={id}
        onFechar={() => {
          setTarefaModalOpen(false);
          setTarefaEditando(null);
        }}
        onSalvar={reloadTarefas}
      />

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
