import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { getPropostaTemplate } from "@/lib/propostas/templates";

type DecimalLike = string | number | { toString(): string };

export type PropostaRenderData = {
  numeroProposta: string;
  versao: number;
  templateUtilizado: string;
  cliente: string;
  obra: string;
  cidade?: string | null;
  estado?: string | null;
  telefone?: string | null;
  email?: string | null;
  quantidade?: string | null;
  descricaoComercial?: string | null;
  horasGarantidas?: string | null;
  precoUnitario?: DecimalLike | null;
  horaExtra?: DecimalLike | null;
  precoM3?: DecimalLike | null;
  volumeMinimoM3?: DecimalLike | null;
  valorTotal: DecimalLike;
  validadeProposta: Date | string;
  prazoExecucao?: string | null;
  responsavel?: string | null;
  observacoesComerciais?: string | null;
  observacoesTecnicas?: string | null;
  condicoesPagamento?: string | null;
  blocos?: Array<{
    chave?: string;
    titulo: string;
    tipo: string;
    ordem: number;
    conteudoAtual: string;
  }>;
  itens?: Array<{
    ordem: number;
    descricao: string;
    quantidade: number;
    precoM3?: DecimalLike | null;
    volumeMinimoM3?: DecimalLike | null;
    horasGarantidas?: string | null;
    precoUnitario?: DecimalLike | null;
    horaExtra?: DecimalLike | null;
    valorTotal: DecimalLike;
  }>;
  data?: Date | string;
};

export type PropostaVariaveisRenderizadas = {
  cliente: string;
  obra: string;
  cidade: string;
  estado: string;
  telefone: string;
  email: string;
  tipo_servico: string;
  quantidade: string;
  descricao_comercial: string;
  horas_garantidas: string;
  preco_unitario: string;
  valor: string;
  hora_extra: string;
  prazo: string;
  validade: string;
  responsavel: string;
  data: string;
  singular_plural: string;
  singular_plural_caps: string;
  singular_plural_operador: string;
  equipamento_plural: string;
  nos_equipamentos: string;
  dos_equipamentos: string;
  aos_equipamentos: string;
  os_equipamentos: string;
  os_pronome: string;
  numero_por_extenso: string;
};

function formatDate(value: Date | string) {
  return format(new Date(value), "dd/MM/yyyy", { locale: ptBR });
}

function numerosPorExtenso(value: number) {
  const mapa: Record<number, string> = {
    1: "um",
    2: "dois",
    3: "tres",
    4: "quatro",
    5: "cinco",
    6: "seis",
    7: "sete",
    8: "oito",
    9: "nove",
    10: "dez",
  };

  return mapa[value] ?? String(value);
}

function getTipoServicoProposta(templateId: string, fallback: string, plural: boolean) {
  if (templateId === "locacao-betoneira-com-operador") {
    return plural
      ? "CAMINHÕES BETONEIRAS COM OPERADORES"
      : "CAMINHÃO BETONEIRA COM OPERADOR";
  }

  if (templateId === "locacao-betoneira-sem-operador") {
    return plural
      ? "CAMINHÕES BETONEIRAS SEM OPERADORES"
      : "CAMINHÃO BETONEIRA SEM OPERADOR";
  }

  return fallback;
}

function formatCurrency(value: DecimalLike) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function paragraph(value?: string | null) {
  if (!value) {
    return "";
  }

  return escapeHtml(value).replaceAll("\n", "<br />");
}

function renderDocumentLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

function getFieldFromBlock(content: string, label: string) {
  const line = content
    .split("\n")
    .find((item) => item.toLowerCase().startsWith(label.toLowerCase()));

  return line?.split(":").slice(1).join(":").trim() || "";
}

function renderHeaderBlock() {
  // O cabeçalho é renderizado pelo prop-header/prop-client-bar em renderPropostaHtml
  // Este bloco gera apenas a saudação inicial
  return "";
}

function formatVolume(value: DecimalLike) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function renderMultiItemPriceBlock(data: PropostaRenderData) {
  const itens = data.itens ?? [];
  const total = itens.reduce((sum, item) => sum + Number(item.valorTotal), 0);

  return `<div class="section">4. Preços</div>
    <p>Os preços ofertados nesta proposta serão os seguintes:</p>
    <table class="ptab">
      <thead>
        <tr>
          <th>Qtd.</th>
          <th>Descrição</th>
          <th>Volume mínimo</th>
          <th>Preço por m³</th>
          <th>Valor total</th>
        </tr>
      </thead>
      <tbody>
        ${itens
          .map(
            (item) => `<tr>
              <td>${item.quantidade}</td>
              <td>${escapeHtml(item.descricao)}</td>
              <td>${item.volumeMinimoM3 ? `${formatVolume(item.volumeMinimoM3)} m³` : escapeHtml(item.horasGarantidas ?? "-")}</td>
              <td>${item.precoM3 ? `${formatCurrency(item.precoM3)}/m³` : item.precoUnitario ? formatCurrency(item.precoUnitario) : "-"}</td>
              <td class="tot">${formatCurrency(item.valorTotal)}</td>
            </tr>`,
          )
          .join("")}
        <tr>
          <td class="tot" colspan="3"></td>
          <td class="tot">TOTAL</td>
          <td class="tot">${formatCurrency(total)}</td>
        </tr>
      </tbody>
    </table>`;
}

