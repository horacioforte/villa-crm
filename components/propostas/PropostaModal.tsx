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
  tipo: "LOCACAO" | "EQUIPAMENTO_USADO";
  potencialOportunidade: string | number | null;
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
  valorM3: number | null;
  volumeMinimoM3: number | null;
  valorVenda: string | number | null;
};

type PropostaItemForm = {
  id: string;
  equipamentoId: string;
  descricao: string;
  quantidade: string;
  precoM3: string;
  volumeMinimoM3: string;
  horasGarantidas: string;
  precoUnitario: string;
  horaExtra: string;
  modeloPorM3: boolean;
  ordem: number;
};

const templateItems = PROPOSTA_TEMPLATES.map((template) => ({
  label: template.nome,
  value: template.id,
}));
const DEFAULT_TEMPLATE = PROPOSTA_TEMPLATES[0];
const BOMBA_TEMPLATE_ID = "locacao-bomba-concreto-com-operacao";
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

function formatPreviewVolume(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "0";
  }

  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
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

function getTemplateForEquipamento(equipamento?: EquipamentoProposta | null) {
  if (equipamento?.tipo === "BOMBA_CONCRETO") {
    return getPropostaTemplate(BOMBA_TEMPLATE_ID) ?? DEFAULT_TEMPLATE;
  }

  return DEFAULT_TEMPLATE;
}

function getPluralVariables(quantidade: string) {
  const parsed = Number.parseInt(quantidade, 10);
  const quantidadeValida = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  const plural = quantidadeValida > 1;

  return {
    singular_plural: plural ? "CAMINHÕES BETONEIRAS" : "CAMINHÃO BETONEIRA",
    singular_plural_caps: plural ? "Caminhões Betoneiras" : "Caminhão Betoneira",
    singular_plural_operador: plural
      ? "caminhões betoneiras com operadores"
      : "caminhão betoneira com operador",
    equipamento_plural: plural ? "equipamentos" : "equipamento",
    nos_equipamentos: plural ? "nos equipamentos" : "no equipamento",
    dos_equipamentos: plural ? "dos equipamentos" : "do equipamento",
    aos_equipamentos: plural ? "aos equipamentos" : "ao equipamento",
    os_equipamentos: plural ? "os equipamentos" : "o equipamento",
    os_pronome: plural ? "os" : "o",
    numero_por_extenso: String(quantidadeValida),
  };
}

