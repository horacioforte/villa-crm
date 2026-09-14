// ARQUIVO: scripts/seed-revendas-caminhoes.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Seed: 20 maiores revendas/concessionárias de caminhões por estado.
// Carteira: REVENDAS_CAMINHOES
// Objetivo: parceria comercial — a revenda representa e vende usados da Villa
//           (bombas de concreto e betoneiras). Buscar proprietário ou gerente comercial.
//
// Uso:
//   npx tsx scripts/seed-revendas-caminhoes.ts          → dry-run
//   npx tsx scripts/seed-revendas-caminhoes.ts --commit  → grava em produção

import "./env";
import { Client } from "pg";

const COMMIT = process.argv.includes("--commit");

interface RevCaminhao {
  titulo: string;
  cidade: string;
  estado: string;
  resumo: string;
  tier: "A" | "B" | "C";
}

const REVENDAS: RevCaminhao[] = [

  // ════════════════════════════════════════════════
  // SÃO PAULO — SP (20)
  // ════════════════════════════════════════════════
  { titulo: "Transolver Caminhões SP Capital", cidade: "São Paulo", estado: "SP",
    resumo: "Maior rede autorizada Mercedes-Benz Caminhões em SP. Atende frotas de construtoras, empreiteiras e transportadoras. Potencial representante de equipamentos usados da Villa.", tier: "A" },
  { titulo: "Transolver Caminhões Grande ABC", cidade: "Santo André", estado: "SP",
    resumo: "Unidade Transolver/Mercedes-Benz no Grande ABC. Base de clientes em indústria e construção. Parceiro para venda de betoneiras e bombas usadas da Villa.", tier: "A" },
  { titulo: "JAB Volvo Caminhões SP", cidade: "São Paulo", estado: "SP",
    resumo: "Concessionária Volvo Caminhões em SP Capital. Clientes em logística e construção pesada. Potencial parceiro Villa para usados.", tier: "A" },
  { titulo: "Transolver Caminhões Guarulhos", cidade: "Guarulhos", estado: "SP",
    resumo: "Unidade Mercedes-Benz em Guarulhos. Atende transportadoras e construtoras da região Norte da Grande SP.", tier: "A" },
  { titulo: "Scania SP Capital", cidade: "São Paulo", estado: "SP",
    resumo: "Concessionária Scania em SP. Base de clientes em construção civil, mineração e logística. Potencial parceiro para equipamentos usados Villa.", tier: "A" },
  { titulo: "VW Caminhões SP Lapa", cidade: "São Paulo", estado: "SP",
    resumo: "Revendedor VW Caminhões/MAN em SP. Atende construtoras, empreiteiras e transportadoras. Potencial representante de betoneiras e bombas da Villa.", tier: "A" },
  { titulo: "Iveco SP Capital", cidade: "São Paulo", estado: "SP",
    resumo: "Concessionária Iveco em SP. Base em logística, construção e obras públicas. Parceiro potencial Villa.", tier: "B" },
  { titulo: "DAF Caminhões SP", cidade: "São Paulo", estado: "SP",
    resumo: "Revendedor DAF/PACCAR em SP. Base em transportadoras e empreiteiras. Parceiro para usados Villa.", tier: "B" },
  { titulo: "Naza Caminhões", cidade: "São Paulo", estado: "SP",
    resumo: "Revenda multimarca de caminhões usados em SP. Clientela diversificada em construção e logística. Potencial representante de usados Villa.", tier: "B" },
  { titulo: "Ciclo Caminhões Ribeirão Preto", cidade: "Ribeirão Preto", estado: "SP",
    resumo: "Revenda de caminhões no interior paulista. Base em agronegócio e construção civil. Potencial parceiro Villa no interior de SP.", tier: "B" },
  { titulo: "Anhanguera Caminhões Campinas", cidade: "Campinas", estado: "SP",
    resumo: "Revenda de caminhões em Campinas. Atende construtoras e transportadoras do interior. Parceiro potencial Villa.", tier: "B" },
  { titulo: "Planalto Veículos Pesados Campinas", cidade: "Campinas", estado: "SP",
    resumo: "Concessionária de caminhões na Região Metropolitana de Campinas. Clientes em obras e logística.", tier: "B" },
  { titulo: "Vale do Paraíba Caminhões", cidade: "São José dos Campos", estado: "SP",
    resumo: "Revenda de caminhões no Vale do Paraíba. Atende indústria, construção e logística. Parceiro potencial Villa.", tier: "B" },
  { titulo: "Litoral Caminhões Santos", cidade: "Santos", estado: "SP",
    resumo: "Revenda de caminhões no litoral paulista. Clientes em portuário, logística e obras. Parceiro potencial.", tier: "B" },
  { titulo: "Sorocaba Diesel Caminhões", cidade: "Sorocaba", estado: "SP",
    resumo: "Concessionária de caminhões em Sorocaba. Base em indústria e construção civil. Potencial representante Villa.", tier: "B" },
  { titulo: "Inter Diesel SP Interior", cidade: "Bauru", estado: "SP",
    resumo: "Revenda de caminhões no centro-oeste paulista. Atende agronegócio e obras de infraestrutura.", tier: "B" },
  { titulo: "Grupo JCR Caminhões SP", cidade: "São Paulo", estado: "SP",
    resumo: "Rede multimarca de caminhões usados na Grande SP. Potencial parceiro para representar usados Villa.", tier: "B" },
  { titulo: "Transcam Veículos Pesados SP", cidade: "Osasco", estado: "SP",
    resumo: "Revenda de caminhões usados em Osasco e Grande SP. Clientes em construção e transportadoras.", tier: "C" },
  { titulo: "Presidente Prudente Caminhões", cidade: "Presidente Prudente", estado: "SP",
    resumo: "Revenda de caminhões no extremo oeste paulista. Atende agronegócio e obras regionais.", tier: "C" },
  { titulo: "Marília Diesel", cidade: "Marília", estado: "SP",
    resumo: "Concessionária de caminhões em Marília/SP. Clientes em agroindústria, construção e transporte.", tier: "C" },

  // ════════════════════════════════════════════════
  // RIO DE JANEIRO — RJ (20)
  // ════════════════════════════════════════════════
  { titulo: "Transolver Caminhões RJ Capital", cidade: "Rio de Janeiro", estado: "RJ",
    resumo: "Rede Mercedes-Benz Caminhões no RJ. Atende construtoras, empreiteiras e transportadoras. Parceiro estratégico Villa.", tier: "A" },
  { titulo: "JAB Volvo Caminhões RJ", cidade: "Rio de Janeiro", estado: "RJ",
    resumo: "Concessionária Volvo no RJ. Base em construção pesada, logística e mineração.", tier: "A" },
  { titulo: "Scania RJ Capital", cidade: "Rio de Janeiro", estado: "RJ",
    resumo: "Dealer Scania no RJ. Clientes em óleo & gás, portuário e construção.", tier: "A" },
  { titulo: "VW Caminhões RJ", cidade: "Rio de Janeiro", estado: "RJ",
    resumo: "Concessionária VW Caminhões/MAN no RJ. Base em transportadoras e obras.", tier: "A" },
  { titulo: "Iveco RJ Capital", cidade: "Rio de Janeiro", estado: "RJ",
    resumo: "Dealer Iveco no RJ. Clientes em obras públicas e logística urbana.", tier: "B" },
  { titulo: "Norte Fluminense Caminhões", cidade: "Campos dos Goytacazes", estado: "RJ",
    resumo: "Revenda de caminhões no Norte Fluminense. Base em petróleo (Campos), construção e agronegócio.", tier: "B" },
  { titulo: "Duque de Caxias Diesel", cidade: "Duque de Caxias", estado: "RJ",
    resumo: "Revenda de caminhões na Baixada Fluminense. Clientes em logística, refinaria e construção.", tier: "B" },
  { titulo: "Niterói Caminhões", cidade: "Niterói", estado: "RJ",
    resumo: "Revendedor de caminhões em Niterói. Atende obras da região oceânica e logística.", tier: "B" },
  { titulo: "Sul Fluminense Trucks", cidade: "Volta Redonda", estado: "RJ",
    resumo: "Revenda de caminhões no Sul Fluminense. Base em siderurgia, construção e transportadoras.", tier: "B" },
  { titulo: "Petrópolis Veículos Pesados", cidade: "Petrópolis", estado: "RJ",
    resumo: "Revendedor de caminhões na Serra Fluminense. Clientes em construção, turismo e logística.", tier: "B" },
  { titulo: "Rio das Ostras Caminhões", cidade: "Macaé", estado: "RJ",
    resumo: "Revenda de caminhões em Macaé (polo do petróleo). Clientes em serviços de oil & gas e obras.", tier: "B" },
  { titulo: "Angra Diesel", cidade: "Angra dos Reis", estado: "RJ",
    resumo: "Revenda em Angra dos Reis. Atende obras de energia nuclear, portuário e construção.", tier: "C" },
  { titulo: "Cabo Frio Caminhões", cidade: "Cabo Frio", estado: "RJ",
    resumo: "Revenda no litoral sul fluminense. Clientes em construção, turismo e logística regional.", tier: "C" },
  { titulo: "Resende Diesel", cidade: "Resende", estado: "RJ",
    resumo: "Revendedor próximo ao polo automotivo de Resende. Clientes em indústria e transportadoras.", tier: "C" },
  { titulo: "Barra Mansa Caminhões", cidade: "Barra Mansa", estado: "RJ",
    resumo: "Revenda no Vale do Paraíba fluminense. Clientes em siderurgia, construção e agro.", tier: "C" },
  { titulo: "Nova Iguaçu Diesel", cidade: "Nova Iguaçu", estado: "RJ",
    resumo: "Revenda na Baixada Fluminense. Atende frotas de construtoras e transportadoras.", tier: "C" },
  { titulo: "Mesquita Caminhões RJ", cidade: "Mesquita", estado: "RJ",
    resumo: "Revenda de usados no Grande RJ. Clientes em construção civil e logística urbana.", tier: "C" },
  { titulo: "Queimados Diesel", cidade: "Queimados", estado: "RJ",
    resumo: "Revendedor de caminhões em Queimados/RJ. Base em indústria local e transportadoras.", tier: "C" },
  { titulo: "Seropédica Veículos Pesados", cidade: "Seropédica", estado: "RJ",
    resumo: "Revenda no entorno da UFRRJ. Clientes em agronegócio, construção e logística.", tier: "C" },
  { titulo: "Itaboraí Caminhões", cidade: "Itaboraí", estado: "RJ",
    resumo: "Revenda próxima ao COMPERJ. Base em petroquímica, construção e transportadoras.", tier: "C" },

  // ════════════════════════════════════════════════
  // MINAS GERAIS — MG (20)
  // ════════════════════════════════════════════════
  { titulo: "Promac Veículos Pesados BH", cidade: "Belo Horizonte", estado: "MG",
    resumo: "Grande concessionária de caminhões em BH. Atende mineradoras, construtoras e transportadoras de MG. Parceiro estratégico Villa.", tier: "A" },
  { titulo: "Transolver Caminhões MG", cidade: "Belo Horizonte", estado: "MG",
    resumo: "Rede Mercedes-Benz em MG. Base em mineração, construção e logística. Parceiro para usados Villa.", tier: "A" },
  { titulo: "Volvo Caminhões BH", cidade: "Belo Horizonte", estado: "MG",
    resumo: "Concessionária Volvo em BH. Clientes em mineração de ferro, construção civil e transportadoras.", tier: "A" },
  { titulo: "Scania MG Capital", cidade: "Belo Horizonte", estado: "MG",
    resumo: "Dealer Scania em BH. Base em mineração e construção pesada em MG.", tier: "A" },
  { titulo: "VW Caminhões MG", cidade: "Betim", estado: "MG",
    resumo: "Concessionária VW Caminhões próxima à planta da FIAT em Betim. Clientes em indústria e construção.", tier: "A" },
  { titulo: "Triangulo Mineiro Caminhões", cidade: "Uberlândia", estado: "MG",
    resumo: "Revenda de caminhões no Triângulo Mineiro. Forte base em agronegócio e obras de infraestrutura.", tier: "B" },
  { titulo: "Juiz de Fora Diesel", cidade: "Juiz de Fora", estado: "MG",
    resumo: "Revendedor de caminhões na Zona da Mata mineira. Base em indústria, construção e logística.", tier: "B" },
  { titulo: "Montes Claros Caminhões", cidade: "Montes Claros", estado: "MG",
    resumo: "Revenda no Norte de MG. Clientes em obras públicas, agronegócio e construção civil.", tier: "B" },
  { titulo: "Contagem Diesel MG", cidade: "Contagem", estado: "MG",
    resumo: "Revenda na RMBH industrial. Atende indústrias, construtoras e transportadoras.", tier: "B" },
  { titulo: "Ipatinga Veículos Pesados", cidade: "Ipatinga", estado: "MG",
    resumo: "Revendedor no Vale do Aço. Clientes em siderurgia (Usiminas), mineração e construção.", tier: "B" },
  { titulo: "Divinópolis Caminhões", cidade: "Divinópolis", estado: "MG",
    resumo: "Revenda no Centro-Oeste mineiro. Base em siderurgia, agro e transportadoras.", tier: "B" },
  { titulo: "Pouso Alegre Diesel", cidade: "Pouso Alegre", estado: "MG",
    resumo: "Revenda no Sul de MG. Clientes em indústria, logística e construção civil.", tier: "B" },
  { titulo: "Governador Valadares Caminhões", cidade: "Governador Valadares", estado: "MG",
    resumo: "Revenda no Vale do Rio Doce. Base em mineração e obras de infraestrutura.", tier: "B" },
  { titulo: "Varginha Diesel MG", cidade: "Varginha", estado: "MG",
    resumo: "Revenda no Sul de MG. Clientes em agronegócio, logística e construção.", tier: "C" },
  { titulo: "Lavras Caminhões MG", cidade: "Lavras", estado: "MG",
    resumo: "Revendedor no Campos das Vertentes. Base em agronegócio e obras regionais.", tier: "C" },
  { titulo: "Unaí Diesel MG", cidade: "Unaí", estado: "MG",
    resumo: "Revenda no Noroeste mineiro. Forte em agronegócio e obras rurais.", tier: "C" },
  { titulo: "Patos de Minas Caminhões", cidade: "Patos de Minas", estado: "MG",
    resumo: "Revenda no Alto Paranaíba. Clientes em agronegócio e construção.", tier: "C" },
  { titulo: "Caratinga Diesel", cidade: "Caratinga", estado: "MG",
    resumo: "Revenda no Leste de MG. Base em obras públicas e agronegócio.", tier: "C" },
  { titulo: "Teófilo Otoni Caminhões", cidade: "Teófilo Otoni", estado: "MG",
    resumo: "Revenda no Vale do Mucuri. Clientes em mineração de gemas, construção e agro.", tier: "C" },
  { titulo: "Araxá Veículos Pesados", cidade: "Araxá", estado: "MG",
    resumo: "Revenda no Triângulo Mineiro. Base em mineração de nióbio, agro e obras.", tier: "C" },

  // ════════════════════════════════════════════════
  // PARANÁ — PR (20)
  // ════════════════════════════════════════════════
  { titulo: "Transbrás Caminhões Curitiba", cidade: "Curitiba", estado: "PR",
    resumo: "Grande rede de caminhões em Curitiba. Atende construtoras, indústrias e transportadoras do PR. Parceiro Villa.", tier: "A" },
  { titulo: "Sul Caminhões Curitiba", cidade: "Curitiba", estado: "PR",
    resumo: "Concessionária multimarca em Curitiba. Base em construção, logística e agronegócio.", tier: "A" },
  { titulo: "Volvo PR Curitiba", cidade: "Curitiba", estado: "PR",
    resumo: "Dealer Volvo em Curitiba. Clientes em construção civil, obras de infraestrutura e logística.", tier: "A" },
  { titulo: "Scania Curitiba PR", cidade: "Curitiba", estado: "PR",
    resumo: "Concessionária Scania no PR. Base em transportadoras, agro e construção.", tier: "A" },
  { titulo: "Mercedes-Benz Caminhões Curitiba", cidade: "Curitiba", estado: "PR",
    resumo: "Dealer MB em Curitiba. Atende frotas de construção e logística no PR.", tier: "A" },
  { titulo: "Norte Paranaense Caminhões Londrina", cidade: "Londrina", estado: "PR",
    resumo: "Revenda no norte do PR. Base em agronegócio, frigoríficos e construção civil.", tier: "B" },
  { titulo: "Maringá Diesel PR", cidade: "Maringá", estado: "PR",
    resumo: "Concessionária em Maringá. Clientes em agroindústria, logística e obras.", tier: "B" },
  { titulo: "Cascavel Caminhões PR", cidade: "Cascavel", estado: "PR",
    resumo: "Revenda no Oeste do PR. Base em cooperativas agrícolas, frigoríficos e construção.", tier: "B" },
  { titulo: "Foz do Iguaçu Diesel", cidade: "Foz do Iguaçu", estado: "PR",
    resumo: "Revenda na tríplice fronteira. Clientes em construção, turismo e logística.", tier: "B" },
  { titulo: "Ponta Grossa Caminhões PR", cidade: "Ponta Grossa", estado: "PR",
    resumo: "Concessionária nos Campos Gerais. Base em cimento, papel e celulose e construção.", tier: "B" },
  { titulo: "Francisco Beltrão Diesel", cidade: "Francisco Beltrão", estado: "PR",
    resumo: "Revenda no Sudoeste do PR. Clientes em agroindústria, frigoríficos e obras.", tier: "B" },
  { titulo: "Guarapuava Caminhões PR", cidade: "Guarapuava", estado: "PR",
    resumo: "Revenda no centro-sul do PR. Base em papel, celulose, agro e construção.", tier: "B" },
  { titulo: "Apucarana Diesel PR", cidade: "Apucarana", estado: "PR",
    resumo: "Revenda no Vale do Ivaí. Clientes em têxtil, construção e agronegócio.", tier: "C" },
  { titulo: "Umuarama Caminhões PR", cidade: "Umuarama", estado: "PR",
    resumo: "Revendedor no Noroeste do PR. Base em agronegócio e obras rurais.", tier: "C" },
  { titulo: "Paranavaí Diesel", cidade: "Paranavaí", estado: "PR",
    resumo: "Revenda no extremo norte do PR. Clientes em cana de açúcar, agro e construção.", tier: "C" },
  { titulo: "Cornélio Procópio Caminhões", cidade: "Cornélio Procópio", estado: "PR",
    resumo: "Revenda no Norte Pioneiro do PR. Base em cafeicultura, soja e obras regionais.", tier: "C" },
  { titulo: "Toledo Diesel PR", cidade: "Toledo", estado: "PR",
    resumo: "Revenda no Oeste do PR. Clientes em cooperativas e frigoríficos.", tier: "C" },
  { titulo: "Irati Caminhões PR", cidade: "Irati", estado: "PR",
    resumo: "Revenda no centro-sul do PR. Base em madeira, papel e construção.", tier: "C" },
  { titulo: "Ivaiporã Diesel", cidade: "Ivaiporã", estado: "PR",
    resumo: "Revenda no Vale do Ivaí. Clientes em cana-de-açúcar e agronegócio.", tier: "C" },
  { titulo: "Campo Mourão Caminhões PR", cidade: "Campo Mourão", estado: "PR",
    resumo: "Revenda no centro-oeste paranaense. Base em grãos, construção e obras rurais.", tier: "C" },

  // ════════════════════════════════════════════════
  // RIO GRANDE DO SUL — RS (20)
  // ════════════════════════════════════════════════
  { titulo: "Sul Eixo Caminhões Porto Alegre", cidade: "Porto Alegre", estado: "RS",
    resumo: "Grupo líder em caminhões no RS. Marcas Scania e Mercedes-Benz. Base em construção, agro e logística. Parceiro estratégico Villa.", tier: "A" },
  { titulo: "Volvo Caminhões POA", cidade: "Porto Alegre", estado: "RS",
    resumo: "Dealer Volvo no RS. Clientes em construção, mineração de carvão e logística.", tier: "A" },
  { titulo: "Scania RS Porto Alegre", cidade: "Porto Alegre", estado: "RS",
    resumo: "Concessionária Scania no RS. Base em transportadoras, obras e agronegócio.", tier: "A" },
  { titulo: "MB Caminhões RS Capital", cidade: "Porto Alegre", estado: "RS",
    resumo: "Dealer Mercedes-Benz no RS. Atende frotas de construtoras e transportadoras.", tier: "A" },
  { titulo: "Caxias Diesel RS", cidade: "Caxias do Sul", estado: "RS",
    resumo: "Revenda em Caxias do Sul. Base em indústria metal-mecânica, construção e logística.", tier: "A" },
  { titulo: "Serra Gaúcha Caminhões", cidade: "Caxias do Sul", estado: "RS",
    resumo: "Concessionária na Serra Gaúcha. Clientes em vinicultura, indústria e construção.", tier: "B" },
  { titulo: "Pelotas Diesel RS", cidade: "Pelotas", estado: "RS",
    resumo: "Revenda no Sul do RS. Base em indústria frigorífica, agro e obras públicas.", tier: "B" },
  { titulo: "Santa Maria Caminhões RS", cidade: "Santa Maria", estado: "RS",
    resumo: "Revenda na Região Central do RS. Clientes em obras, agro e logística.", tier: "B" },
  { titulo: "Passo Fundo Diesel RS", cidade: "Passo Fundo", estado: "RS",
    resumo: "Revenda no Norte do RS. Base em soja, trigo, frigoríficos e construção.", tier: "B" },
  { titulo: "Rio Grande Caminhões RS", cidade: "Rio Grande", estado: "RS",
    resumo: "Revenda próxima ao Porto de Rio Grande. Clientes em portuário, pesca e construção.", tier: "B" },
  { titulo: "Canoas Diesel RS", cidade: "Canoas", estado: "RS",
    resumo: "Revenda na RMPA industrial. Clientes em refinaria, indústria e obras.", tier: "B" },
  { titulo: "Uruguaiana Caminhões RS", cidade: "Uruguaiana", estado: "RS",
    resumo: "Revenda na fronteira oeste do RS. Clientes em comércio fronteiriço e agronegócio.", tier: "C" },
  { titulo: "Ijuí Diesel RS", cidade: "Ijuí", estado: "RS",
    resumo: "Revenda no Noroeste do RS. Base em cooperativas, soja e construção.", tier: "C" },
  { titulo: "Bagé Caminhões RS", cidade: "Bagé", estado: "RS",
    resumo: "Revenda na Campanha Gaúcha. Clientes em pecuária, agro e obras rurais.", tier: "C" },
  { titulo: "Erechim Diesel RS", cidade: "Erechim", estado: "RS",
    resumo: "Revenda no Alto Uruguai. Base em grãos, frigoríficos e construção.", tier: "C" },
  { titulo: "Lajeado Caminhões RS", cidade: "Lajeado", estado: "RS",
    resumo: "Revenda no Vale do Taquari. Clientes em avicultura, suinocultura e obras.", tier: "C" },
  { titulo: "Santo Ângelo Diesel", cidade: "Santo Ângelo", estado: "RS",
    resumo: "Revenda na Missões. Base em soja, trigo e obras regionais.", tier: "C" },
  { titulo: "Cruz Alta Caminhões RS", cidade: "Cruz Alta", estado: "RS",
    resumo: "Revenda no Planalto Central gaúcho. Clientes em agronegócio e obras rurais.", tier: "C" },
  { titulo: "Gramado Diesel RS", cidade: "Gramado", estado: "RS",
    resumo: "Revenda na Serra Gaúcha. Base em turismo, construção e vinicultura.", tier: "C" },
  { titulo: "Novo Hamburgo Caminhões RS", cidade: "Novo Hamburgo", estado: "RS",
    resumo: "Revenda na Região do Vale dos Sinos. Clientes em calçados, indústria e construção.", tier: "C" },

  // ════════════════════════════════════════════════
  // SANTA CATARINA — SC (20)
  // ════════════════════════════════════════════════
  { titulo: "Joinville Diesel SC", cidade: "Joinville", estado: "SC",
    resumo: "Maior revendedor de caminhões no nordeste catarinense. Base em indústria metal-mecânica, construção e logística. Parceiro potencial Villa.", tier: "A" },
  { titulo: "Scania Florianópolis SC", cidade: "Florianópolis", estado: "SC",
    resumo: "Dealer Scania em SC. Clientes em construção, obras públicas e transportadoras.", tier: "A" },
  { titulo: "MB Caminhões Florianópolis", cidade: "Florianópolis", estado: "SC",
    resumo: "Concessionária Mercedes-Benz em Florianópolis. Base em construção civil, logística e obras.", tier: "A" },
  { titulo: "Volvo SC Joinville", cidade: "Joinville", estado: "SC",
    resumo: "Dealer Volvo em SC. Clientes em frigoríficos, indústria e construção civil.", tier: "A" },
  { titulo: "Blumenau Diesel SC", cidade: "Blumenau", estado: "SC",
    resumo: "Revenda de caminhões no Vale do Itajaí. Base em têxtil, indústria e construção.", tier: "A" },
  { titulo: "Chapecó Caminhões SC", cidade: "Chapecó", estado: "SC",
    resumo: "Revenda no Oeste catarinense. Base em frigoríficos, cooperativas e construção.", tier: "B" },
  { titulo: "Criciúma Diesel SC", cidade: "Criciúma", estado: "SC",
    resumo: "Revenda no Sul de SC. Clientes em cerâmica, mineração de carvão e construção.", tier: "B" },
  { titulo: "Itajaí Caminhões SC", cidade: "Itajaí", estado: "SC",
    resumo: "Revenda próxima ao porto de Itajaí. Clientes em portuário, logística e construção.", tier: "B" },
  { titulo: "Lages Diesel SC", cidade: "Lages", estado: "SC",
    resumo: "Revenda no Planalto Serrano. Base em papel e celulose, madeira e agro.", tier: "B" },
  { titulo: "São José Caminhões SC", cidade: "São José", estado: "SC",
    resumo: "Revenda na Grande Florianópolis. Clientes em construção, logística e obras públicas.", tier: "B" },
  { titulo: "Tubarão Diesel SC", cidade: "Tubarão", estado: "SC",
    resumo: "Revenda no Sul de SC. Base em energia termelétrica, cerâmica e construção.", tier: "B" },
  { titulo: "Brusque Caminhões SC", cidade: "Brusque", estado: "SC",
    resumo: "Revenda no Vale do Itajaí. Base em têxtil, indústria e construção civil.", tier: "C" },
  { titulo: "Jaraguá do Sul Diesel", cidade: "Jaraguá do Sul", estado: "SC",
    resumo: "Revenda em Jaraguá do Sul. Base em WEG e indústria eletromecânica, obras.", tier: "C" },
  { titulo: "Caçador Caminhões SC", cidade: "Caçador", estado: "SC",
    resumo: "Revenda no Meio-Oeste catarinense. Base em papel, madeira e agronegócio.", tier: "C" },
  { titulo: "Mafra Diesel SC", cidade: "Mafra", estado: "SC",
    resumo: "Revenda no Norte catarinense. Clientes em papel, celulose e construção.", tier: "C" },
  { titulo: "Concórdia Caminhões SC", cidade: "Concórdia", estado: "SC",
    resumo: "Revenda no Alto Uruguai. Base em frigoríficos, suinocultura e obras.", tier: "C" },
  { titulo: "Videira Diesel SC", cidade: "Videira", estado: "SC",
    resumo: "Revenda no Meio-Oeste. Base em vitivinicultura, frios e construção.", tier: "C" },
  { titulo: "Xanxerê Caminhões SC", cidade: "Xanxerê", estado: "SC",
    resumo: "Revenda no Oeste de SC. Clientes em soja, milho e obras rurais.", tier: "C" },
  { titulo: "Araranguá Diesel SC", cidade: "Araranguá", estado: "SC",
    resumo: "Revenda no extremo sul de SC. Base em energia eólica, pesca e construção.", tier: "C" },
  { titulo: "Balneário Camboriú Caminhões", cidade: "Balneário Camboriú", estado: "SC",
    resumo: "Revenda no Litoral Norte catarinense. Clientes em construção e obras turísticas.", tier: "C" },

  // ════════════════════════════════════════════════
  // BAHIA — BA (20)
  // ════════════════════════════════════════════════
  { titulo: "Salvador Diesel BA", cidade: "Salvador", estado: "BA",
    resumo: "Principal revenda de caminhões em Salvador. Base em construção, portuário e logística. Parceiro estratégico Villa.", tier: "A" },
  { titulo: "MB Caminhões Salvador BA", cidade: "Salvador", estado: "BA",
    resumo: "Concessionária Mercedes-Benz em Salvador. Atende frotas de construtoras e transportadoras.", tier: "A" },
  { titulo: "Volvo Caminhões BA", cidade: "Salvador", estado: "BA",
    resumo: "Dealer Volvo em Salvador. Clientes em petroquímica (Camaçari), construção e portuário.", tier: "A" },
  { titulo: "Scania BA Salvador", cidade: "Salvador", estado: "BA",
    resumo: "Concessionária Scania na BA. Base em obras, logística e agroindústria.", tier: "A" },
  { titulo: "Camaçari Diesel BA", cidade: "Camaçari", estado: "BA",
    resumo: "Revenda próxima ao polo petroquímico. Clientes em indústria química e construção.", tier: "A" },
  { titulo: "Feira de Santana Caminhões BA", cidade: "Feira de Santana", estado: "BA",
    resumo: "Revenda no segundo maior município da BA. Base em agronegócio, logística e obras.", tier: "B" },
  { titulo: "Vitória da Conquista Diesel", cidade: "Vitória da Conquista", estado: "BA",
    resumo: "Revenda no sudoeste da BA. Base em café, fruticultura e obras públicas.", tier: "B" },
  { titulo: "Ilhéus Caminhões BA", cidade: "Ilhéus", estado: "BA",
    resumo: "Revenda no sul da BA. Clientes em cacau, obras portuárias e agronegócio.", tier: "B" },
  { titulo: "Barreiras Diesel BA", cidade: "Barreiras", estado: "BA",
    resumo: "Revenda no oeste da BA. Base em soja, algodão e obras de infraestrutura do agro.", tier: "B" },
  { titulo: "Juazeiro Caminhões BA", cidade: "Juazeiro", estado: "BA",
    resumo: "Revenda no Vale do São Francisco. Base em fruticultura irrigada e obras.", tier: "B" },
  { titulo: "Paulo Afonso Diesel", cidade: "Paulo Afonso", estado: "BA",
    resumo: "Revenda no norte da BA. Clientes em energia hidroelétrica e obras públicas.", tier: "B" },
  { titulo: "Itabuna Caminhões BA", cidade: "Itabuna", estado: "BA",
    resumo: "Revenda no sul da BA. Base em papel, celulose (Veracel/Bracell) e agro.", tier: "B" },
  { titulo: "Porto Seguro Diesel", cidade: "Porto Seguro", estado: "BA",
    resumo: "Revenda no extremo sul da BA. Clientes em construção e turismo.", tier: "C" },
  { titulo: "Alagoinhas Caminhões BA", cidade: "Alagoinhas", estado: "BA",
    resumo: "Revenda no nordeste da BA. Base em petróleo (Recôncavo), agro e obras.", tier: "C" },
  { titulo: "Eunápolis Diesel BA", cidade: "Eunápolis", estado: "BA",
    resumo: "Revenda no extremo sul. Base em celulose (Veracel), madeira e obras.", tier: "C" },
  { titulo: "Brumado Caminhões BA", cidade: "Brumado", estado: "BA",
    resumo: "Revenda no sudoeste da BA. Base em mineração de cromo e obras rurais.", tier: "C" },
  { titulo: "Santo Antônio de Jesus Diesel", cidade: "Santo Antônio de Jesus", estado: "BA",
    resumo: "Revenda no Recôncavo baiano. Clientes em cerâmica e obras públicas.", tier: "C" },
  { titulo: "Senhor do Bonfim Caminhões", cidade: "Senhor do Bonfim", estado: "BA",
    resumo: "Revenda no norte da BA. Base em mineração e obras rurais.", tier: "C" },
  { titulo: "Teixeira de Freitas Diesel", cidade: "Teixeira de Freitas", estado: "BA",
    resumo: "Revenda no extremo sul da BA. Clientes em eucalipto, celulose e construção.", tier: "C" },
  { titulo: "Seabra Caminhões BA", cidade: "Seabra", estado: "BA",
    resumo: "Revenda na Chapada Diamantina. Base em turismo, agro e obras regionais.", tier: "C" },

  // ════════════════════════════════════════════════
  // CEARÁ — CE (20)
  // ════════════════════════════════════════════════
  { titulo: "Nordeste Diesel Fortaleza CE", cidade: "Fortaleza", estado: "CE",
    resumo: "Principal rede de caminhões no CE. Base em construção, obras públicas e logística. Parceiro Villa.", tier: "A" },
  { titulo: "MB Caminhões Fortaleza CE", cidade: "Fortaleza", estado: "CE",
    resumo: "Dealer Mercedes-Benz em Fortaleza. Clientes em obras, portuário e transportadoras.", tier: "A" },
  { titulo: "Volvo Caminhões CE", cidade: "Fortaleza", estado: "CE",
    resumo: "Concessionária Volvo no CE. Base em logística, obras de infraestrutura e energia.", tier: "A" },
  { titulo: "Scania CE Capital", cidade: "Fortaleza", estado: "CE",
    resumo: "Dealer Scania em Fortaleza. Clientes em construção, MCMV e transportadoras.", tier: "A" },
  { titulo: "Pecém Diesel CE", cidade: "São Gonçalo do Amarante", estado: "CE",
    resumo: "Revenda próxima ao Complexo do Pecém. Clientes em siderurgia (CSP), portuário e obras.", tier: "A" },
  { titulo: "Juazeiro do Norte Caminhões CE", cidade: "Juazeiro do Norte", estado: "CE",
    resumo: "Maior revenda no interior do CE. Base em comércio regional, obras e agronegócio.", tier: "B" },
  { titulo: "Sobral Diesel CE", cidade: "Sobral", estado: "CE",
    resumo: "Revenda no norte do CE. Clientes em calçados (Grendene), construção e obras.", tier: "B" },
  { titulo: "Caucaia Caminhões CE", cidade: "Caucaia", estado: "CE",
    resumo: "Revenda na Região Metropolitana de Fortaleza. Base em indústria e construção.", tier: "B" },
  { titulo: "Maracanaú Diesel CE", cidade: "Maracanaú", estado: "CE",
    resumo: "Revenda no polo industrial da RMFOR. Clientes em indústria e obras.", tier: "B" },
  { titulo: "Iguatu Caminhões CE", cidade: "Iguatu", estado: "CE",
    resumo: "Revenda no centro-sul do CE. Base em agronegócio e obras regionais.", tier: "B" },
  { titulo: "Quixadá Diesel CE", cidade: "Quixadá", estado: "CE",
    resumo: "Revenda no sertão central. Clientes em pedras ornamentais, agro e obras.", tier: "C" },
  { titulo: "Limoeiro do Norte Caminhões", cidade: "Limoeiro do Norte", estado: "CE",
    resumo: "Revenda no Vale do Jaguaribe. Base em fruticultura e obras rurais.", tier: "C" },
  { titulo: "Crato Diesel CE", cidade: "Crato", estado: "CE",
    resumo: "Revenda no Cariri cearense. Clientes em gesso, agro e obras públicas.", tier: "C" },
  { titulo: "Itapipoca Caminhões CE", cidade: "Itapipoca", estado: "CE",
    resumo: "Revenda no litoral norte. Base em energia eólica, agro e construção.", tier: "C" },
  { titulo: "Camocim Diesel CE", cidade: "Camocim", estado: "CE",
    resumo: "Revenda no litoral extremo oeste. Clientes em pesca, turismo e obras.", tier: "C" },
  { titulo: "Russas Caminhões CE", cidade: "Russas", estado: "CE",
    resumo: "Revenda no Vale do Jaguaribe. Base em calcário, agro e obras.", tier: "C" },
  { titulo: "Canindé Diesel CE", cidade: "Canindé", estado: "CE",
    resumo: "Revenda no sertão central. Clientes em turismo religioso e obras rurais.", tier: "C" },
  { titulo: "Tianguá Caminhões CE", cidade: "Tianguá", estado: "CE",
    resumo: "Revenda na Ibiapaba. Base em fruticultura irrigada e obras de infraestrutura.", tier: "C" },
  { titulo: "Acopiara Diesel CE", cidade: "Acopiara", estado: "CE",
    resumo: "Revenda no Sertão de Canindé. Clientes em algodão, agro e obras rurais.", tier: "C" },
  { titulo: "Horizonte Caminhões CE", cidade: "Horizonte", estado: "CE",
    resumo: "Revenda na RMFOR. Clientes em polo industrial de Horizonte e obras.", tier: "C" },

  // ════════════════════════════════════════════════
  // PERNAMBUCO — PE (20)
  // ════════════════════════════════════════════════
  { titulo: "Suape Diesel Caminhões PE", cidade: "Ipojuca", estado: "PE",
    resumo: "Revenda próxima ao Porto de Suape. Base em petroquímica, naval e obras industriais. Parceiro Villa.", tier: "A" },
  { titulo: "MB Caminhões Recife PE", cidade: "Recife", estado: "PE",
    resumo: "Dealer Mercedes-Benz em Recife. Clientes em construção, obras públicas e logística.", tier: "A" },
  { titulo: "Volvo Caminhões PE", cidade: "Recife", estado: "PE",
    resumo: "Concessionária Volvo em PE. Base em construção e transportadoras no Nordeste.", tier: "A" },
  { titulo: "Scania PE Capital", cidade: "Recife", estado: "PE",
    resumo: "Dealer Scania em Recife. Clientes em obras, logística e agroindústria.", tier: "A" },
  { titulo: "Caruaru Caminhões PE", cidade: "Caruaru", estado: "PE",
    resumo: "Revenda no Agreste pernambucano. Base em confecções, obras e agronegócio.", tier: "B" },
  { titulo: "Petrolina Diesel PE", cidade: "Petrolina", estado: "PE",
    resumo: "Revenda no polo de fruticultura do São Francisco. Base em uva, manga e obras.", tier: "B" },
  { titulo: "Paulista Caminhões PE", cidade: "Paulista", estado: "PE",
    resumo: "Revenda na Região Metropolitana do Recife. Clientes em construção e logística.", tier: "B" },
  { titulo: "Caetés Diesel PE", cidade: "Caruaru", estado: "PE",
    resumo: "Revenda multimarca no Agreste. Base em indústria local e obras públicas.", tier: "B" },
  { titulo: "Serra Talhada Caminhões PE", cidade: "Serra Talhada", estado: "PE",
    resumo: "Revenda no Sertão do Pajeú. Clientes em energia eólica e obras rurais.", tier: "C" },
  { titulo: "Araripina Diesel PE", cidade: "Araripina", estado: "PE",
    resumo: "Revenda no Polo Gesseiro do Araripe. Base em gesso, calcário e obras.", tier: "C" },
  { titulo: "Garanhuns Caminhões PE", cidade: "Garanhuns", estado: "PE",
    resumo: "Revenda no Agreste meridional. Clientes em laticínios, obras rurais e agro.", tier: "C" },
  { titulo: "Arcoverde Diesel PE", cidade: "Arcoverde", estado: "PE",
    resumo: "Revenda no sertão central de PE. Base em energia eólica e agronegócio.", tier: "C" },
  { titulo: "Salgueiro Caminhões PE", cidade: "Salgueiro", estado: "PE",
    resumo: "Revenda no sertão do Pajeú. Clientes em obras, agro e transportadoras.", tier: "C" },
  { titulo: "Floresta Diesel PE", cidade: "Floresta", estado: "PE",
    resumo: "Revenda no Sertão do São Francisco. Base em irrigação e obras rurais.", tier: "C" },
  { titulo: "Cabrobo Caminhões PE", cidade: "Cabrobo", estado: "PE",
    resumo: "Revenda no sertão nordestino. Clientes em agronegócio e obras de infraestrutura.", tier: "C" },
  { titulo: "Igarassu Diesel PE", cidade: "Igarassu", estado: "PE",
    resumo: "Revenda na Zona Norte da RMPE. Base em indústria, construção e logística.", tier: "C" },
  { titulo: "Cabo de Santo Agostinho Caminhões", cidade: "Cabo de Santo Agostinho", estado: "PE",
    resumo: "Revenda próxima ao Polo de Suape. Clientes em portuário e obras industriais.", tier: "C" },
  { titulo: "Jaboatão Diesel PE", cidade: "Jaboatão dos Guararapes", estado: "PE",
    resumo: "Revenda na RMPE. Base em construção, indústria e obras públicas.", tier: "C" },
  { titulo: "Olinda Caminhões PE", cidade: "Olinda", estado: "PE",
    resumo: "Revenda na Zona Norte do Recife. Clientes em construção civil e logística.", tier: "C" },
  { titulo: "Goiana Diesel PE", cidade: "Goiana", estado: "PE",
    resumo: "Revenda próxima à Fiat/Jeep de Goiana. Clientes em automotivo e construção.", tier: "C" },

  // ════════════════════════════════════════════════
  // GOIÁS — GO (20)
  // ════════════════════════════════════════════════
  { titulo: "Rota Caminhões Goiânia GO", cidade: "Goiânia", estado: "GO",
    resumo: "Principal rede de caminhões em GO. Base em construção, agronegócio e logística. Parceiro Villa.", tier: "A" },
  { titulo: "MB Caminhões Goiânia GO", cidade: "Goiânia", estado: "GO",
    resumo: "Dealer Mercedes-Benz em Goiânia. Clientes em construção civil, MCMV e transportadoras.", tier: "A" },
  { titulo: "Volvo Caminhões GO", cidade: "Goiânia", estado: "GO",
    resumo: "Concessionária Volvo em GO. Base em logística, agro e obras de infraestrutura.", tier: "A" },
  { titulo: "Scania Goiânia GO", cidade: "Goiânia", estado: "GO",
    resumo: "Dealer Scania em GO. Clientes em frigoríficos, soja e construção.", tier: "A" },
  { titulo: "Anápolis Diesel GO", cidade: "Anápolis", estado: "GO",
    resumo: "Revenda no Polo Industrial de Anápolis. Base em farmacêutica, agro e construção.", tier: "A" },
  { titulo: "Rio Verde Caminhões GO", cidade: "Rio Verde", estado: "GO",
    resumo: "Revenda na capital do agronegócio goiano. Base em soja, milho, frigoríficos e obras.", tier: "B" },
  { titulo: "Aparecida de Goiânia Diesel", cidade: "Aparecida de Goiânia", estado: "GO",
    resumo: "Revenda na RMGO. Clientes em indústria, construção civil e logística.", tier: "B" },
  { titulo: "Jataí Caminhões GO", cidade: "Jataí", estado: "GO",
    resumo: "Revenda no Sudoeste goiano. Base em agronegócio e obras rurais.", tier: "B" },
  { titulo: "Itumbiara Diesel GO", cidade: "Itumbiara", estado: "GO",
    resumo: "Revenda no Sul de GO. Base em usinas de açúcar e etanol e construção.", tier: "B" },
  { titulo: "Caldas Novas Caminhões GO", cidade: "Caldas Novas", estado: "GO",
    resumo: "Revenda no turismo termal. Clientes em construção civil e obras hoteleiras.", tier: "B" },
  { titulo: "Luziânia Diesel GO", cidade: "Luziânia", estado: "GO",
    resumo: "Revenda no entorno do DF. Base em construção, logística e obras públicas.", tier: "B" },
  { titulo: "Catalão Caminhões GO", cidade: "Catalão", estado: "GO",
    resumo: "Revenda no Sudeste goiano. Base em mineração de nióbio e obras industriais.", tier: "B" },
  { titulo: "Formosa Diesel GO", cidade: "Formosa", estado: "GO",
    resumo: "Revenda no entorno de Brasília/GO. Clientes em obras e logística regional.", tier: "C" },
  { titulo: "Mineiros Caminhões GO", cidade: "Mineiros", estado: "GO",
    resumo: "Revenda no Sudoeste de GO. Base em agronegócio e obras rurais.", tier: "C" },
  { titulo: "Quirinópolis Diesel GO", cidade: "Quirinópolis", estado: "GO",
    resumo: "Revenda no Sul de GO. Clientes em cana-de-açúcar e agroindústria.", tier: "C" },
  { titulo: "Porangatu Caminhões GO", cidade: "Porangatu", estado: "GO",
    resumo: "Revenda no Norte goiano. Base em mineração de ouro e obras regionais.", tier: "C" },
  { titulo: "Iporá Diesel GO", cidade: "Iporá", estado: "GO",
    resumo: "Revenda no Centro-Oeste goiano. Clientes em agronegócio e obras rurais.", tier: "C" },
  { titulo: "Ceres Caminhões GO", cidade: "Ceres", estado: "GO",
    resumo: "Revenda no Vale do São Patrício. Base em cana, agro e construção.", tier: "C" },
  { titulo: "Inhumas Diesel GO", cidade: "Inhumas", estado: "GO",
    resumo: "Revenda na RMGO. Clientes em agronegócio e construção civil.", tier: "C" },
  { titulo: "Trindade Caminhões GO", cidade: "Trindade", estado: "GO",
    resumo: "Revenda na RMGO. Base em turismo religioso, construção e obras locais.", tier: "C" },

  // ════════════════════════════════════════════════
  // DISTRITO FEDERAL — DF (15)
  // ════════════════════════════════════════════════
  { titulo: "Brasal Caminhões Brasília DF", cidade: "Brasília", estado: "DF",
    resumo: "Principal rede de caminhões do DF. Base em obras públicas, MCMV e logística governamental. Parceiro Villa.", tier: "A" },
  { titulo: "MB Caminhões Brasília DF", cidade: "Brasília", estado: "DF",
    resumo: "Dealer Mercedes-Benz em Brasília. Clientes em construtoras de obras públicas e logística.", tier: "A" },
  { titulo: "Volvo Caminhões DF", cidade: "Brasília", estado: "DF",
    resumo: "Concessionária Volvo no DF. Base em construtoras e transportadoras governamentais.", tier: "A" },
  { titulo: "Scania DF Brasília", cidade: "Brasília", estado: "DF",
    resumo: "Dealer Scania em Brasília. Clientes em obras de infraestrutura e logística.", tier: "A" },
  { titulo: "Taguatinga Diesel DF", cidade: "Taguatinga", estado: "DF",
    resumo: "Revenda em Taguatinga/DF. Base em construção civil e transportadoras.", tier: "B" },
  { titulo: "Gama Caminhões DF", cidade: "Gama", estado: "DF",
    resumo: "Revenda no Gama. Clientes em obras e construção civil no DF.", tier: "B" },
  { titulo: "Ceilândia Diesel DF", cidade: "Ceilândia", estado: "DF",
    resumo: "Revenda em Ceilândia. Base em construção e obras públicas no DF.", tier: "B" },
  { titulo: "Sobradinho Caminhões DF", cidade: "Sobradinho", estado: "DF",
    resumo: "Revenda em Sobradinho. Clientes em construção e logística no DF.", tier: "B" },
  { titulo: "Planaltina Diesel DF", cidade: "Planaltina", estado: "DF",
    resumo: "Revenda em Planaltina. Base em agronegócio do entorno e obras.", tier: "C" },
  { titulo: "Samambaia Caminhões DF", cidade: "Samambaia", estado: "DF",
    resumo: "Revenda em Samambaia. Clientes em construção civil e obras locais.", tier: "C" },
  { titulo: "Águas Claras Diesel DF", cidade: "Águas Claras", estado: "DF",
    resumo: "Revenda em Águas Claras. Base em imobiliário e construção civil.", tier: "C" },
  { titulo: "Recanto das Emas Caminhões", cidade: "Recanto das Emas", estado: "DF",
    resumo: "Revenda em Recanto das Emas. Clientes em obras e construção local.", tier: "C" },
  { titulo: "São Sebastião Diesel DF", cidade: "São Sebastião", estado: "DF",
    resumo: "Revenda em São Sebastião/DF. Base em construção e transportadoras.", tier: "C" },
  { titulo: "Paranoá Caminhões DF", cidade: "Paranoá", estado: "DF",
    resumo: "Revenda em Paranoá. Clientes em obras e logística regional.", tier: "C" },
  { titulo: "Brazlândia Diesel DF", cidade: "Brazlândia", estado: "DF",
    resumo: "Revenda em Brazlândia. Base em horticultura, agro e obras rurais.", tier: "C" },

  // ════════════════════════════════════════════════
  // MATO GROSSO — MT (15)
  // ════════════════════════════════════════════════
  { titulo: "MT Caminhões Cuiabá", cidade: "Cuiabá", estado: "MT",
    resumo: "Principal rede de caminhões em MT. Base em soja, pecuária e obras de infraestrutura. Parceiro Villa.", tier: "A" },
  { titulo: "MB Caminhões Cuiabá MT", cidade: "Cuiabá", estado: "MT",
    resumo: "Dealer Mercedes-Benz em MT. Clientes em agronegócio, construção e logística.", tier: "A" },
  { titulo: "Volvo Caminhões MT", cidade: "Cuiabá", estado: "MT",
    resumo: "Concessionária Volvo em MT. Base em transportadoras de grãos e construção.", tier: "A" },
  { titulo: "Scania MT Cuiabá", cidade: "Cuiabá", estado: "MT",
    resumo: "Dealer Scania em MT. Clientes em agronegócio, frigoríficos e obras.", tier: "A" },
  { titulo: "Sorriso Diesel MT", cidade: "Sorriso", estado: "MT",
    resumo: "Revenda no maior produtor de soja do Brasil. Base em agronegócio e obras rurais.", tier: "B" },
  { titulo: "Sinop Caminhões MT", cidade: "Sinop", estado: "MT",
    resumo: "Revenda no Norte do MT. Base em madeira, soja e obras de infraestrutura.", tier: "B" },
  { titulo: "Rondonópolis Diesel MT", cidade: "Rondonópolis", estado: "MT",
    resumo: "Revenda no Sul do MT. Base em fertilizantes, agro e obras de logística.", tier: "B" },
  { titulo: "Tangará da Serra Caminhões MT", cidade: "Tangará da Serra", estado: "MT",
    resumo: "Revenda no Noroeste. Base em cana, soja e obras rurais.", tier: "B" },
  { titulo: "Primavera do Leste Diesel", cidade: "Primavera do Leste", estado: "MT",
    resumo: "Revenda no Sudeste de MT. Base em algodão, soja e obras de agro.", tier: "C" },
  { titulo: "Alta Floresta Caminhões MT", cidade: "Alta Floresta", estado: "MT",
    resumo: "Revenda no Norte do MT. Base em garimpo, madeira e obras rurais.", tier: "C" },
  { titulo: "Barra do Garças Diesel MT", cidade: "Barra do Garças", estado: "MT",
    resumo: "Revenda no Leste do MT. Base em agronegócio e obras de infraestrutura.", tier: "C" },
  { titulo: "Cáceres Caminhões MT", cidade: "Cáceres", estado: "MT",
    resumo: "Revenda no Oeste do MT. Base em pecuária, pesca e obras rurais.", tier: "C" },
  { titulo: "Colíder Diesel MT", cidade: "Colíder", estado: "MT",
    resumo: "Revenda no Norte do MT. Clientes em pecuária e agronegócio.", tier: "C" },
  { titulo: "Juara Caminhões MT", cidade: "Juara", estado: "MT",
    resumo: "Revenda no Noroeste do MT. Base em pecuária e obras rurais.", tier: "C" },
  { titulo: "Várzea Grande Diesel MT", cidade: "Várzea Grande", estado: "MT",
    resumo: "Revenda na RMCUIABÁ. Clientes em construção civil e logística.", tier: "C" },

  // ════════════════════════════════════════════════
  // MATO GROSSO DO SUL — MS (15)
  // ════════════════════════════════════════════════
  { titulo: "MS Diesel Campo Grande", cidade: "Campo Grande", estado: "MS",
    resumo: "Principal rede de caminhões no MS. Base em pecuária, soja e obras de infraestrutura. Parceiro Villa.", tier: "A" },
  { titulo: "MB Caminhões Campo Grande MS", cidade: "Campo Grande", estado: "MS",
    resumo: "Dealer Mercedes-Benz em MS. Clientes em agronegócio, frigoríficos e obras.", tier: "A" },
  { titulo: "Volvo MS Capital", cidade: "Campo Grande", estado: "MS",
    resumo: "Concessionária Volvo no MS. Base em soja, milho e transportadoras.", tier: "A" },
  { titulo: "Dourados Diesel MS", cidade: "Dourados", estado: "MS",
    resumo: "Revenda no Sul do MS. Base em soja, cana e obras rurais.", tier: "B" },
  { titulo: "Três Lagoas Caminhões MS", cidade: "Três Lagoas", estado: "MS",
    resumo: "Revenda próxima às fábricas de celulose (Suzano, Eldorado). Alto potencial Villa.", tier: "B" },
  { titulo: "Corumbá Diesel MS", cidade: "Corumbá", estado: "MS",
    resumo: "Revenda na fronteira Bolívia. Base em minério de ferro e pecuária.", tier: "B" },
  { titulo: "Ponta Porã Caminhões MS", cidade: "Ponta Porã", estado: "MS",
    resumo: "Revenda na fronteira Paraguai. Clientes em comércio fronteiriço e agro.", tier: "C" },
  { titulo: "Naviraí Diesel MS", cidade: "Naviraí", estado: "MS",
    resumo: "Revenda no Sul do MS. Base em cana-de-açúcar e agronegócio.", tier: "C" },
  { titulo: "Maracaju Caminhões MS", cidade: "Maracaju", estado: "MS",
    resumo: "Revenda no centro-sul. Base em soja e obras rurais.", tier: "C" },
  { titulo: "Sidrolândia Diesel MS", cidade: "Sidrolândia", estado: "MS",
    resumo: "Revenda próxima a Campo Grande. Clientes em agronegócio e construção.", tier: "C" },
  { titulo: "Aquidauana Caminhões MS", cidade: "Aquidauana", estado: "MS",
    resumo: "Revenda no Pantanal. Base em pecuária e turismo ecológico.", tier: "C" },
  { titulo: "Coxim Diesel MS", cidade: "Coxim", estado: "MS",
    resumo: "Revenda no centro-norte do MS. Base em pesca, pecuária e obras rurais.", tier: "C" },
  { titulo: "Ribas do Rio Pardo Caminhões", cidade: "Ribas do Rio Pardo", estado: "MS",
    resumo: "Revenda próxima à nova planta Suzano (celulose). Oportunidade para usados Villa.", tier: "B" },
  { titulo: "Jaraguari Diesel MS", cidade: "Jaraguari", estado: "MS",
    resumo: "Revenda no entorno de Campo Grande. Base em agronegócio e obras.", tier: "C" },
  { titulo: "Camapuã Caminhões MS", cidade: "Camapuã", estado: "MS",
    resumo: "Revenda no centro do MS. Clientes em pecuária e obras rurais.", tier: "C" },

  // ════════════════════════════════════════════════
  // ESPÍRITO SANTO — ES (15)
  // ════════════════════════════════════════════════
  { titulo: "Vitória Diesel ES", cidade: "Vitória", estado: "ES",
    resumo: "Principal revenda de caminhões no ES. Base em portuário, mineração (Vale) e construção. Parceiro Villa.", tier: "A" },
  { titulo: "MB Caminhões ES Capital", cidade: "Vitória", estado: "ES",
    resumo: "Dealer Mercedes-Benz no ES. Clientes em obras portuárias e indústria.", tier: "A" },
  { titulo: "Volvo Caminhões ES", cidade: "Serra", estado: "ES",
    resumo: "Concessionária Volvo no ES. Base em siderurgia (CST/ArcelorMittal), portuário e obras.", tier: "A" },
  { titulo: "Serra Diesel ES", cidade: "Serra", estado: "ES",
    resumo: "Revenda no polo industrial de Serra. Base em Arcelor, Petrobras e construção.", tier: "A" },
  { titulo: "Cachoeiro de Itapemirim Caminhões", cidade: "Cachoeiro de Itapemirim", estado: "ES",
    resumo: "Revenda no sul do ES. Base em mármore, granito e construção civil.", tier: "B" },
  { titulo: "Colatina Diesel ES", cidade: "Colatina", estado: "ES",
    resumo: "Revenda no noroeste do ES. Base em café, móveis e construção.", tier: "B" },
  { titulo: "Aracruz Caminhões ES", cidade: "Aracruz", estado: "ES",
    resumo: "Revenda próxima à Suzano (celulose). Alto potencial de usados Villa.", tier: "B" },
  { titulo: "Linhares Diesel ES", cidade: "Linhares", estado: "ES",
    resumo: "Revenda no norte do ES. Clientes em petróleo (Petrobras) e construção.", tier: "B" },
  { titulo: "São Mateus Caminhões ES", cidade: "São Mateus", estado: "ES",
    resumo: "Revenda no extremo norte do ES. Base em gás, petróleo e agronegócio.", tier: "C" },
  { titulo: "Guarapari Diesel ES", cidade: "Guarapari", estado: "ES",
    resumo: "Revenda no litoral. Base em turismo, construção civil e obras.", tier: "C" },
  { titulo: "Viana Caminhões ES", cidade: "Viana", estado: "ES",
    resumo: "Revenda na Grande Vitória. Clientes em indústria e construção.", tier: "C" },
  { titulo: "Cariacica Diesel ES", cidade: "Cariacica", estado: "ES",
    resumo: "Revenda na Grande Vitória. Base em indústria e obras de infraestrutura.", tier: "C" },
  { titulo: "Domingos Martins Caminhões", cidade: "Domingos Martins", estado: "ES",
    resumo: "Revenda na serra capixaba. Clientes em pedras ornamentais e obras.", tier: "C" },
  { titulo: "Nova Venécia Diesel ES", cidade: "Nova Venécia", estado: "ES",
    resumo: "Revenda no norte do ES. Base em cerâmica, granito e construção.", tier: "C" },
  { titulo: "Mimoso do Sul Caminhões ES", cidade: "Mimoso do Sul", estado: "ES",
    resumo: "Revenda no sul do ES. Clientes em mármore, agro e obras rurais.", tier: "C" },

  // ════════════════════════════════════════════════
  // PARÁ — PA (15)
  // ════════════════════════════════════════════════
  { titulo: "Belém Diesel PA", cidade: "Belém", estado: "PA",
    resumo: "Principal revenda de caminhões no PA. Base em portuário, construção e logística. Parceiro Villa.", tier: "A" },
  { titulo: "MB Caminhões Belém PA", cidade: "Belém", estado: "PA",
    resumo: "Dealer Mercedes-Benz no PA. Clientes em mineração, portuário e obras.", tier: "A" },
  { titulo: "Volvo Caminhões PA", cidade: "Belém", estado: "PA",
    resumo: "Concessionária Volvo no PA. Base em mineração (Vale), celulose e obras.", tier: "A" },
  { titulo: "Marabá Diesel PA", cidade: "Marabá", estado: "PA",
    resumo: "Revenda no sudeste do PA. Base em mineração de ferro, construção e logística.", tier: "A" },
  { titulo: "Paragominas Caminhões PA", cidade: "Paragominas", estado: "PA",
    resumo: "Revenda próxima à mineração de bauxita. Clientes em mineração e obras.", tier: "B" },
  { titulo: "Altamira Diesel PA", cidade: "Altamira", estado: "PA",
    resumo: "Revenda na região de Belo Monte. Base em energia e obras de infraestrutura.", tier: "B" },
  { titulo: "Santarém Caminhões PA", cidade: "Santarém", estado: "PA",
    resumo: "Revenda no oeste do PA. Base em soja (porto de Santarém), pesca e obras.", tier: "B" },
  { titulo: "Castanhal Diesel PA", cidade: "Castanhal", estado: "PA",
    resumo: "Revenda na Região Metropolitana de Belém. Clientes em agro e construção.", tier: "B" },
  { titulo: "Parauapebas Caminhões PA", cidade: "Parauapebas", estado: "PA",
    resumo: "Revenda na Serra dos Carajás. Base em mineração (Vale) e obras de infraestrutura.", tier: "B" },
  { titulo: "Tucuruí Diesel PA", cidade: "Tucuruí", estado: "PA",
    resumo: "Revenda próxima à hidrelétrica de Tucuruí. Base em energia e obras.", tier: "C" },
  { titulo: "Redenção Caminhões PA", cidade: "Redenção", estado: "PA",
    resumo: "Revenda no sul do PA. Base em soja, gado e obras rurais.", tier: "C" },
  { titulo: "Itaituba Diesel PA", cidade: "Itaituba", estado: "PA",
    resumo: "Revenda no oeste do PA. Base em garimpo, ferrogrão e obras.", tier: "C" },
  { titulo: "Ananindeua Caminhões PA", cidade: "Ananindeua", estado: "PA",
    resumo: "Revenda na RMBEL. Base em construção e logística.", tier: "C" },
  { titulo: "Canaã dos Carajás Diesel", cidade: "Canaã dos Carajás", estado: "PA",
    resumo: "Revenda próxima à Mina S11D (Vale). Alta demanda de usados e obras.", tier: "B" },
  { titulo: "Tailândia Caminhões PA", cidade: "Tailândia", estado: "PA",
    resumo: "Revenda no nordeste do PA. Base em caulim e celulose.", tier: "C" },

  // ════════════════════════════════════════════════
  // AMAZONAS — AM (15)
  // ════════════════════════════════════════════════
  { titulo: "Manaus Trucks AM", cidade: "Manaus", estado: "AM",
    resumo: "Principal rede de caminhões no AM. Base em ZFM, obras industriais e construção. Parceiro Villa.", tier: "A" },
  { titulo: "MB Caminhões Manaus AM", cidade: "Manaus", estado: "AM",
    resumo: "Dealer Mercedes-Benz em Manaus. Clientes na Zona Franca e obras de infraestrutura.", tier: "A" },
  { titulo: "Volvo AM Manaus", cidade: "Manaus", estado: "AM",
    resumo: "Concessionária Volvo no AM. Base em indústria da ZFM e transportadoras.", tier: "A" },
  { titulo: "Scania AM Capital", cidade: "Manaus", estado: "AM",
    resumo: "Dealer Scania em Manaus. Clientes em construção civil e logística.", tier: "A" },
  { titulo: "Itacoatiara Diesel AM", cidade: "Itacoatiara", estado: "AM",
    resumo: "Revenda a 176km de Manaus. Base em porto fluvial, soja e construção.", tier: "B" },
  { titulo: "Parintins Caminhões AM", cidade: "Parintins", estado: "AM",
    resumo: "Revenda no baixo Amazonas. Base em turismo (Festival), agro e obras.", tier: "C" },
  { titulo: "Tabatinga Diesel AM", cidade: "Tabatinga", estado: "AM",
    resumo: "Revenda na tríplice fronteira Peru/Colômbia. Clientes em comércio e obras.", tier: "C" },
  { titulo: "Tefé Caminhões AM", cidade: "Tefé", estado: "AM",
    resumo: "Revenda no centro do AM. Base em exploração e obras regionais.", tier: "C" },
  { titulo: "Coari Diesel AM", cidade: "Coari", estado: "AM",
    resumo: "Revenda no polo de gás (Petrobras Urucu). Base em petróleo e obras.", tier: "C" },
  { titulo: "Humaitá Caminhões AM", cidade: "Humaitá", estado: "AM",
    resumo: "Revenda no sul do AM. Base em soja, madeira e obras rurais.", tier: "C" },
  { titulo: "Lábrea Diesel AM", cidade: "Lábrea", estado: "AM",
    resumo: "Revenda no sul do AM. Clientes em madeira e obras regionais.", tier: "C" },
  { titulo: "Barcelos Caminhões AM", cidade: "Barcelos", estado: "AM",
    resumo: "Revenda no noroeste do AM. Base em pesca ornamental e obras.", tier: "C" },
  { titulo: "Carauari Diesel AM", cidade: "Carauari", estado: "AM",
    resumo: "Revenda no Juruá. Clientes em borracha e obras municipais.", tier: "C" },
  { titulo: "Novo Aripuanã Caminhões AM", cidade: "Novo Aripuanã", estado: "AM",
    resumo: "Revenda no sul do AM. Base em madeira e agropecuária.", tier: "C" },
  { titulo: "Manicoré Diesel AM", cidade: "Manicoré", estado: "AM",
    resumo: "Revenda no sul do AM. Clientes em castanha, pesca e obras.", tier: "C" },

  // ════════════════════════════════════════════════
  // MARANHÃO — MA (15)
  // ════════════════════════════════════════════════
  { titulo: "São Luís Diesel MA", cidade: "São Luís", estado: "MA",
    resumo: "Principal revenda de caminhões no MA. Base em portuário, siderurgia e construção. Parceiro Villa.", tier: "A" },
  { titulo: "MB Caminhões São Luís MA", cidade: "São Luís", estado: "MA",
    resumo: "Dealer Mercedes-Benz no MA. Clientes em Itaqui, Alumar e obras.", tier: "A" },
  { titulo: "Volvo MA Capital", cidade: "São Luís", estado: "MA",
    resumo: "Concessionária Volvo no MA. Base em logística e obras de infraestrutura.", tier: "A" },
  { titulo: "Imperatriz Diesel MA", cidade: "Imperatriz", estado: "MA",
    resumo: "Revenda na segunda cidade do MA. Base em VALE (Carajás/EFC), soja e obras.", tier: "A" },
  { titulo: "Açailândia Caminhões MA", cidade: "Açailândia", estado: "MA",
    resumo: "Revenda próxima ao polo siderúrgico. Base em ferro-gusa, madeira e obras.", tier: "B" },
  { titulo: "Caxias Diesel MA", cidade: "Caxias", estado: "MA",
    resumo: "Revenda no leste do MA. Base em soja, babaçu e obras rurais.", tier: "B" },
  { titulo: "Balsas Caminhões MA", cidade: "Balsas", estado: "MA",
    resumo: "Revenda no sul do MA. Base em soja (Gerais de Balsas) e obras.", tier: "B" },
  { titulo: "Timon Diesel MA", cidade: "Timon", estado: "MA",
    resumo: "Revenda na fronteira Piauí. Clientes em agronegócio e obras.", tier: "C" },
  { titulo: "Bacabal Caminhões MA", cidade: "Bacabal", estado: "MA",
    resumo: "Revenda no centro do MA. Base em babaçu e obras rurais.", tier: "C" },
  { titulo: "Santa Inês Diesel MA", cidade: "Santa Inês", estado: "MA",
    resumo: "Revenda no centro-oeste. Base em eucalipto, celulose e obras.", tier: "C" },
  { titulo: "Pinheiro Caminhões MA", cidade: "Pinheiro", estado: "MA",
    resumo: "Revenda no oeste do MA. Clientes em babaçu, pesca e obras.", tier: "C" },
  { titulo: "Codó Diesel MA", cidade: "Codó", estado: "MA",
    resumo: "Revenda no leste do MA. Base em babaçu e obras municipais.", tier: "C" },
  { titulo: "Chapadinha Caminhões MA", cidade: "Chapadinha", estado: "MA",
    resumo: "Revenda no leste do MA. Base em soja e obras rurais.", tier: "C" },
  { titulo: "Zé Doca Diesel MA", cidade: "Zé Doca", estado: "MA",
    resumo: "Revenda no noroeste. Clientes em babaçu, madeira e obras.", tier: "C" },
  { titulo: "Coroatá Caminhões MA", cidade: "Coroatá", estado: "MA",
    resumo: "Revenda no centro do MA. Base em soja e obras rurais.", tier: "C" },

  // ════════════════════════════════════════════════
  // ESTADOS MENORES — PI, RN, PB, AL, SE, TO, RO, AC, AP, RR
  // (10 por estado)
  // ════════════════════════════════════════════════

  // PIAUÍ — PI
  { titulo: "Teresina Diesel PI", cidade: "Teresina", estado: "PI", resumo: "Principal rede de caminhões no PI. Base em construção, MCMV e logística.", tier: "A" },
  { titulo: "MB Caminhões Teresina PI", cidade: "Teresina", estado: "PI", resumo: "Dealer MB em Teresina. Clientes em obras públicas e transportadoras.", tier: "A" },
  { titulo: "Picos Caminhões PI", cidade: "Picos", estado: "PI", resumo: "Revenda no centro do PI. Base em couro, agro e obras regionais.", tier: "B" },
  { titulo: "Floriano Diesel PI", cidade: "Floriano", estado: "PI", resumo: "Revenda no sul do PI. Clientes em soja, agro e obras.", tier: "B" },
  { titulo: "Parnaíba Caminhões PI", cidade: "Parnaíba", estado: "PI", resumo: "Revenda no litoral do PI. Base em portuário, pesca e obras.", tier: "B" },
  { titulo: "Campo Maior Diesel PI", cidade: "Campo Maior", estado: "PI", resumo: "Revenda no norte do PI. Base em cera de carnaúba e agro.", tier: "C" },
  { titulo: "Barras Caminhões PI", cidade: "Barras", estado: "PI", resumo: "Revenda no centro-norte. Base em soja e obras rurais.", tier: "C" },
  { titulo: "Piripiri Diesel PI", cidade: "Piripiri", estado: "PI", resumo: "Revenda no norte do PI. Clientes em turismo (Sete Cidades) e agro.", tier: "C" },
  { titulo: "Oeiras Caminhões PI", cidade: "Oeiras", estado: "PI", resumo: "Revenda no centro. Base em agropecuária e obras municipais.", tier: "C" },
  { titulo: "Uruçuí Diesel PI", cidade: "Uruçuí", estado: "PI", resumo: "Revenda no cerrado piauiense. Base em soja e obras rurais.", tier: "C" },

  // RIO GRANDE DO NORTE — RN
  { titulo: "Natal Diesel RN", cidade: "Natal", estado: "RN", resumo: "Principal rede de caminhões no RN. Base em energia eólica, obras e construção.", tier: "A" },
  { titulo: "MB Caminhões Natal RN", cidade: "Natal", estado: "RN", resumo: "Dealer MB em Natal. Clientes em construção e energia eólica.", tier: "A" },
  { titulo: "Mossoró Caminhões RN", cidade: "Mossoró", estado: "RN", resumo: "Revenda no oeste do RN. Base em sal, petróleo e obras.", tier: "B" },
  { titulo: "Caicó Diesel RN", cidade: "Caicó", estado: "RN", resumo: "Revenda no Seridó. Base em mineração, agro e obras.", tier: "B" },
  { titulo: "Parnamirim Caminhões RN", cidade: "Parnamirim", estado: "RN", resumo: "Revenda na RMNAT. Clientes em base aérea, construção e obras.", tier: "B" },
  { titulo: "Santa Cruz Diesel RN", cidade: "Santa Cruz", estado: "RN", resumo: "Revenda no centro do RN. Base em cerâmica e agronegócio.", tier: "C" },
  { titulo: "Açu Caminhões RN", cidade: "Açu", estado: "RN", resumo: "Revenda no polo de petróleo do RN. Base em sal e energia solar.", tier: "C" },
  { titulo: "Pau dos Ferros Diesel RN", cidade: "Pau dos Ferros", estado: "RN", resumo: "Revenda no Alto Oeste do RN. Base em agronegócio e obras.", tier: "C" },
  { titulo: "São Gonçalo do Amarante Caminhões RN", cidade: "São Gonçalo do Amarante", estado: "RN", resumo: "Revenda na RMNAT. Base em construção e logística.", tier: "C" },
  { titulo: "Currais Novos Diesel RN", cidade: "Currais Novos", estado: "RN", resumo: "Revenda no Seridó. Base em scheelita, agro e obras.", tier: "C" },

  // PARAÍBA — PB
  { titulo: "João Pessoa Diesel PB", cidade: "João Pessoa", estado: "PB", resumo: "Principal rede de caminhões na PB. Base em construção, MCMV e logística.", tier: "A" },
  { titulo: "MB Caminhões João Pessoa PB", cidade: "João Pessoa", estado: "PB", resumo: "Dealer MB na PB. Clientes em obras públicas e transportadoras.", tier: "A" },
  { titulo: "Campina Grande Diesel PB", cidade: "Campina Grande", estado: "PB", resumo: "Revenda no polo industrial. Base em confecções, curtumes e obras.", tier: "B" },
  { titulo: "Patos Caminhões PB", cidade: "Patos", estado: "PB", resumo: "Revenda no Sertão da PB. Base em algodão, agro e obras.", tier: "B" },
  { titulo: "Sousa Diesel PB", cidade: "Sousa", estado: "PB", resumo: "Revenda no Alto Sertão. Base em agronegócio e obras regionais.", tier: "B" },
  { titulo: "Cajazeiras Caminhões PB", cidade: "Cajazeiras", estado: "PB", resumo: "Revenda no Alto Sertão. Clientes em agro e obras municipais.", tier: "C" },
  { titulo: "Guarabira Diesel PB", cidade: "Guarabira", estado: "PB", resumo: "Revenda no Agreste paraibano. Base em agronegócio e obras.", tier: "C" },
  { titulo: "Santa Rita Caminhões PB", cidade: "Santa Rita", estado: "PB", resumo: "Revenda na RMJP. Base em construção e logística.", tier: "C" },
  { titulo: "Bayeux Diesel PB", cidade: "Bayeux", estado: "PB", resumo: "Revenda na RMJP. Clientes em construção e transportadoras.", tier: "C" },
  { titulo: "Cabedelo Caminhões PB", cidade: "Cabedelo", estado: "PB", resumo: "Revenda no Porto de Cabedelo. Base em portuário e obras.", tier: "C" },

  // ALAGOAS — AL
  { titulo: "Maceió Diesel AL", cidade: "Maceió", estado: "AL", resumo: "Principal rede de caminhões em AL. Base em construção, MCMV e logística.", tier: "A" },
  { titulo: "MB Caminhões Maceió AL", cidade: "Maceió", estado: "AL", resumo: "Dealer MB em AL. Clientes em obras e transportadoras.", tier: "A" },
  { titulo: "Arapiraca Caminhões AL", cidade: "Arapiraca", estado: "AL", resumo: "Revenda no Agreste alagoano. Base em fumo, agro e obras.", tier: "B" },
  { titulo: "Palmeira dos Índios Diesel AL", cidade: "Palmeira dos Índios", estado: "AL", resumo: "Revenda no centro de AL. Base em agronegócio e obras regionais.", tier: "B" },
  { titulo: "União dos Palmares Caminhões AL", cidade: "União dos Palmares", estado: "AL", resumo: "Revenda no centro de AL. Clientes em cana, obras e agro.", tier: "C" },
  { titulo: "Penedo Diesel AL", cidade: "Penedo", estado: "AL", resumo: "Revenda no Vale do São Francisco. Base em fruticultura e obras.", tier: "C" },
  { titulo: "Rio Largo Caminhões AL", cidade: "Rio Largo", estado: "AL", resumo: "Revenda na Grande Maceió. Base em cana e obras locais.", tier: "C" },
  { titulo: "Marechal Deodoro Diesel AL", cidade: "Marechal Deodoro", estado: "AL", resumo: "Revenda próxima a Maceió. Clientes em pesca, turismo e construção.", tier: "C" },
  { titulo: "Santana do Ipanema Caminhões AL", cidade: "Santana do Ipanema", estado: "AL", resumo: "Revenda no Sertão. Base em agronegócio e obras rurais.", tier: "C" },
  { titulo: "Delmiro Gouveia Diesel AL", cidade: "Delmiro Gouveia", estado: "AL", resumo: "Revenda no Sertão do São Francisco. Base em energia e agro.", tier: "C" },

  // SERGIPE — SE
  { titulo: "Aracaju Diesel SE", cidade: "Aracaju", estado: "SE", resumo: "Principal rede de caminhões em SE. Base em petróleo, construção e logística.", tier: "A" },
  { titulo: "MB Caminhões Aracaju SE", cidade: "Aracaju", estado: "SE", resumo: "Dealer MB em SE. Clientes em obras públicas e transportadoras.", tier: "A" },
  { titulo: "Lagarto Caminhões SE", cidade: "Lagarto", estado: "SE", resumo: "Revenda no centro-sul de SE. Base em agronegócio e obras regionais.", tier: "B" },
  { titulo: "Itabaiana Diesel SE", cidade: "Itabaiana", estado: "SE", resumo: "Revenda no Agreste sergipano. Base em cerâmica e obras.", tier: "B" },
  { titulo: "Estância Caminhões SE", cidade: "Estância", estado: "SE", resumo: "Revenda no sul de SE. Base em coco, turismo e obras rurais.", tier: "C" },
  { titulo: "Tobias Barreto Diesel SE", cidade: "Tobias Barreto", estado: "SE", resumo: "Revenda no Agreste. Base em confecções e obras municipais.", tier: "C" },
  { titulo: "Nossa Senhora do Socorro Caminhões SE", cidade: "Nossa Senhora do Socorro", estado: "SE", resumo: "Revenda na Grande Aracaju. Clientes em construção e logística.", tier: "C" },
  { titulo: "São Cristóvão Diesel SE", cidade: "São Cristóvão", estado: "SE", resumo: "Revenda histórica. Base em construção e obras públicas.", tier: "C" },
  { titulo: "Carmópolis Caminhões SE", cidade: "Carmópolis", estado: "SE", resumo: "Revenda no polo de petróleo sergipano. Base em óleo e obras.", tier: "C" },
  { titulo: "Propriá Diesel SE", cidade: "Propriá", estado: "SE", resumo: "Revenda no Baixo São Francisco. Clientes em cana e obras.", tier: "C" },

  // TOCANTINS — TO
  { titulo: "Palmas Diesel TO", cidade: "Palmas", estado: "TO", resumo: "Principal rede de caminhões no TO. Base em construção, agro e obras públicas.", tier: "A" },
  { titulo: "MB Caminhões Palmas TO", cidade: "Palmas", estado: "TO", resumo: "Dealer MB no TO. Clientes em obras de infraestrutura e logística.", tier: "A" },
  { titulo: "Araguaína Caminhões TO", cidade: "Araguaína", estado: "TO", resumo: "Revenda na segunda cidade do TO. Base em frigoríficos, agro e obras.", tier: "B" },
  { titulo: "Gurupi Diesel TO", cidade: "Gurupi", estado: "TO", resumo: "Revenda no sul do TO. Base em soja, milho e obras rurais.", tier: "B" },
  { titulo: "Porto Nacional Caminhões TO", cidade: "Porto Nacional", estado: "TO", resumo: "Revenda próxima a Palmas. Base em agro e obras regionais.", tier: "B" },
  { titulo: "Paraíso do Tocantins Diesel", cidade: "Paraíso do Tocantins", estado: "TO", resumo: "Revenda no centro do TO. Base em agronegócio e obras.", tier: "C" },
  { titulo: "Colinas do Tocantins Caminhões", cidade: "Colinas do Tocantins", estado: "TO", resumo: "Revenda no centro-norte. Base em soja e obras rurais.", tier: "C" },
  { titulo: "Dianópolis Diesel TO", cidade: "Dianópolis", estado: "TO", resumo: "Revenda no leste do TO. Base em garimpo, agro e obras.", tier: "C" },
  { titulo: "Miracema Caminhões TO", cidade: "Miracema do Tocantins", estado: "TO", resumo: "Revenda no centro do TO. Clientes em pecuária e obras.", tier: "C" },
  { titulo: "Tocantinópolis Diesel TO", cidade: "Tocantinópolis", estado: "TO", resumo: "Revenda no extremo norte do TO. Base em agronegócio e obras.", tier: "C" },

  // RONDÔNIA — RO
  { titulo: "Porto Velho Diesel RO", cidade: "Porto Velho", estado: "RO", resumo: "Principal rede de caminhões em RO. Base em energia (Jirau/Santo Antônio), agro e obras.", tier: "A" },
  { titulo: "MB Caminhões Porto Velho RO", cidade: "Porto Velho", estado: "RO", resumo: "Dealer MB em RO. Clientes em hidrelétricas, soja e obras.", tier: "A" },
  { titulo: "Ji-Paraná Caminhões RO", cidade: "Ji-Paraná", estado: "RO", resumo: "Revenda no centro de RO. Base em soja, pecuária e obras rurais.", tier: "B" },
  { titulo: "Cacoal Diesel RO", cidade: "Cacoal", estado: "RO", resumo: "Revenda no leste de RO. Base em café, soja e obras regionais.", tier: "B" },
  { titulo: "Vilhena Caminhões RO", cidade: "Vilhena", estado: "RO", resumo: "Revenda no sul de RO. Base em soja, milho e obras rurais.", tier: "B" },
  { titulo: "Ariquemes Diesel RO", cidade: "Ariquemes", estado: "RO", resumo: "Revenda no norte de RO. Base em mineração de estanho e obras.", tier: "C" },
  { titulo: "Rolim de Moura Caminhões RO", cidade: "Rolim de Moura", estado: "RO", resumo: "Revenda no leste de RO. Base em cacau, agro e obras.", tier: "C" },
  { titulo: "Guajará-Mirim Diesel RO", cidade: "Guajará-Mirim", estado: "RO", resumo: "Revenda na fronteira Bolívia. Base em comércio e obras.", tier: "C" },
  { titulo: "Jaru Caminhões RO", cidade: "Jaru", estado: "RO", resumo: "Revenda no centro-leste. Base em agronegócio e obras rurais.", tier: "C" },
  { titulo: "Ouro Preto do Oeste Diesel RO", cidade: "Ouro Preto do Oeste", estado: "RO", resumo: "Revenda no centro de RO. Base em pecuária e obras regionais.", tier: "C" },

  // ACRE — AC
  { titulo: "Rio Branco Diesel AC", cidade: "Rio Branco", estado: "AC", resumo: "Principal rede de caminhões no AC. Base em borracha, castanha e obras.", tier: "A" },
  { titulo: "MB Caminhões Rio Branco AC", cidade: "Rio Branco", estado: "AC", resumo: "Dealer MB no AC. Clientes em construção e obras públicas.", tier: "A" },
  { titulo: "Cruzeiro do Sul Caminhões AC", cidade: "Cruzeiro do Sul", estado: "AC", resumo: "Revenda no Juruá acreano. Base em pesca, madeira e obras regionais.", tier: "B" },
  { titulo: "Sena Madureira Diesel AC", cidade: "Sena Madureira", estado: "AC", resumo: "Revenda no interior do AC. Base em seringueiros e obras municipais.", tier: "C" },
  { titulo: "Tarauacá Caminhões AC", cidade: "Tarauacá", estado: "AC", resumo: "Revenda no Juruá. Base em borracha, castanha e obras.", tier: "C" },
  { titulo: "Feijó Diesel AC", cidade: "Feijó", estado: "AC", resumo: "Revenda no sudoeste do AC. Clientes em floresta e obras rurais.", tier: "C" },
  { titulo: "Brasiléia Caminhões AC", cidade: "Brasiléia", estado: "AC", resumo: "Revenda na fronteira com o Peru/Bolívia. Base em comércio e obras.", tier: "C" },
  { titulo: "Xapuri Diesel AC", cidade: "Xapuri", estado: "AC", resumo: "Revenda histórica (Chico Mendes). Base em borracha e obras locais.", tier: "C" },
  { titulo: "Mâncio Lima Caminhões AC", cidade: "Mâncio Lima", estado: "AC", resumo: "Revenda no extremo oeste. Base em madeira e obras.", tier: "C" },
  { titulo: "Plácido de Castro Diesel AC", cidade: "Plácido de Castro", estado: "AC", resumo: "Revenda próxima à fronteira. Base em agropecuária e obras.", tier: "C" },

  // AMAPÁ — AP
  { titulo: "Macapá Diesel AP", cidade: "Macapá", estado: "AP", resumo: "Principal rede de caminhões no AP. Base em manganês, portuário e obras.", tier: "A" },
  { titulo: "MB Caminhões Macapá AP", cidade: "Macapá", estado: "AP", resumo: "Dealer MB no AP. Clientes em mineração e obras de infraestrutura.", tier: "A" },
  { titulo: "Santana Caminhões AP", cidade: "Santana", estado: "AP", resumo: "Revenda no Porto de Santana. Base em ferro, celulose e obras.", tier: "B" },
  { titulo: "Laranjal do Jari Diesel AP", cidade: "Laranjal do Jari", estado: "AP", resumo: "Revenda no Jari. Base em celulose (Orsa) e obras regionais.", tier: "C" },
  { titulo: "Oiapoque Caminhões AP", cidade: "Oiapoque", estado: "AP", resumo: "Revenda na fronteira com a Guiana Francesa. Base em comércio e obras.", tier: "C" },
  { titulo: "Mazagão Diesel AP", cidade: "Mazagão", estado: "AP", resumo: "Revenda no interior do AP. Base em pesca, açaí e obras.", tier: "C" },
  { titulo: "Porto Grande Caminhões AP", cidade: "Porto Grande", estado: "AP", resumo: "Revenda no interior. Base em agropecuária e obras rurais.", tier: "C" },
  { titulo: "Pedra Branca do Amapari Diesel", cidade: "Pedra Branca do Amapari", estado: "AP", resumo: "Revenda próxima à mineração de ouro. Base em garimpo e obras.", tier: "C" },
  { titulo: "Calçoene Caminhões AP", cidade: "Calçoene", estado: "AP", resumo: "Revenda no norte do AP. Base em mineração e obras regionais.", tier: "C" },
  { titulo: "Tartarugalzinho Diesel AP", cidade: "Tartarugalzinho", estado: "AP", resumo: "Revenda no nordeste do AP. Clientes em dendê e obras rurais.", tier: "C" },

  // RORAIMA — RR
  { titulo: "Boa Vista Diesel RR", cidade: "Boa Vista", estado: "RR", resumo: "Principal rede de caminhões em RR. Base em agronegócio, obras e logística.", tier: "A" },
  { titulo: "MB Caminhões Boa Vista RR", cidade: "Boa Vista", estado: "RR", resumo: "Dealer MB em RR. Clientes em obras públicas e agronegócio.", tier: "A" },
  { titulo: "Pacaraima Caminhões RR", cidade: "Pacaraima", estado: "RR", resumo: "Revenda na fronteira Venezuela. Base em comércio e obras locais.", tier: "B" },
  { titulo: "Caracaraí Diesel RR", cidade: "Caracaraí", estado: "RR", resumo: "Revenda no centro de RR. Base em pecuária, mineração e obras.", tier: "C" },
  { titulo: "Mucajaí Caminhões RR", cidade: "Mucajaí", estado: "RR", resumo: "Revenda no sul de RR. Base em agronegócio e obras rurais.", tier: "C" },
  { titulo: "Normandia Diesel RR", cidade: "Normandia", estado: "RR", resumo: "Revenda no leste de RR. Clientes em garimpo e obras.", tier: "C" },
  { titulo: "Bonfim Caminhões RR", cidade: "Bonfim", estado: "RR", resumo: "Revenda na fronteira Guiana. Base em comércio e obras.", tier: "C" },
  { titulo: "Cantá Diesel RR", cidade: "Cantá", estado: "RR", resumo: "Revenda próxima a Boa Vista. Base em agropecuária e obras.", tier: "C" },
  { titulo: "Iracema Caminhões RR", cidade: "Iracema", estado: "RR", resumo: "Revenda no leste de RR. Base em mineração e obras regionais.", tier: "C" },
  { titulo: "Alto Alegre Diesel RR", cidade: "Alto Alegre", estado: "RR", resumo: "Revenda no centro-norte. Base em garimpo e obras municipais.", tier: "C" },
];

