// ARQUIVO: app/api/agent/campanha-email/route.ts
// Endpoint de campanhas de email outbound do João — Villa Empreendimentos
// Autenticação machine-to-machine via Bearer AGENT_API_KEY
// Envia via Brevo a partir de joao.comercial@villaempreendimentos.com.br
// REGRA: nunca remover. Apenas acrescentar.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// ─── Auth ─────────────────────────────────────────────────────────────────────

function verificarApiKey(req: NextRequest): boolean {
  const apiKey = process.env.AGENT_API_KEY;
  if (!apiKey) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${apiKey}`;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const destinatarioSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  empresa: z.string().min(1),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  cargo: z.string().optional(),
  segmento: z.string().optional(),
  observacoes: z.string().optional(),
});

const campanhaEmailSchema = z.object({
  tipo: z.enum(["PRE_MOLDADO", "OBRA", "GENERICO"]),
  destinatarios: z.array(destinatarioSchema).min(1).max(200),
  equipamentoDestaque: z.string().optional(),
  customSubject: z.string().optional(),
  customIntro: z.string().optional(),
});

type Destinatario = z.infer<typeof destinatarioSchema>;
type TipoCampanha = "PRE_MOLDADO" | "OBRA" | "GENERICO";

// ─── Templates de Email ───────────────────────────────────────────────────────

function gerarSubject(tipo: TipoCampanha, d: Destinatario, equipamento?: string): string {
  if (tipo === "PRE_MOLDADO") {
    return `Caminhões betoneira e autobomba seminovos disponíveis`;
  }
  if (tipo === "OBRA") {
    return `Solução em bombeamento de concreto para ${d.empresa} — Villa Empreendimentos`;
  }
  return `Villa Empreendimentos — Soluções em bombeamento de concreto`;
}

function gerarHtmlEmail(tipo: TipoCampanha, d: Destinatario, equipamento?: string): string {
  const saudacao = d.cargo
    ? `${d.cargo} ${d.nome.split(" ")[0]}`
    : d.nome.split(" ")[0];

  const cidade = d.cidade && d.estado ? ` em ${d.cidade}/${d.estado}` : "";

  const corpos: Record<TipoCampanha, string> = {
    PRE_MOLDADO: `
      <p>Olá, tudo bem?</p>

      <p>Meu nome é João e faço parte do <strong>Grupo Villa Empreendimentos</strong>, uma das maiores
      empresas especializadas em equipamentos para concreto do Brasil.</p>

      <p>Estamos renovando parte da nossa frota e disponibilizando <strong>caminhões betoneira e
      caminhões autobomba seminovos</strong>, revisados e prontos para operação.</p>

      <p>Para empresas de pré-moldados, concreteiras e construtoras, pode ser uma oportunidade de ampliar
      a capacidade produtiva com um investimento muito inferior ao de um equipamento novo.</p>

      <p>Temos opções de:</p>
      <ul style="margin:0 0 16px;padding-left:20px;color:#333333;font-size:15px;line-height:1.9;">
        <li>✅ Caminhões betoneira</li>
        <li>✅ Caminhões autobomba</li>
        <li>✅ Equipamentos revisados e em operação</li>
        <li>✅ Possibilidade de apoio técnico e orientação operacional</li>
      </ul>

      <p>Caso tenha interesse em receber fotos, especificações técnicas e valores, basta responder
      este e-mail ou falar diretamente conosco pelo WhatsApp.</p>
    `,

    OBRA: `
      <p>Olá, ${saudacao}!</p>

      <p>Meu nome é João e sou do time comercial da <strong>Villa Empreendimentos</strong> —
      referência nacional em locação e venda de equipamentos para bombeamento de concreto desde 2007.</p>

      <p>Acompanhamos de perto projetos de infraestrutura e construção em todo o Brasil, e
      identificamos que a <strong>${d.empresa}</strong> tem projetos${cidade} onde podemos
      contribuir com nossa solução.</p>

      <p>Contamos com frota completa de <strong>bombas lança (28 a 58m de alcance),
      bombas estacionárias, caminhões betoneira e centrais de concreto</strong>,
      com atendimento em todo o território nacional — incluindo filiais em São Paulo e Belo Horizonte.</p>

      <p>Posso apresentar nossa proposta para o projeto de vocês?
      É rápido — 15 minutos e você tem uma avaliação técnica completa.</p>
    `,

    GENERICO: `
      <p>Olá, ${saudacao}!</p>

      <p>Meu nome é João e faço parte do time comercial da <strong>Villa Empreendimentos</strong>.</p>

      <p>Somos uma das maiores empresas do Brasil em locação e venda de equipamentos para
      bombeamento e transporte de concreto, atuando em todo o território nacional desde 2007.</p>

      <p>Nossa linha completa inclui <strong>bombas lança (28 a 58m), bombas estacionárias,
      caminhões betoneira, Telebelt e centrais de concreto</strong>,
      além de equipamentos usados disponíveis para venda.</p>

      <p>Gostaria de entender melhor as necessidades da <strong>${d.empresa}</strong> e verificar
      se podemos agregar valor aos projetos de vocês.</p>

      <p>Podemos conversar rapidamente?</p>
    `,
  };

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f6fa;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

          <!-- Header -->
          <tr>
            <td style="background:#1A2E5A;padding:28px 40px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;">Villa Empreendimentos</p>
              <p style="margin:4px 0 0;color:#a8bbdd;font-size:13px;">Soluções em Bombeamento de Concreto</p>
            </td>
          </tr>

          <!-- Corpo -->
          <tr>
            <td style="padding:36px 40px;color:#333333;font-size:15px;line-height:1.7;">
              ${corpos[tipo]}
            </td>
          </tr>

          <!-- Assinatura -->
          <tr>
            <td style="padding:0 40px 36px;">
              <table cellpadding="0" cellspacing="0" style="border-top:2px solid #E8EEFB;padding-top:20px;width:100%;">
                <tr>
                  <td>
                    <p style="margin:0;font-size:15px;font-weight:bold;color:#1A2E5A;">João</p>
                    <p style="margin:2px 0 0;font-size:13px;color:#667085;">Hunter Comercial — Grupo Villa Empreendimentos</p>
                    <p style="margin:8px 0 0;font-size:13px;color:#667085;">
                      📧 joao.comercial@villaempreendimentos.com.br<br>
                      📞 (81) 3325-1144<br>
                      🌐 <a href="https://villaempreendimentos.com.br" style="color:#1E4FAB;text-decoration:none;">villaempreendimentos.com.br</a>
                    </p>
                    <p style="margin:12px 0 0;font-size:12px;color:#999;">
                      Matriz: Recife-PE &nbsp;|&nbsp; Filiais: São Paulo-SP e Belo Horizonte-MG
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f4f6fa;padding:16px 40px;border-top:1px solid #D7DEEA;">
              <p style="margin:0;font-size:11px;color:#999;text-align:center;">
                Você está recebendo este e-mail porque sua empresa atua em um segmento que atendemos.<br>
                Para não receber mais mensagens, responda com "descadastrar".
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ─── Envio via Brevo ──────────────────────────────────────────────────────────

async function enviarEmailBrevo(
  destinatario: Destinatario,
  subject: string,
  htmlContent: string,
): Promise<{ ok: boolean; status: number; body: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { ok: false, status: 500, body: "BREVO_API_KEY não configurada." };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "João — Villa Empreendimentos",
          email: "maria.comercial@villaempreendimentos.com.br",
        },
        to: [{ email: destinatario.email, name: destinatario.nome }],
        replyTo: {
          email: "joao.comercial@villaempreendimentos.com.br",
          name: "João — Villa Empreendimentos",
        },
        subject,
        htmlContent,
      }),
    });

    const body = await response.text().catch(() => "");
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return { ok: false, status: 500, body: String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── POST — disparar campanha ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!verificarApiKey(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const parsed = campanhaEmailSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { tipo, destinatarios, equipamentoDestaque } = parsed.data;

  const resultados: Array<{
    email: string;
    empresa: string;
    status: "enviado" | "erro";
    detalhe?: string;
  }> = [];

  for (const destinatario of destinatarios) {
    const subject = gerarSubject(tipo, destinatario, equipamentoDestaque);
    const html = gerarHtmlEmail(tipo, destinatario, equipamentoDestaque);

    // Delay entre envios para evitar throttling do Brevo
    if (resultados.length > 0) {
      await new Promise((r) => setTimeout(r, 300));
    }

    const resultado = await enviarEmailBrevo(destinatario, subject, html);

    if (resultado.ok) {
      resultados.push({ email: destinatario.email, empresa: destinatario.empresa, status: "enviado" });
      console.info("[JOAO EMAIL] Enviado:", { email: destinatario.email, empresa: destinatario.empresa });
    } else {
      resultados.push({
        email: destinatario.email,
        empresa: destinatario.empresa,
        status: "erro",
        detalhe: resultado.body,
      });
      console.error("[JOAO EMAIL] Erro:", { email: destinatario.email, status: resultado.status, body: resultado.body });
    }
  }

  const enviados = resultados.filter((r) => r.status === "enviado").length;
  const erros = resultados.filter((r) => r.status === "erro").length;

  return NextResponse.json(
    {
      sucesso: true,
      resumo: {
        total: destinatarios.length,
        enviados,
        erros,
      },
      resultados,
    },
    { status: 200 },
  );
}

// ─── GET — health check ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!verificarApiKey(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  return NextResponse.json({
    status: "ok",
    agente: "João — Campanha de Email",
    remetente: "joao.comercial@villaempreendimentos.com.br",
    tipos: ["PRE_MOLDADO", "OBRA", "GENERICO"],
    limite: "200 destinatários por chamada",
    timestamp: new Date().toISOString(),
  });
}
