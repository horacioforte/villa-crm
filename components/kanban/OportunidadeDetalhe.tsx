"use client";

import { useEffect, useState } from "react";
import { ConversasTab } from "@/components/conversas/ConversasTab";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Building2,
  Calendar,
  CalendarCheck,
  Check,
  Clock,
  FileText,
  Hammer,
  Loader2,
  MessageSquare,
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
import { ConcluirTarefaDialog } from "@/components/tarefas/ConcluirTarefaDialog";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { temProximaAcao } from "@/lib/utils";
import {
  statusOportunidadeValues,
  tipoServicoValues,
} from "@/lib/validations/oportunidade";

type StatusOportunidade = (typeof statusOportunidadeValues)[number];
type TipoServico = (typeof tipoServicoValues)[number];

type OportunidadeDetalheData = {
  id: string;
  titulo: string;
  descricao: string | null;
  motivoPerda: string | null;
  tipo: "LOCACAO" | "EQUIPAMENTO_USADO";
  tipoServico: TipoServico | null;
  status: StatusOportunidade;
  potencialOportunidade: string | number | null;
  valorContrato: string | number | null;
  createdAt: string;
  empresaId: string;
  pessoaId: string | null;
  obraId: string | null;
  propostas?: Array<{
    valorTotal: string | number;
    status: string;
  }>;
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

const tipoServicoLabels: Record<TipoServico, string> = {
  BOMBA_LANCA: "Bomba Lanca",
  BOMBA_ESTACIONARIA: "Bomba Estacionaria",
  TELEBELT: "Telebelt",
  BETONEIRA: "Caminhao Betoneira",
  CENTRAL_IN_LOCO: "Central In Loco",
  CONCRETO: "Concreto",
  SERVICO_ESPECIAL: "Servico Especial",
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
  PRE_QUALIFICADA: { label: "Pré-qualificada", className: "bg-purple-100 text-purple-700" },
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

function getValorProposta(oportunidade: OportunidadeDetalheData) {
  return oportunidade.propostas?.[0]?.valorTotal ?? null;
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
  const [totalProposto, setTotalProposto] = useState<number | null>(null);
  const [tarefas, setTarefas] = useState<TarefaOportunidade[]>([]);
  const [tarefaModalOpen, setTarefaModalOpen] = useState(false);
  const [tarefaEditando, setTarefaEditando] =
    useState<TarefaOportunidade | null>(null);
  const [tarefaConcluindo, setTarefaConcluindo] =
    useState<TarefaOportunidade | null>(null);
  const [concluirDialogOpen, setConcluirDialogOpen] = useState(false);

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

  async function reloadTarefas() {
    const response = await fetch(`/api/oportunidades/${id}/tarefas`);

    if (response.ok) {
      setTarefas(await response.json());
    }
  }

  async function reloadHistoricos() {
    const response = await fetch(`/api/oportunidades/${id}/historicos`);

    if (response.ok) {
      setHistoricos(await response.json());
    }
  }

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) {
            onFechar();
          }
        }}
      >
        <DialogContent className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-[#D7DEEA] px-6 py-5">
            <DialogTitle className="text-2xl font-bold text-[#1A2E5A]">
              Detalhe da oportunidade
            </DialogTitle>
            <DialogDescription>
              Informacoes comerciais e relacionamentos vinculados.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex flex-1 items-center justify-center p-12 text-[#667085]">
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

              <div className="space-y-3">
                <Card className="rounded-3xl border-[#D7DEEA] bg-white">
                  <CardContent className="space-y-3 p-4">
                    <ValueRow
                      label="Potencial"
                      description="Estimativa inicial"
                      value={formatCurrency(oportunidade.potencialOportunidade)}
                      className="bg-[#E8EEFB] text-[#1E4FAB]"
                    />
                    <ValueRow
                      label="Proposta"
                      description="Soma das versões ativas"
                      value={formatCurrency(
                        totalProposto ?? getValorProposta(oportunidade),
                      )}
                      className="bg-amber-100 text-amber-800"
                    />
                    <ValueRow
                      label="Contrato"
                      description="Valor confirmado ao fechar"
                      value={formatCurrency(oportunidade.valorContrato)}
                      className="bg-emerald-100 text-emerald-800"
                    />
                  </CardContent>
                </Card>
                <Card className="rounded-3xl border-[#D7DEEA] bg-white text-[#1A2E5A]">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-[#667085]">
                      Tipo
                    </p>
                    <p className="mt-2 text-lg font-bold">
                      {oportunidade.tipo === "LOCACAO"
                        ? `Locacao${oportunidade.tipoServico ? ` - ${tipoServicoLabels[oportunidade.tipoServico]}` : ""}`
                        : "Equipamento usado"}
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
                  onTotalPropostoChange={setTotalProposto}
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
                      const tipo = TIPO_CONFIG[tarefa.tipo] ?? {
                        emoji: "•",
                        label: "Tarefa",
                      };
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
                                  onClick={() => {
                                    setTarefaConcluindo(tarefa);
                                    setConcluirDialogOpen(true);
                                  }}
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

              <Separator />

              {/* LINHA DO TEMPO COMPLETA */}
              <section className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-[#E8EEFB] p-2 text-[#1E4FAB]">
                    <Clock className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#1A2E5A]">Linha do tempo</h3>
                    <p className="mt-1 text-sm text-[#667085]">
                      Tudo que aconteceu nesta oportunidade, em ordem cronológica.
                    </p>
                  </div>
                </div>

                {(() => {
                  type TLItem =
                    | { kind: "tarefa"; date: Date; id: string; titulo: string; tipo: string; status: string; resultado: string | null; responsavel: string | null }
                    | { kind: "contato"; date: Date; id: string; tipo: TipoContato; resumo: string; detalhes: string | null; usuario: string | null };

                  const tarefaItems: TLItem[] = tarefas.map((t) => ({
                    kind: "tarefa" as const,
                    date: new Date(t.dataVencimento),
                    id: t.id,
                    titulo: t.titulo,
                    tipo: t.tipo,
                    status: t.status,
                    resultado: t.resultado ?? null,
                    responsavel: t.responsavel?.nome ?? null,
                  }));

                  const contatoItems: TLItem[] = historicos.map((h) => ({
                    kind: "contato" as const,
                    date: new Date(h.dataContato),
                    id: h.id,
                    tipo: h.tipo,
                    resumo: h.resumo,
                    detalhes: h.detalhes,
                    usuario: h.usuario?.nome ?? null,
                  }));

                  const all = [...tarefaItems, ...contatoItems].sort(
                    (a, b) => b.date.getTime() - a.date.getTime(),
                  );

                  if (all.length === 0) {
                    return <p className="text-sm text-[#667085]">Nenhum evento registrado ainda.</p>;
                  }

                  return (
                    <div className="relative space-y-0 pl-4">
                      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#D7DEEA]" />
                      {all.map((item) => {
                        const dotColor =
                          item.kind === "contato"
                            ? "bg-purple-400"
                            : item.status === "CONCLUIDA"
                              ? "bg-emerald-500"
                              : item.status === "ATRASADA"
                                ? "bg-red-500"
                                : "bg-blue-400";

                        return (
                          <div key={`${item.kind}-${item.id}`} className="relative flex gap-3 pb-3">
                            <div className={`absolute -left-[9px] top-2 size-3 rounded-full border-2 border-white ${dotColor} flex-shrink-0`} />
                            <div className="flex-1 rounded-2xl border border-[#D7DEEA] bg-white p-3">
                              {item.kind === "tarefa" ? (
                                <>
                                  <div className="flex flex-wrap items-center justify-between gap-1">
                                    <span className="text-xs font-semibold text-[#1E4FAB]">
                                      {(TIPO_CONFIG as Record<string, { emoji: string; label: string } | undefined>)[item.tipo]?.emoji}{" "}
                                      {(TIPO_CONFIG as Record<string, { emoji: string; label: string } | undefined>)[item.tipo]?.label ?? item.tipo}
                                    </span>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                      item.status === "CONCLUIDA" ? "bg-emerald-100 text-emerald-700"
                                      : item.status === "ATRASADA" ? "bg-red-100 text-red-700"
                                      : "bg-blue-100 text-blue-700"
                                    }`}>
                                      {item.status === "CONCLUIDA" ? "✅ Concluída" : item.status === "ATRASADA" ? "⚠️ Atrasada" : "⏳ Pendente"}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-sm font-medium text-[#1A2E5A]">{item.titulo}</p>
                                  {item.resultado ? (
                                    <p className="mt-1 text-xs text-[#667085]">Resultado: {item.resultado}</p>
                                  ) : null}
                                  <p className="mt-1 text-xs text-[#667085]">
                                    {item.responsavel ?? "Sem responsável"} · {format(item.date, "dd/MM/yyyy", { locale: ptBR })}
                                  </p>
                                </>
                              ) : (
                                <>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-purple-600">
                                      {TIPO_CONTATO_LABELS[item.tipo]}
                                    </span>
                                    <span className="text-xs text-[#667085]">
                                      {format(item.date, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-sm font-medium text-[#1A2E5A]">{item.resumo}</p>
                                  {item.detalhes ? (
                                    <p className="mt-1 text-xs text-[#667085]">{item.detalhes}</p>
                                  ) : null}
                                  {item.usuario ? (
                                    <p className="mt-1 text-xs text-[#667085]">por {item.usuario}</p>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
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

              <Separator />
              <section className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-[#E8EEFB] p-2 text-[#1E4FAB]">
                    <MessageSquare className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#1A2E5A]">Conversas WhatsApp</h3>
                    <p className="mt-1 text-sm text-[#667085]">
                      Histórico de mensagens vinculadas a esta oportunidade.
                    </p>
                  </div>
                </div>
                <ConversasTab oportunidadeId={id} />
              </section>

              {/* ── Inteligência da IA (João Hunter) ─────────────────────── */}
              <IntelligenceSection oportunidadeId={id} />

            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-[#667085]">
              Oportunidade nao encontrada.
            </div>
          )}

          <div className="flex shrink-0 justify-end gap-3 border-t border-[#D7DEEA] px-6 py-4">
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
          </div>
        </DialogContent>
      </Dialog>

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
        contexto={{
          oportunidadeId: oportunidade?.id ?? id,
          oportunidadeNome: oportunidade?.titulo ?? null,
          empresaId: oportunidade?.empresaId ?? null,
          empresaNome: oportunidade
            ? (oportunidade.empresa.nomeFantasia ?? oportunidade.empresa.razaoSocial)
            : null,
          pessoaId: oportunidade?.pessoaId ?? null,
          pessoaNome: oportunidade?.pessoa?.nome ?? null,
          obraId: oportunidade?.obraId ?? null,
          obraNome: oportunidade?.obra?.nome ?? null,
        }}
        onFechar={() => {
          setTarefaModalOpen(false);
          setTarefaEditando(null);
        }}
        onSalvar={reloadTarefas}
      />

      <ConcluirTarefaDialog
        aberto={concluirDialogOpen}
        tarefa={tarefaConcluindo}
        onFechar={() => setConcluirDialogOpen(false)}
        onConcluido={() => {
          reloadTarefas();
          reloadHistoricos();
        }}
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

function ValueRow({
  label,
  description,
  value,
  className,
}: {
  label: string;
  description: string;
  value: string;
  className: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#F4F6FA] p-3">
      <div className="min-w-0">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${className}`}
        >
          {label}
        </span>
        <p className="mt-1 text-xs text-[#667085]">{description}</p>
      </div>
      <p className="shrink-0 text-right text-base font-bold text-[#1A2E5A]">
        {value}
      </p>
    </div>
  );
}

// ─── Seção Inteligência da IA ─────────────────────────────────────────────────
// REGRA: nunca remover. Apenas acrescentar.
// Mostra o dossiê vinculado e as atualizações do João após a oportunidade ser assumida.

type DossieResumo = {
  id: string;
  titulo: string;
  completude: number;
  score: number;
  missaoAtual?: string | null;
  totalAtualizacoes: number;
};

type AtualizacaoIA = {
  id: string;
  tipo: string;
  titulo: string;
  conteudo: string;
  agente?: string | null;
  fonte?: string | null;
  link?: string | null;
  createdAt: string;
};

function IntelligenceSection({ oportunidadeId }: { oportunidadeId: string }) {
  const [dossie, setDossie] = useState<DossieResumo | null>(null);
  const [atualizacoes, setAtualizacoes] = useState<AtualizacaoIA[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        // Busca dossiê vinculado à oportunidade
        const res = await fetch(`/api/inteligencia?limit=1&status=ASSUMIDO`);
        const data = await res.json();
        // Filtra pelo oportunidadeId (API retorna todos assumidos; filtra no cliente)
        const d = (data.dossies ?? []).find(
          (item: { oportunidadeId?: string }) => item.oportunidadeId === oportunidadeId
        ) as DossieResumo | undefined;
        if (d) {
          setDossie(d);
          // Busca as atualizações de monitoramento desta oportunidade
          const resAtual = await fetch(`/api/inteligencia/${d.id}/timeline?limit=20`);
          const dataAtual = await resAtual.json();
          // Filtra apenas atualizações de monitoramento ou relevantes
          const lista: AtualizacaoIA[] = (dataAtual.atualizacoes ?? []).filter(
            (a: { tipo: string }) =>
              ["MONITORAMENTO", "NOTICIA_ENCONTRADA", "DECISOR_ENCONTRADO", "EMPRESA_ENCONTRADA", "ASSUMIDO_PELO_COMERCIAL"].includes(a.tipo)
          );
          setAtualizacoes(lista);
        }
      } catch {
        // silencioso — pode não ter dossiê vinculado
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [oportunidadeId]);

  // Sem dossiê vinculado → não renderiza a seção
  if (!carregando && !dossie) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-[#E8EEFB] p-2 text-[#1E4FAB]">
          <span className="text-sm">🧠</span>
        </div>
        <div>
          <h3 className="font-bold text-[#1A2E5A]">Inteligência da IA</h3>
          <p className="mt-0.5 text-sm text-[#667085]">
            Dossiê João Hunter IA — monitoramento contínuo.
          </p>
        </div>
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-[#667085] py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : dossie ? (
        <>
          {/* Resumo do dossiê */}
          <div className="rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#1A2E5A]">{dossie.titulo}</p>
              <a
                href={`/inteligencia/${dossie.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#1E4FAB] hover:underline"
              >
                Ver dossiê →
              </a>
            </div>
            <div className="flex items-center gap-4 text-xs text-[#667085]">
              <span>Completude: <strong className="text-[#1A2E5A]">{dossie.completude}%</strong></span>
              <span>Score: <strong className="text-[#1A2E5A]">{dossie.score}/100</strong></span>
              <span>Atualizações: <strong className="text-[#1A2E5A]">{dossie.totalAtualizacoes}</strong></span>
            </div>
            {/* barra de completude */}
            <div className="h-1.5 bg-white rounded-full overflow-hidden border border-[#D7DEEA]">
              <div
                className={`h-full rounded-full ${dossie.completude >= 80 ? "bg-emerald-500" : dossie.completude >= 60 ? "bg-amber-500" : "bg-blue-500"}`}
                style={{ width: `${dossie.completude}%` }}
              />
            </div>
            {dossie.missaoAtual && (
              <p className="text-xs text-[#667085]">
                🎯 <span className="text-[#1A2E5A]">{dossie.missaoAtual}</span>
              </p>
            )}
          </div>

          {/* Atualizações do João */}
          {atualizacoes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide">Atualizações recentes</p>
              {atualizacoes.map(a => (
                <div key={a.id} className="rounded-2xl border border-[#D7DEEA] bg-white p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      a.tipo === "MONITORAMENTO" ? "bg-blue-100 text-blue-700" :
                      a.tipo === "DECISOR_ENCONTRADO" ? "bg-purple-100 text-purple-700" :
                      a.tipo === "NOTICIA_ENCONTRADA" ? "bg-cyan-100 text-cyan-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {a.tipo === "MONITORAMENTO" ? "📡 Monitor" :
                       a.tipo === "DECISOR_ENCONTRADO" ? "👤 Decisor" :
                       a.tipo === "NOTICIA_ENCONTRADA" ? "📰 Notícia" :
                       a.tipo === "EMPRESA_ENCONTRADA" ? "🏢 Empresa" : a.tipo}
                    </span>
                    <span className="text-xs text-[#667085]">
                      {new Date(a.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-[#1A2E5A]">{a.titulo}</p>
                  <p className="text-xs text-[#667085] line-clamp-3">{a.conteudo}</p>
                  {a.link && (
                    <a href={a.link} target="_blank" rel="noopener noreferrer" className="text-xs text-[#1E4FAB] hover:underline">
                      Ver fonte →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