function renderPriceBlock(content: string, data: PropostaRenderData) {
  if ((data.itens?.length ?? 0) > 1) {
    return renderMultiItemPriceBlock(data);
  }

  const isM3 = content.includes("Preço por m³") || content.includes("Preco por m3");
  const rows = isM3
    ? [
        getFieldFromBlock(content, "Qtd."),
        getFieldFromBlock(content, "Descrição") ||
          getFieldFromBlock(content, "Descricao"),
        getFieldFromBlock(content, "Volume mínimo") ||
          getFieldFromBlock(content, "Volume minimo"),
        getFieldFromBlock(content, "Preço por m³") ||
          getFieldFromBlock(content, "Preco por m3"),
        getFieldFromBlock(content, "Valor total"),
      ]
    : [
        getFieldFromBlock(content, "Qtd."),
        getFieldFromBlock(content, "Descrição") ||
          getFieldFromBlock(content, "Descricao"),
        getFieldFromBlock(content, "Horas Garantidas"),
        getFieldFromBlock(content, "Preço Unit./mês") ||
          getFieldFromBlock(content, "Preco Unit./mes"),
        getFieldFromBlock(content, "Preço Total/mês") ||
          getFieldFromBlock(content, "Preco Total/mes"),
        getFieldFromBlock(content, "Hora Extra/h"),
      ];
  const headers = isM3
    ? ["Qtd.", "Descrição", "Volume mínimo", "Preço por m³", "Valor total"]
    : [
        "Qtd.",
        "Descrição",
        "Horas Garantidas",
        "Preço Unit./mês",
        "Preço Total/mês",
        "Hora Extra/h",
      ];
  const observacoes = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("Obs."));

  return `<div class="section">4. Preços</div>
    <p>Os preços ofertados nesta proposta serão os seguintes:</p>
    <table class="ptab">
      <thead>
        <tr>
          ${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        <tr>
          ${rows
            .map((value, index) =>
              index === (isM3 ? 4 : 4)
                ? `<td class="tot">${escapeHtml(value)}</td>`
                : `<td>${escapeHtml(value)}</td>`,
            )
            .join("")}
        </tr>
      </tbody>
    </table>
    ${observacoes.map((line) => `<p class="obs">${escapeHtml(line)}</p>`).join("")}`;
}

function renderSignatureBlock(
  data: PropostaRenderData,
  content: string,
  title: string,
) {
  const confirmacao = content.split("\n")[0] || "";

  return `<section class="document-section signature-section">
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(confirmacao)}</p>
    <div class="signature-grid">
      ${[1, 2]
        .map(
          () => `<div class="signature-box">
            <p><strong>${escapeHtml(data.cliente)}</strong></p>
            <div class="signature-line"></div>
            <p>Assinatura</p>
            <p>Nome:</p>
            <p>Cargo:</p>
            <p>Data: _____/_____/_______</p>
            <div class="stamp-line"></div>
            <p>Carimbo CNPJ</p>
          </div>`,
        )
        .join("")}
    </div>
    <div class="closing">
      <p>Atenciosamente,</p>
      <p><strong>Morgana Albertim</strong></p>
      <p>Supervisora Comercial</p>
      <p>Villa Empreendimentos</p>
    </div>
    <div class="witness-grid">
      <div><p>Testemunha:</p><p>Nome:</p><p>CPF:</p></div>
      <div><p>Testemunha:</p><p>Nome:</p><p>CPF:</p></div>
    </div>
  </section>`;
}

function renderGovernedBlocks(data: PropostaRenderData) {
  if (!data.blocos?.length) {
    return "";
  }

  const modeloPorM3 =
    data.precoM3 !== null &&
    data.precoM3 !== undefined &&
    data.volumeMinimoM3 !== null &&
    data.volumeMinimoM3 !== undefined;

  return data.blocos
    .slice()
    .filter((bloco) => !modeloPorM3 || bloco.chave !== "precos_referencia")
    .sort((left, right) => left.ordem - right.ordem)
    .map((bloco) => {
      if (bloco.chave === "cabecalho") {
        return renderHeaderBlock();
      }

      if (bloco.chave === "precos") {
        return renderPriceBlock(bloco.conteudoAtual, data);
      }

      if (bloco.chave === "assinaturas") {
        return renderSignatureBlock(data, bloco.conteudoAtual, bloco.titulo);
      }

      return `<section class="document-section">
        <h2>${escapeHtml(bloco.titulo)}</h2>
        ${renderDocumentLines(bloco.conteudoAtual)}
      </section>`;
    })
    .join("");
}

