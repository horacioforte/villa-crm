"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  REDE_SOCIAL_LABELS,
  redeSocialTipoValues,
  STATUS_CONEXAO_LABELS,
} from "@/lib/validations/rede-social";

type RedeSocialTipo = (typeof redeSocialTipoValues)[number];
type StatusConexao = "NAO_CONECTADO" | "CONECTADO" | "ERRO" | "TOKEN_EXPIRADO";

type RedeSocialConta = {
  id: string;
  rede: RedeSocialTipo;
  nome: string;
  statusConexao: StatusConexao;
  ultimaSincronizacaoEm: string | null;
  createdBy: { id: string; nome: string | null } | null;
};

const STATUS_BADGE: Record<StatusConexao, string> = {
  NAO_CONECTADO: "bg-slate-100 text-slate-600 border border-slate-200",
  CONECTADO: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  ERRO: "bg-red-100 text-red-700 border border-red-200",
  TOKEN_EXPIRADO: "bg-amber-100 text-amber-800 border border-amber-200",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

// Configurações da Central de Mídias Sociais.
// Este formulário apenas cria o registro `RedeSocialConta` no banco (nome,
// IDs de negócio/página/conta de anúncios e o NOME da variável de ambiente
// que guardará o token). Nenhum valor de token é digitado ou armazenado
// aqui, e nenhuma chamada à API da Meta é feita — a conexão real (OAuth,
// Business Verification etc.) é trabalho da "trilha paralela" do Horacio.
export default function MidiasSociaisConfiguracoesPage() {
  const [contas, setContas] = useState<RedeSocialConta[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroCarregar, setErroCarregar] = useState(false);
  const [papel, setPapel] = useState<string | null>(null);

  const [rede, setRede] = useState<RedeSocialTipo>("INSTAGRAM");
  const [nome, setNome] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [pageId, setPageId] = useState("");
  const [contaAnunciosId, setContaAnunciosId] = useState("");
  const [accessTokenEnvVar, setAccessTokenEnvVar] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setLoading(true);
    setErroCarregar(false);
    try {
      const response = await fetch("/api/midias-sociais/contas");
      if (!response.ok) throw new Error();
      setContas(await response.json());
    } catch {
      setErroCarregar(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    async function loadSession() {
      const response = await fetch("/api/auth/session");
      if (!response.ok) return;
      const session = await response.json();
      setPapel(session?.user?.papel ?? null);
    }
    loadSession();
  }, []);

  const isAdmin = papel === "ADMIN";

  async function registrar() {
    if (!nome.trim()) {
      toast.error("Informe um nome para identificar a conta.");
      return;
    }
    setSalvando(true);
    try {
      const response = await fetch("/api/midias-sociais/contas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rede,
          nome,
          businessId: businessId || undefined,
          pageId: pageId || undefined,
          contaAnunciosId: contaAnunciosId || undefined,
          accessTokenEnvVar: accessTokenEnvVar || undefined,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message ?? "Falha ao registrar a conta.");
      }

      toast.success(`${REDE_SOCIAL_LABELS[rede]} registrado. Conexão com a Meta ainda pendente.`);
      setNome("");
      setBusinessId("");
      setPageId("");
      setContaAnunciosId("");
      setAccessTokenEnvVar("");
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao registrar a conta.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#1E4FAB]">
          Mídias Sociais
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[#1A2E5A]">Configurações</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
          Cadastro das contas de rede social conectadas à Central de Mídias Sociais. Nenhuma
          credencial é armazenada aqui — apenas o nome da variável de ambiente que guarda o
          token no servidor.
        </p>
      </header>

      <Card className="mt-6 rounded-3xl border-[#D7DEEA]">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-[#1A2E5A]">Contas cadastradas</CardTitle>
          <CardDescription>Status de conexão e última sincronização por rede.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-[#667085]">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : erroCarregar ? (
            <div className="flex items-center gap-2 rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] px-4 py-3 text-sm text-[#667085]">
              <AlertCircle className="size-4 flex-shrink-0" />
              Não foi possível carregar as contas cadastradas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#D7DEEA] text-left text-xs font-bold uppercase tracking-wide text-[#98A2B3]">
                    <th className="py-2 pr-4">Rede</th>
                    <th className="py-2 pr-4">Nome</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Última sincronização</th>
                    <th className="py-2 pr-4">Cadastrado por</th>
                  </tr>
                </thead>
                <tbody>
                  {redeSocialTipoValues.map((r) => {
                    const conta = contas.find((c) => c.rede === r);
                    return (
                      <tr key={r} className="border-b border-[#F0F2F7]">
                        <td className="py-3 pr-4 font-semibold text-[#1A2E5A]">
                          {REDE_SOCIAL_LABELS[r]}
                        </td>
                        <td className="py-3 pr-4 text-[#334155]">{conta?.nome ?? "—"}</td>
                        <td className="py-3 pr-4">
                          <Badge className={STATUS_BADGE[conta?.statusConexao ?? "NAO_CONECTADO"]}>
                            {STATUS_CONEXAO_LABELS[conta?.statusConexao ?? "NAO_CONECTADO"]}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-xs text-[#667085]">
                          {formatDate(conta?.ultimaSincronizacaoEm ?? null)}
                        </td>
                        <td className="py-3 pr-4 text-xs text-[#667085]">
                          {conta?.createdBy?.nome ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin ? (
        <Card className="mt-6 rounded-3xl border-[#D7DEEA]">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-[#1A2E5A]">
              Registrar nova conta
            </CardTitle>
            <CardDescription>
              Cria apenas o registro de configuração. A conexão real com a Meta (OAuth, tokens)
              é feita em uma etapa futura — este cadastro não chama nenhuma API externa.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[#1E4FAB]">
                Rede
                <select
                  value={rede}
                  onChange={(e) => setRede(e.target.value as RedeSocialTipo)}
                  className="h-11 rounded-2xl border border-[#D7DEEA] bg-white px-3 text-sm font-normal normal-case text-[#172033]"
                >
                  {redeSocialTipoValues.map((r) => (
                    <option key={r} value={r}>
                      {REDE_SOCIAL_LABELS[r]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[#1E4FAB]">
                Nome de identificação
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: @villapumps"
                  className="h-11 rounded-2xl border border-[#D7DEEA] bg-white px-3 text-sm font-normal normal-case text-[#172033]"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[#1E4FAB]">
                Business ID (opcional)
                <input
                  value={businessId}
                  onChange={(e) => setBusinessId(e.target.value)}
                  className="h-11 rounded-2xl border border-[#D7DEEA] bg-white px-3 text-sm font-normal normal-case text-[#172033]"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[#1E4FAB]">
                Page ID (opcional)
                <input
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  className="h-11 rounded-2xl border border-[#D7DEEA] bg-white px-3 text-sm font-normal normal-case text-[#172033]"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[#1E4FAB]">
                Conta de anúncios (opcional)
                <input
                  value={contaAnunciosId}
                  onChange={(e) => setContaAnunciosId(e.target.value)}
                  className="h-11 rounded-2xl border border-[#D7DEEA] bg-white px-3 text-sm font-normal normal-case text-[#172033]"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[#1E4FAB]">
                Variável de ambiente do token (opcional)
                <input
                  value={accessTokenEnvVar}
                  onChange={(e) => setAccessTokenEnvVar(e.target.value)}
                  placeholder="Ex: META_INSTAGRAM_ACCESS_TOKEN"
                  className="h-11 rounded-2xl border border-[#D7DEEA] bg-white px-3 text-sm font-normal normal-case text-[#172033]"
                />
              </label>
            </div>

            <Button
              type="button"
              disabled={salvando}
              onClick={registrar}
              className="h-11 w-fit rounded-2xl bg-[#1E4FAB] text-sm font-bold uppercase tracking-wide text-white hover:bg-[#1A2E5A]"
            >
              {salvando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCcw className="size-4" />
              )}
              Registrar conta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 rounded-2xl border border-[#D7DEEA] bg-white px-4 py-3 text-sm text-[#667085]">
          Apenas administradores podem cadastrar ou alterar contas de mídias sociais.
        </div>
      )}
    </div>
  );
}
