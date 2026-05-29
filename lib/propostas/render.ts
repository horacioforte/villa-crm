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
};

function formatDate(value: Date | string) {
  return format(new Date(value), "dd/MM/yyyy", { locale: ptBR });
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

function renderHeaderBlock(data: PropostaRenderData, content: string) {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const intro = lines.slice(6).join("\n");

  return `<header class="proposal-header">
    <div class="brand-row">
      <div>
        <strong>Villa Empreendimentos</strong>
        <span>Locação e venda de equipamentos para concreto</span>
      </div>
      <div class="proposal-number">Proposta Nº ${escapeHtml(data.numeroProposta)}</div>
    </div>
    <p class="date-line">Recife, ${escapeHtml(formatDate(data.data ?? new Date()))}.</p>
    <div class="recipient">
      <p>À</p>
      <p><strong>${escapeHtml(data.cliente)}</strong></p>
      <p><strong>Obra:</strong> ${escapeHtml(data.obra)}</p>
      <p><strong>Fone:</strong> ${escapeHtml(data.telefone || getFieldFromBlock(content, "Fone") || "Não informado")}</p>
      <p><strong>Email:</strong> ${escapeHtml(data.email || getFieldFromBlock(content, "Email") || "Não informado")}</p>
    </div>
    <div class="intro">${paragraph(intro)}</div>
  </header>`;
}

function renderPriceBlock(content: string) {
  const quantidade = getFieldFromBlock(content, "Qtd.");
  const descricao = getFieldFromBlock(content, "Descrição") || getFieldFromBlock(content, "Descricao");
  const horas = getFieldFromBlock(content, "Horas Garantidas");
  const precoUnitario = getFieldFromBlock(content, "Preço Unit./mês") || getFieldFromBlock(content, "Preco Unit./mes");
  const precoTotal = getFieldFromBlock(content, "Preço Total/mês") || getFieldFromBlock(content, "Preco Total/mes");
  const horaExtra = getFieldFromBlock(content, "Hora Extra/h");
  const observacoes = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("Obs."));

  const horaExtraTable = horaExtra && horaExtra !== "Nao informado"
    ? `<table class="price-table" style="margin-top:10px">
      <thead>
        <tr>
          <th>Hora Extra</th>
          <th>Valor por hora excedente</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Por hora excedente</td>
          <td>${escapeHtml(horaExtra)}</td>
        </tr>
      </tbody>
    </table>`
    : "";

  return `<section class="document-section price-section">
    <h2>4. Preços</h2>
    <p>Os preços ofertados nesta proposta serão os seguintes:</p>
    <table class="price-table">
      <thead>
        <tr>
          <th>Qtd.</th>
          <th>Descrição</th>
          <th>Horas Garantidas</th>
          <th>Preço Unit./mês</th>
          <th>Preço Total/mês</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(quantidade)}</td>
          <td>${escapeHtml(descricao)}</td>
          <td>${escapeHtml(horas)}</td>
          <td>${escapeHtml(precoUnitario)}</td>
          <td>${escapeHtml(precoTotal)}</td>
        </tr>
      </tbody>
    </table>
    ${horaExtraTable}
    ${observacoes.map((line) => `<p class="note">${escapeHtml(line)}</p>`).join("")}
  </section>`;
}

