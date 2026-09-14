#!/usr/bin/env python3
# ARQUIVO: scripts/fetch-cnpj-concreteiras.py
# REGRA: nunca remover. Apenas acrescentar.
#
# Baixa dados abertos de CNPJ da Receita Federal e filtra concreteiras.
# CNAE alvo: 2330305 — Preparação de massa de concreto e argamassa para construção
#
# Requisitos:
#   pip install requests --break-system-packages
#
# Uso:
#   python scripts/fetch-cnpj-concreteiras.py
#   python scripts/fetch-cnpj-concreteiras.py --mes 2026-08
#
# Saída: scripts/cnpj-concreteiras.csv (lido por seed-cnpj-concreteiras.ts)

import requests
import zipfile
import io
import csv
import sys
import os
import datetime
from pathlib import Path

# ─── Configuração ──────────────────────────────────────────────────────────────

# FILTRO A: 2330305 em qualquer posição (principal ou secundário)
#           → captura concreteiras "clássicas" (Valebeton, Engemix, etc.)
CNAE_CONCRETO = "2330305"

# FILTRO B: CNAEs amplos de construção que aparecem como principal
#           em concreteiras que registram 2330305 só como secundário
#           (ex: Polimix → 4399199; Supermix filiais → 4299599)
#           → só inclui se o nome fantasia também indicar concreto
CNAES_SERVICO_CONSTRUCAO = {"4399199", "4299599"}

# Palavras-chave no nome fantasia que indicam concreteira
#   quando o CNAE principal é genérico de construção
KEYWORDS_CONCRETO = {
    "CONCRETO", "CONCRET", "USINADO", "DOSADORA", "BETONADA",
    "POLIMIX", "ENGEMIX", "SUPERMIX",
    # Ampliação ChatGPT ↓
    "BETON", "BETAO", "CONCRETAGEM", "CENTRAL CONCRETO",
}

SITUACAO_ATIVA = "02"
BASE_URL = "https://dados.rfb.gov.br/CNPJ/dados_abertos_cnpj"

# ─── Utilitários ───────────────────────────────────────────────────────────────

def parse_mes(args):
    for i, arg in enumerate(args):
        if arg == "--mes" and i + 1 < len(args):
            return args[i + 1]
        if arg.startswith("--mes="):
            return arg.split("=", 1)[1]
    # Tenta mês anterior ao atual (dados sempre atrasam 1-2 meses)
    hoje = datetime.date.today().replace(day=1)
    for _ in range(2):
        hoje = (hoje - datetime.timedelta(days=1)).replace(day=1)
    return hoje.strftime("%Y-%m")


def download_zip_rows(url: str, encoding: str = "latin-1"):
    """Baixa um ZIP, extrai o CSV interno e retorna linhas pipe-separated."""
    nome = url.split("/")[-1]
    print(f"  ↓ {nome} ...", end="", flush=True)
    try:
        r = requests.get(url, stream=True, timeout=600)
        r.raise_for_status()
    except requests.HTTPError as e:
        print(f" IGNORADO ({e.response.status_code})")
        return
    except Exception as e:
        print(f" ERRO: {e}")
        return

    buf = io.BytesIO()
    baixado = 0
    for chunk in r.iter_content(chunk_size=2 * 1024 * 1024):
        buf.write(chunk)
        baixado += len(chunk)
        print(f"\r  ↓ {nome} ... {baixado / 1024 / 1024:.0f} MB", end="", flush=True)

    print(f"\r  ↓ {nome} ... {baixado / 1024 / 1024:.0f} MB OK")
    buf.seek(0)

    with zipfile.ZipFile(buf) as zf:
        for membro in zf.namelist():
            with zf.open(membro) as f:
                reader = csv.reader(
                    io.TextIOWrapper(f, encoding=encoding),
                    delimiter="|",
                    quotechar='"',
                )
                yield from reader


# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    mes = parse_mes(sys.argv[1:])
    print(f"\n{'═' * 60}")
    print(f"FETCH CNPJ — CONCRETEIRAS BRASIL")
    print(f"Mês de referência : {mes}")
    print(f"CNAE concreto     : {CNAE_CONCRETO} (principal ou secundário)")
    print(f"CNAEs construção  : {CNAES_SERVICO_CONSTRUCAO} (só com keyword no nome)")
    print(f"{'═' * 60}\n")

    # ── PASSO 1: Estabelecimentos → encontrar CNPJs ativos com CNAE alvo ──────
    # Estratégia de dois filtros:
    #
    # FILTRO A: 2330305 em qualquer posição (principal OU secundário)
    #   → captura a maioria das concreteiras formalmente cadastradas
    #
    # FILTRO B: CNAE principal genérico de construção (4399199/4299599)
    #   + nome fantasia contém palavra-chave de concreto
    #   → captura casos como Polimix unidades, Concrearte, Supermix filiais
    #   que registraram o CNAE de concreto só como secundário ou nenhum.
    print("PASSO 1: Filtrando estabelecimentos (filtro A + filtro B)...")
    matches: dict = {}  # cnpj_basico → dict

    for i in range(10):
        url = f"{BASE_URL}/{mes}/Estabelecimentos{i}.zip"
        count_antes = len(matches)
        for row in download_zip_rows(url):
            if len(row) < 21:
                continue
            cnpj_basico      = row[0].strip()
            cnpj_ordem       = row[1].strip() if len(row) > 1 else ""
            cnpj_dv          = row[2].strip() if len(row) > 2 else ""
            nome_fantasia    = row[4].strip() if len(row) > 4 else ""
            situacao         = row[5].strip() if len(row) > 5 else ""
            cnae_principal   = row[11].strip() if len(row) > 11 else ""
            cnae_secundarios = row[12].strip() if len(row) > 12 else ""
            uf               = row[19].strip() if len(row) > 19 else ""
            municipio_cod    = row[20].strip() if len(row) > 20 else ""
            ddd              = row[21].strip() if len(row) > 21 else ""
            telefone         = row[22].strip() if len(row) > 22 else ""

            if situacao != SITUACAO_ATIVA:
                continue

            # Filtro A: 2330305 como principal ou secundário
            todos_cnaes = {cnae_principal} | set(cnae_secundarios.replace(" ", "").split(","))
            filtro_a = CNAE_CONCRETO in todos_cnaes

            # Filtro B: CNAE principal genérico + nome com keyword de concreto
            nome_upper = nome_fantasia.upper()
            filtro_b = (
                cnae_principal in CNAES_SERVICO_CONSTRUCAO
                and any(kw in nome_upper for kw in KEYWORDS_CONCRETO)
            )

            if filtro_a or filtro_b:
                # Critério e confiança
                if filtro_a:
                    criterio = "CNAE_DIRETO"
                    confianca = "ALTA"
                else:
                    criterio = "CNAE_GENERICO_NOME"
                    confianca = "MEDIA"

                matches[cnpj_basico] = {
                    "cnpj": f"{cnpj_basico}{cnpj_ordem}{cnpj_dv}",
                    "nome_fantasia": nome_fantasia,
                    "uf": uf,
                    "municipio_cod": municipio_cod,
                    "telefone": f"({ddd}) {telefone}".strip() if ddd else telefone,
                    "razao_social": "",
                    "cidade": "",
                    "criterio_identificacao": criterio,
                    "confianca": confianca,
                }
        encontrados = len(matches) - count_antes
        print(f"     → +{encontrados} concreteiras (total até agora: {len(matches)})")

    print(f"\nTotal estabelecimentos ativos encontrados: {len(matches)}\n")

    if not matches:
        print("❌ Nenhuma empresa encontrada. Verifique o mês ou o CNAE.")
        sys.exit(1)

    # ── PASSO 2: Empresas → razão social ─────────────────────────────────────
    print("PASSO 2: Buscando razões sociais...")
    for i in range(10):
        url = f"{BASE_URL}/{mes}/Empresas{i}.zip"
        for row in download_zip_rows(url):
            if len(row) < 2:
                continue
            basico = row[0].strip()
            if basico in matches:
                matches[basico]["razao_social"] = row[1].strip()

    # ── PASSO 3: Municípios → nomes de cidades ────────────────────────────────
    print("\nPASSO 3: Baixando tabela de municípios...")
    municipios: dict = {}
    url = f"{BASE_URL}/{mes}/Municipios.zip"
    for row in download_zip_rows(url):
        if len(row) >= 2:
            municipios[row[0].strip()] = row[1].strip().title()

    for data in matches.values():
        data["cidade"] = municipios.get(data["municipio_cod"], "")

    # ── PASSO 4: Salvar CSV ───────────────────────────────────────────────────
    output = Path(__file__).parent / "cnpj-concreteiras.csv"
    with open(output, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_ALL)
        writer.writerow(["cnpj", "razao_social", "nome_fantasia", "uf", "cidade", "telefone",
                         "criterio_identificacao", "confianca"])
        for data in sorted(matches.values(), key=lambda x: (x["uf"], x["cidade"])):
            writer.writerow([
                data["cnpj"],
                data["razao_social"],
                data["nome_fantasia"],
                data["uf"],
                data["cidade"],
                data["telefone"],
                data.get("criterio_identificacao", ""),
                data.get("confianca", ""),
            ])

    # Resumo por estado
    por_uf: dict = {}
    for d in matches.values():
        uf = d["uf"] or "??"
        por_uf[uf] = por_uf.get(uf, 0) + 1

    print(f"\n{'─' * 60}")
    print("CONCRETEIRAS POR ESTADO:")
    for uf, qtd in sorted(por_uf.items(), key=lambda x: -x[1]):
        print(f"  {uf}: {qtd}")

    print(f"\n✅ {len(matches)} concreteiras salvas em: {output}")
    print(f"   Próximo passo:")
    print(f"   npx tsx scripts/seed-cnpj-concreteiras.ts          ← dry-run")
    print(f"   npx tsx scripts/seed-cnpj-concreteiras.ts --commit  ← grava\n")


if __name__ == "__main__":
    main()
