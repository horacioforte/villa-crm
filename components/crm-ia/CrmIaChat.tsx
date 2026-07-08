"use client";

// ARQUIVO: components/crm-ia/CrmIaChat.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Chat flutuante do CRM IA — aparece em todas as páginas do CRM.

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, ChevronDown } from "lucide-react";

type DadosRelatorio = {
  titulo: string;
  tipoGrafico: "bar" | "pie" | "doughnut";
  labels: string[];
  datasets: Array<{ label: string; data: number[]; backgroundColor?: string[] }>;
  descricao?: string;
  tipoSaida?: "pdf" | "excel" | "powerpoint";
  // Campos para relatórios ricos
  tabela?: string[][];
  colunas?: string[];
  conclusoes?: string[];
  recomendacoes?: string[];
  periodo?: string;
  filtros?: string;
};

type Mensagem = {
  role: "user" | "assistant";
  content: string;
  relatorio?: DadosRelatorio;
};

export function CrmIaChat() {
  // Detecta se é o primeiro acesso do dia para o modo recepção
  const hoje = new Date().toISOString().split("T")[0];
  const [modoRecepcao, setModoRecepcao] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      role: "assistant",
      content:
        "Olá! Sou o **CRM IA**, seu assistente inteligente.\n\nPosso analisar dados, consultar contatos, histórico de atividades, gerar relatórios e executar ações no CRM. O que você precisa?",
    },
  ]);
  const [input, setInput] = useState("");
  const [carregando, setCarregando] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const primeiraAberturaRef = useRef(false);

  // Inicializa modo recepção (primeiro acesso do dia)
  useEffect(() => {
    const ultimoBriefing = localStorage.getItem("crm-ia-briefing-date");
    if (ultimoBriefing !== hoje) {
      setModoRecepcao(true);
    }
  }, [hoje]);

  // Auto-briefing removido — usuário abre o chat manualmente quando quiser

  useEffect(() => {
    if (aberto) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [aberto, mensagens]);

  async function enviar(textoForce?: string) {
    const texto = (textoForce ?? input).trim();
    if (!texto || carregando) return;

    const novasMensagens: Mensagem[] = [
      ...mensagens,
      { role: "user", content: texto },
    ];
    setMensagens(novasMensagens);
    setInput("");
    setCarregando(true);

    try {
      const res = await fetch("/api/crm-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensagem: texto,
          historico: novasMensagens.slice(-10),
        }),
      });

      if (!res.ok) throw new Error("Erro na resposta");
      const data = await res.json();

      const novaMsgAssistant: Mensagem = {
        role: "assistant",
        content: data.resposta,
        ...(data.relatorio ? { relatorio: data.relatorio } : {}),
      };
      setMensagens([...novasMensagens, novaMsgAssistant]);
    } catch {
      setMensagens([
        ...novasMensagens,
        {
          role: "assistant",
          content: "Desculpe, ocorreu um erro. Tente novamente.",
        },
      ]);
    } finally {
      setCarregando(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  // Renderiza markdown simples (negrito e quebras de linha)
  function renderTexto(texto: string) {
    const partes = texto.split(/(\*\*[^*]+\*\*)/g);
    return partes.map((parte, i) => {
      if (parte.startsWith("**") && parte.endsWith("**")) {
        return <strong key={i}>{parte.slice(2, -2)}</strong>;
      }
      return (
        <span key={i}>
          {parte.split("\n").map((linha, j, arr) => (
            <span key={j}>
              {linha}
              {j < arr.length - 1 && <br />}
            </span>
          ))}
        </span>
      );
    });
  }

  // Carrega script externo dinamicamente (CDN)
  function carregarScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // ── PDF — abre nova aba com layout profissional Villa ────────────────────────
  function abrirRelatorio(rel: DadosRelatorio) {
    const chartConfig = JSON.stringify({
      type: rel.tipoGrafico,
      data: {
        labels: rel.labels,
        datasets: rel.datasets.map((d) => ({
          ...d,
          borderWidth: rel.tipoGrafico === "bar" ? 0 : 2,
          borderColor: "#ffffff",
        })),
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom", labels: { padding: 16, font: { size: 13 } } },
          title: { display: false },
        },
        scales: rel.tipoGrafico === "bar" ? {
          y: { beginAtZero: true, ticks: { font: { size: 12 } } },
          x: { ticks: { font: { size: 12 } } },
        } : undefined,
      },
    });

    const dataHoje = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit", month: "long", year: "numeric",
    });

    // Tabela de dados HTML
    const tabelaHtml = rel.tabela && rel.colunas
      ? `<div class="card">
          <h2>Dados Detalhados</h2>
          <table>
            <thead><tr>${rel.colunas.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
            <tbody>${rel.tabela.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
          </table>
        </div>`
      : rel.labels.length > 0
        ? `<div class="card">
            <h2>Dados do Relatório</h2>
            <table>
              <thead><tr><th>Categoria</th>${rel.datasets.map((d) => `<th>${d.label}</th>`).join("")}</tr></thead>
              <tbody>${rel.labels.map((label, i) => `<tr><td><strong>${label}</strong></td>${rel.datasets.map((d) => `<td>$x(d.data[i] ?? 0).toLocaleString("pt-BR")}</td>`).join("")}</tr>`).join("")}
              <tr class="total-row"><td><strong>Total</strong></td>${rel.datasets.map((d) => `<td><strong>${d.data.reduce((a, b) => a + b, 0).toLocaleString("pt-BR")}</strong></td>`).join("")}</tr>
              </tbody>
            </table>
          </div>`
        : "";

    const conclusoesHtml = rel.conclusoes?.length
      ? `<div class="card">
          <h2>Principais Conclusões</h2>
          <ul class="insights">${rel.conclusoes.map((c) => `<li>${c}</li>`).join("")}</ul>
        </div>`
      : "";

    const recomendacoesHtml = rel.recomendacoes?.length
      ? `<div class="card accent">
          <h2>Recomendações Práticas</h2>
          <ol class="recs">${rel.recomendacoes.map((r) => `<li>${r}</li>`).join("")}</ol>
        </div>`
      : "";

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${rel.titulo} — Villa CRM</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f6fa;color:#1A2E5A;min-height:100vh}
    .page{max-width:900px;margin:0 auto;padding:40px 32px}
    .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #1A2E5A}
    .logo-wrap{display:flex;flex-direction:column}
    .logo{font-size:24px;font-weight:900;letter-spacing:-0.5px;color:#1A2E5A}
    .logo span{color:#1E4FAB}
    .logo-sub{font-size:11px;color:#667085;margin-top:2px}
    .meta{text-align:right;font-size:12px;color:#667085;line-height:1.6}
    .card{background:white;border-radius:16px;padding:28px;box-shadow:0 2px 8px rgba(0,0,0,0.08);margin-bottom:20px}
    .card.accent{border-left:4px solid #1E4FAB}
    h1{font-size:22px;font-weight:700;margin-bottom:6px;color:#1A2E5A}
    h2{font-size:16px;font-weight:700;margin-bottom:16px;color:#1A2E5A}
    .descricao{font-size:14px;color:#667085;margin-bottom:0;line-height:1.6}
    .summary-row{display:flex;gap:12px;margin-top:12px;flex-wrap:wrap}
    .summary-item{background:#F4F6FA;border-radius:8px;padding:10px 16px;font-size:12px;color:#374151}
    .summary-item strong{display:block;font-size:18px;color:#1A2E5A;margin-bottom:2px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    thead tr{background:#1A2E5A;color:white}
    th{padding:10px 12px;text-align:left;font-weight:600}
    td{padding:8px 12px;border-bottom:1px solid #E8EEFB;color:#374151}
    tr:last-child td{border-bottom:none}
    tr:hover td{background:#F9FAFB}
    .total-row td{font-weight:700;background:#EEF2FF;color:#1A2E5A;border-top:2px solid #C7D2FE}
    ul.insights, ol.recs{padding-left:20px;display:flex;flex-direction:column;gap:8px}
    li{font-size:14px;color:#374151;line-height:1.5}
    .btn{display:inline-flex;align-items:center;gap:8px;background:#1A2E5A;color:white;border:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:24px}
    .btn:hover{background:#1E4FAB}
    .footer{text-align:center;font-size:11px;color:#98A2B3;margin-top:24px;padding-top:16px;border-top:1px solid #E8EEFB}
    @media print{body{background:white}.btn{display:none}.page{padding:20px}canvas{max-height:350px!important}}
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="logo-wrap">
        <div class="logo">Villa <span>CRM</span></div>
        <div class="logo-sub">Relatório gerado por CRM IA</div>
      </div>
      <div class="meta">
        <div>${dataHoje}</div>
        ${rel.periodo ? `<div>Período: ${rel.periodo}</div>` : ""}
        ${rel.filtros ? `<div>Filtros: ${rel.filtros}</div>` : ""}
      </div>
    </div>

    <button class="btn" onclick="window.print()">📥 Salvar como PDF</button>

    <div class="card">
      <h1>${rel.titulo}</h1>
      ${rel.descricao ? `<p class="descricao">${rel.descricao}</p>` : ""}
      ${rel.labels.length > 0 ? `<canvas id="chart" style="margin-top:24px;max-height:380px"></canvas>` : ""}
    </div>

    ${tabelaHtml}
    ${conclusoesHtml}
    ${recomendacoesHtml}

    <p class="footer">Relatório gerado pelo CRM IA · Villa Empreendimentos · Confidencial</p>
  </div>
  ${rel.labels.length > 0 ? `<script>new Chart(document.getElementById('chart'), ${chartConfig});</script>` : ""}
</body>
</html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }

  // ── Excel — planilha .xlsx completa com SheetJS ───────────────────────────
  async function baixarExcel(rel: DadosRelatorio) {
    await carregarScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
    const XLSX = (window as any).XLSX;
    const wb = XLSX.utils.book_new();

    // Aba 1 — Gráfico/Dados principais
    const headers = ["Categoria", ...rel.datasets.map((d) => d.label)];
    const rows = rel.labels.map((label, i) => [
      label,
      ...rel.datasets.map((d) => d.data[i] ?? 0),
    ]);
    const totals = ["TOTAL", ...rel.datasets.map((d) => d.data.reduce((a, b) => a + b, 0))];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows, totals]);
    ws["!cols"] = headers.map(() => ({ wch: 30 }));
    XLSX.utils.book_append_sheet(wb, ws, "Dados");

    // Aba 2 — Tabela detalhada (se houver)
    if (rel.tabela && rel.colunas) {
      const wsTabela = XLSX.utils.aoa_to_sheet([rel.colunas, ...rel.tabela]);
      wsTabela["!cols"] = rel.colunas.map(() => ({ wch: 30 }));
      XLSX.utils.book_append_sheet(wb, wsTabela, "Detalhes");
    }

    // Aba 3 — Análise (conclusões + recomendações)
    const analiseRows: string[][] = [["ANÁLISE E RECOMENDAÇÕES"]];
    if (rel.conclusoes?.length) {
      analiseRows.push([""]);
      analiseRows.push(["Principais Conclusões"]);
      rel.conclusoes.forEach((c, i) => analiseRows.push([`${i + 1}. ${c}`]));
    }
    if (rel.recomendacoes?.length) {
      analiseRows.push([""]);
      analiseRows.push(["Recomendações Práticas"]);
      rel.recomendacoes.forEach((r, i) => analiseRows.push([`${i + 1}. ${r}`]));
    }
    if (analiseRows.length > 1) {
      const wsAnalise = XLSX.utils.aoa_to_sheet(analiseRows);
      wsAnalise["!cols"] = [{ wch: 80 }];
      XLSX.utils.book_append_sheet(wb, wsAnalise, "Análise");
    }

    // Aba 4 — Informações do relatório
    const wsMeta = XLSX.utils.aoa_to_sheet([
      ["Relatório", rel.titulo],
      ["Gerado em", new Date().toLocaleString("pt-BR")],
      ...(rel.periodo ? [["Período", rel.periodo]] : []),
      ...(rel.filtros ? [["Filtros", rel.filtros]] : []),
      ...(rel.descricao ? [["Descrição", rel.descricao]] : []),
      ["Fonte", "Villa CRM IA"],
    ]);
    wsMeta["!cols"] = [{ wch: 16 }, { wch: 70 }];
    XLSX.utils.book_append_sheet(wb, wsMeta, "Informações");

    XLSX.writeFile(wb, `${rel.titulo}.xlsx`);
  }

  // ── PowerPoint — apresentação profissional .pptx com PptxGenJS ──────────────
  async function baixarPowerPoint(rel: DadosRelatorio) {
    await carregarScript(
      "https://cdnjs.cloudflare.com/ajax/libs/PptxGenJS/3.12.0/pptxgen.bundle.js"
    );
    const PptxGenJS = (window as any).PptxGenJS;
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9";

    const dataHoje = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit", month: "long", year: "numeric",
    });

    // Slide 1 — Capa
    const slideCapa = pptx.addSlide();
    slideCapa.background = { color: "1A2E5A" };
    slideCapa.addShape(pptx.ShapeType?.rect ?? "rect", {
      x: 0, y: 4.9, w: 10, h: 0.725, fill: { color: "1E4FAB" },
    });
    slideCapa.addText("Villa CRM", {
      x: 0.6, y: 0.7, w: 8.8, h: 0.7,
      fontSize: 18, bold: false, color: "93C5FD", align: "left",
    });
    slideCapa.addText(rel.titulo, {
      x: 0.6, y: 1.5, w: 8.8, h: 1.8,
      fontSize: 30, bold: true, color: "FFFFFF", align: "left",
    });
    if (rel.descricao) {
      slideCapa.addText(rel.descricao, {
        x: 0.6, y: 3.4, w: 8.8, h: 0.8,
        fontSize: 14, color: "93C5FD", align: "left",
      });
    }
    slideCapa.addText(`Gerado em ${dataHoje}${rel.periodo ? ` · Período: ${rel.periodo}` : ""}`, {
      x: 0.6, y: 5.0, w: 8.8, h: 0.5,
      fontSize: 12, color: "DBEAFE", align: "left",
    });

    // Slide 2 — Resumo Executivo
    const slideResumo = pptx.addSlide();
    slideResumo.background = { color: "FFFFFF" };
    slideResumo.addText("Resumo Executivo", {
      x: 0.5, y: 0.3, w: 9, h: 0.6,
      fontSize: 22, bold: true, color: "1A2E5A",
    });
    slideResumo.addShape(pptx.ShapeType?.rect ?? "rect", {
      x: 0.5, y: 0.95, w: 9, h: 0.04, fill: { color: "1A2E5A" },
    });

    const totalGeral = rel.datasets[0]?.data.reduce((a, b) => a + b, 0) ?? 0;
    const maiorLabel = rel.labels[rel.datasets[0]?.data.indexOf(Math.max(...(rel.datasets[0]?.data ?? []))) ?? 0] ?? "-";

    const resumoItens = [
      `📊 Relatório: ${rel.titulo}`,
      `🔢 Total: ${totalGeral.toLocaleString("pt-BR")} ${rel.datasets[0]?.label ?? ""}`,
      `🏆 Maior categoria: ${maiorLabel}`,
      `📅 Gerado em: ${dataHoje}`,
      ...(rel.periodo ? [`🗓️ Período: ${rel.periodo}`] : []),
      ...(rel.filtros ? [`🔍 Filtros: ${rel.filtros}`] : []),
    ];

    slideResumo.addText(resumoItens.join("\n"), {
      x: 0.6, y: 1.2, w: 8.8, h: 3.8,
      fontSize: 14, color: "374151", bullet: false,
      lineSpacingMultiple: 1.6,
    });

    // Slide 3 — Gráfico principal
    if (rel.labels.length > 0) {
      const slideGrafico = pptx.addSlide();
      slideGrafico.background = { color: "F4F6FA" };
      slideGrafico.addText(rel.titulo, {
        x: 0.4, y: 0.2, w: 9.2, h: 0.6,
        fontSize: 18, bold: true, color: "1A2E5A",
      });
      slideGrafico.addShape(pptx.ShapeType?.rect ?? "rect", {
        x: 0.4, y: 0.85, w: 9.2, h: 0.04, fill: { color: "1A2E5A" },
      });

      const chartTypeMap: Record<string, any> = {
        bar: pptx.ChartType?.bar ?? "bar",
        pie: pptx.ChartType?.pie ?? "pie",
        doughnut: pptx.ChartType?.doughnut ?? "doughnut",
      };
      const chartData = rel.datasets.map((d) => ({
        name: d.label,
        labels: rel.labels,
        values: d.data,
      }));
      slideGrafico.addChart(chartTypeMap[rel.tipoGrafico] ?? "bar", chartData, {
        x: 0.4, y: 1.0, w: 9.2, h: 4.3,
        showLegend: true, legendPos: "b",
        showTitle: false,
        chartColors: ["1A2E5A", "1E4FAB", "2563EB", "3B82F6", "60A5FA", "F59E0B", "EF4444", "10B981", "8B5CF6", "EC4899"],
      });
    }

    // Slide 4 — Tabela de dados
    const slideDados = pptx.addSlide();
    slideDados.background = { color: "FFFFFF" };
    slideDados.addText("Dados Detalhados", {
      x: 0.4, y: 0.2, w: 9.2, h: 0.6,
      fontSize: 18, bold: true, color: "1A2E5A",
    });

    const hasCustomTabela = rel.tabela && rel.colunas;
    const tabelaRows = hasCustomTabela
      ? [
          rel.colunas!.map((c) => ({ text: c, options: { bold: true, fill: "1A2E5A", color: "FFFFFF", fontSize: 11 } })),
          ...rel.tabela!.map((row) => row.map((cell) => ({ text: cell, options: { fontSize: 10, color: "374151" } }))),
        ]
      : [
          [
            { text: "Categoria", options: { bold: true, fill: "1A2E5A", color: "FFFFFF", fontSize: 11 } },
            ...rel.datasets.map((d) => ({ text: d.label, options: { bold: true, fill: "1A2E5A", color: "FFFFFF", fontSize: 11 } })),
          ],
          ...rel.labels.map((label, i) => [
            { text: label, options: { fontSize: 10, color: "374151" } },
            ...rel.datasets.map((d) => ({ text: (d.data[i] ?? 0).toLocaleString("pt-BR"), options: { fontSize: 10, color: "374151", align: "right" as any } })),
          ]),
          [
            { text: "TOTAL", options: { bold: true, fill: "EEF2FF", color: "1A2E5A", fontSize: 11 } },
            ...rel.datasets.map((d) => ({ text: d.data.reduce((a, b) => a + b, 0).toLocaleString("pt-BR"), options: { bold: true, fill: "EEF2FF", color: "1A2E5A", fontSize: 11, align: "right" as any } })),
          ],
        ];

    slideDados.addTable(tabelaRows, {
      x: 0.4, y: 1.0, w: 9.2,
      rowH: 0.36,
      border: { type: "solid", color: "D7DEEA", pt: 1 },
    });

    // Slide 5 — Conclusões (se houver)
    if (rel.conclusoes?.length) {
      const slideConclusoes = pptx.addSlide();
      slideConclusoes.background = { color: "1A2E5A" };
      slideConclusoes.addText("Principais Conclusões", {
        x: 0.5, y: 0.3, w: 9, h: 0.6,
        fontSize: 22, bold: true, color: "FFFFFF",
      });
      slideConclusoes.addShape(pptx.ShapeType?.rect ?? "rect", {
        x: 0.5, y: 0.95, w: 9, h: 0.04, fill: { color: "3B82F6" },
      });
      rel.conclusoes.forEach((c, i) => {
        slideConclusoes.addText(`${i + 1}. ${c}`, {
          x: 0.6, y: 1.2 + i * 0.65, w: 8.8, h: 0.6,
          fontSize: 14, color: "DBEAFE",
        });
      });
    }

    // Slide 6 — Recomendações (se houver)
    if (rel.recomendacoes?.length) {
      const slideRecs = pptx.addSlide();
      slideRecs.background = { color: "FFFFFF" };
      slideRecs.addText("Recomendações Práticas", {
        x: 0.5, y: 0.3, w: 9, h: 0.6,
        fontSize: 22, bold: true, color: "1A2E5A",
      });
      slideRecs.addShape(pptx.ShapeType?.rect ?? "rect", {
        x: 0.5, y: 0.95, w: 9, h: 0.04, fill: { color: "1A2E5A" },
      });
      rel.recomendacoes.forEach((r, i) => {
        slideRecs.addShape(pptx.ShapeType?.rect ?? "rect", {
          x: 0.5, y: 1.15 + i * 0.75, w: 0.35, h: 0.35,
          fill: { color: "1E4FAB" }, line: { color: "1E4FAB" },
        });
        slideRecs.addText(String(i + 1), {
          x: 0.5, y: 1.15 + i * 0.75, w: 0.35, h: 0.35,
          fontSize: 12, bold: true, color: "FFFFFF", align: "center", valign: "middle",
        });
        slideRecs.addText(r, {
          x: 0.95, y: 1.15 + i * 0.75, w: 8.5, h: 0.55,
          fontSize: 13, color: "374151",
        });
      });
    }

    // Slide 7 — Próximas ações
    const slideAcoes = pptx.addSlide();
    slideAcoes.background = { color: "F4F6FA" };
    slideAcoes.addText("Próximas Ações", {
      x: 0.5, y: 0.3, w: 9, h: 0.6,
      fontSize: 22, bold: true, color: "1A2E5A",
    });
    slideAcoes.addShape(pptx.ShapeType?.rect ?? "rect", {
      x: 0.5, y: 0.95, w: 9, h: 0.04, fill: { color: "1A2E5A" },
    });
    slideAcoes.addText(
      "Com base neste relatório, sugerimos que a equipe comercial:\n\n1. Revise e priorize as ações identificadas acima\n2. Crie tarefas no CRM para cada ação prioritária\n3. Defina responsáveis e prazos claros\n4. Acompanhe a evolução no próximo briefing semanal",
      {
        x: 0.6, y: 1.2, w: 8.8, h: 3.5,
        fontSize: 14, color: "374151", lineSpacingMultiple: 1.6,
      }
    );
    slideAcoes.addText("Gerado por CRM IA · Villa Empreendimentos", {
      x: 0.5, y: 5.1, w: 9, h: 0.4,
      fontSize: 11, color: "98A2B3", align: "center",
    });

    await pptx.writeFile({ fileName: `${rel.titulo}.pptx` });
  }

  const sugestoesRapidas = [
    "Briefing do dia",
    "Propostas paradas",
    "Buscar contatos",
    "Gerar PDF do pipeline",
    "Atividades desta semana",
    "Gerar Excel de oportunidades",
    "Clientes sem contato",
    "PowerPoint para reunião",
  ];

  return (
    <>
      {/* Botão flutuante */}
      {!aberto && (
        <button
          onClick={() => setAberto(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-[#1A2E5A] px-4 py-3 text-white shadow-lg transition hover:bg-[#1E4FAB] hover:scale-105 active:scale-95"
          aria-label="Abrir CRM IA"
        >
          <Bot className="size-5" />
          <span className="text-sm font-semibold">CRM IA</span>
        </button>
      )}

      {/* Painel do chat */}
      {aberto && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl border border-[#D7DEEA] bg-white shadow-2xl transition-all duration-300 ${modoRecepcao ? "w-[520px]" : "w-[390px]"}`}
          style={{ maxHeight: "min(680px, calc(100vh - 48px))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-2xl bg-[#1A2E5A] px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-white/20">
                <Bot className="size-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">CRM IA</p>
                <p className="text-[10px] text-blue-200">Análise · PDF · Excel · PowerPoint · Ações</p>
              </div>
            </div>
            <button
              onClick={() => setAberto(false)}
              className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white transition"
              aria-label="Fechar"
            >
              <ChevronDown className="size-5" />
            </button>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0 }}>
            {mensagens.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="mr-2 mt-1 flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-[#E8EEFB]">
                    <Bot className="size-3 text-[#1A2E5A]" />
                  </div>
                )}
                <div className="flex flex-col gap-1.5 max-w-[85%]">
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#1A2E5A] text-white rounded-tr-sm"
                        : "bg-[#F4F6FA] text-[#1A2E5A] rounded-tl-sm"
                    }`}
                  >
                    {renderTexto(msg.content)}
                  </div>

                  {/* Botões de exportação */}
                  {msg.relatorio && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => abrirRelatorio(msg.relatorio!)}
                          className="flex items-center gap-1.5 rounded-lg bg-[#1A2E5A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1E4FAB] transition"
                        >
                          <span>📊</span>
                          <span>PDF com Gráfico</span>
                        </button>
                        <button
                          onClick={() => baixarExcel(msg.relatorio!)}
                          className="flex items-center gap-1.5 rounded-lg bg-[#166534] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#15803D] transition"
                        >
                          <span>📗</span>
                          <span>Planilha Excel</span>
                        </button>
                        <button
                          onClick={() => baixarPowerPoint(msg.relatorio!)}
                          className="flex items-center gap-1.5 rounded-lg bg-[#9A3412] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#C2410C] transition"
                        >
                          <span>🔑</span>
                          <span>PowerPoint</span>
                        </button>
                      </div>
                      <button
                        onClick={() => enviar("Com base neste relatório, crie tarefas de follow-up para a equipe com prioridades e prazos.")}
                        className="flex items-center gap-1.5 rounded-lg border border-[#1A2E5A] px-3 py-1.5 text-xs font-semibold text-[#1A2E5A] hover:bg-[#E8EEFB] transition"
                      >
                        <span>✅</span>
                        <span>Criar tarefas a partir deste relatório</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {carregando && (
              <div className="flex justify-start">
                <div className="mr-2 mt-1 flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-[#E8EEFB]">
                  <Bot className="size-3 text-[#1A2E5A]" />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-[#F4F6FA] px-3 py-2">
                  <Loader2 className="size-3.5 animate-spin text-[#1A2E5A]" />
                  <span className="text-xs text-[#667085]">Consultando o CRM...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Sugestões rápidas */}
          {mensagens.length === 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {sugestoesRapidas.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  className="rounded-full border border-[#D7DEEA] bg-white px-2.5 py-1 text-xs text-[#1A2E5A] hover:bg-[#E8EEFB] transition"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-[#D7DEEA] p-3">
            <div className="flex items-end gap-2 rounded-xl border border-[#D7DEEA] bg-[#F4F6FA] px-3 py-2 focus-within:border-[#1E4FAB] transition">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Peça um relatório, análise, PDF, Excel..."
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-[#1A2E5A] placeholder:text-[#98A2B3] outline-none"
                style={{ maxHeight: "80px" }}
                disabled={carregando}
              />
              <button
                onClick={() => enviar()}
                disabled={!input.trim() || carregando}
                className="flex size-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#1A2E5A] text-white transition hover:bg-[#1E4FAB] disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Enviar"
              >
                <Send className="size-3.5" />
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-[#98A2B3]">
              Enter para enviar · Shift+Enter para nova linha
            </p>
          </div>
        </div>
      )}
    </>
  );
}
