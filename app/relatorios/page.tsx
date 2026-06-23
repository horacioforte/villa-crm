"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart2, Download, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { PageNavigation } from "@/components/layout/PageNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AbaRelatorio = "oportunidades" | "propostas" | "pipeline";
type SortDirection = "asc" | "desc";

type UsuarioResumo = {
  id: string;
  nome: string;
};

type OportunidadeRelatorio = {
  id: string;
  titulo: string;
  status: string;
  tipo: string;
  tipoServico: string | null;
  temperatura: string | null;
  potencialOportunidade: string | number | null;
  valorProposto: number;
  valorContrato: string | number | null;
  canalOrigem: string | null;
  previsaoFechamento: string | null;
  createdAt: string;
  empresa: { razaoSocial: string; nomeFantasia: string | null };
  obra: { nome: string; cidade: string | null; estado: string | null } | null;
  pessoa: { nome: string } | null;
  responsavel: { nome: string } | null;
  _totalPropostas: number;
};

type PropostaRelatorio = {
  id: string;
  numeroProposta: string;
  versao: number;
  ativa: boolean;
  status: string;
  templateUtilizado: string;
  valorTotal: string | number;
  validadeProposta: string;
  createdAt: string;
  oportunidade: {
    titulo: string;
    empresa: { razaoSocial: string; nomeFantasia: string | null };
    obra: { nome: string; cidade: string | null; estado: string | null } | null;
    responsavel: { nome: string } | null;
  };
  criadoPor: { nome: string } | null;
};

type PipelineRelatorio = {
  totalPotencial: number;
  totalProposto: number;
  totalContratado: number;
  oportunidadesPorStatus: Array<{
    status: string;
    quantidade: number;
    valorPotencial: number;
  }>;
  propostasPorStatus: Array<{
    status: string;
    quantidade: number;
    valorTotal: number;
  }>;
  topClientes: Array<{
    empresa: string;
    valorProposto: number;
    quantidadeOportunidades: number;
  }>;
  porEstado: Array<{
    estado: string;
    quantidade: number;
    valorPotencial: number;
    valorProposto: number;
  }>;
  porTemperatura: Array<{
    temperatura: string;
    quantidade: number;
    valorProposto: number;
  }>;
  porOrigem: Array<{
    canalOrigem: string;
    quantidade: number;
    valorPotencial: number;
    valorProposto: number;
  }>;
  evolucaoMensal: Array<{
    mes: string;
    oportunidadesCriadas: number;
    propostasGeradas: number;
    valorProposto: number;
  }>;
};

const statusOportunidade = [
  "NOVA",
  "EM_ATENDIMENTO",
  "PROPOSTA_ENVIADA",
  "NEGOCIACAO",
  "GANHA",
  "PERDIDA",
];
const statusProposta = [
  "RASCUNHO",
  "AGUARDANDO_APROVACAO",
  "ENVIADA",
  "APROVADA",
  "ACEITA",
  "REJEITADA",
  "VENCIDA",
  "CANCELADA",
];
const templates = [
  "locacao-betoneira-com-operador",
  "locacao-betoneira-sem-operador",
  "locacao-bomba-concreto-com-operacao",
];
const temperaturaOptions = [
  { value: "QUENTE", label: "Quente" },
  { value: "MEDIA", label: "Média" },
  { value: "FRIA", label: "Fria" },
  { value: "sem_classificacao", label: "Sem classificação" },
];
const canalOrigemLabels: Record<string, string> = {
  INDICACAO: "Indicação",
  CLIENTE_ATUAL: "Cliente atual",
  OBRA_MAPEADA: "Obra mapeada",
  GOOGLE: "Google",
  LINKEDIN: "LinkedIn",
  SITE: "Site",
  VISITA_COMERCIAL: "Visita comercial",
  MARKETPLACE: "Marketplace",
  OLX: "OLX",
  EVENTO: "Evento",
  OUTROS: "Outros",
  "Não informado": "Não informado",
};
const canalOrigemOptions = Object.entries(canalOrigemLabels)
  .filter(([value]) => value !== "Não informado")
  .map(([value, label]) => ({ value, label }));

function formatCurrency(value: string | number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

function getCliente(row: { empresa: { razaoSocial: string; nomeFantasia: string | null } }) {
  return row.empresa.nomeFantasia ?? row.empresa.razaoSocial;
}

function buildQuery(filters: Record<string, string>, formato?: string) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== "__all" && value !== "_all") {
      params.set(key, value);
    }
  });

  if (formato) {
    params.set("formato", formato);
  }

  return params.toString();
}

