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

type OportunidadeProposta = {
  id: string;
  titulo: string;
  valor: string | number | null;
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
};

type PropostaModalProps = {
  aberto: boolean;
  oportunidadeId: string;
  onFechar: () => void;
  onSalvar: () => void;
};

const templateItems = PROPOSTA_TEMPLATES.map((template) => ({
  label: template.nome,
  value: template.id,
}));

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

export function PropostaModal({
  aberto,
  oportunidadeId,
  onFechar,
  onSalvar,
}: PropostaModalProps) {
  const [oportunidade, setOportunidade] = useState<OportunidadeProposta | null>(
    null,
  );
  const [templateUtilizado, setTemplateUtilizado] = useState(
    PROPOSTA_TEMPLATES[0].id,
  );
  const [quantidade, setQuantidade] = useState("1");
  const [descricaoComercial, setDescricaoComercial] = useState(
    "Caminhão Betoneira - 8m3",
  );
  const [horasGarantidas, setHorasGarantidas] = useState("180h");
  const [precoUnitario, setPrecoUnitario] = useState("");
  const [horaExtra, setHoraExtra] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [validadeProposta, setValidadeProposta] = useState(
    format(addDays(new Date(), 15), "yyyy-MM-dd"),
  );
  const [prazoExecucao, setPrazoExecucao] = useState("A combinar");
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
        const response = await fetch(`/api/oportunidades/${oportunidadeId}`);

        if (!response.ok) {
          throw new Error("Falha ao carregar oportunidade.");
        }

        const data = await response.json();
        const initialTemplate = getPropostaTemplate(PROPOSTA_TEMPLATES[0].id);
        setTemplateUtilizado(PROPOSTA_TEMPLATES[0].id);
        setOportunidade(data);
        setPrecoUnitario(data.valor ? String(data.valor) : "");
        setTelefone(data.empresa?.telefone ?? "");
        setEmail(data.empresa?.email ?? "");
        setCondicoesPagamento(initialTemplate?.condicoesPagamentoPadrao ?? "");
        setObservacoesTecnicas(initialTemplate?.observacoesTecnicasPadrao ?? "");
      } catch {
        toast.error("Nao foi possivel carregar dados da oportunidade.");
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
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl p-6 sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#1A2E5A]">
            Gerar proposta comercial
          </DialogTitle>
          <DialogDescription>
            Selecione o modelo Villa, revise os dados herdados e salve o
            rascunho da proposta.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-[#667085]">
            <Loader2 className="mr-2 size-5 animate-spin" />
            Carregando proposta...
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <div className="space-y-4">
              <Field label="Template">
                <Select
                  items={templateItems}
                  value={templateUtilizado}
                  onValueChange={(value) => {
                    const nextTemplateId = value ?? PROPOSTA_TEMPLATES[0].id;
                    const nextTemplate = getPropostaTemplate(nextTemplateId);

                    setTemplateUtilizado(nextTemplateId);
                    setCondicoesPagamento(
                      nextTemplate?.condicoesPagamentoPadrao ?? "",
                    );
                    setObservacoesTecnicas(
                      nextTemplate?.observacoesTecnicasPadrao ?? "",
                    );
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

            <div className="min-w-0">
              <PropostaPreview html={previewHtml} />
            </div>
          </div>
        )}

        <DialogFooter>
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
    <div>
      <Label className="text-[#1A2E5A]">{label}</Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-[#667085]">{label}</dt>
      <dd className="font-semibold text-[#1A2E5A]">{value}</dd>
    </div>
  );
}