function renderSignatureBlock(data: PropostaRenderData, content: string) {
  const confirmacao = content.split("\n")[0] || "";

  return `<section class="document-section signature-section">
    <h2>11. Aceite</h2>
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

  return data.blocos
    .slice()
    .sort((left, right) => left.ordem - right.ordem)
    .map((bloco) => {
      if (bloco.chave === "cabecalho") {
        return renderHeaderBlock(data, bloco.conteudoAtual);
      }

      if (bloco.chave === "precos") {
        return renderPriceBlock(bloco.conteudoAtual);
      }

      if (bloco.chave === "assinaturas") {
        return renderSignatureBlock(data, bloco.conteudoAtual);
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

  return {
    cliente: data.cliente,
    obra: data.obra,
    cidade: data.cidade ?? "Nao informado",
    estado: data.estado ?? "Nao informado",
    telefone: data.telefone || "Nao informado",
    email: data.email || "Nao informado",
    tipo_servico: template?.tipoServico ?? data.templateUtilizado,
    quantidade: data.quantidade || "01",
    descricao_comercial: data.descricaoComercial || "Caminhao Betoneira - 8m3",
    horas_garantidas: data.horasGarantidas || "180h",
    preco_unitario: data.precoUnitario
      ? formatCurrency(data.precoUnitario)
      : formatCurrency(data.valorTotal),
    valor: formatCurrency(data.valorTotal),
    hora_extra:
      data.horaExtra === null || data.horaExtra === undefined
        ? "Nao informado"
        : formatCurrency(data.horaExtra),
    prazo: data.prazoExecucao || "A definir",
    validade: formatDate(data.validadeProposta),
    responsavel: data.responsavel || "Equipe Comercial Villa",
    data: formatDate(data.data ?? new Date()),
  };
}

export function renderPropostaHtml(data: PropostaRenderData) {
  const template = getPropostaTemplate(data.templateUtilizado);
  const variaveis = buildPropostaVariaveis(data);
  const titulo = template?.titulo ?? "Proposta comercial Villa";
  const descricao = template?.descricao ?? "Proposta comercial Villa.";
  const escopo = template?.escopo ?? [];
  const observacoesTecnicas =
    data.observacoesTecnicas || template?.observacoesTecnicasPadrao;
  const condicoesPagamento =
    data.condicoesPagamento || template?.condicoesPagamentoPadrao;

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(data.numeroProposta)} v${data.versao}</title>
    <style>
      @page { size: A4; margin: 18mm; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #F4F6FA; color: #111827; font-family: "Open Sans", Arial, sans-serif; }
      .page { width: 210mm; min-height: 297mm; margin: 24px auto; background: #fff; padding: 22mm 20mm; box-shadow: 0 18px 50px rgba(26, 46, 90, .14); }
      .brand-row { border-bottom: 2px solid #1A2E5A; color: #1A2E5A; display: flex; justify-content: space-between; gap: 24px; padding-bottom: 12px; }
      .brand-row strong { display: block; font: 700 16px Montserrat, Arial, sans-serif; letter-spacing: .02em; text-transform: uppercase; }
      .brand-row span { color: #475467; display: block; font-size: 10px; margin-top: 3px; }
      .proposal-number { font-weight: 700; text-align: right; white-space: nowrap; }
      .date-line { margin: 18px 0 20px; text-align: right; }
      .recipient { line-height: 1.45; margin-bottom: 20px; }
      .recipient p, .intro p, .document-section p { margin: 0 0 8px; }
      .intro { margin-top: 18px; }
      h2 { color: #1A2E5A; font: 700 14px Montserrat, Arial, sans-serif; margin: 0 0 10px; text-transform: none; }
      p { color: #202938; font-size: 11px; line-height: 1.55; text-align: justify; }
      .document-section { margin-top: 16px; page-break-inside: avoid; }
      .price-table { border-collapse: collapse; font-size: 10px; margin: 10px 0 12px; width: 100%; }
      .price-table th { background: #1A2E5A; color: #fff; font-weight: 700; text-align: left; }
      .price-table th, .price-table td { border: 1px solid #98A2B3; padding: 7px 8px; vertical-align: top; }
      .price-table td:last-child, .price-table th:last-child { text-align: right; }
      .note { font-size: 10px; }
      .signature-grid, .witness-grid { display: grid; gap: 22px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 20px; }
      .signature-box { min-height: 190px; }
      .signature-line { border-top: 1px solid #111827; margin: 34px 0 6px; }
      .stamp-line { border-top: 1px solid #111827; margin: 22px 0 6px; }
      .closing { margin-top: 24px; }
      .closing p { margin-bottom: 3px; text-align: left; }
      .witness-grid { margin-top: 18px; }
      .footer { border-top: 1px solid #D7DEEA; color: #667085; font-size: 9px; margin-top: 28px; padding-top: 10px; text-align: center; }
      @media print { body { background: #fff; } .page { box-shadow: none; margin: 0; width: auto; min-height: auto; } }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="content">
        ${
          data.blocos?.length
            ? renderGovernedBlocks(data)
            : `<h2>Escopo previsto</h2><ul>${escopo.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
        }
        ${
          data.observacoesComerciais
            ? `<h2>Observacoes comerciais</h2><p>${paragraph(data.observacoesComerciais)}</p>`
            : ""
        }
        ${
          observacoesTecnicas
            ? `<h2>Observacoes tecnicas</h2><p>${paragraph(observacoesTecnicas)}</p>`
            : ""
        }
        ${
          condicoesPagamento
            ? `<h2>Condicoes de pagamento</h2><p>${paragraph(condicoesPagamento)}</p>`
            : ""
        }
      </section>
      <footer class="footer">
        ${escapeHtml(titulo)} - ${escapeHtml(descricao)} - Documento gerado em ${escapeHtml(variaveis.data)}.
      </footer>
    </main>
  </body>
</html>`;
}