function downloadRelatorio(url: string) {
  window.open(url, "_blank");
}

function FilterField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs font-semibold uppercase tracking-wide text-[#667085]">
        {label}
      </span>
      {children}
    </div>
  );
}

function CardTotal({
  label,
  value,
  type = "currency",
}: {
  label: string;
  value: number;
  type?: "currency" | "number";
}) {
  return (
    <Card className="rounded-3xl border-[#D7DEEA] bg-white">
      <CardContent className="p-4">
        <p className="text-sm text-[#667085]">{label}</p>
        <p className="mt-2 text-2xl font-bold text-[#1A2E5A]">
          {type === "currency" ? formatCurrency(value) : value}
        </p>
      </CardContent>
    </Card>
  );
}

function SortableTable<T>({
  rows,
  columns,
}: {
  rows: T[];
  columns: Array<{
    key: string;
    label: string;
    value: (row: T) => string | number;
    render?: (row: T) => React.ReactNode;
    className?: string;
  }>;
}) {
  const [sortKey, setSortKey] = useState(columns[0]?.key ?? "");
  const [direction, setDirection] = useState<SortDirection>("asc");
  const sortedRows = useMemo(() => {
    const column = columns.find((item) => item.key === sortKey) ?? columns[0];
    if (!column) return rows;

    return [...rows].sort((a, b) => {
      const aValue = column.value(a);
      const bValue = column.value(b);
      const result =
        typeof aValue === "number" && typeof bValue === "number"
          ? aValue - bValue
          : String(aValue).localeCompare(String(bValue), "pt-BR");

      return direction === "asc" ? result : -result;
    });
  }, [columns, direction, rows, sortKey]);

  return (
    <div className="overflow-x-auto rounded-3xl border border-[#D7DEEA] bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[#1A2E5A] text-white">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="whitespace-nowrap px-3 py-3">
                <button
                  type="button"
                  onClick={() => {
                    if (sortKey === column.key) {
                      setDirection((current) =>
                        current === "asc" ? "desc" : "asc",
                      );
                    } else {
                      setSortKey(column.key);
                      setDirection("asc");
                    }
                  }}
                  className="font-semibold"
                >
                  {column.label}
                  {sortKey === column.key ? (direction === "asc" ? " ↑" : " ↓") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, index) => (
            <tr key={index} className="border-t border-[#D7DEEA]">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`whitespace-nowrap px-3 py-3 text-[#1A2E5A] ${column.className ?? ""}`}
                >
                  {column.render ? column.render(row) : column.value(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  placeholder,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <FilterField label={label} className="min-w-48">
      <Select value={value} onValueChange={(nextValue) => onChange(nextValue ?? "__all")}>
        <SelectTrigger className="h-11 w-full rounded-2xl bg-white">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  );
}

function useUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioResumo[]>([]);

  useEffect(() => {
    async function loadUsuarios() {
      const response = await fetch("/api/usuarios");
      if (!response.ok) return;

      const data = await response.json();
      setUsuarios(Array.isArray(data) ? data : []);
    }

    loadUsuarios();
  }, []);

  return usuarios;
}

function useEstadosDisponiveis() {
  const [estados, setEstados] = useState<string[]>([]);

  useEffect(() => {
    async function loadEstados() {
      const response = await fetch("/api/relatorios/estados");
      if (!response.ok) return;

      const data = await response.json();
      setEstados(Array.isArray(data.estados) ? data.estados : []);
    }

    loadEstados();
  }, []);

  return estados;
}

function RelatorioOportunidades() {
  const usuarios = useUsuarios();
  const estadosDisponiveis = useEstadosDisponiveis();
  const [data, setData] = useState<OportunidadeRelatorio[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState({
    dataInicio: "",
    dataFim: "",
    status: "__all",
    estado: "__all",
    temperatura: "__all",
    canalOrigem: "__all",
    responsavelId: "__all",
  });

  async function buscar() {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/relatorios/oportunidades?${buildQuery(filters)}`,
      );
      if (!response.ok) throw new Error("Falha ao carregar relatório.");
      setData(await response.json());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao buscar.");
    } finally {
      setIsLoading(false);
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    buscar();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const totals = {
    potencial: data.reduce(
      (sum, row) => sum + Number(row.potencialOportunidade ?? 0),
      0,
    ),
    proposto: data.reduce((sum, row) => sum + row.valorProposto, 0),
    contrato: data.reduce((sum, row) => sum + Number(row.valorContrato ?? 0), 0),
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <FilterField label="Início" className="w-40">
          <Input
            type="date"
            value={filters.dataInicio}
            onChange={(event) =>
              setFilters((current) => ({ ...current, dataInicio: event.target.value }))
            }
            className="h-11 w-full rounded-2xl bg-white"
          />
        </FilterField>
        <FilterField label="Fim" className="w-40">
          <Input
            type="date"
            value={filters.dataFim}
            onChange={(event) =>
              setFilters((current) => ({ ...current, dataFim: event.target.value }))
            }
            className="h-11 w-full rounded-2xl bg-white"
          />
        </FilterField>
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(status) => setFilters((current) => ({ ...current, status }))}
          placeholder="Todos os status"
          options={statusOportunidade.map((status) => ({ value: status, label: status }))}
        />
        <FilterSelect
          label="Estado"
          value={filters.estado}
          onChange={(estado) => setFilters((current) => ({ ...current, estado }))}
          placeholder="Todos os estados"
          options={estadosDisponiveis.map((estado) => ({
            value: estado,
            label: estado,
          }))}
        />
        <FilterSelect
          label="Temperatura"
          value={filters.temperatura}
          onChange={(temperatura) =>
            setFilters((current) => ({ ...current, temperatura }))
          }
          placeholder="Todas as temperaturas"
          options={temperaturaOptions}
        />
        <FilterSelect
          label="Origem"
          value={filters.canalOrigem}
          onChange={(canalOrigem) =>
            setFilters((current) => ({ ...current, canalOrigem }))
          }
          placeholder="Todas as origens"
          options={canalOrigemOptions}
        />
        <FilterSelect
          label="Responsável"
          value={filters.responsavelId}
          onChange={(responsavelId) =>
            setFilters((current) => ({ ...current, responsavelId }))
          }
          placeholder="Todos os responsáveis"
          options={usuarios.map((usuario) => ({
            value: usuario.id,
            label: usuario.nome,
          }))}
        />
        <Button onClick={buscar} className="h-11 rounded-2xl bg-[#1E4FAB] text-white">
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Buscar
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            downloadRelatorio(
              `/api/relatorios/oportunidades?${buildQuery(filters, "xlsx")}`,
            )
          }
          className="h-11 rounded-2xl"
        >
          <Download className="size-4" />
          Excel
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            downloadRelatorio(
              `/api/relatorios/oportunidades?${buildQuery(filters, "pdf")}`,
            )
          }
          className="h-11 rounded-2xl"
        >
          <Download className="size-4" />
          PDF
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <CardTotal label="Total de oportunidades" value={data.length} type="number" />
        <CardTotal label="Valor potencial" value={totals.potencial} />
        <CardTotal label="Valor proposto" value={totals.proposto} />
        <CardTotal label="Valor contratado" value={totals.contrato} />
      </div>
      <SortableTable
        rows={data}
        columns={[
          { key: "cliente", label: "Cliente", value: (row) => getCliente(row) },
          {
            key: "obra",
            label: "Obra",
            value: (row) => row.obra?.nome ?? "",
          },
          { key: "contato", label: "Contato", value: (row) => row.pessoa?.nome ?? "" },
          {
            key: "responsavel",
            label: "Responsável",
            value: (row) => row.responsavel?.nome ?? "",
          },
          { key: "tipo", label: "Tipo", value: (row) => row.tipoServico ?? row.tipo },
          { key: "status", label: "Status", value: (row) => row.status },
          {
            key: "temperatura",
            label: "Temperatura",
            value: (row) => row.temperatura ?? "",
          },
          { key: "origem", label: "Origem", value: (row) => row.canalOrigem ?? "" },
          {
            key: "potencial",
            label: "Potencial",
            value: (row) => Number(row.potencialOportunidade ?? 0),
            render: (row) => formatCurrency(row.potencialOportunidade),
          },
          {
            key: "proposto",
            label: "Proposto",
            value: (row) => row.valorProposto,
            render: (row) => formatCurrency(row.valorProposto),
          },
          {
            key: "contrato",
            label: "Contrato",
            value: (row) => Number(row.valorContrato ?? 0),
            render: (row) => formatCurrency(row.valorContrato),
          },
          {
            key: "previsao",
            label: "Previsão",
            value: (row) => row.previsaoFechamento ?? "",
            render: (row) => formatDate(row.previsaoFechamento),
          },
          {
            key: "createdAt",
            label: "Criada em",
            value: (row) => row.createdAt,
            render: (row) => formatDate(row.createdAt),
          },
          {
            key: "qtd",
            label: "Qtd. propostas",
            value: (row) => row._totalPropostas,
          },
        ]}
      />
    </section>
  );
}

function RelatorioPropostas() {
  const usuarios = useUsuarios();
  const [data, setData] = useState<PropostaRelatorio[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState({
    dataInicio: "",
    dataFim: "",
    status: "__all",
    templateUtilizado: "__all",
    responsavelId: "__all",
  });

  async function buscar() {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/relatorios/propostas?${buildQuery(filters)}`);
      if (!response.ok) throw new Error("Falha ao carregar relatório.");
      setData(await response.json());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao buscar.");
    } finally {
      setIsLoading(false);
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    buscar();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const total = data.reduce((sum, row) => sum + Number(row.valorTotal), 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <FilterField label="Início" className="w-40">
          <Input
            type="date"
            value={filters.dataInicio}
            onChange={(event) =>
              setFilters((current) => ({ ...current, dataInicio: event.target.value }))
            }
            className="h-11 w-full rounded-2xl bg-white"
          />
        </FilterField>
        <FilterField label="Fim" className="w-40">
          <Input
            type="date"
            value={filters.dataFim}
            onChange={(event) =>
              setFilters((current) => ({ ...current, dataFim: event.target.value }))
            }
            className="h-11 w-full rounded-2xl bg-white"
          />
        </FilterField>
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(status) => setFilters((current) => ({ ...current, status }))}
          placeholder="Todos os status"
          options={statusProposta.map((status) => ({ value: status, label: status }))}
        />
        <FilterSelect
          label="Template"
          value={filters.templateUtilizado}
          onChange={(templateUtilizado) =>
            setFilters((current) => ({ ...current, templateUtilizado }))
          }
          placeholder="Todos os templates"
          options={templates.map((template) => ({ value: template, label: template }))}
        />
        <FilterSelect
          label="Responsável"
          value={filters.responsavelId}
          onChange={(responsavelId) =>
            setFilters((current) => ({ ...current, responsavelId }))
          }
          placeholder="Todos os responsáveis"
          options={usuarios.map((usuario) => ({
            value: usuario.id,
            label: usuario.nome,
          }))}
        />
        <Button onClick={buscar} className="h-11 rounded-2xl bg-[#1E4FAB] text-white">
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Buscar
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            downloadRelatorio(
              `/api/relatorios/propostas?${buildQuery(filters, "xlsx")}`,
            )
          }
          className="h-11 rounded-2xl"
        >
          <Download className="size-4" />
          Excel
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            downloadRelatorio(
              `/api/relatorios/propostas?${buildQuery(filters, "pdf")}`,
            )
          }
          className="h-11 rounded-2xl"
        >
          <Download className="size-4" />
          PDF
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <CardTotal label="Total de propostas" value={data.length} type="number" />
        <CardTotal
          label="Versões ativas"
          value={data.filter((row) => row.ativa).length}
          type="number"
        />
        <CardTotal label="Valor total" value={total} />
      </div>
      <SortableTable
        rows={data}
        columns={[
          { key: "numero", label: "Número", value: (row) => row.numeroProposta },
          { key: "versao", label: "Versão", value: (row) => row.versao },
          {
            key: "ativa",
            label: "Ativa?",
            value: (row) => (row.ativa ? "Sim" : "Não"),
          },
          {
            key: "cliente",
            label: "Cliente",
            value: (row) => getCliente(row.oportunidade),
          },
          {
            key: "obra",
            label: "Obra",
            value: (row) => row.oportunidade.obra?.nome ?? "",
          },
          {
            key: "responsavel",
            label: "Responsável",
            value: (row) => row.oportunidade.responsavel?.nome ?? "",
          },
          { key: "template", label: "Template", value: (row) => row.templateUtilizado },
          { key: "status", label: "Status", value: (row) => row.status },
          {
            key: "valor",
            label: "Valor",
            value: (row) => Number(row.valorTotal),
            render: (row) => formatCurrency(row.valorTotal),
          },
          {
            key: "validade",
            label: "Validade",
            value: (row) => row.validadeProposta,
            render: (row) => formatDate(row.validadeProposta),
          },
          {
            key: "createdAt",
            label: "Gerada em",
            value: (row) => row.createdAt,
            render: (row) => formatDate(row.createdAt),
          },
          {
            key: "criadoPor",
            label: "Gerada por",
            value: (row) => row.criadoPor?.nome ?? "",
          },
        ]}
      />
    </section>
  );
}

