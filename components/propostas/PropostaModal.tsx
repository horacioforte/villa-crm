"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PropostaPreview } from "@/components/propostas/PropostaPreview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { renderPropostaHtml } from "@/lib/propostas/render";
import {
  PROPOSTA_TEMPLATES,
  buildTemplateBlocosSnapshot,
  getPropostaTemplate,
} from "@/lib/propostas/templates";
import type { PropostaTemplate } from "@/lib/propostas/templates";

type OportunidadeProposta = {
  id: string;
  titulo: string;
  tipo: "LOCACAO" | "VENDA";
  valor: string | number | null;
  equipamentoId: string | null;
  empresa: {
    razaoSocial: string;
    nomeFantasia: string | null;
    telefone?: string | null;
    email?: string | null;
  };
  obra: {
    nome: string;
    cidade: string | null;
    estado: string | null;
  } | null;
  responsavel: {
    nome: string;
  } | null;
  equipamento: EquipamentoProposta | null;
};

type PropostaModalProps = {
  aberto: boolean;
  oportunidadeId: string;
  onFechar: () => void;
  onSalvar: () => void;
};

type EquipamentoProposta = {
  id: string;
  codigo: string;
  codigoInterno?: string;
  nome: string;
  tipo: "BOMBA_CONCRETO" | "BETONEIRA" | "OUTRO";
  status: "DISPONIVEL" | "LOCADO" | "MANUTENCAO" | "VENDIDO" | "INATIVO";
  valorLocacao: string | number | null;
  valorVenda: string | number | null;
};

const templateItems = PROPOSTA_TEMPLATES.map((template) => ({
  label: template.nome,
  value: template.id,
}));
const DEFAULT_TEMPLATE = PROPOSTA_TEMPLATES[0];
const MANUAL_EQUIPAMENTO_VALUE = "manual";

function getValidadePadrao(template: PropostaTemplate = DEFAULT_TEMPLATE) {
  return format(addDays(new Date(), template.defaults.validadeDias), "yyyy-MM-dd");
}

function parseCurrencyInput(value: string) {
  const sanitized = value.trim().replace(/[^\d,.-]/g, "");
  const lastComma = sanitized.lastIndexOf(",");
  const lastDot = sanitized.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";

    return Number(
      sanitized
        .replaceAll(thousandsSeparator, "")
        .replace(decimalSeparator, "."),
    );
  }

  return Number(sanitized.replace(",", "."));
}

