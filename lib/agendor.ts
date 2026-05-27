/**
 * lib/agendor.ts
 * ──────────────────────────────────────────────────────────────
 * Cliente da API Agendor v3 e funções de mapeamento para o
 * schema Prisma do Villa CRM.
 *
 * Configuração:
 *   Adicione no .env.local:
 *     AGENDOR_API_TOKEN=ced0f3c1-5015-4e83-9d91-89260c443903
 * ──────────────────────────────────────────────────────────────
 */

import { TipoOperacao, StatusOportunidade } from "@/app/generated/prisma/client";

// ─────────────────────────────────────────────────────────────
// TIPOS DA API AGENDOR
// ─────────────────────────────────────────────────────────────

export interface AgendorContact {
  work?: string | null;
  mobile?: string | null;
  whatsapp?: string | null;
  email?: string | null;
}

export interface AgendorAddress {
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  streetName?: string | null;
  streetNumber?: string | null;
  district?: string | null;
}

export interface AgendorOrganization {
  id: number;
  name: string;
  legalName?: string | null;
  cnpj?: string | null;
  email?: string | null;
  website?: string | null;
  description?: string | null;
  category?: string | null;
  sector?: string | null;
  contact?: AgendorContact | null;
  address?: AgendorAddress | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AgendorPerson {
  id: number;
  name: string;
  email?: string | null;
  role?: string | null;
  contact?: AgendorContact | null;
  organization?: { id: number; name: string } | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AgendorFunnelStep {
  name?: string | null;
}

export interface AgendorFunnel {
  step?: AgendorFunnelStep | null;
}

export interface AgendorDeal {
  id: number;
  title: string;
  value?: number | null;
  dealStatusText?: string | null;
  funnel?: AgendorFunnel | null;
  organization?: { id: number; name: string } | null;
  person?: { id: number; name: string } | null;
  owner?: { id: number; name: string } | null;
  endTime?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface AgendorPagedResponse<T> {
  data: T[];
  total: number;
}

// ─────────────────────────────────────────────────────────────
// CLIENTE HTTP AGENDOR
// ─────────────────────────────────────────────────────────────

export class AgendorClient {
  private readonly baseUrl = "https://api.agendor.com.br/v3";
  private readonly token: string;

  constructor(token?: string) {
    const t = token ?? process.env.AGENDOR_API_TOKEN;
    if (!t) {
      throw new Error(
        "Token do Agendor não encontrado. Configure AGENDOR_API_TOKEN no .env.local"
      );
    }
    this.token = t;
  }

  private async fetchPaginated<T>(
    endpoint: string,
    perPage = 100
  ): Promise<T[]> {
    const all: T[] = [];
    let page = 1;

    while (true) {
      const url = new URL(`${this.baseUrl}/${endpoint}`);
      url.searchParams.set("per_page", String(perPage));
      url.searchParams.set("page", String(page));

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Token ${this.token}`,
          "Content-Type": "application/json",
        },
        // sem cache — dados sempre frescos na importação
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(
          `Agendor API erro ${res.status} em /${endpoint}: ${await res.text()}`
        );
      }

      const body = (await res.json()) as AgendorPagedResponse<T>;
      const registros = body.data ?? [];
      all.push(...registros);

      if (all.length >= (body.total ?? 0) || registros.length === 0) break;
      page++;
    }

    return all;
  }

  async getOrganizations(): Promise<AgendorOrganization[]> {
    return this.fetchPaginated<AgendorOrganization>("organizations");
  }

  async getPeople(): Promise<AgendorPerson[]> {
    return this.fetchPaginated<AgendorPerson>("people");
  }

  async getDeals(): Promise<AgendorDeal[]> {
    return this.fetchPaginated<AgendorDeal>("deals");
  }
}

// ─────────────────────────────────────────────────────────────
// FUNÇÕES DE MAPEAMENTO
// ─────────────────────────────────────────────────────────────

/** Converte Organization do Agendor para dados de Empresa (Prisma). */
export function mapOrganizacaoParaEmpresa(org: AgendorOrganization) {
  const contato = org.contact ?? {};
  const endereco = org.address ?? {};

  // Monta endereço em uma linha para o campo `endereco` (texto livre)
  const enderecoCompleto = [
    endereco.streetName,
    endereco.streetNumber,
    endereco.district,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    razaoSocial: org.legalName?.trim() || org.name?.trim() || "Sem nome",
    nomeFantasia: org.name?.trim() || null,
    cnpj: org.cnpj?.replace(/\D/g, "").trim() || null,
    segmento: [org.category, org.sector].filter(Boolean).join(" / ") || null,
    telefone:
      contato.work?.trim() || contato.mobile?.trim() || null,
    email: org.email?.trim() || contato.email?.trim() || null,
    site: org.website?.trim() || null,
    endereco: enderecoCompleto || null,
    cidade: endereco.city?.trim() || null,
    estado: endereco.state?.trim() || null,
    cep: endereco.postalCode?.replace(/\D/g, "").trim() || null,
    observacoes: org.description?.trim() || null,
    ativa: true,
  };
}

/** Converte Person do Agendor para dados de Pessoa (Prisma). */
export function mapPessoaAgendor(person: AgendorPerson) {
  const contato = person.contact ?? {};

  return {
    nome: person.name?.trim() || "Sem nome",
    email: person.email?.trim() || contato.email?.trim() || null,
    telefone: contato.work?.trim() || contato.mobile?.trim() || null,
    whatsapp: contato.whatsapp?.trim() || null,
    cargo: person.role?.trim() || null,
    ativa: true,
  };
}

/**
 * Infere o TipoOperacao a partir do título do negócio.
 * Palavras-chave de venda → VENDA; qualquer outro → LOCACAO.
 */
function inferirTipoOperacao(titulo: string): TipoOperacao {
  const t = titulo.toLowerCase();
  if (
    t.includes("vend") ||
    t.includes("compra") ||
    t.includes("aquisi") ||
    t.includes("purchase")
  ) {
    return TipoOperacao.VENDA;
  }
  return TipoOperacao.LOCACAO;
}

/** Mapeia o status do Agendor para StatusOportunidade do Villa CRM. */
function mapStatus(dealStatusText?: string | null): StatusOportunidade {
  const s = (dealStatusText ?? "").toLowerCase();
  if (s.includes("ganho") || s.includes("won")) return StatusOportunidade.GANHA;
  if (s.includes("perd") || s.includes("lost")) return StatusOportunidade.PERDIDA;
  if (s.includes("propost")) return StatusOportunidade.PROPOSTA_ENVIADA;
  if (s.includes("negoc")) return StatusOportunidade.NEGOCIACAO;
  if (s.includes("atend")) return StatusOportunidade.EM_ATENDIMENTO;
  return StatusOportunidade.NOVA;
}

/** Converte Deal do Agendor para dados de Oportunidade (Prisma). */
export function mapNegocioAgendor(deal: AgendorDeal) {
  const titulo = deal.title?.trim() || `Negócio #${deal.id}`;

  return {
    titulo,
    tipo: inferirTipoOperacao(titulo),
    status: mapStatus(deal.dealStatusText),
    valor: deal.value != null ? deal.value : null,
    origem: "Agendor",
    previsaoFechamento: deal.endTime ? new Date(deal.endTime) : null,
    observacoes: deal.funnel?.step?.name
      ? `Etapa Agendor: ${deal.funnel.step.name}`
      : null,
    ativa: true,
  };
}