// ─── Script principal ─────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${"═".repeat(60)}`);
  console.log("SEED — REVENDAS DE CAMINHÕES — 20/ESTADO BRASIL");
  console.log(`Modo: ${COMMIT ? "🔴 PRODUÇÃO (--commit)" : "🟡 DRY-RUN (sem --commit)"}`);
  console.log(`Total de empresas: ${REVENDAS.length}`);
  console.log(`${"═".repeat(60)}\n`);

  const porEstado: Record<string, number> = {};
  for (const r of REVENDAS) porEstado[r.estado] = (porEstado[r.estado] || 0) + 1;
  for (const [uf, qtd] of Object.entries(porEstado).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${uf}: ${qtd}`);
  }
  console.log("");

  if (!COMMIT) {
    for (const r of REVENDAS) console.log(`  [TIER ${r.tier}] ${r.titulo} — ${r.cidade}/${r.estado}`);
    console.log(`\n💡 Para gravar: npx tsx scripts/seed-revendas-caminhoes.ts --commit\n`);
    return;
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  let criados = 0, carteirasAdicionadas = 0, jaExistiam = 0;

  try {
    for (const r of REVENDAS) {
      const titulo = r.titulo.trim();
      const existe = await client.query(`SELECT id FROM "DossieComercial" WHERE titulo = $1 LIMIT 1`, [titulo]);

      if (existe.rows.length > 0) {
        const id = existe.rows[0].id as string;
        jaExistiam++;
        await client.query(
          `INSERT INTO "DossieCarteira" (id, "dossieId", carteira, status, "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, 'REVENDAS_CAMINHOES', 'MONITORANDO', NOW(), NOW())
           ON CONFLICT ("dossieId", carteira) DO NOTHING`,
          [id],
        );
        continue;
      }

      const ins = await client.query(
        `INSERT INTO "DossieComercial" (
           id, titulo, resumo, status, origem, tipo, segmento,
           cidade, estado, completude, score,
           "missaoAtual", "ultimaAtividade", "createdAt", "updatedAt"
         ) VALUES (
           gen_random_uuid(), $1, $2, 'INVESTIGANDO', 'JOAO_RADAR', 'EMPRESA', 'Revenda de Caminhões',
           $3, $4, 0, 0, $5,
           NOW() - INTERVAL '30 days', NOW(), NOW()
         ) RETURNING id`,
        [
          titulo, r.resumo, r.cidade, r.estado,
          `Identificar decisor de parcerias comerciais (proprietário ou gerente comercial). Proposta: revenda representa e vende usados Villa (betoneiras, bombas). Buscar LinkedIn, telefone e WhatsApp.`,
        ],
      );

      const dossieId = ins.rows[0].id as string;
      await client.query(
        `INSERT INTO "DossieCarteira" (id, "dossieId", carteira, status, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, 'REVENDAS_CAMINHOES', 'MONITORANDO', NOW(), NOW())
         ON CONFLICT ("dossieId", carteira) DO NOTHING`,
        [dossieId],
      );

      console.log(`  + [TIER ${r.tier}] ${titulo} — ${r.cidade}/${r.estado}`);
      criados++; carteirasAdicionadas++;
    }
  } finally {
    await client.end();
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`  Dossiês criados: ${criados} | Carteiras: ${carteirasAdicionadas} | Já existiam: ${jaExistiam}`);
  console.log(`\n✅ Gravado. João investiga decisores das revendas na próxima terça.\n`);
}

main().catch(err => { console.error("Erro fatal:", err); process.exit(1); });