function parseQuantidadeInput(value: string) {
  const parsed = Number(value.trim().replace(",", "."));

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function formatPreviewCurrency(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "R$ 0,00";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatCurrencyInput(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function getEquipamentoCodigo(equipamento: EquipamentoProposta) {
  return equipamento.codigoInterno ?? equipamento.codigo;
}

function getEquipamentoLabel(equipamento: EquipamentoProposta) {
  const codigo = getEquipamentoCodigo(equipamento);

  return codigo ? `${equipamento.nome} - ${codigo}` : equipamento.nome;
}

function getEquipamentoPreco(
  equipamento: EquipamentoProposta,
  tipoOportunidade: OportunidadeProposta["tipo"] | null | undefined,
) {
  const valorPreferencial =
    tipoOportunidade === "VENDA"
      ? equipamento.valorVenda
      : equipamento.valorLocacao;
  const parsed = parseCurrencyInput(String(valorPreferencial ?? ""));

  if (!Number.isNaN(parsed) && parsed > 0) {
    return parsed;
  }

  return null;
}

export function PropostaModal({
  aberto,
  oportunidadeId,
  onFechar,
  onSalvar,
}: PropostaModalProps) {
  const [oportunidade, setOportunidade] = useState<OportunidadeProposta | null>(
    null,
  );
  const [equipamentos, setEquipamentos] = useState<EquipamentoProposta[]>([]);
  const [equipamentoSelecionadoId, setEquipamentoSelecionadoId] = useState<string>(
    MANUAL_EQUIPAMENTO_VALUE,
  );
  const [templateUtilizado, setTemplateUtilizado] = useState<string>(
    DEFAULT_TEMPLATE.id,
  );
  const [quantidade, setQuantidade] = useState("1");
  const [descricaoComercial, setDescricaoComercial] = useState<string>(
    DEFAULT_TEMPLATE.defaults.descricaoComercial,
  );
  const [horasGarantidas, setHorasGarantidas] = useState<string>(
    DEFAULT_TEMPLATE.defaults.horasGarantidas,
  );
  const [precoUnitario, setPrecoUnitario] = useState("");
  const [horaExtra, setHoraExtra] = useState<string>(
    DEFAULT_TEMPLATE.defaults.horaExtra ?? "",
  );
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [validadeProposta, setValidadeProposta] = useState(
    getValidadePadrao(DEFAULT_TEMPLATE),
  );
  const [prazoExecucao, setPrazoExecucao] = useState<string>(
    DEFAULT_TEMPLATE.defaults.prazoExecucao,
  );
  const [condicoesPagamento, setCondicoesPagamento] = useState("");
  const [observacoesComerciais, setObservacoesComerciais] = useState("");
  const [observacoesTecnicas, setObservacoesTecnicas] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!aberto) {
      return;
    }

    async function loadOportunidade() {
      setIsLoading(true);

      try {
        const [oportunidadeResponse, equipamentosResponse] = await Promise.all([
          fetch(`/api/oportunidades/${oportunidadeId}`),
          fetch("/api/equipamentos"),
        ]);

        if (!oportunidadeResponse.ok || !equipamentosResponse.ok) {
          throw new Error("Falha ao carregar oportunidade.");
        }

        const [data, equipamentosData] = await Promise.all([
          oportunidadeResponse.json(),
          equipamentosResponse.json(),
        ]);
        const initialTemplate = DEFAULT_TEMPLATE;
        const equipamentosDisponiveis = Array.isArray(equipamentosData)
          ? equipamentosData
          : [];
        const equipamentosComVinculado =
          data.equipamento &&
          !equipamentosDisponiveis.some(
            (equipamento: EquipamentoProposta) =>
              equipamento.id === data.equipamento.id,
          )
            ? [data.equipamento, ...equipamentosDisponiveis]
            : equipamentosDisponiveis;
        const equipamentoInicial = data.equipamentoId
          ? equipamentosComVinculado.find(
              (equipamento: EquipamentoProposta) =>
                equipamento.id === data.equipamentoId,
            )
          : null;
        const precoEquipamentoInicial = equipamentoInicial
          ? getEquipamentoPreco(equipamentoInicial, data.tipo)
          : null;

        setTemplateUtilizado(initialTemplate.id);
        setOportunidade(data);
        setEquipamentos(equipamentosComVinculado);
        setEquipamentoSelecionadoId(
          equipamentoInicial?.id ?? MANUAL_EQUIPAMENTO_VALUE,
        );
        setDescricaoComercial(
          equipamentoInicial?.nome ?? initialTemplate.defaults.descricaoComercial,
        );
        setHorasGarantidas(initialTemplate.defaults.horasGarantidas);
        setHoraExtra(initialTemplate.defaults.horaExtra ?? "");
        setPrazoExecucao(initialTemplate.defaults.prazoExecucao);
        setValidadeProposta(getValidadePadrao(initialTemplate));
        setPrecoUnitario(
          precoEquipamentoInicial !== null
            ? formatCurrencyInput(precoEquipamentoInicial)
            : data.valor
              ? String(data.valor)
              : "",
        );
        setTelefone(data.empresa?.telefone ?? "");
        setEmail(data.empresa?.email ?? "");
        setCondicoesPagamento(initialTemplate.condicoesPagamentoPadrao);
        setObservacoesTecnicas(initialTemplate.observacoesTecnicasPadrao);
      } catch {
        toast.error("Nao foi possivel carregar dados da proposta.");
      } finally {
        setIsLoading(false);
      }
    }

    loadOportunidade();
  }, [aberto, oportunidadeId]);

  const quantidadeCalculada = useMemo(
    () => parseQuantidadeInput(quantidade),
    [quantidade],
  );
  const precoUnitarioCalculado = useMemo(() => {
    const parsed = parseCurrencyInput(precoUnitario);

    return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
  }, [precoUnitario]);
  const valorTotalCalculado = useMemo(() => {
    if (quantidadeCalculada === null || precoUnitarioCalculado === null) {
      return null;
    }

    return Math.round(quantidadeCalculada * precoUnitarioCalculado * 100) / 100;
  }, [precoUnitarioCalculado, quantidadeCalculada]);
  const equipamentoSelecionado = useMemo(
    () =>
      equipamentos.find(
        (equipamento) => equipamento.id === equipamentoSelecionadoId,
      ) ?? null,
    [equipamentoSelecionadoId, equipamentos],
  );

  function handleEquipamentoChange(value: string | null) {
    const nextValue = value ?? MANUAL_EQUIPAMENTO_VALUE;
    const equipamento = equipamentos.find((item) => item.id === nextValue);

    setEquipamentoSelecionadoId(nextValue);

    if (!equipamento) {
      return;
    }

    const precoEquipamento = getEquipamentoPreco(equipamento, oportunidade?.tipo);

    setDescricaoComercial(equipamento.nome);

    if (precoEquipamento !== null) {
      setPrecoUnitario(formatCurrencyInput(precoEquipamento));
    } else {
      setPrecoUnitario("");
    }
  }

  const previewHtml = useMemo(() => {
    if (!oportunidade) {
      return "";
    }

    const cliente =
      oportunidade.empresa.nomeFantasia ?? oportunidade.empresa.razaoSocial;
    const quantidadePreview =
      quantidadeCalculada === null ? quantidade : String(quantidadeCalculada);
    const blocos = buildTemplateBlocosSnapshot(templateUtilizado, {
      numero_proposta: "PREVIEW",
      cliente,
      obra: oportunidade.obra?.nome ?? "Obra nao informada",
      telefone,
      email,
      cidade: oportunidade.obra?.cidade ?? "",
      estado: oportunidade.obra?.estado ?? "",
      quantidade: quantidadePreview,
      descricao_comercial: descricaoComercial,
      horas_garantidas: horasGarantidas,
      preco_unitario: formatPreviewCurrency(precoUnitarioCalculado),
      valor: formatPreviewCurrency(valorTotalCalculado),
      hora_extra: horaExtra
        ? formatPreviewCurrency(parseCurrencyInput(horaExtra))
        : "",
      prazo: prazoExecucao,
      validade: validadeProposta,
      responsavel: oportunidade.responsavel?.nome ?? "Equipe Comercial Villa",
      data: new Date().toLocaleDateString("pt-BR"),
      observacoes_comerciais: observacoesComerciais,
    });

    return renderPropostaHtml({
      numeroProposta: "PREVIEW",
      versao: 1,
      templateUtilizado,
      cliente,
      obra: oportunidade.obra?.nome ?? "Obra nao informada",
      cidade: oportunidade.obra?.cidade,
      estado: oportunidade.obra?.estado,
      telefone,
      email,
      quantidade: quantidadePreview,
      descricaoComercial,
      horasGarantidas,
      precoUnitario: precoUnitarioCalculado ?? 0,
      horaExtra,
      valorTotal: valorTotalCalculado ?? 0,
      validadeProposta,
      prazoExecucao,
      responsavel: oportunidade.responsavel?.nome,
      observacoesComerciais,
      observacoesTecnicas,
      condicoesPagamento,
      blocos,
    });
  }, [
    condicoesPagamento,
    descricaoComercial,
    email,
    horaExtra,
    horasGarantidas,
    observacoesComerciais,
    observacoesTecnicas,
    oportunidade,
    precoUnitarioCalculado,
    prazoExecucao,
    quantidade,
    quantidadeCalculada,
    templateUtilizado,
    telefone,
    validadeProposta,
    valorTotalCalculado,
  ]);

  async function handleSalvar() {
    if (!oportunidade?.obra) {
      toast.error("A oportunidade precisa ter obra vinculada.");
      return;
    }

    if (quantidadeCalculada === null) {
      toast.error("Informe uma quantidade inteira positiva.");
      return;
    }

    if (precoUnitarioCalculado === null) {
      toast.error("Informe um valor unitario/mês positivo.");
      return;
    }

    if (valorTotalCalculado === null) {
      toast.error("Nao foi possivel calcular o valor total/mês.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/oportunidades/${oportunidadeId}/propostas`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            templateUtilizado,
            valorTotal: valorTotalCalculado,
            quantidade: quantidadeCalculada,
            descricaoComercial,
            horasGarantidas,
            precoUnitario: precoUnitarioCalculado,
            horaExtra: horaExtra || null,
            telefone,
            email,
            validadeProposta,
            prazoExecucao,
            condicoesPagamento,
            observacoesComerciais,
            observacoesTecnicas,
          }),
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Falha ao salvar proposta.");
      }

      toast.success("Rascunho de proposta salvo.");
      onSalvar();
      onFechar();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar a proposta.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(open) => {
        if (!open) {
          onFechar();
        }
      }}
    >
      <DialogContent className="flex h-[min(92vh,900px)] w-[min(96vw,1500px)] max-w-none flex-col overflow-hidden rounded-3xl p-0 sm:max-w-none">
        <DialogHeader className="shrink-0">
          <div className="px-5 pt-5 sm:px-6 sm:pt-6">
            <DialogTitle className="text-2xl font-bold text-[#1A2E5A]">
              Gerar proposta comercial
            </DialogTitle>
            <DialogDescription>
              Selecione o modelo Villa, revise os dados herdados e salve o
              rascunho da proposta.
            </DialogDescription>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-[#667085]">
            <Loader2 className="mr-2 size-5 animate-spin" />
            Carregando proposta...
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-y-auto xl:grid-cols-[460px_minmax(0,1fr)] xl:overflow-hidden">
            <div className="min-w-0 space-y-4 overflow-x-hidden border-b border-[#D7DEEA] px-5 py-4 sm:px-6 xl:overflow-y-auto xl:border-r xl:border-b-0">
              <Field label="Template">
                <Select
                  items={templateItems}
                  value={templateUtilizado}
                  onValueChange={(value) => {
                    const nextTemplateId = value ?? DEFAULT_TEMPLATE.id;
                    const nextTemplate =
                      getPropostaTemplate(nextTemplateId) ?? DEFAULT_TEMPLATE;

                    setTemplateUtilizado(nextTemplateId);
                    setDescricaoComercial(nextTemplate.defaults.descricaoComercial);
                    setHorasGarantidas(nextTemplate.defaults.horasGarantidas);
                    setHoraExtra(nextTemplate.defaults.horaExtra ?? "");
                    setPrazoExecucao(nextTemplate.defaults.prazoExecucao);
                    setValidadeProposta(getValidadePadrao(nextTemplate));
                    setCondicoesPagamento(nextTemplate.condicoesPagamentoPadrao);
                    setObservacoesTecnicas(nextTemplate.observacoesTecnicasPadrao);
                  }}
                >
                  <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPOSTA_TEMPLATES.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="rounded-3xl border border-[#D7DEEA] bg-[#F4F6FA] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
                  Dados herdados
                </p>
                <dl className="mt-3 space-y-2 text-sm">
                  <ReadOnly label="Cliente" value={oportunidade?.empresa.nomeFantasia ?? oportunidade?.empresa.razaoSocial ?? "Nao informado"} />
                  <ReadOnly label="Obra" value={oportunidade?.obra?.nome ?? "Nao vinculada"} />
                  <ReadOnly label="Local" value={`${oportunidade?.obra?.cidade ?? "Cidade nao informada"} / ${oportunidade?.obra?.estado ?? "UF"}`} />
                  <ReadOnly label="Responsavel" value={oportunidade?.responsavel?.nome ?? "Equipe Comercial Villa"} />
                </dl>
              </div>

              <Field label="Equipamento/serviço">
                <Select
                  value={equipamentoSelecionadoId}
                  onValueChange={handleEquipamentoChange}
                >
                  <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                    <SelectValue placeholder="Selecione o equipamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={MANUAL_EQUIPAMENTO_VALUE}>
                      Preencher manualmente
                    </SelectItem>
                    {equipamentos.map((equipamento) => (
                      <SelectItem key={equipamento.id} value={equipamento.id}>
                        {getEquipamentoLabel(equipamento)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {equipamentoSelecionado &&
                getEquipamentoPreco(equipamentoSelecionado, oportunidade?.tipo) ===
                  null ? (
                  <p className="mt-2 text-xs text-[#667085]">
                    Este equipamento nao tem valor cadastrado para esta operacao.
                    Informe o valor unitario manualmente.
                  </p>
                ) : null}
              </Field>
              <Field label="Quantidade">
                <Input
                  inputMode="numeric"
                  placeholder="Ex: 2"
                  value={quantidade}
                  onChange={(event) => setQuantidade(event.target.value)}
                  className="h-11 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>
              <Field label="Descricao comercial">
                <Input
                  value={descricaoComercial}
                  onChange={(event) =>
                    setDescricaoComercial(event.target.value)
                  }
                  className="h-11 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>
              <Field label="Horas garantidas">
                <Input
                  value={horasGarantidas}
                  onChange={(event) => setHorasGarantidas(event.target.value)}
                  className="h-11 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>
              <Field label="Valor unitario/mês">
                <Input
                  inputMode="decimal"
                  placeholder="Ex: 12500,00"
                  value={precoUnitario}
                  onChange={(event) => setPrecoUnitario(event.target.value)}
                  className="h-11 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>
              <Field label="Valor total/mês calculado">
                <Input
                  readOnly
                  value={formatCurrencyInput(valorTotalCalculado)}
                  className="h-11 rounded-2xl border-[#D7DEEA] bg-[#E9EEF7] font-semibold text-[#1A2E5A]"
                />
              </Field>
              <Field label="Hora extra (R$/h)">
                <Input
                  inputMode="decimal"
                  placeholder="Ex: 166.67"
                  value={horaExtra}
                  onChange={(event) => setHoraExtra(event.target.value)}
                  className="h-11 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>
              <Field label="Telefone">
                <Input
                  value={telefone}
                  onChange={(event) => setTelefone(event.target.value)}
                  className="h-11 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>
              <Field label="Validade da proposta">
                <Input
                  type="date"
                  value={validadeProposta}
                  onChange={(event) => setValidadeProposta(event.target.value)}
                  className="h-11 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>
              <Field label="Prazo de execucao">
                <Input
                  value={prazoExecucao}
                  onChange={(event) => setPrazoExecucao(event.target.value)}
                  className="h-11 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>
              <Field label="Condicoes de pagamento">
                <Textarea
                  value={condicoesPagamento}
                  onChange={(event) => setCondicoesPagamento(event.target.value)}
                  className="min-h-24 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>
              <Field label="Observacoes comerciais">
                <Textarea
                  value={observacoesComerciais}
                  onChange={(event) =>
                    setObservacoesComerciais(event.target.value)
                  }
                  className="min-h-24 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>
              <Field label="Observacoes tecnicas">
                <Textarea
                  value={observacoesTecnicas}
                  onChange={(event) => setObservacoesTecnicas(event.target.value)}
                  className="min-h-24 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>
            </div>

            <div className="min-w-0 overflow-x-hidden bg-[#F4F6FA] px-4 py-4 sm:px-6 xl:overflow-y-auto">
              <PropostaPreview html={previewHtml} />
            </div>
          </div>
        )}

        <DialogFooter className="m-0 mx-0 mb-0 shrink-0 rounded-none border-t border-[#D7DEEA] px-5 py-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={onFechar}
            className="h-11 rounded-2xl"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={isSubmitting || isLoading}
            onClick={handleSalvar}
            className="h-11 rounded-2xl bg-[#1E4FAB] px-6 text-white hover:bg-[#1A2E5A]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar rascunho"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <Label className="text-[#1A2E5A]">{label}</Label>
      <div className="mt-2 min-w-0">{children}</div>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-[#667085]">{label}</dt>
      <dd className="break-words font-semibold text-[#1A2E5A]">{value}</dd>
    </div>
  );
}
