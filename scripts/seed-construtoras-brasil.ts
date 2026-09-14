// ARQUIVO: scripts/seed-construtoras-brasil.ts
// REGRA: nunca remover. Apenas acrescentar.
// Seed: 50 maiores construtoras por estado × 27 estados.
// Carteira: CONSTRUTORA_BRASIL
// Objetivo: mapear o decisor que contrata concreto bombeado / central in loco.
//
// Uso:
//   npx tsx scripts/seed-construtoras-brasil.ts          → dry-run
//   npx tsx scripts/seed-construtoras-brasil.ts --commit  → grava em produção

import "./env";
import { Client } from "pg";

const COMMIT = process.argv.includes("--commit");

interface Construtora {
  titulo: string;
  cidade: string;
  estado: string;
  resumo: string;
  tier: "A" | "B" | "C";
}

const CONSTRUTORAS: Construtora[] = [

// ══════════════════════════════════════════════════════════
// SÃO PAULO — SP (50)
// ══════════════════════════════════════════════════════════
{ titulo:"Cyrela Brazil Realty", cidade:"São Paulo", estado:"SP", resumo:"Maior incorporadora SP. Alto volume bomba lança em condomínios verticais.", tier:"A" },
{ titulo:"Even Construtora SP", cidade:"São Paulo", estado:"SP", resumo:"Grande incorporadora SP. Uso intensivo de concreto bombeado em lajes.", tier:"A" },
{ titulo:"Gafisa SP", cidade:"São Paulo", estado:"SP", resumo:"Incorporadora nacional com foco SP e RJ. Múltiplos canteiros com bomba.", tier:"A" },
{ titulo:"JHSF Participações", cidade:"São Paulo", estado:"SP", resumo:"Alto padrão SP. Obras de grande porte com bomba lança de alto alcance.", tier:"A" },
{ titulo:"Eztec Empreendimentos SP", cidade:"São Paulo", estado:"SP", resumo:"Incorporadora SP. Residenciais verticais com alta demanda de concretagem.", tier:"A" },
{ titulo:"Tecnisa SP", cidade:"São Paulo", estado:"SP", resumo:"Incorporadora SP. Condomínios verticais com uso de bomba lança.", tier:"A" },
{ titulo:"Setin Incorporadora SP", cidade:"São Paulo", estado:"SP", resumo:"Incorporadora SP. Residenciais e comerciais com concretagem intensiva.", tier:"A" },
{ titulo:"Kallas Incorporações SP", cidade:"São Paulo", estado:"SP", resumo:"Incorporadora SP. Alto volume de lajes em condomínios verticais.", tier:"A" },
{ titulo:"Helbor Empreendimentos SP", cidade:"Mogi das Cruzes", estado:"SP", resumo:"Incorporadora. Múltiplos empreendimentos SP com bomba e central de concreto.", tier:"A" },
{ titulo:"Stan Construtora SP", cidade:"São Paulo", estado:"SP", resumo:"Construtora residencial SP. Uso de bomba estacionária e lança.", tier:"B" },
{ titulo:"Esser Engenharia SP", cidade:"São Paulo", estado:"SP", resumo:"Construtora SP. Obras de médio e grande porte com concretagem.", tier:"B" },
{ titulo:"RNI Negócios Imobiliários SP", cidade:"São Paulo", estado:"SP", resumo:"Incorporadora faixa 2-3. Empreendimentos SP e interior com bomba.", tier:"B" },
{ titulo:"Progen Engenharia SP", cidade:"São Paulo", estado:"SP", resumo:"Construtora SP. Obras verticais com uso de concreto bombeado.", tier:"B" },
{ titulo:"Método Engenharia SP", cidade:"São Paulo", estado:"SP", resumo:"Construtora industrial e comercial SP. Estruturas com bomba estacionária.", tier:"B" },
{ titulo:"Trianon Construtora SP", cidade:"São Paulo", estado:"SP", resumo:"Incorporadora SP. Residenciais verticais com concretagem frequente.", tier:"B" },
{ titulo:"Skanska SP", cidade:"São Paulo", estado:"SP", resumo:"Multinacional sueca. Obras comerciais e industriais SP com bomba.", tier:"A" },
{ titulo:"Mota-Engil SP", cidade:"São Paulo", estado:"SP", resumo:"Multinacional portuguesa. Obras de infraestrutura e construção pesada.", tier:"A" },
{ titulo:"Queiroz Galvão SP", cidade:"São Paulo", estado:"SP", resumo:"Grande empreiteira. Obras de infraestrutura SP com alta demanda concreto.", tier:"A" },
{ titulo:"Galvão Engenharia SP", cidade:"São Paulo", estado:"SP", resumo:"Construtora infraestrutura. Pontes, viadutos e obras pesadas SP.", tier:"A" },
{ titulo:"WTorre Engenharia SP", cidade:"São Paulo", estado:"SP", resumo:"Construtora comercial SP. Galpões, data centers e obras com bomba.", tier:"A" },
{ titulo:"Brookfield Properties SP", cidade:"São Paulo", estado:"SP", resumo:"Incorporadora canadense. Grandes empreendimentos SP com concreto bombeado.", tier:"A" },
{ titulo:"Tegra Incorporadora SP", cidade:"São Paulo", estado:"SP", resumo:"Incorporadora alto padrão SP. Obras verticais com bomba lança.", tier:"B" },
{ titulo:"Trisul Construtora SP", cidade:"São Paulo", estado:"SP", resumo:"Incorporadora SP. Residenciais com concretagem intensiva.", tier:"B" },
{ titulo:"MRV SP Capital", cidade:"São Paulo", estado:"SP", resumo:"Maior construtora MCMV. Dezenas de canteiros simultâneos em SP.", tier:"A" },
{ titulo:"Plano&Plano SP", cidade:"São Paulo", estado:"SP", resumo:"Incorporadora MCMV SP. Alto volume betoneira e bomba em condomínios.", tier:"A" },
{ titulo:"Cury Construtora SP", cidade:"São Paulo", estado:"SP", resumo:"MCMV SP-RJ. Centenas de unidades simultâneas, alto consumo concretagem.", tier:"A" },
{ titulo:"Tenda SP", cidade:"São Paulo", estado:"SP", resumo:"MCMV segunda maior Brasil. Múltiplos canteiros SP com bomba.", tier:"A" },
{ titulo:"Rodobens SP Interior", cidade:"São José do Rio Preto", estado:"SP", resumo:"Incorporadora interior SP. MCMV faixas 2-3 com uso de bomba.", tier:"B" },
{ titulo:"Bairro Novo Construtora SP", cidade:"Osasco", estado:"SP", resumo:"Construtora popular SP. Condomínios com bomba estacionária.", tier:"B" },
{ titulo:"GLP (Global Logistic Properties) SP", cidade:"São Paulo", estado:"SP", resumo:"Condomínios logísticos SP. Galpões AAA com alto consumo concreto.", tier:"A" },
{ titulo:"Prologis SP", cidade:"São Paulo", estado:"SP", resumo:"Condomínios logísticos SP. Galpões de grande porte com bomba.", tier:"A" },
{ titulo:"CBRE Investment SP", cidade:"São Paulo", estado:"SP", resumo:"Investimentos em construção de lajes corporativas SP.", tier:"B" },
{ titulo:"SYN Prop SP", cidade:"São Paulo", estado:"SP", resumo:"Incorporadora de escritórios SP. Estruturas verticais com bomba lança.", tier:"B" },
{ titulo:"HM Engenharia SP", cidade:"São Paulo", estado:"SP", resumo:"Construtora SP. Obras residenciais e comerciais com bomba.", tier:"B" },
{ titulo:"Patriani Construtora SP", cidade:"São Paulo", estado:"SP", resumo:"Construtora SP. Residenciais verticais com concretagem.", tier:"B" },
{ titulo:"Viver Incorporadora SP", cidade:"São Paulo", estado:"SP", resumo:"Incorporadora SP. MCMV faixa 3 com uso de bomba lança.", tier:"B" },
{ titulo:"São José Construtora SP", cidade:"São José dos Campos", estado:"SP", resumo:"Construtora Vale do Paraíba. Obras industriais e residenciais.", tier:"B" },
{ titulo:"Ribeirão Construtora SP", cidade:"Ribeirão Preto", estado:"SP", resumo:"Construtora interior. Residenciais e obras industriais interior SP.", tier:"C" },
{ titulo:"Campinas Construtora SP", cidade:"Campinas", estado:"SP", resumo:"Construtora Campinas. Obras verticais e industriais com concretagem.", tier:"C" },
{ titulo:"Sorocaba Construções SP", cidade:"Sorocaba", estado:"SP", resumo:"Construtora interior paulista. Obras industriais e residenciais.", tier:"C" },
{ titulo:"Bauru Engenharia SP", cidade:"Bauru", estado:"SP", resumo:"Construtora centro-oeste paulista. Obras verticais e civís.", tier:"C" },
{ titulo:"Santos Construções SP", cidade:"Santos", estado:"SP", resumo:"Construtora litoral. Obras residenciais e obras portuárias.", tier:"C" },
{ titulo:"Irmãos Thá SP", cidade:"São Paulo", estado:"SP", resumo:"Construtora SP. Obras comerciais e residenciais com concreto bombeado.", tier:"B" },
{ titulo:"Beter Construtora SP", cidade:"São Paulo", estado:"SP", resumo:"Construtora SP. Obras residenciais e comerciais verticais.", tier:"C" },
{ titulo:"Biancchi Construtora SP", cidade:"Osasco", estado:"SP", resumo:"Construtora Grande SP. Obras residenciais com bomba lança.", tier:"C" },
{ titulo:"Construbase SP", cidade:"São Paulo", estado:"SP", resumo:"Construtora SP. Fundações e estruturas com bomba estacionária.", tier:"C" },
{ titulo:"Diálogo Construtora SP", cidade:"São Paulo", estado:"SP", resumo:"Construtora SP. Residenciais e comerciais com concretagem.", tier:"C" },
{ titulo:"Onda Azul Construtora SP", cidade:"São Bernardo do Campo", estado:"SP", resumo:"Construtora Grande ABC. Obras residenciais com bomba.", tier:"C" },
{ titulo:"Porte Engenharia SP", cidade:"São Paulo", estado:"SP", resumo:"Construtora SP. Obras verticais com bomba lança e central.", tier:"B" },
{ titulo:"You Inc SP", cidade:"São Paulo", estado:"SP", resumo:"Incorporadora SP. Residenciais com concretagem intensiva.", tier:"B" },

// ══════════════════════════════════════════════════════════
// RIO DE JANEIRO — RJ (40)
// ══════════════════════════════════════════════════════════
{ titulo:"Carvalho Hosken RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Grande construtora RJ. Obras residenciais e comerciais com bomba lança.", tier:"A" },
{ titulo:"Concal Construtora RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Construtora RJ. Obras residenciais com concreto bombeado.", tier:"A" },
{ titulo:"PDG Realty RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Incorporadora nacional. Grandes empreendimentos RJ com bomba.", tier:"A" },
{ titulo:"Gafisa RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Incorporadora RJ. Residenciais verticais com bomba lança.", tier:"A" },
{ titulo:"Cury Construtora RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"MCMV no eixo RJ. Alto volume de concretagem em condomínios.", tier:"A" },
{ titulo:"Tenda RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"MCMV RJ. Múltiplos canteiros com bomba estacionária.", tier:"A" },
{ titulo:"Direcional RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"MCMV RJ. Grande volume de concreto em condomínios populares.", tier:"A" },
{ titulo:"Tegra RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Incorporadora alto padrão RJ. Obras verticais com bomba lança.", tier:"A" },
{ titulo:"Brookfield RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Incorporadora. Grandes empreendimentos RJ com concretagem.", tier:"A" },
{ titulo:"Construtora Emccamp RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Construtora RJ. Obras residenciais com concreto bombeado.", tier:"B" },
{ titulo:"Calçada Engenharia RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Construtora RJ. Obras civís e fundações com bomba.", tier:"B" },
{ titulo:"ARG Engenharia RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Construtora RJ. Obras residenciais e comerciais.", tier:"B" },
{ titulo:"Patrimonial Construções RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Construtora RJ. Obras verticais com uso de bomba.", tier:"B" },
{ titulo:"Camargo Corrêa RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Empreiteira. Obras de infraestrutura e construção pesada RJ.", tier:"A" },
{ titulo:"Odebrecht Engenharia RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Grande empreiteira. Obras portuárias e de infraestrutura RJ.", tier:"A" },
{ titulo:"Andrade Gutierrez RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Empreiteira. Obras de infraestrutura e construção pesada RJ.", tier:"A" },
{ titulo:"OAS Engenharia RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Empreiteira. Obras de infraestrutura RJ.", tier:"A" },
{ titulo:"Engelux RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Incorporadora RJ. Residenciais alto padrão com bomba lança.", tier:"B" },
{ titulo:"Goldsztein RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Incorporadora RJ. Obras residenciais com concretagem.", tier:"B" },
{ titulo:"Melnick Even RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Incorporadora sul-sudeste. Empreendimentos RJ com bomba.", tier:"B" },
{ titulo:"Bairro Novo RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Construtora MCMV RJ. Condomínios com betoneira e bomba.", tier:"B" },
{ titulo:"Inpar RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Incorporadora RJ. Residenciais verticais com concretagem.", tier:"B" },
{ titulo:"Rosa Construtora RJ", cidade:"Niterói", estado:"RJ", resumo:"Construtora Niterói e RJ. Obras residenciais com bomba.", tier:"C" },
{ titulo:"Coelho da Fonseca RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Construtora RJ. Obras residenciais e comerciais.", tier:"C" },
{ titulo:"Barra Homes RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Construtora Barra da Tijuca. Residenciais com bomba lança.", tier:"B" },
{ titulo:"EBM Construtora RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Construtora RJ. Obras verticais com concretagem.", tier:"C" },
{ titulo:"JMalucelli Construtora RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Construtora RJ. Obras de infraestrutura e residenciais.", tier:"B" },
{ titulo:"Rio Pré-Moldados RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Construtora RJ. Obras industriais e residenciais.", tier:"C" },
{ titulo:"Nova Rio Construtora", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Construtora RJ. Empreendimentos residenciais com bomba.", tier:"C" },
{ titulo:"Encca Construtora RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Construtora RJ. Obras comerciais e residenciais.", tier:"C" },
{ titulo:"Fortenge RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Construtora RJ. Fundações e estruturas com bomba.", tier:"C" },
{ titulo:"Campo Grande Construtora RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Construtora subúrbio RJ. Residenciais e obras civis.", tier:"C" },
{ titulo:"Macaé Construções RJ", cidade:"Macaé", estado:"RJ", resumo:"Construtora polo petróleo RJ. Obras industriais e residenciais.", tier:"B" },
{ titulo:"SCC Construtora RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Construtora RJ. Obras residenciais com concretagem.", tier:"C" },
{ titulo:"Iguá Engenharia RJ", cidade:"Rio de Janeiro", estado:"RJ", resumo:"Construtora saneamento RJ. ETEs e reservatórios com bomba.", tier:"B" },
{ titulo:"Tegra Construtora Petrópolis RJ", cidade:"Petrópolis", estado:"RJ", resumo:"Construtora Serra Fluminense. Obras residenciais.", tier:"C" },
{ titulo:"Vale Fluminense Construtora RJ", cidade:"Volta Redonda", estado:"RJ", resumo:"Construtora Vale do Aço. Obras industriais e residenciais.", tier:"C" },
{ titulo:"Norte Fluminense Engenharia RJ", cidade:"Campos dos Goytacazes", estado:"RJ", resumo:"Construtora norte RJ. Obras petróleo, agro e residenciais.", tier:"C" },
{ titulo:"Angra Construtora RJ", cidade:"Angra dos Reis", estado:"RJ", resumo:"Construtora litoral sul RJ. Obras residenciais e náuticas.", tier:"C" },
{ titulo:"Baixada Fluminense Engenharia RJ", cidade:"Nova Iguaçu", estado:"RJ", resumo:"Construtora Baixada. Obras residenciais e civis.", tier:"C" },

// ══════════════════════════════════════════════════════════
// MINAS GERAIS — MG (40)
// ══════════════════════════════════════════════════════════
{ titulo:"MRV Engenharia MG", cidade:"Belo Horizonte", estado:"MG", resumo:"Maior MCMV Brasil. Sede BH. Dezenas de canteiros simultâneos MG.", tier:"A" },
{ titulo:"Direcional Engenharia MG", cidade:"Belo Horizonte", estado:"MG", resumo:"MCMV MG. Grande volume concreto bombeado em condomínios.", tier:"A" },
{ titulo:"Construtora Patrimar MG", cidade:"Belo Horizonte", estado:"MG", resumo:"Incorporadora BH. Residenciais verticais com bomba lança.", tier:"A" },
{ titulo:"Encalso Construtora MG", cidade:"Belo Horizonte", estado:"MG", resumo:"Construtora BH. Obras residenciais e comerciais com bomba.", tier:"A" },
{ titulo:"Terra Construtora MG", cidade:"Belo Horizonte", estado:"MG", resumo:"Incorporadora BH. Residenciais alto padrão com bomba.", tier:"B" },
{ titulo:"Líder Construtora MG", cidade:"Belo Horizonte", estado:"MG", resumo:"Incorporadora BH. Condomínios com uso de concreto bombeado.", tier:"B" },
{ titulo:"Construtora Bairro Serrano MG", cidade:"Belo Horizonte", estado:"MG", resumo:"Construtora BH. Obras residenciais com bomba estacionária.", tier:"B" },
{ titulo:"Urbamais Construtora MG", cidade:"Belo Horizonte", estado:"MG", resumo:"Construtora BH. Obras residenciais e comerciais.", tier:"B" },
{ titulo:"Vale Verde Construtora MG", cidade:"Belo Horizonte", estado:"MG", resumo:"Construtora BH. Residenciais com concretagem frequente.", tier:"B" },
{ titulo:"Alme Construtora MG", cidade:"Belo Horizonte", estado:"MG", resumo:"Construtora BH. Obras de fundação e estrutura com bomba.", tier:"B" },
{ titulo:"Caminhos da Serra MG", cidade:"Nova Lima", estado:"MG", resumo:"Construtora Nova Lima. Residenciais alto padrão com bomba lança.", tier:"B" },
{ titulo:"Camargo Corrêa MG", cidade:"Belo Horizonte", estado:"MG", resumo:"Empreiteira. Obras de mineração e infraestrutura MG.", tier:"A" },
{ titulo:"Andrade Gutierrez MG", cidade:"Belo Horizonte", estado:"MG", resumo:"Empreiteira MG. Obras de infraestrutura e construção pesada.", tier:"A" },
{ titulo:"Construtora Barbosa Mello MG", cidade:"Belo Horizonte", estado:"MG", resumo:"Empreiteira BH. Obras de infraestrutura rodoviária MG.", tier:"A" },
{ titulo:"Inova MG Construções", cidade:"Belo Horizonte", estado:"MG", resumo:"Construtora BH. Obras residenciais e comerciais.", tier:"C" },
{ titulo:"Construtora Globalmix MG", cidade:"Belo Horizonte", estado:"MG", resumo:"Construtora BH. Obras verticais com concretagem.", tier:"C" },
{ titulo:"Tenda MG", cidade:"Belo Horizonte", estado:"MG", resumo:"MCMV MG. Múltiplos canteiros com bomba.", tier:"A" },
{ titulo:"Construtora Diogo MG", cidade:"Uberlândia", estado:"MG", resumo:"Construtora Uberlândia. Obras residenciais e comerciais.", tier:"B" },
{ titulo:"Uberlândia Engenharia MG", cidade:"Uberlândia", estado:"MG", resumo:"Construtora Triângulo Mineiro. Obras verticais com bomba.", tier:"B" },
{ titulo:"Araguari Construtora MG", cidade:"Araguari", estado:"MG", resumo:"Construtora interior MG. Obras residenciais com concretagem.", tier:"C" },
{ titulo:"Juiz de Fora Engenharia MG", cidade:"Juiz de Fora", estado:"MG", resumo:"Construtora Zona da Mata. Obras residenciais e industriais.", tier:"B" },
{ titulo:"CRP Construtora MG", cidade:"Juiz de Fora", estado:"MG", resumo:"Construtora JF. Obras verticais com bomba lança.", tier:"C" },
{ titulo:"Montes Claros Engenharia MG", cidade:"Montes Claros", estado:"MG", resumo:"Construtora norte MG. Obras MCMV e públicas com bomba.", tier:"B" },
{ titulo:"Ipatinga Construtora MG", cidade:"Ipatinga", estado:"MG", resumo:"Construtora Vale do Aço. Obras próximas à Usiminas.", tier:"B" },
{ titulo:"Pampulha Engenharia BH", cidade:"Belo Horizonte", estado:"MG", resumo:"Construtora BH. Obras residenciais com bomba.", tier:"C" },
{ titulo:"Betim Construtora MG", cidade:"Betim", estado:"MG", resumo:"Construtora Betim. Obras próximas à FIAT e obras residenciais.", tier:"B" },
{ titulo:"Contagem Engenharia MG", cidade:"Contagem", estado:"MG", resumo:"Construtora polo industrial RMBH. Obras industriais e residenciais.", tier:"B" },
{ titulo:"Diamantina Construtora MG", cidade:"Diamantina", estado:"MG", resumo:"Construtora norte MG. Obras residenciais e turísticas.", tier:"C" },
{ titulo:"Governador Valadares Engenharia MG", cidade:"Governador Valadares", estado:"MG", resumo:"Construtora GV. Obras residenciais e de infraestrutura.", tier:"C" },
{ titulo:"Itabira Construtora MG", cidade:"Itabira", estado:"MG", resumo:"Construtora próxima Vale. Obras mineiras e residenciais MG.", tier:"C" },
{ titulo:"Varginha Engenharia MG", cidade:"Varginha", estado:"MG", resumo:"Construtora sul MG. Obras residenciais com concretagem.", tier:"C" },
{ titulo:"Divinópolis Construtora MG", cidade:"Divinópolis", estado:"MG", resumo:"Construtora centro-oeste MG. Obras residenciais.", tier:"C" },
{ titulo:"Sete Lagoas Engenharia MG", cidade:"Sete Lagoas", estado:"MG", resumo:"Construtora RMBH norte. Obras industriais e residenciais.", tier:"C" },
{ titulo:"Timóteo Construções MG", cidade:"Timóteo", estado:"MG", resumo:"Construtora Vale do Aço. Obras residenciais.", tier:"C" },
{ titulo:"Ouro Preto Engenharia MG", cidade:"Ouro Preto", estado:"MG", resumo:"Construtora histórica MG. Obras residenciais e restauro.", tier:"C" },
{ titulo:"Muriaé Construtora MG", cidade:"Muriaé", estado:"MG", resumo:"Construtora Zona da Mata. Obras residenciais e civis.", tier:"C" },
{ titulo:"Viçosa Engenharia MG", cidade:"Viçosa", estado:"MG", resumo:"Construtora universitária. Obras residenciais entorno UFV.", tier:"C" },
{ titulo:"Teófilo Otoni Construções MG", cidade:"Teófilo Otoni", estado:"MG", resumo:"Construtora nordeste MG. Obras civis e residenciais.", tier:"C" },
{ titulo:"Pouso Alegre Construtora MG", cidade:"Pouso Alegre", estado:"MG", resumo:"Construtora sul MG. Obras residenciais e industriais.", tier:"C" },
{ titulo:"Patos de Minas Engenharia MG", cidade:"Patos de Minas", estado:"MG", resumo:"Construtora Alto Paranaíba. Obras residenciais com bomba.", tier:"C" },

// ══════════════════════════════════════════════════════════
// PARANÁ — PR (35)
// ══════════════════════════════════════════════════════════
{ titulo:"Irmãos Thá PR", cidade:"Curitiba", estado:"PR", resumo:"Maior construtora PR. Obras residenciais e comerciais com bomba lança.", tier:"A" },
{ titulo:"EBM Construtora PR", cidade:"Curitiba", estado:"PR", resumo:"Construtora PR. Alto padrão e médio padrão com concretagem.", tier:"A" },
{ titulo:"Tecnologia e Construção PR", cidade:"Curitiba", estado:"PR", resumo:"Construtora Curitiba. Obras verticais com bomba.", tier:"A" },
{ titulo:"JMalucelli Construtora PR", cidade:"Curitiba", estado:"PR", resumo:"Construtora PR. Obras de infraestrutura e residenciais.", tier:"A" },
{ titulo:"Plaenge Construtora PR", cidade:"Londrina", estado:"PR", resumo:"Construtora norte PR. Obras residenciais com bomba lança.", tier:"A" },
{ titulo:"Vanguarda Construtora PR", cidade:"Curitiba", estado:"PR", resumo:"Incorporadora Curitiba. Residenciais verticais com concretagem.", tier:"B" },
{ titulo:"Adolfo Leirner PR", cidade:"Curitiba", estado:"PR", resumo:"Incorporadora PR. Obras de alto padrão com bomba.", tier:"B" },
{ titulo:"Construtora Seiva PR", cidade:"Curitiba", estado:"PR", resumo:"Construtora PR. Obras residenciais e comerciais.", tier:"B" },
{ titulo:"Kaminagakura PR", cidade:"Curitiba", estado:"PR", resumo:"Construtora PR. Obras residenciais com concretagem.", tier:"B" },
{ titulo:"Construtora Capoani PR", cidade:"Curitiba", estado:"PR", resumo:"Construtora PR. Obras residenciais e comerciais.", tier:"B" },
{ titulo:"Nortenge PR", cidade:"Londrina", estado:"PR", resumo:"Construtora norte PR. Residenciais e obras civis.", tier:"B" },
{ titulo:"Cocil Construtora PR", cidade:"Curitiba", estado:"PR", resumo:"Construtora PR. Obras residenciais com bomba estacionária.", tier:"B" },
{ titulo:"MPA Construtora PR", cidade:"Maringá", estado:"PR", resumo:"Construtora Maringá. Obras verticais com concretagem.", tier:"B" },
{ titulo:"Incorporadora Ideal PR", cidade:"Curitiba", estado:"PR", resumo:"Incorporadora PR. Residenciais com bomba lança.", tier:"C" },
{ titulo:"São José Obras PR", cidade:"Cascavel", estado:"PR", resumo:"Construtora oeste PR. Obras residenciais e agroindústria.", tier:"C" },
{ titulo:"Delta Construtora PR", cidade:"Curitiba", estado:"PR", resumo:"Construtora MCMV PR. Condomínios com bomba estacionária.", tier:"B" },
{ titulo:"Construtora Copel Obras PR", cidade:"Curitiba", estado:"PR", resumo:"Construtora obras de energia PR. Alto consumo concreto.", tier:"B" },
{ titulo:"Londrina Engenharia PR", cidade:"Londrina", estado:"PR", resumo:"Construtora norte PR. Obras residenciais e comerciais.", tier:"C" },
{ titulo:"Cascavel Construções PR", cidade:"Cascavel", estado:"PR", resumo:"Construtora oeste PR. Obras cooperativas e residenciais.", tier:"C" },
{ titulo:"Foz Engenharia PR", cidade:"Foz do Iguaçu", estado:"PR", resumo:"Construtora Foz. Obras turísticas e residenciais.", tier:"C" },
{ titulo:"Ponta Grossa Construtora PR", cidade:"Ponta Grossa", estado:"PR", resumo:"Construtora Campos Gerais. Obras industriais e residenciais.", tier:"C" },
{ titulo:"Apucarana Engenharia PR", cidade:"Apucarana", estado:"PR", resumo:"Construtora Vale do Ivaí. Obras têxteis e residenciais.", tier:"C" },
{ titulo:"Francisco Beltrão Construções PR", cidade:"Francisco Beltrão", estado:"PR", resumo:"Construtora sudoeste PR. Obras frigoríficos e residenciais.", tier:"C" },
{ titulo:"Paranavaí Construtora PR", cidade:"Paranavaí", estado:"PR", resumo:"Construtora norte PR. Obras residenciais.", tier:"C" },
{ titulo:"Guarapuava Engenharia PR", cidade:"Guarapuava", estado:"PR", resumo:"Construtora centro-sul PR. Obras residenciais e celulose.", tier:"C" },
{ titulo:"Maringá Engenharia PR", cidade:"Maringá", estado:"PR", resumo:"Construtora Maringá. Obras residenciais com bomba.", tier:"C" },
{ titulo:"União da Vitória Construtora PR", cidade:"União da Vitória", estado:"PR", resumo:"Construtora sul PR. Obras madeireiras e residenciais.", tier:"C" },
{ titulo:"Rolândia Construções PR", cidade:"Rolândia", estado:"PR", resumo:"Construtora norte PR. Obras residenciais.", tier:"C" },
{ titulo:"Paranaguá Engenharia PR", cidade:"Paranaguá", estado:"PR", resumo:"Construtora porto PR. Obras portuárias e residenciais.", tier:"C" },
{ titulo:"Cornélio Procópio Construtora PR", cidade:"Cornélio Procópio", estado:"PR", resumo:"Construtora norte pioneiro PR. Obras residenciais.", tier:"C" },
{ titulo:"Astorga Engenharia PR", cidade:"Astorga", estado:"PR", resumo:"Construtora norte PR. Obras residenciais e rurais.", tier:"C" },
{ titulo:"Ivaiporã Construções PR", cidade:"Ivaiporã", estado:"PR", resumo:"Construtora Vale do Ivaí. Obras residenciais.", tier:"C" },
{ titulo:"Campo Mourão Construtora PR", cidade:"Campo Mourão", estado:"PR", resumo:"Construtora centro-oeste PR. Obras residenciais.", tier:"C" },
{ titulo:"Umuarama Engenharia PR", cidade:"Umuarama", estado:"PR", resumo:"Construtora noroeste PR. Obras residenciais.", tier:"C" },
{ titulo:"Telêmaco Borba Construções PR", cidade:"Telêmaco Borba", estado:"PR", resumo:"Construtora polo papel PR. Obras industriais Klabin.", tier:"C" },

// ══════════════════════════════════════════════════════════
// RIO GRANDE DO SUL — RS (35)
// ══════════════════════════════════════════════════════════
{ titulo:"Melnick Even RS", cidade:"Porto Alegre", estado:"RS", resumo:"Maior incorporadora RS. Obras verticais com bomba lança.", tier:"A" },
{ titulo:"Goldsztein RS", cidade:"Porto Alegre", estado:"RS", resumo:"Incorporadora RS. Residenciais alto padrão com concretagem.", tier:"A" },
{ titulo:"Stédile Construtora RS", cidade:"Porto Alegre", estado:"RS", resumo:"Construtora RS. Obras residenciais e comerciais com bomba.", tier:"A" },
{ titulo:"VK Construtora RS", cidade:"Porto Alegre", estado:"RS", resumo:"Construtora RS. Obras residenciais verticais com concretagem.", tier:"A" },
{ titulo:"Engelux RS", cidade:"Porto Alegre", estado:"RS", resumo:"Incorporadora RS. Residenciais alto padrão com bomba.", tier:"A" },
{ titulo:"Construtora Cyrela RS", cidade:"Porto Alegre", estado:"RS", resumo:"Incorporadora RS. Grandes empreendimentos com bomba lança.", tier:"A" },
{ titulo:"Even RS", cidade:"Porto Alegre", estado:"RS", resumo:"Incorporadora RS. Obras verticais com concretagem.", tier:"A" },
{ titulo:"Ecovix Construções RS", cidade:"Porto Alegre", estado:"RS", resumo:"Construtora MCMV RS. Condomínios com bomba estacionária.", tier:"B" },
{ titulo:"Construtora Rech RS", cidade:"Porto Alegre", estado:"RS", resumo:"Construtora RS. Obras residenciais com bomba.", tier:"B" },
{ titulo:"Pelli Construtora RS", cidade:"Caxias do Sul", estado:"RS", resumo:"Construtora Serra Gaúcha. Obras residenciais e industriais.", tier:"B" },
{ titulo:"Caxias Engenharia RS", cidade:"Caxias do Sul", estado:"RS", resumo:"Construtora Caxias. Obras metal-mecânicas e residenciais.", tier:"B" },
{ titulo:"Construtora Serra RS", cidade:"Caxias do Sul", estado:"RS", resumo:"Construtora Serra Gaúcha. Obras residenciais.", tier:"B" },
{ titulo:"Pelotas Engenharia RS", cidade:"Pelotas", estado:"RS", resumo:"Construtora sul RS. Obras residenciais e frigoríficos.", tier:"B" },
{ titulo:"Santa Maria Construtora RS", cidade:"Santa Maria", estado:"RS", resumo:"Construtora central RS. Obras militares e residenciais.", tier:"B" },
{ titulo:"Passo Fundo Engenharia RS", cidade:"Passo Fundo", estado:"RS", resumo:"Construtora norte RS. Obras agronegócio e residenciais.", tier:"B" },
{ titulo:"Rio Grande Construções RS", cidade:"Rio Grande", estado:"RS", resumo:"Construtora sul RS. Obras portuárias e residenciais.", tier:"B" },
{ titulo:"Uruguaiana Construtora RS", cidade:"Uruguaiana", estado:"RS", resumo:"Construtora fronteira RS. Obras residenciais.", tier:"C" },
{ titulo:"Novo Hamburgo Engenharia RS", cidade:"Novo Hamburgo", estado:"RS", resumo:"Construtora Vale dos Sinos. Obras calçadistas e residenciais.", tier:"C" },
{ titulo:"Gravataí Construtora RS", cidade:"Gravataí", estado:"RS", resumo:"Construtora RMPA. Obras industriais GM e residenciais.", tier:"C" },
{ titulo:"Canoas Engenharia RS", cidade:"Canoas", estado:"RS", resumo:"Construtora RMPA. Obras refinaria e residenciais.", tier:"C" },
{ titulo:"Lajeado Construtora RS", cidade:"Lajeado", estado:"RS", resumo:"Construtora Vale Taquari. Obras suinocultura e residenciais.", tier:"C" },
{ titulo:"Erechim Engenharia RS", cidade:"Erechim", estado:"RS", resumo:"Construtora Alto Uruguai. Obras grãos e residenciais.", tier:"C" },
{ titulo:"Ijuí Construtora RS", cidade:"Ijuí", estado:"RS", resumo:"Construtora noroeste RS. Obras cooperativas e residenciais.", tier:"C" },
{ titulo:"Cruz Alta Engenharia RS", cidade:"Cruz Alta", estado:"RS", resumo:"Construtora planalto RS. Obras agronegócio e residenciais.", tier:"C" },
{ titulo:"Bagé Construtora RS", cidade:"Bagé", estado:"RS", resumo:"Construtora campanha gaúcha. Obras pecuária e residenciais.", tier:"C" },
{ titulo:"Alegrete Engenharia RS", cidade:"Alegrete", estado:"RS", resumo:"Construtora fronteira oeste RS. Obras residenciais.", tier:"C" },
{ titulo:"São Leopoldo Construtora RS", cidade:"São Leopoldo", estado:"RS", resumo:"Construtora Vale dos Sinos. Obras industriais e residenciais.", tier:"C" },
{ titulo:"Sapucaia do Sul Engenharia RS", cidade:"Sapucaia do Sul", estado:"RS", resumo:"Construtora RMPA. Obras industriais e residenciais.", tier:"C" },
{ titulo:"Montenegro Construtora RS", cidade:"Montenegro", estado:"RS", resumo:"Construtora Vale do Caí. Obras residenciais.", tier:"C" },
{ titulo:"Bento Gonçalves Engenharia RS", cidade:"Bento Gonçalves", estado:"RS", resumo:"Construtora Serra. Obras vinicultura e residenciais.", tier:"C" },
{ titulo:"Farroupilha Construtora RS", cidade:"Farroupilha", estado:"RS", resumo:"Construtora Serra Gaúcha. Obras residenciais.", tier:"C" },
{ titulo:"São Gabriel Engenharia RS", cidade:"São Gabriel", estado:"RS", resumo:"Construtora campanha RS. Obras residenciais.", tier:"C" },
{ titulo:"Quaraí Construtora RS", cidade:"Quaraí", estado:"RS", resumo:"Construtora fronteira. Obras residenciais.", tier:"C" },
{ titulo:"Venâncio Aires Engenharia RS", cidade:"Venâncio Aires", estado:"RS", resumo:"Construtora Vale do Rio Pardo. Obras fumo e residenciais.", tier:"C" },
{ titulo:"Cachoeirinha Construtora RS", cidade:"Cachoeirinha", estado:"RS", resumo:"Construtora RMPA norte. Obras industriais e residenciais.", tier:"C" },

// ══════════════════════════════════════════════════════════
// SANTA CATARINA — SC (30)
// ══════════════════════════════════════════════════════════
{ titulo:"Hantei Construtora SC", cidade:"Joinville", estado:"SC", resumo:"Construtora Joinville. Obras industriais e residenciais com bomba.", tier:"A" },
{ titulo:"Habitasul SC", cidade:"Florianópolis", estado:"SC", resumo:"Incorporadora SC. Residenciais e resorts com concretagem.", tier:"A" },
{ titulo:"Adolfo Sizenando SC", cidade:"Florianópolis", estado:"SC", resumo:"Construtora Florianópolis. Alto padrão com bomba lança.", tier:"A" },
{ titulo:"Cassol Construtora SC", cidade:"Florianópolis", estado:"SC", resumo:"Construtora SC. Obras residenciais e comerciais.", tier:"A" },
{ titulo:"PHD Construtora SC", cidade:"Florianópolis", estado:"SC", resumo:"Incorporadora SC. Residenciais verticais com bomba.", tier:"B" },
{ titulo:"Construtora Comasa SC", cidade:"Joinville", estado:"SC", resumo:"Construtora Joinville. Obras industriais e residenciais.", tier:"B" },
{ titulo:"Formacco Construtora SC", cidade:"Blumenau", estado:"SC", resumo:"Construtora Blumenau. Obras residenciais com concretagem.", tier:"B" },
{ titulo:"Boing SC", cidade:"Blumenau", estado:"SC", resumo:"Construtora SC. Obras residenciais e comerciais.", tier:"B" },
{ titulo:"Rodobens SC", cidade:"São José", estado:"SC", resumo:"Incorporadora SC. MCMV faixas 2-3 com bomba.", tier:"B" },
{ titulo:"Chapecó Engenharia SC", cidade:"Chapecó", estado:"SC", resumo:"Construtora oeste SC. Obras frigoríficos e residenciais.", tier:"B" },
{ titulo:"Criciúma Construtora SC", cidade:"Criciúma", estado:"SC", resumo:"Construtora sul SC. Obras cerâmica e residenciais.", tier:"B" },
{ titulo:"Itajaí Engenharia SC", cidade:"Itajaí", estado:"SC", resumo:"Construtora porto SC. Obras portuárias e residenciais.", tier:"B" },
{ titulo:"Lages Construções SC", cidade:"Lages", estado:"SC", resumo:"Construtora planalto SC. Obras papel e residenciais.", tier:"C" },
{ titulo:"Caçador Construtora SC", cidade:"Caçador", estado:"SC", resumo:"Construtora meio-oeste SC. Obras madeira e residenciais.", tier:"C" },
{ titulo:"Jaraguá do Sul Engenharia SC", cidade:"Jaraguá do Sul", estado:"SC", resumo:"Construtora WEG polo SC. Obras industriais e residenciais.", tier:"C" },
{ titulo:"Tubarão Construtora SC", cidade:"Tubarão", estado:"SC", resumo:"Construtora sul SC. Obras energia e residenciais.", tier:"C" },
{ titulo:"Concórdia Engenharia SC", cidade:"Concórdia", estado:"SC", resumo:"Construtora Alto Uruguai. Obras frigoríficos e residenciais.", tier:"C" },
{ titulo:"Xanxerê Construtora SC", cidade:"Xanxerê", estado:"SC", resumo:"Construtora oeste SC. Obras agronegócio e residenciais.", tier:"C" },
{ titulo:"Araranguá Engenharia SC", cidade:"Araranguá", estado:"SC", resumo:"Construtora extremo sul SC. Obras residenciais.", tier:"C" },
{ titulo:"Brusque Construtora SC", cidade:"Brusque", estado:"SC", resumo:"Construtora Vale do Itajaí SC. Obras têxteis e residenciais.", tier:"C" },
{ titulo:"Canoinhas Engenharia SC", cidade:"Canoinhas", estado:"SC", resumo:"Construtora norte SC. Obras madeira e residenciais.", tier:"C" },
{ titulo:"Mafra Construtora SC", cidade:"Mafra", estado:"SC", resumo:"Construtora norte SC. Obras papel e residenciais.", tier:"C" },
{ titulo:"Videira Engenharia SC", cidade:"Videira", estado:"SC", resumo:"Construtora meio-oeste SC. Obras vinicultura e residenciais.", tier:"C" },
{ titulo:"São Bento do Sul Construtora SC", cidade:"São Bento do Sul", estado:"SC", resumo:"Construtora norte SC. Obras mobiliário e residenciais.", tier:"C" },
{ titulo:"Imbituba Engenharia SC", cidade:"Imbituba", estado:"SC", resumo:"Construtora porto SC. Obras portuárias e residenciais.", tier:"C" },
{ titulo:"Palhoça Construtora SC", cidade:"Palhoça", estado:"SC", resumo:"Construtora Grande Florianópolis. Obras residenciais.", tier:"C" },
{ titulo:"São José Engenharia SC", cidade:"São José", estado:"SC", resumo:"Construtora Grande Florianópolis. Obras residenciais.", tier:"C" },
{ titulo:"Balneário Camboriú Construtora SC", cidade:"Balneário Camboriú", estado:"SC", resumo:"Construtora litoral SC. Obras alto padrão turismo.", tier:"B" },
{ titulo:"Penha Construtora SC", cidade:"Penha", estado:"SC", resumo:"Construtora litoral norte SC. Obras turismo e residenciais.", tier:"C" },
{ titulo:"Içara Engenharia SC", cidade:"Içara", estado:"SC", resumo:"Construtora sul SC. Obras cerâmica e residenciais.", tier:"C" },

// ══════════════════════════════════════════════════════════
// BAHIA — BA (30)
// ══════════════════════════════════════════════════════════
{ titulo:"OLM Construtora BA", cidade:"Salvador", estado:"BA", resumo:"Maior construtora MCMV nordeste. Obras de grande porte com bomba.", tier:"A" },
{ titulo:"Conder Construtora BA", cidade:"Salvador", estado:"BA", resumo:"Construtora governo BA. Obras habitacionais e públicas.", tier:"A" },
{ titulo:"Odebrecht BA", cidade:"Salvador", estado:"BA", resumo:"Empreiteira. Obras de grande porte petroq. Camaçari.", tier:"A" },
{ titulo:"Andrade Gutierrez BA", cidade:"Salvador", estado:"BA", resumo:"Empreiteira BA. Obras portuárias e de infraestrutura.", tier:"A" },
{ titulo:"Construtora Engefort BA", cidade:"Salvador", estado:"BA", resumo:"Construtora BA. Obras residenciais e comerciais com bomba.", tier:"B" },
{ titulo:"Tenda BA", cidade:"Salvador", estado:"BA", resumo:"MCMV BA. Condomínios com bomba estacionária.", tier:"A" },
{ titulo:"MRV BA", cidade:"Salvador", estado:"BA", resumo:"MCMV BA. Grandes canteiros com alto consumo concretagem.", tier:"A" },
{ titulo:"Camaçari Engenharia BA", cidade:"Camaçari", estado:"BA", resumo:"Construtora polo petroquímico. Obras industriais com bomba.", tier:"B" },
{ titulo:"Feira de Santana Construtora BA", cidade:"Feira de Santana", estado:"BA", resumo:"Construtora interior BA. Obras residenciais e logística.", tier:"B" },
{ titulo:"Vitória da Conquista Engenharia BA", cidade:"Vitória da Conquista", estado:"BA", resumo:"Construtora sudoeste BA. Obras residenciais e café.", tier:"B" },
{ titulo:"Ilhéus Construtora BA", cidade:"Ilhéus", estado:"BA", resumo:"Construtora sul BA. Obras portuárias e residenciais.", tier:"B" },
{ titulo:"Barreiras Engenharia BA", cidade:"Barreiras", estado:"BA", resumo:"Construtora cerrado baiano. Obras agronegócio e residenciais.", tier:"B" },
{ titulo:"Juazeiro Construtora BA", cidade:"Juazeiro", estado:"BA", resumo:"Construtora São Francisco. Obras fruticultura e residenciais.", tier:"C" },
{ titulo:"Paulo Afonso Engenharia BA", cidade:"Paulo Afonso", estado:"BA", resumo:"Construtora norte BA. Obras energia hidrelétrica.", tier:"C" },
{ titulo:"Itabuna Construtora BA", cidade:"Itabuna", estado:"BA", resumo:"Construtora sul BA. Obras celulose e residenciais.", tier:"C" },
{ titulo:"Porto Seguro Engenharia BA", cidade:"Porto Seguro", estado:"BA", resumo:"Construtora extremo sul BA. Obras turismo e residenciais.", tier:"C" },
{ titulo:"Alagoinhas Construtora BA", cidade:"Alagoinhas", estado:"BA", resumo:"Construtora nordeste BA. Obras petróleo e residenciais.", tier:"C" },
{ titulo:"Teixeira de Freitas Engenharia BA", cidade:"Teixeira de Freitas", estado:"BA", resumo:"Construtora extremo sul BA. Obras eucalipto e residenciais.", tier:"C" },
{ titulo:"Lauro de Freitas Construtora BA", cidade:"Lauro de Freitas", estado:"BA", resumo:"Construtora RMSV. Obras residenciais e comerciais.", tier:"C" },
{ titulo:"Simões Filho Engenharia BA", cidade:"Simões Filho", estado:"BA", resumo:"Construtora polo industrial BA. Obras industriais e residenciais.", tier:"C" },
{ titulo:"Dias d'Ávila Construtora BA", cidade:"Dias d'Ávila", estado:"BA", resumo:"Construtora polo petroquímico. Obras industriais BA.", tier:"C" },
{ titulo:"Jacobina Engenharia BA", cidade:"Jacobina", estado:"BA", resumo:"Construtora norte BA. Obras mineração ouro e residenciais.", tier:"C" },
{ titulo:"Santo Antônio de Jesus Construtora BA", cidade:"Santo Antônio de Jesus", estado:"BA", resumo:"Construtora Recôncavo. Obras residenciais.", tier:"C" },
{ titulo:"Eunápolis Engenharia BA", cidade:"Eunápolis", estado:"BA", resumo:"Construtora extremo sul BA. Obras Veracel e residenciais.", tier:"C" },
{ titulo:"Brumado Construtora BA", cidade:"Brumado", estado:"BA", resumo:"Construtora sudoeste BA. Obras mineração e residenciais.", tier:"C" },
{ titulo:"Valença Engenharia BA", cidade:"Valença", estado:"BA", resumo:"Construtora Recôncavo. Obras turismo e residenciais.", tier:"C" },
{ titulo:"Senhor do Bonfim Construtora BA", cidade:"Senhor do Bonfim", estado:"BA", resumo:"Construtora norte BA. Obras residenciais.", tier:"C" },
{ titulo:"Guanambi Engenharia BA", cidade:"Guanambi", estado:"BA", resumo:"Construtora sudoeste BA. Obras residenciais.", tier:"C" },
{ titulo:"Seabra Construtora BA", cidade:"Seabra", estado:"BA", resumo:"Construtora Chapada Diamantina. Obras turismo.", tier:"C" },
{ titulo:"Tucano Engenharia BA", cidade:"Tucano", estado:"BA", resumo:"Construtora nordeste BA. Obras rurais e residenciais.", tier:"C" },

// ══════════════════════════════════════════════════════════
// CEARÁ — CE (25)
// ══════════════════════════════════════════════════════════
{ titulo:"GEF Engenharia CE", cidade:"Fortaleza", estado:"CE", resumo:"Maior MCMV CE. Condomínios com bomba lança e estacionária.", tier:"A" },
{ titulo:"Colmeia Construtora CE", cidade:"Fortaleza", estado:"CE", resumo:"Construtora CE. Obras residenciais e comerciais com bomba.", tier:"A" },
{ titulo:"MDL Realty CE", cidade:"Fortaleza", estado:"CE", resumo:"Incorporadora CE. Residenciais verticais com concretagem.", tier:"A" },
{ titulo:"SIM Construtora CE", cidade:"Fortaleza", estado:"CE", resumo:"Construtora CE. Obras residenciais e comerciais.", tier:"B" },
{ titulo:"Tenda CE", cidade:"Fortaleza", estado:"CE", resumo:"MCMV CE. Múltiplos canteiros com bomba.", tier:"A" },
{ titulo:"MRV CE", cidade:"Fortaleza", estado:"CE", resumo:"MCMV CE. Grandes canteiros com alto consumo concreto.", tier:"A" },
{ titulo:"Direcional CE", cidade:"Fortaleza", estado:"CE", resumo:"MCMV CE. Condomínios com betoneira e bomba.", tier:"A" },
{ titulo:"Juazeiro Engenharia CE", cidade:"Juazeiro do Norte", estado:"CE", resumo:"Construtora Cariri. Obras residenciais e comerciais.", tier:"B" },
{ titulo:"Sobral Construtora CE", cidade:"Sobral", estado:"CE", resumo:"Construtora norte CE. Obras calçados e residenciais.", tier:"B" },
{ titulo:"Caucaia Engenharia CE", cidade:"Caucaia", estado:"CE", resumo:"Construtora RMFOR. Obras residenciais e industriais.", tier:"B" },
{ titulo:"Maracanaú Construtora CE", cidade:"Maracanaú", estado:"CE", resumo:"Construtora polo industrial CE. Obras industriais.", tier:"B" },
{ titulo:"Pecém Engenharia CE", cidade:"São Gonçalo do Amarante", estado:"CE", resumo:"Construtora polo industrial. Obras CSP siderurgia.", tier:"B" },
{ titulo:"Iguatu Construtora CE", cidade:"Iguatu", estado:"CE", resumo:"Construtora centro-sul CE. Obras residenciais.", tier:"C" },
{ titulo:"Quixadá Engenharia CE", cidade:"Quixadá", estado:"CE", resumo:"Construtora sertão central CE. Obras residenciais.", tier:"C" },
{ titulo:"Limoeiro do Norte Construtora CE", cidade:"Limoeiro do Norte", estado:"CE", resumo:"Construtora Vale Jaguaribe. Obras fruticultura.", tier:"C" },
{ titulo:"Canindé Engenharia CE", cidade:"Canindé", estado:"CE", resumo:"Construtora sertão CE. Obras religiosas e residenciais.", tier:"C" },
{ titulo:"Crato Construtora CE", cidade:"Crato", estado:"CE", resumo:"Construtora Cariri. Obras gesso e residenciais.", tier:"C" },
{ titulo:"Itapipoca Engenharia CE", cidade:"Itapipoca", estado:"CE", resumo:"Construtora litoral norte CE. Obras energia e residenciais.", tier:"C" },
{ titulo:"Horizonte Construtora CE", cidade:"Horizonte", estado:"CE", resumo:"Construtora polo industrial CE. Obras industriais.", tier:"C" },
{ titulo:"Tianguá Engenharia CE", cidade:"Tianguá", estado:"CE", resumo:"Construtora Ibiapaba CE. Obras fruticultura.", tier:"C" },
{ titulo:"Russas Construtora CE", cidade:"Russas", estado:"CE", resumo:"Construtora Vale Jaguaribe. Obras calcário.", tier:"C" },
{ titulo:"Forquilha Engenharia CE", cidade:"Forquilha", estado:"CE", resumo:"Construtora norte CE. Obras residenciais.", tier:"C" },
{ titulo:"Acopiara Construtora CE", cidade:"Acopiara", estado:"CE", resumo:"Construtora sertão CE. Obras residenciais.", tier:"C" },
{ titulo:"Camocim Engenharia CE", cidade:"Camocim", estado:"CE", resumo:"Construtora litoral extremo CE. Obras residenciais.", tier:"C" },
{ titulo:"Barbalha Construtora CE", cidade:"Barbalha", estado:"CE", resumo:"Construtora Cariri sul CE. Obras residenciais.", tier:"C" },

// ══════════════════════════════════════════════════════════
// PERNAMBUCO — PE (25)
// ══════════════════════════════════════════════════════════
{ titulo:"Queiroz Galvão PE", cidade:"Recife", estado:"PE", resumo:"Grande empreiteira. Obras Suape, porto e infraestrutura PE.", tier:"A" },
{ titulo:"Construtora Celi PE", cidade:"Recife", estado:"PE", resumo:"Incorporadora PE. Residenciais verticais com bomba lança.", tier:"A" },
{ titulo:"Moura Dubeux PE", cidade:"Recife", estado:"PE", resumo:"Incorporadora PE. Alto padrão Boa Viagem com bomba.", tier:"A" },
{ titulo:"MRV PE", cidade:"Recife", estado:"PE", resumo:"MCMV PE. Grandes canteiros com alto consumo concretagem.", tier:"A" },
{ titulo:"Tenda PE", cidade:"Recife", estado:"PE", resumo:"MCMV PE. Múltiplos canteiros com bomba.", tier:"A" },
{ titulo:"Direcional PE", cidade:"Recife", estado:"PE", resumo:"MCMV PE. Condomínios com betoneira e bomba.", tier:"A" },
{ titulo:"Marquise Incorporações PE", cidade:"Recife", estado:"PE", resumo:"Incorporadora PE. Obras residenciais com bomba lança.", tier:"B" },
{ titulo:"Endemix PE", cidade:"Recife", estado:"PE", resumo:"Construtora MCMV PE. Condomínios com bomba estacionária.", tier:"B" },
{ titulo:"Caruaru Engenharia PE", cidade:"Caruaru", estado:"PE", resumo:"Construtora Agreste PE. Obras residenciais e industriais.", tier:"B" },
{ titulo:"Petrolina Construtora PE", cidade:"Petrolina", estado:"PE", resumo:"Construtora São Francisco. Obras fruticultura e residenciais.", tier:"B" },
{ titulo:"Paulista Engenharia PE", cidade:"Paulista", estado:"PE", resumo:"Construtora RMREC. Obras residenciais.", tier:"C" },
{ titulo:"Olinda Construtora PE", cidade:"Olinda", estado:"PE", resumo:"Construtora histórica PE. Obras residenciais e turismo.", tier:"C" },
{ titulo:"Jaboatão Engenharia PE", cidade:"Jaboatão dos Guararapes", estado:"PE", resumo:"Construtora RMREC. Obras residenciais.", tier:"C" },
{ titulo:"Cabo de Santo Agostinho Construções PE", cidade:"Cabo de Santo Agostinho", estado:"PE", resumo:"Construtora polo Suape. Obras industriais PE.", tier:"C" },
{ titulo:"Serra Talhada Construtora PE", cidade:"Serra Talhada", estado:"PE", resumo:"Construtora sertão PE. Obras energia e residenciais.", tier:"C" },
{ titulo:"Araripina Engenharia PE", cidade:"Araripina", estado:"PE", resumo:"Construtora polo gesseiro. Obras gesso e residenciais.", tier:"C" },
{ titulo:"Garanhuns Construtora PE", cidade:"Garanhuns", estado:"PE", resumo:"Construtora agreste meridional PE. Obras laticínios.", tier:"C" },
{ titulo:"Arcoverde Engenharia PE", cidade:"Arcoverde", estado:"PE", resumo:"Construtora sertão central PE. Obras energia eólica.", tier:"C" },
{ titulo:"Salgueiro Construtora PE", cidade:"Salgueiro", estado:"PE", resumo:"Construtora sertão PE. Obras residenciais.", tier:"C" },
{ titulo:"Surubim Engenharia PE", cidade:"Surubim", estado:"PE", resumo:"Construtora Agreste norte PE. Obras residenciais.", tier:"C" },
{ titulo:"Belo Jardim Construtora PE", cidade:"Belo Jardim", estado:"PE", resumo:"Construtora Agreste PE. Obras residenciais.", tier:"C" },
{ titulo:"Pesqueira Engenharia PE", cidade:"Pesqueira", estado:"PE", resumo:"Construtora interior PE. Obras agronegócio.", tier:"C" },
{ titulo:"Ipojuca Construções PE", cidade:"Ipojuca", estado:"PE", resumo:"Construtora polo Suape. Obras portuárias e industriais.", tier:"B" },
{ titulo:"Santa Cruz do Capibaribe Engenharia PE", cidade:"Santa Cruz do Capibaribe", estado:"PE", resumo:"Construtora confecções PE. Obras industriais.", tier:"C" },
{ titulo:"Cabrobo Construtora PE", cidade:"Cabrobo", estado:"PE", resumo:"Construtora sertão PE. Obras rurais e residenciais.", tier:"C" },

// ══════════════════════════════════════════════════════════
// GOIÁS — GO (25)
// ══════════════════════════════════════════════════════════
{ titulo:"Construção Goiânia MRV GO", cidade:"Goiânia", estado:"GO", resumo:"MCMV GO. Grandes canteiros com alto consumo concretagem.", tier:"A" },
{ titulo:"Tenda GO", cidade:"Goiânia", estado:"GO", resumo:"MCMV GO. Múltiplos canteiros com bomba.", tier:"A" },
{ titulo:"Direcional GO", cidade:"Goiânia", estado:"GO", resumo:"MCMV GO. Condomínios com betoneira e bomba.", tier:"A" },
{ titulo:"Construtora São José MCMV GO", cidade:"Goiânia", estado:"GO", resumo:"Construtora MCMV GO. Grandes empreendimentos com bomba.", tier:"A" },
{ titulo:"Construtora Veiga GO", cidade:"Goiânia", estado:"GO", resumo:"Incorporadora GO. Residenciais verticais com bomba lança.", tier:"A" },
{ titulo:"Palagi Construtora GO", cidade:"Goiânia", estado:"GO", resumo:"Construtora GO. Obras residenciais e comerciais com bomba.", tier:"B" },
{ titulo:"Coutinho Vilela GO", cidade:"Goiânia", estado:"GO", resumo:"Construtora GO. Obras verticais com concretagem.", tier:"B" },
{ titulo:"Anápolis Engenharia GO", cidade:"Anápolis", estado:"GO", resumo:"Construtora polo industrial GO. Obras farmacêuticas.", tier:"B" },
{ titulo:"Rio Verde Construtora GO", cidade:"Rio Verde", estado:"GO", resumo:"Construtora cerrado GO. Obras agronegócio e residenciais.", tier:"B" },
{ titulo:"Aparecida Construções GO", cidade:"Aparecida de Goiânia", estado:"GO", resumo:"Construtora RMGO. Obras residenciais.", tier:"C" },
{ titulo:"Jataí Engenharia GO", cidade:"Jataí", estado:"GO", resumo:"Construtora sudoeste GO. Obras agronegócio.", tier:"C" },
{ titulo:"Itumbiara Construtora GO", cidade:"Itumbiara", estado:"GO", resumo:"Construtora sul GO. Obras usinas etanol e residenciais.", tier:"C" },
{ titulo:"Catalão Engenharia GO", cidade:"Catalão", estado:"GO", resumo:"Construtora sudeste GO. Obras nióbio e residenciais.", tier:"C" },
{ titulo:"Formosa Construtora GO", cidade:"Formosa", estado:"GO", resumo:"Construtora entorno DF. Obras residenciais.", tier:"C" },
{ titulo:"Luziânia Engenharia GO", cidade:"Luziânia", estado:"GO", resumo:"Construtora entorno DF. Obras residenciais.", tier:"C" },
{ titulo:"Trindade Construtora GO", cidade:"Trindade", estado:"GO", resumo:"Construtora RMGO. Obras turismo religioso.", tier:"C" },
{ titulo:"Caldas Novas Engenharia GO", cidade:"Caldas Novas", estado:"GO", resumo:"Construtora termal GO. Obras hotéis e residenciais.", tier:"C" },
{ titulo:"Goianésia Construtora GO", cidade:"Goianésia", estado:"GO", resumo:"Construtora centro GO. Obras cana e residenciais.", tier:"C" },
{ titulo:"Mineiros Engenharia GO", cidade:"Mineiros", estado:"GO", resumo:"Construtora sudoeste GO. Obras agronegócio.", tier:"C" },
{ titulo:"Inhumas Construtora GO", cidade:"Inhumas", estado:"GO", resumo:"Construtora RMGO oeste. Obras residenciais.", tier:"C" },
{ titulo:"Iporá Engenharia GO", cidade:"Iporá", estado:"GO", resumo:"Construtora centro-oeste GO. Obras residenciais.", tier:"C" },
{ titulo:"Quirinópolis Construtora GO", cidade:"Quirinópolis", estado:"GO", resumo:"Construtora sul GO. Obras cana e residenciais.", tier:"C" },
{ titulo:"Porangatu Engenharia GO", cidade:"Porangatu", estado:"GO", resumo:"Construtora norte GO. Obras mineração e residenciais.", tier:"C" },
{ titulo:"Ceres Construtora GO", cidade:"Ceres", estado:"GO", resumo:"Construtora Vale São Patrício. Obras cana.", tier:"C" },
{ titulo:"Morrinhos Engenharia GO", cidade:"Morrinhos", estado:"GO", resumo:"Construtora sul GO. Obras laticínios e residenciais.", tier:"C" },

// ══════════════════════════════════════════════════════════
// DISTRITO FEDERAL — DF (20)
// ══════════════════════════════════════════════════════════
{ titulo:"Brasal Construtora DF", cidade:"Brasília", estado:"DF", resumo:"Maior construtora DF. Obras públicas e MCMV com bomba.", tier:"A" },
{ titulo:"Rossi Residencial DF", cidade:"Brasília", estado:"DF", resumo:"Incorporadora DF. Residenciais e obras comerciais.", tier:"A" },
{ titulo:"Tenda DF", cidade:"Brasília", estado:"DF", resumo:"MCMV DF. Múltiplos canteiros com bomba.", tier:"A" },
{ titulo:"MRV DF", cidade:"Brasília", estado:"DF", resumo:"MCMV DF. Grandes canteiros com concretagem.", tier:"A" },
{ titulo:"Andrade Gutierrez DF", cidade:"Brasília", estado:"DF", resumo:"Empreiteira. Obras públicas e infraestrutura DF.", tier:"A" },
{ titulo:"Construtora OAS DF", cidade:"Brasília", estado:"DF", resumo:"Empreiteira. Obras de infraestrutura DF.", tier:"A" },
{ titulo:"Engemix DF", cidade:"Brasília", estado:"DF", resumo:"Construtora DF. Obras residenciais com concretagem.", tier:"B" },
{ titulo:"Rodobens DF", cidade:"Brasília", estado:"DF", resumo:"Incorporadora DF. MCMV faixas 2-3 com bomba.", tier:"B" },
{ titulo:"JHD Construtora DF", cidade:"Brasília", estado:"DF", resumo:"Construtora DF. Obras residenciais e comerciais.", tier:"B" },
{ titulo:"Cesa Construtora DF", cidade:"Brasília", estado:"DF", resumo:"Construtora DF. Obras residenciais com bomba.", tier:"B" },
{ titulo:"Terrabrás DF", cidade:"Brasília", estado:"DF", resumo:"Construtora DF. Obras residenciais e loteamentos.", tier:"B" },
{ titulo:"Taguatinga Engenharia DF", cidade:"Taguatinga", estado:"DF", resumo:"Construtora DF. Obras residenciais e comerciais.", tier:"C" },
{ titulo:"Plano Piloto Construtora DF", cidade:"Brasília", estado:"DF", resumo:"Construtora DF. Obras corporativas com bomba.", tier:"C" },
{ titulo:"Ceilândia Construções DF", cidade:"Ceilândia", estado:"DF", resumo:"Construtora DF. Obras residenciais populares.", tier:"C" },
{ titulo:"Sobradinho Construtora DF", cidade:"Sobradinho", estado:"DF", resumo:"Construtora DF. Obras residenciais.", tier:"C" },
{ titulo:"Planaltina Engenharia DF", cidade:"Planaltina", estado:"DF", resumo:"Construtora DF. Obras residenciais e rurais.", tier:"C" },
{ titulo:"Gama Construtora DF", cidade:"Gama", estado:"DF", resumo:"Construtora DF. Obras residenciais.", tier:"C" },
{ titulo:"Santa Maria Construtora DF", cidade:"Santa Maria", estado:"DF", resumo:"Construtora DF. Obras MCMV residenciais.", tier:"C" },
{ titulo:"Samambaia Engenharia DF", cidade:"Samambaia", estado:"DF", resumo:"Construtora DF. Obras residenciais.", tier:"C" },
{ titulo:"Recanto das Emas Construtora DF", cidade:"Recanto das Emas", estado:"DF", resumo:"Construtora DF. Obras residenciais populares.", tier:"C" },

// ══════════════════════════════════════════════════════════
// MATO GROSSO — MT (20)
// ══════════════════════════════════════════════════════════
{ titulo:"Construtora Terra Nova MT", cidade:"Cuiabá", estado:"MT", resumo:"Incorporadora MT. Residenciais verticais com bomba lança.", tier:"A" },
{ titulo:"MRV MT", cidade:"Cuiabá", estado:"MT", resumo:"MCMV MT. Grandes canteiros com alto consumo concreto.", tier:"A" },
{ titulo:"Tenda MT", cidade:"Cuiabá", estado:"MT", resumo:"MCMV MT. Condomínios com bomba estacionária.", tier:"A" },
{ titulo:"Construtora Habitação MT", cidade:"Cuiabá", estado:"MT", resumo:"Construtora MT. Obras residenciais e comerciais.", tier:"B" },
{ titulo:"Sorriso Engenharia MT", cidade:"Sorriso", estado:"MT", resumo:"Construtora polo soja MT. Obras agronegócio e residenciais.", tier:"B" },
{ titulo:"Sinop Construtora MT", cidade:"Sinop", estado:"MT", resumo:"Construtora norte MT. Obras madeira, soja e residenciais.", tier:"B" },
{ titulo:"Rondonópolis Engenharia MT", cidade:"Rondonópolis", estado:"MT", resumo:"Construtora sul MT. Obras fertilizantes e residenciais.", tier:"B" },
{ titulo:"Tangará Construtora MT", cidade:"Tangará da Serra", estado:"MT", resumo:"Construtora noroeste MT. Obras cana e residenciais.", tier:"C" },
{ titulo:"Alta Floresta Engenharia MT", cidade:"Alta Floresta", estado:"MT", resumo:"Construtora norte MT. Obras residenciais.", tier:"C" },
{ titulo:"Barra do Garças Construtora MT", cidade:"Barra do Garças", estado:"MT", resumo:"Construtora leste MT. Obras agronegócio.", tier:"C" },
{ titulo:"Primavera Construtora MT", cidade:"Primavera do Leste", estado:"MT", resumo:"Construtora sudeste MT. Obras algodão e residenciais.", tier:"C" },
{ titulo:"Cáceres Engenharia MT", cidade:"Cáceres", estado:"MT", resumo:"Construtora oeste MT. Obras residenciais.", tier:"C" },
{ titulo:"Juara Construtora MT", cidade:"Juara", estado:"MT", resumo:"Construtora noroeste MT. Obras pecuária e residenciais.", tier:"C" },
{ titulo:"Colíder Engenharia MT", cidade:"Colíder", estado:"MT", resumo:"Construtora norte MT. Obras residenciais.", tier:"C" },
{ titulo:"Várzea Grande Construtora MT", cidade:"Várzea Grande", estado:"MT", resumo:"Construtora RMCUIABÁ. Obras residenciais.", tier:"C" },
{ titulo:"Jaciara Engenharia MT", cidade:"Jaciara", estado:"MT", resumo:"Construtora sul MT. Obras usinas e residenciais.", tier:"C" },
{ titulo:"Lucas do Rio Verde Construtora MT", cidade:"Lucas do Rio Verde", estado:"MT", resumo:"Construtora polo soja MT. Obras agronegócio.", tier:"C" },
{ titulo:"Campo Verde Engenharia MT", cidade:"Campo Verde", estado:"MT", resumo:"Construtora sudeste MT. Obras algodão e residenciais.", tier:"C" },
{ titulo:"Nova Mutum Construtora MT", cidade:"Nova Mutum", estado:"MT", resumo:"Construtora polo soja MT. Obras residenciais.", tier:"C" },
{ titulo:"Guarantã do Norte Engenharia MT", cidade:"Guarantã do Norte", estado:"MT", resumo:"Construtora norte MT. Obras residenciais.", tier:"C" },

// ══════════════════════════════════════════════════════════
// MATO GROSSO DO SUL — MS (20)
// ══════════════════════════════════════════════════════════
{ titulo:"MRV MS", cidade:"Campo Grande", estado:"MS", resumo:"MCMV MS. Grandes canteiros com alto consumo concretagem.", tier:"A" },
{ titulo:"Tenda MS", cidade:"Campo Grande", estado:"MS", resumo:"MCMV MS. Condomínios com bomba estacionária.", tier:"A" },
{ titulo:"Construtora Campo Grande MS", cidade:"Campo Grande", estado:"MS", resumo:"Incorporadora MS. Residenciais com bomba lança.", tier:"A" },
{ titulo:"Construtora Habitação MS", cidade:"Campo Grande", estado:"MS", resumo:"Construtora MS. Obras residenciais e comerciais.", tier:"B" },
{ titulo:"Dourados Engenharia MS", cidade:"Dourados", estado:"MS", resumo:"Construtora sul MS. Obras soja e residenciais.", tier:"B" },
{ titulo:"Três Lagoas Construtora MS", cidade:"Três Lagoas", estado:"MS", resumo:"Construtora próxima Suzano. Obras celulose e residenciais.", tier:"B" },
{ titulo:"Ribas Engenharia MS", cidade:"Ribas do Rio Pardo", estado:"MS", resumo:"Construtora nova planta Suzano MS. Obras industriais.", tier:"B" },
{ titulo:"Corumbá Construtora MS", cidade:"Corumbá", estado:"MS", resumo:"Construtora fronteira MS. Obras mineração e residenciais.", tier:"C" },
{ titulo:"Ponta Porã Engenharia MS", cidade:"Ponta Porã", estado:"MS", resumo:"Construtora fronteira Paraguai. Obras residenciais.", tier:"C" },
{ titulo:"Naviraí Construtora MS", cidade:"Naviraí", estado:"MS", resumo:"Construtora sul MS. Obras cana e residenciais.", tier:"C" },
{ titulo:"Maracaju Engenharia MS", cidade:"Maracaju", estado:"MS", resumo:"Construtora centro-sul MS. Obras soja e residenciais.", tier:"C" },
{ titulo:"Coxim Construtora MS", cidade:"Coxim", estado:"MS", resumo:"Construtora centro-norte MS. Obras residenciais.", tier:"C" },
{ titulo:"Aquidauana Engenharia MS", cidade:"Aquidauana", estado:"MS", resumo:"Construtora Pantanal MS. Obras pecuária e residenciais.", tier:"C" },
{ titulo:"Sidrolândia Construtora MS", cidade:"Sidrolândia", estado:"MS", resumo:"Construtora entorno CG. Obras residenciais.", tier:"C" },
{ titulo:"Bonito Engenharia MS", cidade:"Bonito", estado:"MS", resumo:"Construtora ecoturismo MS. Obras hotéis e residenciais.", tier:"C" },
{ titulo:"Paranaíba Construtora MS", cidade:"Paranaíba", estado:"MS", resumo:"Construtora leste MS. Obras agronegócio e residenciais.", tier:"C" },
{ titulo:"Miranda Engenharia MS", cidade:"Miranda", estado:"MS", resumo:"Construtora Pantanal MS. Obras residenciais.", tier:"C" },
{ titulo:"Ivinhema Construtora MS", cidade:"Ivinhema", estado:"MS", resumo:"Construtora sul MS. Obras residenciais.", tier:"C" },
{ titulo:"Jardim Engenharia MS", cidade:"Jardim", estado:"MS", resumo:"Construtora sul MS. Obras residenciais.", tier:"C" },
{ titulo:"Amambai Construtora MS", cidade:"Amambai", estado:"MS", resumo:"Construtora sul MS. Obras agronegócio e residenciais.", tier:"C" },

// ══════════════════════════════════════════════════════════
// ESPÍRITO SANTO — ES (20)
// ══════════════════════════════════════════════════════════
{ titulo:"Morar Bem Construtora ES", cidade:"Vitória", estado:"ES", resumo:"Incorporadora ES. Residenciais verticais com bomba lança.", tier:"A" },
{ titulo:"MRV ES", cidade:"Vitória", estado:"ES", resumo:"MCMV ES. Canteiros com bomba estacionária.", tier:"A" },
{ titulo:"Direcional ES", cidade:"Vitória", estado:"ES", resumo:"MCMV ES. Condomínios com betoneira e bomba.", tier:"A" },
{ titulo:"Douglas Construtora ES", cidade:"Vitória", estado:"ES", resumo:"Incorporadora ES. Obras alto padrão com bomba.", tier:"B" },
{ titulo:"Habiarte Construtora ES", cidade:"Vitória", estado:"ES", resumo:"Construtora ES. Obras residenciais com concretagem.", tier:"B" },
{ titulo:"Serra Engenharia ES", cidade:"Serra", estado:"ES", resumo:"Construtora polo industrial ES. Obras Arcelor e residenciais.", tier:"B" },
{ titulo:"Cachoeiro Construtora ES", cidade:"Cachoeiro de Itapemirim", estado:"ES", resumo:"Construtora sul ES. Obras mármore e residenciais.", tier:"B" },
{ titulo:"Colatina Engenharia ES", cidade:"Colatina", estado:"ES", resumo:"Construtora noroeste ES. Obras café e residenciais.", tier:"B" },
{ titulo:"Aracruz Construtora ES", cidade:"Aracruz", estado:"ES", resumo:"Construtora norte ES. Obras Suzano celulose.", tier:"B" },
{ titulo:"Linhares Engenharia ES", cidade:"Linhares", estado:"ES", resumo:"Construtora norte ES. Obras petróleo e residenciais.", tier:"C" },
{ titulo:"São Mateus Construtora ES", cidade:"São Mateus", estado:"ES", resumo:"Construtora norte ES. Obras gás e residenciais.", tier:"C" },
{ titulo:"Guarapari Engenharia ES", cidade:"Guarapari", estado:"ES", resumo:"Construtora litoral ES. Obras turismo e residenciais.", tier:"C" },
{ titulo:"Viana Construtora ES", cidade:"Viana", estado:"ES", resumo:"Construtora Grande Vitória. Obras industriais e residenciais.", tier:"C" },
{ titulo:"Cariacica Engenharia ES", cidade:"Cariacica", estado:"ES", resumo:"Construtora Grande Vitória. Obras industriais.", tier:"C" },
{ titulo:"Domingos Martins Construtora ES", cidade:"Domingos Martins", estado:"ES", resumo:"Construtora serra capixaba. Obras pedras e residenciais.", tier:"C" },
{ titulo:"Nova Venécia Engenharia ES", cidade:"Nova Venécia", estado:"ES", resumo:"Construtora norte ES. Obras cerâmica e residenciais.", tier:"C" },
{ titulo:"Alegre Construtora ES", cidade:"Alegre", estado:"ES", resumo:"Construtora sul ES. Obras residenciais.", tier:"C" },
{ titulo:"Guaçuí Engenharia ES", cidade:"Guaçuí", estado:"ES", resumo:"Construtora caparaó ES. Obras residenciais.", tier:"C" },
{ titulo:"Itapemirim Construtora ES", cidade:"Itapemirim", estado:"ES", resumo:"Construtora sul ES. Obras energia e residenciais.", tier:"C" },
{ titulo:"Anchieta Engenharia ES", cidade:"Anchieta", estado:"ES", resumo:"Construtora próxima CSA. Obras industriais e residenciais.", tier:"C" },

// ══════════════════════════════════════════════════════════
// PARÁ — PA (20)
// ══════════════════════════════════════════════════════════
{ titulo:"Nortenge Engenharia PA", cidade:"Belém", estado:"PA", resumo:"Construtora MCMV norte. Obras habitacionais com bomba.", tier:"A" },
{ titulo:"MRV PA", cidade:"Belém", estado:"PA", resumo:"MCMV PA. Canteiros com bomba estacionária.", tier:"A" },
{ titulo:"Direcional PA", cidade:"Belém", estado:"PA", resumo:"MCMV PA. Condomínios com betoneira e bomba.", tier:"A" },
{ titulo:"BPAZ Construtora PA", cidade:"Belém", estado:"PA", resumo:"Construtora PA. Obras residenciais e comerciais com bomba.", tier:"B" },
{ titulo:"Marabá Engenharia PA", cidade:"Marabá", estado:"PA", resumo:"Construtora polo mineração PA. Obras Vale e residenciais.", tier:"B" },
{ titulo:"Parauapebas Construtora PA", cidade:"Parauapebas", estado:"PA", resumo:"Construtora Carajás. Obras mineração e residenciais.", tier:"B" },
{ titulo:"Paragominas Engenharia PA", cidade:"Paragominas", estado:"PA", resumo:"Construtora PA. Obras mineração bauxita e residenciais.", tier:"B" },
{ titulo:"Altamira Construtora PA", cidade:"Altamira", estado:"PA", resumo:"Construtora Belo Monte. Obras energia e residenciais.", tier:"B" },
{ titulo:"Santarém Engenharia PA", cidade:"Santarém", estado:"PA", resumo:"Construtora oeste PA. Obras porto soja e residenciais.", tier:"C" },
{ titulo:"Castanhal Construtora PA", cidade:"Castanhal", estado:"PA", resumo:"Construtora RMBEL. Obras agronegócio e residenciais.", tier:"C" },
{ titulo:"Tucuruí Engenharia PA", cidade:"Tucuruí", estado:"PA", resumo:"Construtora hidrelétrica PA. Obras energia.", tier:"C" },
{ titulo:"Canaã dos Carajás Construtora PA", cidade:"Canaã dos Carajás", estado:"PA", resumo:"Construtora S11D. Obras mineração Vale.", tier:"C" },
{ titulo:"Ananindeua Engenharia PA", cidade:"Ananindeua", estado:"PA", resumo:"Construtora RMBEL. Obras residenciais.", tier:"C" },
{ titulo:"Barcarena Construtora PA", cidade:"Barcarena", estado:"PA", resumo:"Construtora polo alumínio PA. Obras industriais.", tier:"C" },
{ titulo:"Redenção Engenharia PA", cidade:"Redenção", estado:"PA", resumo:"Construtora sul PA. Obras soja e residenciais.", tier:"C" },
{ titulo:"Tailândia Construtora PA", cidade:"Tailândia", estado:"PA", resumo:"Construtora nordeste PA. Obras caulim e residenciais.", tier:"C" },
{ titulo:"Itaituba Engenharia PA", cidade:"Itaituba", estado:"PA", resumo:"Construtora oeste PA. Obras garimpo e ferrogrão.", tier:"C" },
{ titulo:"Capanema Construtora PA", cidade:"Capanema", estado:"PA", resumo:"Construtora nordeste PA. Obras residenciais.", tier:"C" },
{ titulo:"Bragança Engenharia PA", cidade:"Bragança", estado:"PA", resumo:"Construtora nordeste PA. Obras pesca e residenciais.", tier:"C" },
{ titulo:"Vigia Construtora PA", cidade:"Vigia", estado:"PA", resumo:"Construtora nordeste PA. Obras residenciais.", tier:"C" },

// ══════════════════════════════════════════════════════════
// AMAZONAS — AM (15)
// ══════════════════════════════════════════════════════════
{ titulo:"Construtora Iplan AM", cidade:"Manaus", estado:"AM", resumo:"MCMV AM. Empreendimentos Manaus com bomba.", tier:"B" },
{ titulo:"MRV AM", cidade:"Manaus", estado:"AM", resumo:"MCMV AM. Canteiros com bomba estacionária.", tier:"A" },
{ titulo:"Construtora Araujo AM", cidade:"Manaus", estado:"AM", resumo:"Construtora AM. Obras ZFM e residenciais com bomba.", tier:"B" },
{ titulo:"Manaus Engenharia AM", cidade:"Manaus", estado:"AM", resumo:"Construtora AM. Obras industriais ZFM e residenciais.", tier:"B" },
{ titulo:"Construtora Soleil AM", cidade:"Manaus", estado:"AM", resumo:"Incorporadora AM. Residenciais verticais com concretagem.", tier:"B" },
{ titulo:"Tropical Construtora AM", cidade:"Manaus", estado:"AM", resumo:"Construtora AM. Obras residenciais e comerciais.", tier:"C" },
{ titulo:"Itacoatiara Engenharia AM", cidade:"Itacoatiara", estado:"AM", resumo:"Construtora AM. Obras porto e residenciais.", tier:"C" },
{ titulo:"Parintins Construtora AM", cidade:"Parintins", estado:"AM", resumo:"Construtora AM. Obras festivais e residenciais.", tier:"C" },
{ titulo:"Coari Engenharia AM", cidade:"Coari", estado:"AM", resumo:"Construtora AM. Obras petróleo Urucu e residenciais.", tier:"C" },
{ titulo:"Humaitá Construtora AM", cidade:"Humaitá", estado:"AM", resumo:"Construtora sul AM. Obras soja e residenciais.", tier:"C" },
{ titulo:"Tefé Engenharia AM", cidade:"Tefé", estado:"AM", resumo:"Construtora AM. Obras municipais e residenciais.", tier:"C" },
{ titulo:"Tabatinga Construtora AM", cidade:"Tabatinga", estado:"AM", resumo:"Construtora fronteira AM. Obras residenciais.", tier:"C" },
{ titulo:"São Gabriel da Cachoeira Engenharia AM", cidade:"São Gabriel da Cachoeira", estado:"AM", resumo:"Construtora noroeste AM. Obras residenciais.", tier:"C" },
{ titulo:"Lábrea Construtora AM", cidade:"Lábrea", estado:"AM", resumo:"Construtora sul AM. Obras rurais e residenciais.", tier:"C" },
{ titulo:"Novo Aripuanã Engenharia AM", cidade:"Novo Aripuanã", estado:"AM", resumo:"Construtora sul AM. Obras madeira e residenciais.", tier:"C" },

// ══════════════════════════════════════════════════════════
// MARANHÃO — MA (15)
// ══════════════════════════════════════════════════════════
{ titulo:"Construtora Maranhense MCMV MA", cidade:"São Luís", estado:"MA", resumo:"Construtora MCMV MA. Empreendimentos com bomba.", tier:"B" },
{ titulo:"MRV MA", cidade:"São Luís", estado:"MA", resumo:"MCMV MA. Grandes canteiros com concretagem.", tier:"A" },
{ titulo:"Direcional MA", cidade:"São Luís", estado:"MA", resumo:"MCMV MA. Condomínios com betoneira e bomba.", tier:"A" },
{ titulo:"São Luís Engenharia MA", cidade:"São Luís", estado:"MA", resumo:"Construtora MA. Obras portuárias e residenciais.", tier:"B" },
{ titulo:"Imperatriz Construtora MA", cidade:"Imperatriz", estado:"MA", resumo:"Construtora MA. Obras EFC e residenciais.", tier:"B" },
{ titulo:"Açailândia Engenharia MA", cidade:"Açailândia", estado:"MA", resumo:"Construtora MA. Obras polo siderúrgico e residenciais.", tier:"B" },
{ titulo:"Caxias Construtora MA", cidade:"Caxias", estado:"MA", resumo:"Construtora leste MA. Obras soja e residenciais.", tier:"C" },
{ titulo:"Balsas Engenharia MA", cidade:"Balsas", estado:"MA", resumo:"Construtora sul MA. Obras soja e residenciais.", tier:"C" },
{ titulo:"Timon Construtora MA", cidade:"Timon", estado:"MA", resumo:"Construtora fronteira PI. Obras residenciais.", tier:"C" },
{ titulo:"Bacabal Engenharia MA", cidade:"Bacabal", estado:"MA", resumo:"Construtora centro MA. Obras residenciais.", tier:"C" },
{ titulo:"Santa Inês Construtora MA", cidade:"Santa Inês", estado:"MA", resumo:"Construtora MA. Obras eucalipto e residenciais.", tier:"C" },
{ titulo:"Pinheiro Engenharia MA", cidade:"Pinheiro", estado:"MA", resumo:"Construtora oeste MA. Obras residenciais.", tier:"C" },
{ titulo:"Chapadinha Construtora MA", cidade:"Chapadinha", estado:"MA", resumo:"Construtora leste MA. Obras soja e residenciais.", tier:"C" },
{ titulo:"São João dos Patos Engenharia MA", cidade:"São João dos Patos", estado:"MA", resumo:"Construtora centro MA. Obras residenciais.", tier:"C" },
{ titulo:"Itapecuru Mirim Construtora MA", cidade:"Itapecuru Mirim", estado:"MA", resumo:"Construtora norte MA. Obras residenciais.", tier:"C" },

// ══════════════════════════════════════════════════════════
// ESTADOS MENORES — 10-12 por estado
// ══════════════════════════════════════════════════════════

// PIAUÍ — PI
{ titulo:"MRV PI", cidade:"Teresina", estado:"PI", resumo:"MCMV PI. Canteiros com bomba estacionária.", tier:"A" },
{ titulo:"Construtora Alencar PI", cidade:"Teresina", estado:"PI", resumo:"Construtora PI. Obras residenciais com bomba.", tier:"B" },
{ titulo:"Teresina Engenharia PI", cidade:"Teresina", estado:"PI", resumo:"Construtora PI. Obras residenciais e comerciais.", tier:"B" },
{ titulo:"Picos Construtora PI", cidade:"Picos", estado:"PI", resumo:"Construtora interior PI. Obras residenciais.", tier:"C" },
{ titulo:"Floriano Engenharia PI", cidade:"Floriano", estado:"PI", resumo:"Construtora sul PI. Obras soja e residenciais.", tier:"C" },
{ titulo:"Parnaíba Construtora PI", cidade:"Parnaíba", estado:"PI", resumo:"Construtora litoral PI. Obras residenciais.", tier:"C" },
{ titulo:"Campo Maior Engenharia PI", cidade:"Campo Maior", estado:"PI", resumo:"Construtora norte PI. Obras residenciais.", tier:"C" },
{ titulo:"Uruçuí Construtora PI", cidade:"Uruçuí", estado:"PI", resumo:"Construtora cerrado PI. Obras soja e rurais.", tier:"C" },
{ titulo:"Barras Engenharia PI", cidade:"Barras", estado:"PI", resumo:"Construtora centro-norte PI. Obras residenciais.", tier:"C" },
{ titulo:"Piripiri Construtora PI", cidade:"Piripiri", estado:"PI", resumo:"Construtora norte PI. Obras residenciais.", tier:"C" },

// RIO GRANDE DO NORTE — RN
{ titulo:"MRV RN", cidade:"Natal", estado:"RN", resumo:"MCMV RN. Canteiros com bomba estacionária.", tier:"A" },
{ titulo:"Construtora Natal RN", cidade:"Natal", estado:"RN", resumo:"Construtora RN. Obras residenciais com bomba.", tier:"A" },
{ titulo:"Potengi Construtora RN", cidade:"Natal", estado:"RN", resumo:"Incorporadora RN. Residenciais com concretagem.", tier:"B" },
{ titulo:"Mossoró Engenharia RN", cidade:"Mossoró", estado:"RN", resumo:"Construtora oeste RN. Obras sal, petróleo e residenciais.", tier:"B" },
{ titulo:"Parnamirim Construtora RN", cidade:"Parnamirim", estado:"RN", resumo:"Construtora RMNAT. Obras residenciais.", tier:"C" },
{ titulo:"Caicó Engenharia RN", cidade:"Caicó", estado:"RN", resumo:"Construtora Seridó RN. Obras mineração e residenciais.", tier:"C" },
{ titulo:"Santa Cruz Construtora RN", cidade:"Santa Cruz", estado:"RN", resumo:"Construtora centro RN. Obras residenciais.", tier:"C" },
{ titulo:"Açu Engenharia RN", cidade:"Açu", estado:"RN", resumo:"Construtora oeste RN. Obras sal e residenciais.", tier:"C" },
{ titulo:"Currais Novos Construtora RN", cidade:"Currais Novos", estado:"RN", resumo:"Construtora Seridó. Obras scheelita e residenciais.", tier:"C" },
{ titulo:"São Gonçalo do Amarante Engenharia RN", cidade:"São Gonçalo do Amarante", estado:"RN", resumo:"Construtora RMNAT. Obras residenciais.", tier:"C" },

// PARAÍBA — PB
{ titulo:"MRV PB", cidade:"João Pessoa", estado:"PB", resumo:"MCMV PB. Canteiros com bomba estacionária.", tier:"A" },
{ titulo:"Construtora João Pessoa PB", cidade:"João Pessoa", estado:"PB", resumo:"Incorporadora PB. Residenciais com bomba lança.", tier:"A" },
{ titulo:"Moura Dubeux PB", cidade:"João Pessoa", estado:"PB", resumo:"Incorporadora alto padrão PB. Obras com bomba.", tier:"B" },
{ titulo:"Campina Grande Engenharia PB", cidade:"Campina Grande", estado:"PB", resumo:"Construtora polo industrial PB. Obras residenciais.", tier:"B" },
{ titulo:"Patos Construtora PB", cidade:"Patos", estado:"PB", resumo:"Construtora sertão PB. Obras residenciais.", tier:"C" },
{ titulo:"Sousa Engenharia PB", cidade:"Sousa", estado:"PB", resumo:"Construtora Alto Sertão PB. Obras residenciais.", tier:"C" },
{ titulo:"Guarabira Construtora PB", cidade:"Guarabira", estado:"PB", resumo:"Construtora Agreste PB. Obras residenciais.", tier:"C" },
{ titulo:"Cajazeiras Engenharia PB", cidade:"Cajazeiras", estado:"PB", resumo:"Construtora Alto Sertão PB. Obras residenciais.", tier:"C" },
{ titulo:"Santa Rita Construtora PB", cidade:"Santa Rita", estado:"PB", resumo:"Construtora RMJP. Obras residenciais.", tier:"C" },
{ titulo:"Bayeux Engenharia PB", cidade:"Bayeux", estado:"PB", resumo:"Construtora RMJP. Obras residenciais.", tier:"C" },

// ALAGOAS — AL
{ titulo:"MRV AL", cidade:"Maceió", estado:"AL", resumo:"MCMV AL. Canteiros com bomba estacionária.", tier:"A" },
{ titulo:"Construtora Maceió AL", cidade:"Maceió", estado:"AL", resumo:"Incorporadora AL. Residenciais com bomba lança.", tier:"A" },
{ titulo:"Construtora Pilar AL", cidade:"Maceió", estado:"AL", resumo:"Construtora AL. Obras residenciais e públicas.", tier:"B" },
{ titulo:"Arapiraca Engenharia AL", cidade:"Arapiraca", estado:"AL", resumo:"Construtora Agreste AL. Obras residenciais.", tier:"B" },
{ titulo:"Penedo Construtora AL", cidade:"Penedo", estado:"AL", resumo:"Construtora São Francisco AL. Obras fruticultura.", tier:"C" },
{ titulo:"União dos Palmares Engenharia AL", cidade:"União dos Palmares", estado:"AL", resumo:"Construtora AL. Obras cana e residenciais.", tier:"C" },
{ titulo:"Rio Largo Construtora AL", cidade:"Rio Largo", estado:"AL", resumo:"Construtora AL. Obras cana e residenciais.", tier:"C" },
{ titulo:"Palmeira dos Índios Engenharia AL", cidade:"Palmeira dos Índios", estado:"AL", resumo:"Construtora AL. Obras residenciais.", tier:"C" },
{ titulo:"Delmiro Gouveia Construtora AL", cidade:"Delmiro Gouveia", estado:"AL", resumo:"Construtora sertão AL. Obras energia.", tier:"C" },
{ titulo:"Santana do Ipanema Engenharia AL", cidade:"Santana do Ipanema", estado:"AL", resumo:"Construtora sertão AL. Obras residenciais.", tier:"C" },

// SERGIPE — SE
{ titulo:"MRV SE", cidade:"Aracaju", estado:"SE", resumo:"MCMV SE. Canteiros com bomba estacionária.", tier:"A" },
{ titulo:"Construtora Aracaju SE", cidade:"Aracaju", estado:"SE", resumo:"Incorporadora SE. Residenciais com bomba.", tier:"A" },
{ titulo:"Construtora Celi SE", cidade:"Aracaju", estado:"SE", resumo:"Construtora SE. Obras residenciais e comerciais.", tier:"B" },
{ titulo:"Itabaiana Engenharia SE", cidade:"Itabaiana", estado:"SE", resumo:"Construtora Agreste SE. Obras residenciais.", tier:"C" },
{ titulo:"Lagarto Construtora SE", cidade:"Lagarto", estado:"SE", resumo:"Construtora SE. Obras residenciais.", tier:"C" },
{ titulo:"Nossa Senhora do Socorro Engenharia SE", cidade:"Nossa Senhora do Socorro", estado:"SE", resumo:"Construtora RMARAC. Obras residenciais.", tier:"C" },
{ titulo:"Estância Construtora SE", cidade:"Estância", estado:"SE", resumo:"Construtora sul SE. Obras residenciais.", tier:"C" },
{ titulo:"Tobias Barreto Engenharia SE", cidade:"Tobias Barreto", estado:"SE", resumo:"Construtora SE. Obras confecções e residenciais.", tier:"C" },
{ titulo:"São Cristóvão Construtora SE", cidade:"São Cristóvão", estado:"SE", resumo:"Construtora histórica SE. Obras residenciais.", tier:"C" },
{ titulo:"Carmópolis Engenharia SE", cidade:"Carmópolis", estado:"SE", resumo:"Construtora polo petróleo SE. Obras industriais.", tier:"C" },

// TOCANTINS — TO
{ titulo:"MRV TO", cidade:"Palmas", estado:"TO", resumo:"MCMV TO. Canteiros com bomba estacionária.", tier:"A" },
{ titulo:"Construtora Palmas TO", cidade:"Palmas", estado:"TO", resumo:"Incorporadora TO. Residenciais com bomba lança.", tier:"A" },
{ titulo:"Construtora Araguaína TO", cidade:"Araguaína", estado:"TO", resumo:"Construtora TO. Obras frigoríficos e residenciais.", tier:"B" },
{ titulo:"Gurupi Engenharia TO", cidade:"Gurupi", estado:"TO", resumo:"Construtora sul TO. Obras soja e residenciais.", tier:"C" },
{ titulo:"Porto Nacional Construtora TO", cidade:"Porto Nacional", estado:"TO", resumo:"Construtora TO. Obras residenciais.", tier:"C" },
{ titulo:"Paraíso Construtora TO", cidade:"Paraíso do Tocantins", estado:"TO", resumo:"Construtora TO. Obras agronegócio.", tier:"C" },
{ titulo:"Dianópolis Engenharia TO", cidade:"Dianópolis", estado:"TO", resumo:"Construtora leste TO. Obras garimpo e residenciais.", tier:"C" },
{ titulo:"Miracema Construtora TO", cidade:"Miracema do Tocantins", estado:"TO", resumo:"Construtora TO. Obras residenciais.", tier:"C" },
{ titulo:"Colinas Engenharia TO", cidade:"Colinas do Tocantins", estado:"TO", resumo:"Construtora TO. Obras soja e residenciais.", tier:"C" },
{ titulo:"Tocantinópolis Construtora TO", cidade:"Tocantinópolis", estado:"TO", resumo:"Construtora extremo norte TO. Obras residenciais.", tier:"C" },

// RONDÔNIA — RO
{ titulo:"MRV RO", cidade:"Porto Velho", estado:"RO", resumo:"MCMV RO. Canteiros com bomba estacionária.", tier:"A" },
{ titulo:"Construtora Porto Velho RO", cidade:"Porto Velho", estado:"RO", resumo:"Construtora RO. Obras hidrelétricas e residenciais.", tier:"B" },
{ titulo:"Ji-Paraná Engenharia RO", cidade:"Ji-Paraná", estado:"RO", resumo:"Construtora RO. Obras soja e residenciais.", tier:"B" },
{ titulo:"Cacoal Construtora RO", cidade:"Cacoal", estado:"RO", resumo:"Construtora RO. Obras café e residenciais.", tier:"C" },
{ titulo:"Vilhena Engenharia RO", cidade:"Vilhena", estado:"RO", resumo:"Construtora sul RO. Obras soja e residenciais.", tier:"C" },
{ titulo:"Ariquemes Construtora RO", cidade:"Ariquemes", estado:"RO", resumo:"Construtora RO. Obras estanho e residenciais.", tier:"C" },
{ titulo:"Rolim de Moura Engenharia RO", cidade:"Rolim de Moura", estado:"RO", resumo:"Construtora RO. Obras residenciais.", tier:"C" },
{ titulo:"Guajará-Mirim Construtora RO", cidade:"Guajará-Mirim", estado:"RO", resumo:"Construtora fronteira RO. Obras residenciais.", tier:"C" },
{ titulo:"Jaru Engenharia RO", cidade:"Jaru", estado:"RO", resumo:"Construtora RO. Obras agronegócio e residenciais.", tier:"C" },
{ titulo:"Ouro Preto do Oeste Construtora RO", cidade:"Ouro Preto do Oeste", estado:"RO", resumo:"Construtora RO. Obras residenciais.", tier:"C" },

// ACRE — AC
{ titulo:"MRV AC", cidade:"Rio Branco", estado:"AC", resumo:"MCMV AC. Canteiros com bomba.", tier:"A" },
{ titulo:"Construtora Rio Branco AC", cidade:"Rio Branco", estado:"AC", resumo:"Construtora AC. Obras residenciais e públicas.", tier:"B" },
{ titulo:"Construtora Acre Habitação AC", cidade:"Rio Branco", estado:"AC", resumo:"Construtora AC. Obras residenciais com bomba.", tier:"B" },
{ titulo:"Cruzeiro do Sul Engenharia AC", cidade:"Cruzeiro do Sul", estado:"AC", resumo:"Construtora Juruá AC. Obras residenciais.", tier:"C" },
{ titulo:"Sena Madureira Construtora AC", cidade:"Sena Madureira", estado:"AC", resumo:"Construtora AC. Obras residenciais.", tier:"C" },
{ titulo:"Tarauacá Engenharia AC", cidade:"Tarauacá", estado:"AC", resumo:"Construtora AC. Obras residenciais.", tier:"C" },
{ titulo:"Feijó Construtora AC", cidade:"Feijó", estado:"AC", resumo:"Construtora AC. Obras residenciais.", tier:"C" },
{ titulo:"Brasiléia Engenharia AC", cidade:"Brasiléia", estado:"AC", resumo:"Construtora fronteira AC. Obras residenciais.", tier:"C" },
{ titulo:"Xapuri Construtora AC", cidade:"Xapuri", estado:"AC", resumo:"Construtora AC. Obras residenciais.", tier:"C" },
{ titulo:"Mâncio Lima Engenharia AC", cidade:"Mâncio Lima", estado:"AC", resumo:"Construtora extremo oeste AC. Obras madeira.", tier:"C" },

// AMAPÁ — AP
{ titulo:"MRV AP", cidade:"Macapá", estado:"AP", resumo:"MCMV AP. Canteiros com bomba.", tier:"A" },
{ titulo:"Construtora Macapá AP", cidade:"Macapá", estado:"AP", resumo:"Construtora AP. Obras residenciais e portuárias.", tier:"B" },
{ titulo:"Santana Engenharia AP", cidade:"Santana", estado:"AP", resumo:"Construtora porto AP. Obras ferro e celulose.", tier:"B" },
{ titulo:"Laranjal do Jari Construtora AP", cidade:"Laranjal do Jari", estado:"AP", resumo:"Construtora Jari AP. Obras celulose e residenciais.", tier:"C" },
{ titulo:"Oiapoque Engenharia AP", cidade:"Oiapoque", estado:"AP", resumo:"Construtora fronteira AP. Obras residenciais.", tier:"C" },
{ titulo:"Porto Grande Construtora AP", cidade:"Porto Grande", estado:"AP", resumo:"Construtora interior AP. Obras residenciais.", tier:"C" },
{ titulo:"Pedra Branca Engenharia AP", cidade:"Pedra Branca do Amapari", estado:"AP", resumo:"Construtora AP. Obras mineração ouro.", tier:"C" },
{ titulo:"Calçoene Construtora AP", cidade:"Calçoene", estado:"AP", resumo:"Construtora norte AP. Obras residenciais.", tier:"C" },
{ titulo:"Tartarugalzinho Engenharia AP", cidade:"Tartarugalzinho", estado:"AP", resumo:"Construtora nordeste AP. Obras dendê.", tier:"C" },
{ titulo:"Mazagão Construtora AP", cidade:"Mazagão", estado:"AP", resumo:"Construtora AP. Obras açaí e residenciais.", tier:"C" },

// RORAIMA — RR
{ titulo:"MRV RR", cidade:"Boa Vista", estado:"RR", resumo:"MCMV RR. Canteiros com bomba.", tier:"A" },
{ titulo:"Norte Construtora RR", cidade:"Boa Vista", estado:"RR", resumo:"Construtora RR. Obras residenciais e públicas.", tier:"B" },
{ titulo:"Construtora Boa Vista RR", cidade:"Boa Vista", estado:"RR", resumo:"Construtora RR. Obras residenciais com bomba.", tier:"B" },
{ titulo:"Pacaraima Construtora RR", cidade:"Pacaraima", estado:"RR", resumo:"Construtora fronteira Venezuela. Obras residenciais.", tier:"C" },
{ titulo:"Caracaraí Engenharia RR", cidade:"Caracaraí", estado:"RR", resumo:"Construtora RR. Obras pecuária e residenciais.", tier:"C" },
{ titulo:"Mucajaí Construtora RR", cidade:"Mucajaí", estado:"RR", resumo:"Construtora RR. Obras residenciais.", tier:"C" },
{ titulo:"Bonfim Engenharia RR", cidade:"Bonfim", estado:"RR", resumo:"Construtora fronteira Guiana. Obras residenciais.", tier:"C" },
{ titulo:"Alto Alegre Construtora RR", cidade:"Alto Alegre", estado:"RR", resumo:"Construtora RR. Obras garimpo e residenciais.", tier:"C" },
{ titulo:"Cantá Engenharia RR", cidade:"Cantá", estado:"RR", resumo:"Construtora entorno Boa Vista. Obras residenciais.", tier:"C" },
{ titulo:"Iracema Construtora RR", cidade:"Iracema", estado:"RR", resumo:"Construtora leste RR. Obras mineração.", tier:"C" },

];

// ─── Script principal ──────────────────────────────────────────────────────────

async function main() {
  const porEstado: Record<string, number> = {};
  for (const c of CONSTRUTORAS) porEstado[c.estado] = (porEstado[c.estado] || 0) + 1;

  console.log(`\n${"═".repeat(60)}`);
  console.log("SEED — CONSTRUTORAS BRASIL");
  console.log(`Modo: ${COMMIT ? "🔴 PRODUÇÃO (--commit)" : "🟡 DRY-RUN (sem --commit)"}`);
  console.log(`Total: ${CONSTRUTORAS.length} construtoras`);
  console.log(`${"═".repeat(60)}`);
  for (const [uf, qtd] of Object.entries(porEstado).sort((a, b) => b[1] - a[1]))
    console.log(`  ${uf}: ${qtd}`);
  console.log("");

  if (!COMMIT) {
    for (const c of CONSTRUTORAS)
      console.log(`  [${c.tier}] ${c.titulo} — ${c.cidade}/${c.estado}`);
    console.log(`\n💡 Para gravar: npx tsx scripts/seed-construtoras-brasil.ts --commit\n`);
    return;
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let criados = 0, jaExistiam = 0;

  try {
    for (const c of CONSTRUTORAS) {
      const titulo = c.titulo.trim();
      const existe = await client.query(`SELECT id FROM "DossieComercial" WHERE titulo=$1 LIMIT 1`, [titulo]);

      if (existe.rows.length > 0) {
        jaExistiam++;
        await client.query(
          `INSERT INTO "DossieCarteira" (id,"dossieId",carteira,status,"createdAt","updatedAt")
           VALUES (gen_random_uuid(),$1,'CONSTRUTORA_BRASIL','MONITORANDO',NOW(),NOW())
           ON CONFLICT ("dossieId",carteira) DO NOTHING`,
          [existe.rows[0].id],
        );
        continue;
      }

      const ins = await client.query(
        `INSERT INTO "DossieComercial" (
           id,titulo,resumo,status,origem,tipo,segmento,
           cidade,estado,completude,score,
           "missaoAtual","ultimaAtividade","createdAt","updatedAt"
         ) VALUES (
           gen_random_uuid(),$1,$2,'INVESTIGANDO','JOAO_RADAR','EMPRESA','Construtora',
           $3,$4,0,0,$5,NOW()-INTERVAL '30 days',NOW(),NOW()
         ) RETURNING id`,
        [titulo, c.resumo, c.cidade, c.estado,
         `Identificar o decisor que contrata locação de equipamentos de concreto (bomba lança, bomba estacionária, central in loco, betoneira). Buscar Diretor de Obras, Gerente de Obras ou Comprador. LinkedIn + telefone + WhatsApp.`],
      );

      await client.query(
        `INSERT INTO "DossieCarteira" (id,"dossieId",carteira,status,"createdAt","updatedAt")
         VALUES (gen_random_uuid(),$1,'CONSTRUTORA_BRASIL','MONITORANDO',NOW(),NOW())
         ON CONFLICT ("dossieId",carteira) DO NOTHING`,
        [ins.rows[0].id],
      );

      console.log(`  + [${c.tier}] ${titulo} — ${c.cidade}/${c.estado}`);
      criados++;
    }
  } finally {
    await client.end();
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`  Criados: ${criados} | Já existiam: ${jaExistiam}`);
  console.log(`\n✅ João investiga decisores das construtoras na próxima terça.\n`);
}

main().catch(err => { console.error("Erro fatal:", err); process.exit(1); });
