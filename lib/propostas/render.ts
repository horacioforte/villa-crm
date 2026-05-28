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
  valorTotal: DecimalLike;
  validadeProposta: Date | string;
  prazoExecucao?: string | null;
  responsavel?: string | null;
  observacoesComerciais?: string | null;
  observacoesTecnicas?: string | null;
  condicoesPagamento?: string | null;
  blocos?: Array<{
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
  tipo_servico: string;
  valor: string;
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

function renderGovernedBlocks(data: PropostaRenderData) {
  if (!data.blocos?.length) {
    return "";
  }

  return data.blocos
    .slice()
    .sort((left, right) => left.ordem - right.ordem)
    .map(
      (bloco) => `<section class="governed-block">
        <div class="block-meta">${escapeHtml(bloco.tipo.replaceAll("_", " "))}</div>
        <h2>${escapeHtml(bloco.titulo)}</h2>
        <p>${paragraph(bloco.conteudoAtual)}</p>
      </section>`,
    )
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
    tipo_servico: template?.tipoServico ?? data.templateUtilizado,
    valor: formatCurrency(data.valorTotal),
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
      body { margin: 0; background: #F4F6FA; color: #172033; font-family: "Open Sans", Arial, sans-serif; }
      .page { max-width: 920px; margin: 0 auto; background: #fff; }
      .hero { background: #1A2E5A; color: #fff; padding: 40px; }
      .brand { color: #9CB7F2; font: 700 12px Montserrat, Arial, sans-serif; letter-spacing: .18em; text-transform: uppercase; }
      h1, h2 { font-family: Montserrat, Arial, sans-serif; margin: 0; }
      h1 { margin-top: 12px; font-size: 30px; line-height: 1.2; }
      h2 { color: #1A2E5A; font-size: 18px; }
      .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 28px 40px; background: #E8EEFB; }
      .meta div, .card { border: 1px solid #D7DEEA; border-radius: 18px; background: #fff; padding: 16px; }
      .label { color: #667085; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
      .value { margin-top: 6px; color: #1A2E5A; font-weight: 700; }
      .content { padding: 34px 40px 44px; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin: 22px 0; }
      p { color: #475467; line-height: 1.7; }
      ul { margin: 12px 0 0; padding-left: 20px; color: #475467; line-height: 1.7; }
      .price { color: #1E4FAB; font-size: 26px; font-weight: 800; }
      .governed-block { margin-top: 24px; page-break-inside: avoid; }
      .block-meta { color: #667085; font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 6px; }
      .footer { border-top: 1px solid #D7DEEA; padding: 24px 40px; color: #667085; font-size: 12px; }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <div class="brand">Villa Empreendimentos</div>
        <h1>${escapeHtml(titulo)}</h1>
        <p>Proposta ${escapeHtml(data.numeroProposta)} - versao ${data.versao}</p>
      </section>
      <section class="meta">
        <div><span class="label">Cliente</span><p class="value">${escapeHtml(variaveis.cliente)}</p></div>
        <div><span class="label">Obra</span><p class="value">${escapeHtml(variaveis.obra)}</p></div>
        <div><span class="label">Local</span><p class="value">${escapeHtml(`${variaveis.cidade} / ${variaveis.estado}`)}</p></div>
        <div><span class="label">Responsavel</span><p class="value">${escapeHtml(variaveis.responsavel)}</p></div>
      </section>
      <section class="content">
        <h2>Resumo comercial</h2>
        <p>${escapeHtml(descricao)}</p>
        <div class="grid">
          <div class="card"><span class="label">Tipo de servico</span><p class="value">${escapeHtml(variaveis.tipo_servico)}</p></div>
          <div class="card"><span class="label">Valor total</span><p class="price">${escapeHtml(variaveis.valor)}</p></div>
          <div class="card"><span class="label">Prazo de execucao</span><p class="value">${escapeHtml(variaveis.prazo)}</p></div>
          <div class="card"><span class="label">Validade</span><p class="value">${escapeHtml(variaveis.validade)}</p></div>
        </div>
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
        Documento gerado em ${escapeHtml(variaveis.data)} pela Villa Empreendimentos. Esta proposta esta sujeita a validacao operacional e comercial.
      </footer>
    </main>
  </body>
</html>`;
}