export function buildPropostaVariaveis(
  data: PropostaRenderData,
): PropostaVariaveisRenderizadas {
  const template = getPropostaTemplate(data.templateUtilizado);
  const modeloPorM3 =
    data.precoM3 !== null &&
    data.precoM3 !== undefined &&
    data.volumeMinimoM3 !== null &&
    data.volumeMinimoM3 !== undefined;
  const quantidadeNumero = Number.parseInt(data.quantidade || "1", 10);
  const quantidadeValida =
    Number.isFinite(quantidadeNumero) && quantidadeNumero > 0
      ? quantidadeNumero
      : 1;
  const plural = quantidadeValida > 1;

  return {
    cliente: data.cliente,
    obra: data.obra,
    cidade: data.cidade ?? "Nao informado",
    estado: data.estado ?? "Nao informado",
    telefone: data.telefone || "Nao informado",
    email: data.email || "Nao informado",
    tipo_servico: getTipoServicoProposta(
      data.templateUtilizado,
      template?.tipoServico ?? data.templateUtilizado,
      plural,
    ),
    quantidade: data.quantidade || "01",
    descricao_comercial:
      data.descricaoComercial ||
      template?.defaults.descricaoComercial ||
      "Caminhao Betoneira - 8m3",
    horas_garantidas:
      modeloPorM3
        ? `${new Intl.NumberFormat("pt-BR", {
            maximumFractionDigits: 2,
          }).format(Number(data.volumeMinimoM3))} m³`
        : data.horasGarantidas || template?.defaults.horasGarantidas || "180h",
    preco_unitario: modeloPorM3
      ? `${formatCurrency(data.precoM3!)}/m³`
      : data.precoUnitario
        ? formatCurrency(data.precoUnitario)
        : formatCurrency(data.valorTotal),
    valor: formatCurrency(data.valorTotal),
    hora_extra:
      data.horaExtra === null || data.horaExtra === undefined
        ? "Nao informado"
        : formatCurrency(data.horaExtra),
    prazo: data.prazoExecucao || template?.defaults.prazoExecucao || "A definir",
    validade: formatDate(data.validadeProposta),
    responsavel: data.responsavel || "Equipe Comercial Villa",
    data: formatDate(data.data ?? new Date()),
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
    numero_por_extenso: `${quantidadeValida} (${numerosPorExtenso(
      quantidadeValida,
    )})`,
  };
}

