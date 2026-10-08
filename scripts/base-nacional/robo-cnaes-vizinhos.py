#!/usr/bin/env python3
"""Robô gratuito — busca de possíveis concreteiras FORA da base (CNAEs vizinhos).

Lê os arquivos ABERTOS da Receita Federal (Estabelecimentos*.zip e Empresas*.zip de uma competência,
baixados gratuitamente) e lista estabelecimentos ATIVOS que:
  - NÃO têm o CNAE 2330-3/05 (esses já estão na base), e
  - têm CNAE principal ou secundário vizinho (pré-moldados, locação de máquinas, serviços de obra,
    extração de areia/brita, cimento, transporte de carga), e
  - têm no nome (razão social ou fantasia) termos de concreto, concreteira, concretagem, mix, beton,
    betoneira, bomba de concreto, bombeamento, usina ou argamassa.
Não acessa internet nem banco. Não importa nada: só gera CSV/JSON para análise (importar exige autorização).

Uso: python3 robo-cnaes-vizinhos.py --pasta=<competencia> --saida=<pasta> [--uf=PE]
"""
import csv, io, json, os, re, sys, zipfile, glob, unicodedata, collections

def arg(n, d=None):
    for a in sys.argv[1:]:
        if a.startswith(f"--{n}="): return a.split("=", 1)[1]
    return d

ALVO = "2330305"
VIZINHOS = {
    "2330301": "pré-moldados de concreto armado", "2330302": "artefatos de cimento", "2330303": "artefatos de fibrocimento",
    "2330304": "casas pré-moldadas", "2330399": "outros artefatos de concreto", "7732201": "aluguel de máquinas para construção",
    "7739099": "aluguel de outras máquinas", "4399199": "serviços especializados de construção", "4399103": "obras de alvenaria",
    "4399105": "perfuração e sondagem", "4313400": "obras de terraplenagem", "0810099": "extração de pedra/areia",
    "0810006": "extração de areia", "0810002": "extração de granito/britamento", "2320600": "fabricação de cimento",
    "4930202": "transporte rodoviário de carga", "4744005": "comércio de materiais de construção (pedra/areia)",
}
# "USINA" sozinho é ambíguo (usina de açúcar, usinagem mecânica): só conta "usina de concreto".
TERMOS = re.compile(r"\b(CONCRET\w*|CONCREMIX|BETON\w*|BETONEIRA\w*|\w+MIX|MIX|BOMBEAMENTO|BOBEAMENTO|BOMBAS? (DE|PARA) CONCRETO|USINAS? DE CONCRETO|ARGAMASS\w*)\b")
FORTE = re.compile(r"\b(CONCRETEIRA|CONCRETAGEM|CONCRETO USINADO|CONCRETOS USINADOS|USINA DE CONCRETO|BOMBEAMENTO|BOMBAS? (DE|PARA) CONCRETO|BETONEIRA\w*|CONCREMIX)\b")
NAO_CONC = re.compile(r"\b(ARTEFATOS?|BLOCOS?|PRE ?MOLDADOS?|PISOS?|LAJES?|TUBOS?|POSTES?) DE CONCRETO\b")

def norm(s):
    return re.sub(r"[^A-Z0-9 ]+", " ", unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().upper())

def linhas(zp):
    with zipfile.ZipFile(zp) as z:
        for nome in z.namelist():
            with z.open(nome) as f:
                for row in csv.reader(io.TextIOWrapper(f, encoding="latin-1", newline=""), delimiter=";"):
                    yield row

def processar_estab(args):
    zp, uf = args
    achados = {}
    filtro_uf = f'";"{uf}";"' if uf else None
    with zipfile.ZipFile(zp) as z:
        for nome in z.namelist():
            with z.open(nome) as f:
                for bruta in io.TextIOWrapper(f, encoding="latin-1", newline=""):
                    if '"02"' not in bruta or (filtro_uf and filtro_uf not in bruta): continue   # pré-filtro rápido
                    r = next(csv.reader([bruta], delimiter=";"))
                    _avaliar(r, uf, achados)
    return achados

def _avaliar(r, uf, achados):
    if True:
            if len(r) < 28 or r[5] != "02": return            # só ATIVAS
            if uf and r[19] != uf: return
            princ, sec = r[11], [s for s in r[12].split(",") if s]
            cnaes = {princ, *sec}
            if ALVO in cnaes: return                            # já está na base
            viz = sorted(c for c in cnaes if c in VIZINHOS)
            if not viz: return
            fant = norm(r[4])
            cnpj = r[0] + r[1] + r[2]
            achados[cnpj] = {"cnpj": cnpj, "raiz": r[0], "matriz": r[3] == "1", "fantasia": r[4].strip(), "cnae_principal": princ,
                             "cnaes_vizinhos": viz, "uf": r[19], "municipio_rfb": r[20], "cep": r[18],
                             "ddd": r[21], "telefone": r[22], "email": r[27].strip().lower(), "_fant": fant}

def main():
    from multiprocessing import Pool
    pasta, saida, uf = arg("pasta"), arg("saida"), (arg("uf") or "").upper() or None
    os.makedirs(saida, exist_ok=True)
    achados = {}
    arquivos = sorted(glob.glob(os.path.join(pasta, "Estabelecimentos*.zip")))
    with Pool(min(len(arquivos), os.cpu_count() or 2)) as pool:
        for parcial in pool.imap_unordered(processar_estab, [(a, uf) for a in arquivos]): achados.update(parcial)
    raizes = {a["raiz"] for a in achados.values()}
    razao = {}
    for zp in sorted(glob.glob(os.path.join(pasta, "Empresas*.zip"))):
        for r in linhas(zp):
            if r and r[0] in raizes: razao[r[0]] = (r[1].strip(), r[5] if len(r) > 5 else "")
    out = []
    for a in achados.values():
        rz, porte = razao.get(a["raiz"], ("", ""))
        nome = NAO_CONC.sub(" ", f"{norm(rz)} {a.pop('_fant')}")
        termos = sorted(set(m.group(0) for m in TERMOS.finditer(nome)))
        if not termos: continue
        a.update({"razao_social": rz, "porte": porte, "termos": termos, "forte": bool(FORTE.search(nome))})
        out.append(a)
    out.sort(key=lambda x: (not x["forte"], x["uf"], x["razao_social"]))
    with open(os.path.join(saida, f"cnaes-vizinhos-{uf or 'BR'}.json"), "w", encoding="utf-8") as f: json.dump(out, f, ensure_ascii=False, indent=1)
    with open(os.path.join(saida, f"cnaes-vizinhos-{uf or 'BR'}.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["forte", "razao_social", "fantasia", "cnpj", "uf", "municipio_rfb", "cnae_principal", "cnaes_vizinhos", "termos", "porte"])
        for a in out: w.writerow([a["forte"], a["razao_social"], a["fantasia"], a["cnpj"], a["uf"], a["municipio_rfb"], a["cnae_principal"], ",".join(a["cnaes_vizinhos"]), ",".join(a["termos"]), a["porte"]])
    c = collections.Counter(("forte" if a["forte"] else "fraco") for a in out)
    print(json.dumps({"uf": uf or "BR", "estabelecimentos_vizinhos_ativos": len(achados), "com_termos_no_nome": len(out), "por_forca": c}, ensure_ascii=False))

if __name__ == "__main__":
    main()
