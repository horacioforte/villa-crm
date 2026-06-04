import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

type SaudeComercialResumo = {
  indicadores: {
    oportunidadesAbertas: number;
    oportunidadesSemProximaAcao: number;
    tarefasVencidas: number;
    propostasAguardandoRetorno: number;
    cumprimentoCadencia: number;
    taxaConclusaoTarefas: number;
    saudeGeral: { label: string; score: number };
  };
};

function getMissingConfig() {
  return [
    "CRON_SECRET",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS",
    "SMTP_FROM",
    "SAUDE_COMERCIAL_EMAIL_TO",
  ].filter((key) => !process.env[key]);
}

function assertCronAuth(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  return Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);
}

export async function GET(request: Request) {
  if (!assertCronAuth(request)) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  const missingConfig = getMissingConfig();
  if (missingConfig.length > 0) {
    return NextResponse.json(
      {
        message: "Rotina semanal pronta, mas falta configurar envio de e-mail.",
        missingConfig,
      },
      { status: 428 },
    );
  }

  const origin = new URL(request.url).origin;
  const authHeader = request.headers.get("authorization") ?? "";
  const dataUrl = new URL("/api/saude-comercial?periodo=7d", origin);
  const pdfUrl = new URL("/api/saude-comercial/pdf?periodo=7d", origin);
  const [dataResponse, pdfResponse] = await Promise.all([
    fetch(dataUrl, { headers: { authorization: authHeader } }),
    fetch(pdfUrl, { headers: { authorization: authHeader } }),
  ]);

  if (!dataResponse.ok || !pdfResponse.ok) {
    return NextResponse.json(
      { message: "Não foi possível gerar o relatório semanal." },
      { status: 500 },
    );
  }

  const data = (await dataResponse.json()) as SaudeComercialResumo;
  const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  const destinatarios = process.env.SAUDE_COMERCIAL_EMAIL_TO ?? "";

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: destinatarios,
    subject: "Relatório Semanal de Saúde Comercial",
    text: [
      "Resumo dos principais indicadores da Saúde Comercial da Villa:",
      "",
      `Saúde geral: ${data.indicadores.saudeGeral.label} (${data.indicadores.saudeGeral.score}/100)`,
      `Oportunidades abertas: ${data.indicadores.oportunidadesAbertas}`,
      `Sem próxima ação: ${data.indicadores.oportunidadesSemProximaAcao}`,
      `Tarefas vencidas: ${data.indicadores.tarefasVencidas}`,
      `Propostas sem retorno: ${data.indicadores.propostasAguardandoRetorno}`,
      `Cumprimento da cadência: ${data.indicadores.cumprimentoCadencia}%`,
      `Conclusão de tarefas: ${data.indicadores.taxaConclusaoTarefas}%`,
    ].join("\n"),
    attachments: [
      {
        filename: `relatorio-saude-comercial-${new Date()
          .toISOString()
          .slice(0, 10)}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  return NextResponse.json({
    message: "Relatório semanal de Saúde Comercial enviado.",
    destinatarios: destinatarios.split(",").map((email) => email.trim()),
  });
}