function createEmptyItem(ordem = 0): PropostaItemForm {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${ordem}`,
    equipamentoId: "",
    descricao: "",
    quantidade: "1",
    precoM3: "",
    volumeMinimoM3: "",
    horasGarantidas: "",
    precoUnitario: "",
    horaExtra: "",
    modeloPorM3: false,
    ordem,
  };
}

function getEquipamentoPreco(
  equipamento: EquipamentoProposta,
  tipoOportunidade: OportunidadeProposta["tipo"] | null | undefined,
) {
  const valorPreferencial =
    tipoOportunidade === "EQUIPAMENTO_USADO"
      ? equipamento.valorVenda
      : equipamento.valorLocacao;
  const parsed = parseCurrencyInput(String(valorPreferencial ?? ""));

  if (!Number.isNaN(parsed) && parsed > 0) {
    return parsed;
  }

  return null;
}

function createItemFromEquipamento(
  equipamento: EquipamentoProposta,
  tipoOportunidade: OportunidadeProposta["tipo"] | null | undefined,
  ordem = 0,
): PropostaItemForm {
  const precoEquipamento = getEquipamentoPreco(equipamento, tipoOportunidade);
  const modeloPorM3 =
    equipamento.tipo === "BOMBA_CONCRETO" || Boolean(equipamento.valorM3);

  return {
    ...createEmptyItem(ordem),
    equipamentoId: equipamento.id,
    descricao: equipamento.nome,
    precoM3:
      modeloPorM3 && equipamento.valorM3
        ? formatCurrencyInput(equipamento.valorM3)
        : "",
    volumeMinimoM3:
      modeloPorM3 && equipamento.volumeMinimoM3
        ? String(equipamento.volumeMinimoM3)
        : "",
    precoUnitario:
      !modeloPorM3 && precoEquipamento !== null
        ? formatCurrencyInput(precoEquipamento)
        : "",
    modeloPorM3,
    horasGarantidas: modeloPorM3 ? "" : DEFAULT_TEMPLATE.defaults.horasGarantidas,
    horaExtra: modeloPorM3 ? "" : (DEFAULT_TEMPLATE.defaults.horaExtra ?? ""),
  };
}

function buildM3BlocosSnapshot(
  templateUtilizado: string,
  variables: Parameters<typeof buildTemplateBlocosSnapshot>[1],
  itens: PropostaItemForm[] = [],
) {
  const horaExtraMatchers = [
    { keys: ["32"], pattern: /auto bomba lan[cç]a 32 metros/i },
    { keys: ["36"], pattern: /auto bomba lan[cç]a 36 metros/i },
    { keys: ["38"], pattern: /auto bomba lan[cç]a 38 metros/i },
    { keys: ["42", "43"], pattern: /auto bomba lan[cç]a 42\/43 metros/i },
    { keys: ["56", "58"], pattern: /auto bomba lan[cç]a 56\/58 metros/i },
  ];

  return buildTemplateBlocosSnapshot(templateUtilizado, variables)
    .filter((bloco) => bloco.chave !== "precos_referencia")
    .map((bloco) =>
      bloco.chave === "precos"
        ? {
            ...bloco,
            conteudoAtual: bloco.conteudoAtual
              .split("\n")
              .filter((line) => !line.startsWith("Hora Extra/h:"))
              .map((line) =>
                line
                  .replace("Horas Garantidas:", "Volume mínimo:")
                  .replace("Preço Unit./mês:", "Preço por m³:")
                  .replace("Preco Unit./mes:", "Preco por m3:")
                  .replace("Preço Total/mês:", "Valor total:")
                  .replace("Preco Total/mes:", "Valor total:"),
              )
              .join("\n"),
          }
        : bloco.chave === "trabalho_extra" && itens.length
          ? {
              ...bloco,
              conteudoAtual: bloco.conteudoAtual
                .split("\n")
                .filter((line) => {
                  const matcher = horaExtraMatchers.find((item) =>
                    item.pattern.test(line),
                  );

                  if (!matcher) {
                    return true;
                  }

                  return itens.some((item) =>
                    matcher.keys.some((key) =>
                      item.descricao.toLowerCase().includes(key),
                    ),
                  );
                })
                .join("\n"),
            }
        : bloco,
    );
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
  const [itens, setItens] = useState<PropostaItemForm[]>([createEmptyItem()]);
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
  const [precoM3, setPrecoM3] = useState("");
  const [volumeMinimoM3, setVolumeMinimoM3] = useState("");
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
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  useEffect(() => {
    if (!aberto) {
      return;
    }

    async function loadOportunidade() {
      setIsLoading(true);
      setIsPreviewVisible(false);

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
        const initialTemplate = getTemplateForEquipamento(equipamentoInicial);

        setTemplateUtilizado(initialTemplate.id);
        setOportunidade(data);
        setEquipamentos(equipamentosComVinculado);
        setEquipamentoSelecionadoId(
          equipamentoInicial?.id ?? MANUAL_EQUIPAMENTO_VALUE,
        );
        setItens(
          equipamentoInicial
            ? [createItemFromEquipamento(equipamentoInicial, data.tipo)]
            : [createEmptyItem()],
        );
        setDescricaoComercial(
          equipamentoInicial?.nome ?? initialTemplate.defaults.descricaoComercial,
        );
        setHorasGarantidas(initialTemplate.defaults.horasGarantidas);
        setHoraExtra(initialTemplate.defaults.horaExtra ?? "");
        setPrecoM3(
          equipamentoInicial?.valorM3
            ? formatCurrencyInput(equipamentoInicial.valorM3)
            : "",
        );
        setVolumeMinimoM3(
          equipamentoInicial?.volumeMinimoM3
            ? String(equipamentoInicial.volumeMinimoM3)
            : "",
        );
        setPrazoExecucao(initialTemplate.defaults.prazoExecucao);
        setValidadeProposta(getValidadePadrao(initialTemplate));
        setPrecoUnitario(
          precoEquipamentoInicial !== null
            ? formatCurrencyInput(precoEquipamentoInicial)
            : data.potencialOportunidade
              ? String(data.potencialOportunidade)
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
  const equipamentoSelecionadoLabel =
    equipamentoSelecionadoId === MANUAL_EQUIPAMENTO_VALUE
      ? "Preencher manualmente"
      : equipamentoSelecionado
        ? getEquipamentoLabel(equipamentoSelecionado)
        : "Selecione o equipamento";
  const getItemEquipamentoLabel = (item: PropostaItemForm) => {
    const equipamento = equipamentos.find(
      (current) => current.id === item.equipamentoId,
    );

    return equipamento
      ? getEquipamentoLabel(equipamento)
      : item.descricao || "Selecione o equipamento";
  };
  const modeloPorM3 =
    equipamentoSelecionado?.tipo === "BOMBA_CONCRETO" ||
    Boolean(equipamentoSelecionado?.valorM3);
  const precoM3Calculado = useMemo(() => {
    const parsed = parseCurrencyInput(precoM3);

    return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
  }, [precoM3]);
  const volumeMinimoM3Calculado = useMemo(() => {
    const parsed = parseCurrencyInput(volumeMinimoM3);

    return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
  }, [volumeMinimoM3]);
  const valorTotalM3Calculado = useMemo(() => {
    if (precoM3Calculado === null || volumeMinimoM3Calculado === null) {
      return null;
    }

    return Math.round(precoM3Calculado * volumeMinimoM3Calculado * 100) / 100;
  }, [precoM3Calculado, volumeMinimoM3Calculado]);
  const totalItensCalculado = useMemo(
    () =>
      Math.round(
        itens.reduce((sum, item) => sum + calcularTotalItem(item), 0) * 100,
      ) / 100,
    [itens],
  );
  const valorTotalProposta = modeloPorM3
    ? totalItensCalculado
    : valorTotalCalculado;

  function handleEquipamentoChange(value: string | null) {
    const nextValue = value ?? MANUAL_EQUIPAMENTO_VALUE;
    const equipamento = equipamentos.find((item) => item.id === nextValue);

    setEquipamentoSelecionadoId(nextValue);

    if (!equipamento) {
      return;
    }

    const precoEquipamento = getEquipamentoPreco(equipamento, oportunidade?.tipo);
    const nextTemplate = getTemplateForEquipamento(equipamento);

    setTemplateUtilizado(nextTemplate.id);
    setDescricaoComercial(equipamento.nome);
    setHorasGarantidas(nextTemplate.defaults.horasGarantidas);
    setHoraExtra(nextTemplate.defaults.horaExtra ?? "");
    setPrazoExecucao(nextTemplate.defaults.prazoExecucao);
    setValidadeProposta(getValidadePadrao(nextTemplate));
    setCondicoesPagamento(nextTemplate.condicoesPagamentoPadrao);
    setObservacoesTecnicas(nextTemplate.observacoesTecnicasPadrao);
    setItens((current) => [
      createItemFromEquipamento(equipamento, oportunidade?.tipo, 0),
      ...current.slice(1).map((item, index) => ({ ...item, ordem: index + 1 })),
    ]);

    if (precoEquipamento !== null) {
      setPrecoUnitario(formatCurrencyInput(precoEquipamento));
    } else {
      setPrecoUnitario("");
    }

    if (equipamento.valorM3) {
      setPrecoM3(formatCurrencyInput(equipamento.valorM3));
      setVolumeMinimoM3(
        equipamento.volumeMinimoM3 ? String(equipamento.volumeMinimoM3) : "",
      );
    } else {
      setPrecoM3("");
      setVolumeMinimoM3("");
    }
  }

  function atualizarItem(
    index: number,
    field: keyof PropostaItemForm,
    value: string | boolean | number,
  ) {
    setItens((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: String(value) } : item,
      ),
    );
  }

  function handleItemEquipamentoChange(index: number, equipamentoId: string | null) {
    const equipamento = equipamentos.find((item) => item.id === equipamentoId);

    if (!equipamento) {
      atualizarItem(index, "equipamentoId", "");
      return;
    }

    setItens((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? createItemFromEquipamento(equipamento, oportunidade?.tipo, index)
          : item,
      ),
    );
  }

  function adicionarItem() {
    setItens((current) => [...current, createEmptyItem(current.length)]);
  }

  function removerItem(index: number) {
    setItens((current) =>
      current
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item, itemIndex) => ({ ...item, ordem: itemIndex })),
    );
  }

  function calcularTotalItem(item: PropostaItemForm) {
    const quantidadeItem = parseQuantidadeInput(item.quantidade) ?? 1;
    const itemPrecoM3 = parseCurrencyInput(item.precoM3);
    const itemVolumeMinimoM3 = parseCurrencyInput(item.volumeMinimoM3);
    const itemPrecoUnitario = parseCurrencyInput(item.precoUnitario);

    if (
      item.modeloPorM3 &&
      !Number.isNaN(itemPrecoM3) &&
      !Number.isNaN(itemVolumeMinimoM3)
    ) {
      return quantidadeItem * itemPrecoM3 * itemVolumeMinimoM3;
    }

    if (!Number.isNaN(itemPrecoUnitario)) {
      return quantidadeItem * itemPrecoUnitario;
    }

    return 0;
  }

  const previewHtml = useMemo(() => {
    if (!oportunidade) {
      return "";
    }

    const cliente =
      oportunidade.empresa.nomeFantasia ?? oportunidade.empresa.razaoSocial;
    const primeiroItem = itens[0];
    const primeiroItemQuantidade = primeiroItem
      ? (parseQuantidadeInput(primeiroItem.quantidade) ?? 1)
      : null;
    const primeiroItemPrecoM3 = primeiroItem
      ? parseCurrencyInput(primeiroItem.precoM3)
      : Number.NaN;
    const primeiroItemVolumeMinimoM3 = primeiroItem
      ? parseCurrencyInput(primeiroItem.volumeMinimoM3)
      : Number.NaN;
    const quantidadePreview =
      modeloPorM3 && primeiroItemQuantidade !== null
        ? String(primeiroItemQuantidade)
        : quantidadeCalculada === null
          ? quantidade
          : String(quantidadeCalculada);
    const templateVariables = {
      numero_proposta: "PREVIEW",
      cliente,
      obra: oportunidade.obra?.nome ?? "Obra nao informada",
      telefone,
      email,
      cidade: oportunidade.obra?.cidade ?? "",
      estado: oportunidade.obra?.estado ?? "",
      quantidade: quantidadePreview,
      descricao_comercial:
        modeloPorM3 && primeiroItem?.descricao
          ? primeiroItem.descricao
          : descricaoComercial,
      horas_garantidas: modeloPorM3
        ? `${formatPreviewVolume(
            Number.isNaN(primeiroItemVolumeMinimoM3)
              ? volumeMinimoM3Calculado
              : primeiroItemVolumeMinimoM3,
          )} m³`
        : horasGarantidas,
      preco_unitario: modeloPorM3
        ? `${formatPreviewCurrency(
            Number.isNaN(primeiroItemPrecoM3)
              ? precoM3Calculado
              : primeiroItemPrecoM3,
          )}/m³`
        : formatPreviewCurrency(precoUnitarioCalculado),
      valor: formatPreviewCurrency(valorTotalProposta),
      hora_extra: modeloPorM3
        ? ""
        : horaExtra
          ? formatPreviewCurrency(parseCurrencyInput(horaExtra))
          : "",
      prazo: prazoExecucao,
      validade: validadeProposta,
      responsavel: oportunidade.responsavel?.nome ?? "Equipe Comercial Villa",
      data: new Date().toLocaleDateString("pt-BR"),
      observacoes_comerciais: observacoesComerciais,
      ...getPluralVariables(quantidadePreview),
    };
    const blocos = modeloPorM3
      ? buildM3BlocosSnapshot(templateUtilizado, templateVariables, itens)
      : buildTemplateBlocosSnapshot(templateUtilizado, templateVariables);
    const itensPreview = itens.map((item, index) => ({
      ordem: index,
      descricao: item.descricao || `Equipamento ${index + 1}`,
      quantidade: parseQuantidadeInput(item.quantidade) ?? 1,
      precoM3: item.modeloPorM3 ? parseCurrencyInput(item.precoM3) : null,
      volumeMinimoM3: item.modeloPorM3
        ? parseCurrencyInput(item.volumeMinimoM3)
        : null,
      horasGarantidas: item.horasGarantidas || null,
      precoUnitario: item.modeloPorM3 ? null : parseCurrencyInput(item.precoUnitario),
      horaExtra: item.horaExtra ? parseCurrencyInput(item.horaExtra) : null,
      valorTotal: calcularTotalItem(item),
    }));

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
      precoUnitario: modeloPorM3
        ? (precoM3Calculado ?? 0)
        : (precoUnitarioCalculado ?? 0),
      horaExtra: modeloPorM3 ? null : horaExtra,
      precoM3: modeloPorM3 ? precoM3Calculado : null,
      volumeMinimoM3: modeloPorM3 ? volumeMinimoM3Calculado : null,
      valorTotal: valorTotalProposta ?? 0,
      validadeProposta,
      prazoExecucao,
      responsavel: oportunidade.responsavel?.nome,
      observacoesComerciais,
      observacoesTecnicas,
      condicoesPagamento,
      blocos,
      itens: modeloPorM3 ? itensPreview : undefined,
    });
  }, [
    condicoesPagamento,
    descricaoComercial,
    email,
    horaExtra,
    horasGarantidas,
    itens,
    modeloPorM3,
    observacoesComerciais,
    observacoesTecnicas,
    precoM3Calculado,
    oportunidade,
    precoUnitarioCalculado,
    prazoExecucao,
    quantidade,
    quantidadeCalculada,
    templateUtilizado,
    telefone,
    validadeProposta,
    volumeMinimoM3Calculado,
    valorTotalCalculado,
    valorTotalM3Calculado,
    valorTotalProposta,
  ]);

  function parseOptionalPositive(value: string) {
    const parsed = parseCurrencyInput(value);

    return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
  }

  async function handleSalvar() {
    if (!oportunidade?.obra) {
      toast.error("A oportunidade precisa ter obra vinculada.");
      return;
    }

    if (quantidadeCalculada === null) {
      toast.error("Informe uma quantidade inteira positiva.");
      return;
    }

    if (!modeloPorM3 && precoUnitarioCalculado === null) {
      toast.error("Informe um valor unitario/mês positivo.");
      return;
    }

    const itensPayload = modeloPorM3
      ? itens.map((item, index) => ({
          equipamentoId: item.equipamentoId || null,
          descricao: item.descricao || `Equipamento ${index + 1}`,
          quantidade: parseQuantidadeInput(item.quantidade) ?? 1,
          precoM3: parseOptionalPositive(item.precoM3),
          volumeMinimoM3: parseOptionalPositive(item.volumeMinimoM3),
          horasGarantidas: item.horasGarantidas || null,
          precoUnitario: parseOptionalPositive(item.precoUnitario),
          horaExtra: parseOptionalPositive(item.horaExtra),
          ordem: index,
        }))
      : [];
    const primeiroItem = itensPayload[0];

    if (
      modeloPorM3 &&
      itensPayload.some((item) => !item.precoM3 || !item.volumeMinimoM3)
    ) {
      toast.error("Informe preco por m3 e volume minimo em todos os equipamentos.");
      return;
    }

    if (valorTotalProposta === null) {
      toast.error("Nao foi possivel calcular o valor total.");
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
            valorTotal: valorTotalProposta,
            quantidade: modeloPorM3
              ? (primeiroItem?.quantidade ?? quantidadeCalculada)
              : quantidadeCalculada,
            descricaoComercial: modeloPorM3
              ? (primeiroItem?.descricao ?? descricaoComercial)
              : descricaoComercial,
            horasGarantidas: modeloPorM3 ? null : horasGarantidas,
            precoUnitario: modeloPorM3
              ? (primeiroItem?.precoM3 ?? precoM3Calculado)
              : precoUnitarioCalculado,
            horaExtra: modeloPorM3 ? null : horaExtra || null,
            precoM3: modeloPorM3 ? (primeiroItem?.precoM3 ?? precoM3Calculado) : null,
            volumeMinimoM3: modeloPorM3
              ? (primeiroItem?.volumeMinimoM3 ?? volumeMinimoM3Calculado)
              : null,
            itens: modeloPorM3 ? itensPayload : undefined,
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
      <DialogContent className="!flex h-[min(92dvh,900px)] w-[calc(100vw-1rem)] !max-w-[min(96vw,1200px)] flex-col !gap-0 overflow-hidden rounded-3xl p-0 sm:w-[min(96vw,1200px)]">
        <DialogHeader className="shrink-0">
          <div className="px-5 pt-5 sm:px-6 sm:pt-6">
            <DialogTitle className="text-2xl font-bold text-[#1A2E5A]">
              Gerar proposta comercial
            </DialogTitle>
            <DialogDescription>
              Selecione o modelo Villa, revise os dados herdados e salve o
              rascunho da proposta. O preview fica disponivel sob demanda.
            </DialogDescription>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-[#667085]">
            <Loader2 className="mr-2 size-5 animate-spin" />
            Carregando proposta...
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-5 py-4 sm:px-6">
            <div className="grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
              <Field label="Template" className="lg:col-span-2">
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

              <section className="rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] p-3 lg:col-span-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
                      Dados herdados
                    </p>
                    <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <ReadOnly label="Cliente" value={oportunidade?.empresa.nomeFantasia ?? oportunidade?.empresa.razaoSocial ?? "Nao informado"} />
                      <ReadOnly label="Obra" value={oportunidade?.obra?.nome ?? "Nao vinculada"} />
                      <ReadOnly label="Local" value={`${oportunidade?.obra?.cidade ?? "Cidade nao informada"} / ${oportunidade?.obra?.estado ?? "UF"}`} />
                      <ReadOnly label="Responsavel" value={oportunidade?.responsavel?.nome ?? "Equipe Comercial Villa"} />
                    </dl>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPreviewVisible((current) => !current)}
                    className="h-10 shrink-0 rounded-2xl"
                  >
                    {isPreviewVisible ? "Ocultar preview" : "Mostrar preview"}
                  </Button>
                </div>
              </section>

              {isPreviewVisible ? (
                <section className="w-full min-w-0 overflow-x-hidden rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] p-3 lg:col-span-2">
                  <PropostaPreview html={previewHtml} />
                </section>
              ) : null}

              <Field label="Equipamento/serviço" className="lg:col-span-2">
                <Select
                  value={equipamentoSelecionadoId}
                  onValueChange={handleEquipamentoChange}
                >
                  <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                    <span
                      data-slot="select-value"
                      className="flex flex-1 items-center gap-1.5 truncate text-left"
                    >
                      {equipamentoSelecionadoLabel}
                    </span>
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
              {modeloPorM3 ? (
                <section className="space-y-3 rounded-2xl border border-[#D7DEEA] bg-white p-4 lg:col-span-2">
                  <div>
                    <p className="font-semibold text-[#1A2E5A]">
                      Equipamentos da proposta
                    </p>
                    <p className="text-sm text-[#667085]">
                      Adicione uma ou mais bombas, cada uma com volume mínimo e
                      preço por m³.
                    </p>
                  </div>

                  {itens.map((item, index) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-[#1A2E5A]">
                          Equipamento {index + 1}
                        </span>
                        {itens.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removerItem(index)}
                            className="text-xs font-semibold text-red-600 hover:underline"
                          >
                            Remover
                          </button>
                        ) : null}
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Equipamento">
                          <Select
                            value={item.equipamentoId || undefined}
                            onValueChange={(value) =>
                              handleItemEquipamentoChange(index, value)
                            }
                          >
                            <SelectTrigger className="h-11 w-full rounded-2xl bg-white">
                              <span
                                data-slot="select-value"
                                className="flex flex-1 items-center gap-1.5 truncate text-left"
                              >
                                {getItemEquipamentoLabel(item)}
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              {equipamentos.map((equipamento) => (
                                <SelectItem key={equipamento.id} value={equipamento.id}>
                                  {getEquipamentoLabel(equipamento)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>

                        <Field label="Descricao">
                          <Input
                            value={item.descricao}
                            onChange={(event) =>
                              atualizarItem(index, "descricao", event.target.value)
                            }
                            className="h-11 rounded-2xl bg-white"
                          />
                        </Field>

                        <Field label="Quantidade">
                          <Input
                            inputMode="numeric"
                            value={item.quantidade}
                            onChange={(event) =>
                              atualizarItem(index, "quantidade", event.target.value)
                            }
                            className="h-11 rounded-2xl bg-white"
                          />
                        </Field>

                        <Field label="Preço por m³ (R$)">
                          <Input
                            inputMode="decimal"
                            value={item.precoM3}
                            onChange={(event) =>
                              atualizarItem(index, "precoM3", event.target.value)
                            }
                            className="h-11 rounded-2xl bg-white"
                          />
                        </Field>

                        <Field label="Volume mínimo (m³)">
                          <Input
                            inputMode="decimal"
                            value={item.volumeMinimoM3}
                            onChange={(event) =>
                              atualizarItem(index, "volumeMinimoM3", event.target.value)
                            }
                            className="h-11 rounded-2xl bg-white"
                          />
                        </Field>

                        <div className="flex min-h-11 items-center justify-end rounded-2xl bg-white px-4 text-sm font-semibold text-[#1A2E5A]">
                          {formatPreviewCurrency(calcularTotalItem(item))}
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={adicionarItem}
                    className="w-full rounded-2xl border-2 border-dashed border-[#D7DEEA] py-2.5 text-sm font-semibold text-[#1E4FAB] transition-colors hover:border-[#1E4FAB]"
                  >
                    + Adicionar equipamento
                  </button>

                  <div className="flex items-center justify-between rounded-2xl bg-[#1A2E5A] px-4 py-3 text-white">
                    <span className="text-sm">Total geral</span>
                    <span className="font-semibold">
                      {formatPreviewCurrency(totalItensCalculado)}
                    </span>
                  </div>
                </section>
              ) : (
                <>
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
                </>
              )}
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
              <Field label="Condicoes de pagamento" className="lg:col-span-2">
                <Textarea
                  value={condicoesPagamento}
                  onChange={(event) => setCondicoesPagamento(event.target.value)}
                  className="min-h-24 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>
              <Field label="Observacoes comerciais" className="lg:col-span-2">
                <Textarea
                  value={observacoesComerciais}
                  onChange={(event) =>
                    setObservacoesComerciais(event.target.value)
                  }
                  className="min-h-24 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>
              <Field label="Observacoes tecnicas" className="lg:col-span-2">
                <Textarea
                  value={observacoesTecnicas}
                  onChange={(event) => setObservacoesTecnicas(event.target.value)}
                  className="min-h-24 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>
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
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`w-full min-w-0 ${className}`}>
      <Label className="text-[#1A2E5A]">{label}</Label>
      <div className="mt-2 w-full min-w-0 [&_[data-slot=input]]:w-full [&_[data-slot=select-trigger]]:w-full [&_[data-slot=textarea]]:w-full">
        {children}
      </div>
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
