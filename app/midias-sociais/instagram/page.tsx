"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/midias-sociais/StatTile";
import { STATUS_CONEXAO_LABELS } from "@/lib/validations/rede-social";

type StatusConexao = "NAO_CONECTADO" | "CONECTADO" | "ERRO" | "TOKEN_EXPIRADO";

type RedeSocialConta = {
  id: string;
  rede: "INSTAGRAM" | "FACEBOOK" | "YOUTUBE";
  statusConexao: StatusConexao;
};

const STATUS_BADGE: Record<StatusConexao, string> = {
  NAO_CONECTADO: "bg-slate-100 text-slate-600 border border-slate-200",
  CONECTADO: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  ERRO: "bg-red-100 text-red-700 border border-red-200",
  TOKEN_EXPIRADO: "bg-amber-100 text-amber-800 border border-amber-200",
};

export default function MidiasSociaisInstagramPage() {
  const [statusConexao, setStatusConexao] = useState<StatusConexao>("NAO_CONECTADO");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      try {
        const response = await fetch("/api/midias-sociais/contas");
        if (!response.ok) return;
        const contas = (await response.json()) as RedeSocialConta[];
        const contaInstagram = contas.find((c) => c.rede === "INSTAGRAM");
        if (!cancelado) {
          setStatusConexao(contaInstagram?.statusConexao ?? "NAO_CONECTADO");
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, []);

  const conectado = statusConexao === "CONECTADO";

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#1E4FAB]">
            Mídias Sociais
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#1A2E5A]">Instagram</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
            @villapumps — audiência, conteúdo e leads gerados no Instagram.
          </p>
        </div>
        {!loading && (
          <Badge className={STATUS_BADGE[statusConexao]}>
            {STATUS_CONEXAO_LABELS[statusConexao]}
          </Badge>
        )}
      </header>

      {!conectado && !loading && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 size-4 flex-shrink-0" />
          <div>
            <p className="font-semibold">Aguardando conexão com a Meta</p>
            <p className="mt-0.5 text-xs leading-5 text-amber-700">
              Conecte a conta do Instagram em Mídias Sociais → Configurações para começar a
              receber dados reais.
            </p>
          </div>
        </div>
      )}

      <section className="mt-6">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[#1E4FAB]">
          Resultado comercial
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Investimento" emphasis="primary" />
          <StatTile label="Leads" emphasis="primary" />
          <StatTile label="Qualificados" emphasis="primary" />
          <StatTile label="Oportunidades" emphasis="primary" />
          <StatTile label="Valor proposto" emphasis="primary" />
          <StatTile label="Contratado" emphasis="primary" />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[#667085]">
          Aquisição e audiência
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatTile label="Alcance" />
          <StatTile label="Não seguidores alcançados" />
          <StatTile label="Visitas ao perfil" />
          <StatTile label="Mensagens diretas" />
          <StatTile label="Engajamento" />
        </div>
      </section>
    </div>
  );
}