function RelatorioPipeline() {
  const [data, setData] = useState<PipelineRelatorio | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function buscar() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/relatorios/pipeline");
        if (!response.ok) throw new Error("Falha ao carregar pipeline.");
        setData(await response.json());
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao buscar.");
      } finally {
        setIsLoading(false);
      }
    }

    buscar();
  }, []);

  if (isLoading || !data) {
    return (
      <div className="flex items-center rounded-3xl border border-[#D7DEEA] bg-white p-6 text-[#667085]">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Carregando pipeline...
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <CardTotal label="Valor potencial" value={data.totalPotencial} />
        <CardTotal label="Valor proposto" value={data.totalProposto} />
        <CardTotal label="Valor contratado" value={data.totalContratado} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ResumoTable
          title="Oportunidades por status"
          rows={data.oportunidadesPorStatus.map((item) => [
            item.status,
            item.quantidade,
            formatCurrency(item.valorPotencial),
          ])}
          headers={["Status", "Qtd.", "Valor potencial"]}
        />
        <ResumoTable
          title="Propostas por status"
          rows={data.propostasPorStatus.map((item) => [
            item.status,
            item.quantidade,
            formatCurrency(item.valorTotal),
          ])}
          headers={["Status", "Qtd.", "Valor total"]}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <ResumoTable
          title="Por Estado"
          rows={data.porEstado.map((item) => [
            item.estado,
            item.quantidade,
            formatCurrency(item.valorProposto),
          ])}
          headers={["Estado", "Qtd.", "Valor proposto"]}
        />
        <ResumoTable
          title="Por Temperatura"
          rows={data.porTemperatura.map((item) => [
            item.temperatura === "QUENTE"
              ? "Quente"
              : item.temperatura === "MEDIA"
                ? "Média"
                : item.temperatura === "FRIA"
                  ? "Fria"
                  : "Sem classificação",
            item.quantidade,
            formatCurrency(item.valorProposto),
          ])}
          headers={["Temperatura", "Qtd.", "Valor proposto"]}
        />
        <ResumoTable
          title="Por Origem"
          rows={data.porOrigem.map((item) => [
            canalOrigemLabels[item.canalOrigem] ?? item.canalOrigem,
            item.quantidade,
            formatCurrency(item.valorProposto),
          ])}
          headers={["Origem", "Qtd.", "Valor proposto"]}
        />
      </div>
      <ResumoTable
        title="Top 5 clientes por valor proposto"
        rows={data.topClientes.map((item) => [
          item.empresa,
          item.quantidadeOportunidades,
          formatCurrency(item.valorProposto),
        ])}
        headers={["Cliente", "Oportunidades", "Valor proposto"]}
      />
      <ResumoTable
        title="Evolução mensal"
        rows={data.evolucaoMensal.map((item) => [
          item.mes,
          item.oportunidadesCriadas,
          item.propostasGeradas,
          formatCurrency(item.valorProposto),
        ])}
        headers={["Mês", "Oportunidades", "Propostas", "Valor proposto"]}
      />
    </section>
  );
}

function ResumoTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <Card className="rounded-3xl border-[#D7DEEA] bg-white">
      <CardContent className="p-4">
        <h2 className="font-bold text-[#1A2E5A]">{title}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-[#667085]">
                {headers.map((header) => (
                  <th key={header} className="py-2 pr-4">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t border-[#D7DEEA]">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="py-2 pr-4 text-[#1A2E5A]">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RelatoriosPage() {
  const [aba, setAba] = useState<AbaRelatorio>("oportunidades");
  const tabs: Array<{ id: AbaRelatorio; label: string }> = [
    { id: "oportunidades", label: "Oportunidades" },
    { id: "propostas", label: "Propostas" },
    { id: "pipeline", label: "Pipeline" },
  ];

  return (
    <main className="min-h-screen bg-[#F4F6FA] p-4 text-[#1A2E5A] md:p-6">
      <PageNavigation currentPage="Relatórios" currentHref="/relatorios" />
      <div className="space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[#E8EEFB] p-3 text-[#1E4FAB]">
              <BarChart2 className="size-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#1A2E5A]">Relatórios</h1>
              <p className="mt-1 text-sm text-[#667085]">
                Oportunidades, propostas e pipeline comercial da Villa.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAba(tab.id)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  aba === tab.id
                    ? "bg-[#1E4FAB] text-white"
                    : "border border-[#D7DEEA] bg-white text-[#1A2E5A] hover:bg-[#F4F6FA]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {aba === "oportunidades" ? <RelatorioOportunidades /> : null}
        {aba === "propostas" ? <RelatorioPropostas /> : null}
        {aba === "pipeline" ? <RelatorioPipeline /> : null}
      </div>
    </main>
  );
}