export function renderPropostaHtml(data: PropostaRenderData) {
  const template = getPropostaTemplate(data.templateUtilizado);
  const variaveis = buildPropostaVariaveis(data);
  const escopo = template?.escopo ?? [];
  const observacoesTecnicas =
    data.observacoesTecnicas || template?.observacoesTecnicasPadrao;
  const condicoesPagamento =
    data.condicoesPagamento || template?.condicoesPagamentoPadrao;

  const css = `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 10.5pt; color: #000; background: white; }

      /* Banner topo */
      .prop-header { background: #1A2E5A; padding: 18px 2.2cm; display: flex; justify-content: space-between; align-items: flex-start; }
      .prop-empresa { color: white; font-size: 16pt; font-weight: 700; letter-spacing: 0.5px; }
      .prop-sub { color: rgba(255,255,255,0.62); font-size: 9pt; margin-top: 3px; }
      .prop-num-box { background: #1E4FAB; border: 1.5px solid rgba(255,255,255,0.28); color: white; padding: 7px 16px; border-radius: 5px; text-align: center; min-width: 170px; }
      .prop-num-label { font-size: 7.5pt; letter-spacing: 0.8px; text-transform: uppercase; opacity: 0.8; }
      .prop-num-val { font-size: 12pt; font-weight: 700; margin-top: 3px; }

      /* Barra cliente */
      .prop-client-bar { background: #F0F4FA; border-bottom: 2.5px solid #1A2E5A; padding: 9px 2.2cm; font-size: 9.5pt; color: #333; line-height: 1.65; }

      /* Conteúdo */
      .prop-content { padding: 18px 2.2cm 2cm; }
      p { margin-bottom: 7px; text-align: justify; line-height: 1.55; font-size: 10.5pt; }

      /* Seções com borda esquerda */
      .section { font-size: 10pt; font-weight: 700; color: #1A2E5A; margin: 14px 0 5px; text-transform: uppercase; letter-spacing: 0.7px; border-left: 3px solid #1E4FAB; padding-left: 8px; }

      ul.clausulas { margin: 4px 0 8px 0; padding: 0; }
      ul.clausulas li { list-style: none; padding: 2px 0 2px 14px; position: relative; line-height: 1.5; text-align: justify; font-size: 10.5pt; }
      ul.clausulas li::before { content: "•"; position: absolute; left: 0; color: #1E4FAB; font-weight: 700; }

      /* Tabelas */
      table.ptab { width: 100%; border-collapse: collapse; margin: 8px 0 4px; font-size: 10pt; }
      table.ptab th { background: #1A2E5A; color: white; padding: 8px 10px; text-align: left; font-size: 9.5pt; }
      table.ptab td { padding: 6px 10px; border-bottom: 1px solid #ddd; }
      table.ptab tr:nth-child(even) td { background: #F5F8FF; }
      table.ptab .tot { font-weight: 700; color: #1A2E5A; background: #EEF3FF !important; }

      .obs { font-size: 9pt; color: #333; margin: 3px 0 3px 6px; line-height: 1.5; }
      .obs strong { color: #1A2E5A; }

      /* Assinatura */
      .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 16px; }
      .sig-box { border-top: 2px solid #1A2E5A; padding-top: 8px; font-size: 9.5pt; line-height: 1.8; }
      .sig-villa { margin-top: 24px; font-size: 10pt; }
      .testemunhas { margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; font-size: 9pt; }
      .test-box { border-top: 1px solid #bbb; padding-top: 5px; color: #444; }

      /* Rodapé azul */
      .prop-footer { background: #1A2E5A; color: rgba(255,255,255,0.65); font-size: 8.5pt; text-align: center; padding: 9px 2.2cm; margin-top: 32px; letter-spacing: 0.3px; }

      .btn-print { background: #1E4FAB; color: white; border: none; padding: 10px 22px; border-radius: 6px; font-size: 13px; cursor: pointer; margin-bottom: 18px; display: block; }
      @media print { .btn-print { display: none !important; } body { background: white; } }
    </style>`;

  const headerHtml = `
  <div class="prop-header">
    <div>
      <div class="prop-empresa">VILLA EMPREENDIMENTOS</div>
      <div class="prop-sub">Locação de Equipamentos para Construção Civil</div>
    </div>
    <div class="prop-num-box">
      <div class="prop-num-label">Proposta N.º</div>
      <div class="prop-num-val">${escapeHtml(data.numeroProposta)}</div>
    </div>
  </div>
  <div class="prop-client-bar">
    <strong>${escapeHtml(variaveis.cliente)}</strong> &nbsp;·&nbsp;
    <strong>Obra:</strong> ${escapeHtml(variaveis.obra)} &nbsp;·&nbsp;
    <strong>Tel:</strong> ${escapeHtml(variaveis.telefone)} &nbsp;·&nbsp;
    <strong>E-mail:</strong> ${escapeHtml(variaveis.email)} &nbsp;·&nbsp;
    Recife, ${escapeHtml(variaveis.data)}
  </div>`;

  const footerHtml = `
  <div class="prop-footer">
    comercial@villaempreendimentos.com.br &nbsp;·&nbsp; logistica@villaempreendimentos.com.br &nbsp;·&nbsp; marcio@villaempreendimentos.com.br &nbsp;·&nbsp; Bezerros – PE
  </div>`;

  const bodyContent = data.blocos?.length
    ? renderGovernedBlocks(data)
    : `<div class="section">Escopo</div><ul class="clausulas">${escopo.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;

  const extras = [
    data.observacoesComerciais
      ? `<div class="section">Observações Comerciais</div><p>${paragraph(data.observacoesComerciais)}</p>`
      : "",
    observacoesTecnicas
      ? `<div class="section">Observações Técnicas</div><p>${paragraph(observacoesTecnicas)}</p>`
      : "",
    condicoesPagamento
      ? `<div class="section">Condições de Pagamento</div><p>${paragraph(condicoesPagamento)}</p>`
      : "",
  ].join("");

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Proposta ${escapeHtml(data.numeroProposta)}</title>
    ${css}
  </head>
  <body>
    ${headerHtml}
    <div class="prop-content">
      <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Salvar como PDF</button>
      <p>Prezado(a) Cliente,</p>
      <p>Conforme solicitação de V. Sa., temos o prazer de apresentar nossa proposta de locação de <strong>${escapeHtml(variaveis.tipo_servico)}</strong>, conforme segue:</p>
      ${bodyContent}
      ${extras}
    </div>
    ${footerHtml}
  </body>
</html>`;
}
