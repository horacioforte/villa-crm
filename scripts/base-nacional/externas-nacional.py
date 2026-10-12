#!/usr/bin/env python3
"""Base Nacional — empresas FORA da base encontradas por CNAE vizinho, no Brasil todo (método aprovado em PE).

Criado em 12/10/2026 (autorização de Horácio para todo o Brasil). Gratuito, sem internet e sem banco.

Entrada:
  --vizinhos=cnaes-vizinhos-BR.json   (saída de robo-cnaes-vizinhos.py sem --uf)
  --base-raizes=raizes.txt            (cnpjBasico de todas as candidatas já na Base Nacional)
  --pasta=<competência da Receita>    (Estabelecimentos*.zip e Empresas*.zip)
  --saida=<pasta>

O que faz:
  1) Agrupa por raiz e aplica a triagem de triagem-externas.py (categorias 0/a/b/c/d).
  2) Regra mais rígida para INCLUIR como candidata: o nome precisa indicar com clareza concreto usinado,
     usina/central de concreto, concreteira ou "ready mix"/redimix — e não pode ser artefato/pré-moldado
     nem só bombeamento.
  3) Separa: só bombeamento; locação de bombas/betoneiras; fornecedores/revendas; potenciais compradoras
     que não são concreteiras; sem evidência suficiente.
  4) Evita duplicidade com a base e entre si: raiz de CNPJ, telefone, e-mail, domínio próprio e endereço
     (CEP + número + logradouro). Chave compartilhada por muitas empresas (contador, gmail) não conta.
  5) Para as incluídas, monta o JSON completo (todas as unidades, ativas ou não) no formato do
     importar-externas-cnae-vizinho.ts.
Nada é importado aqui.
"""
import collections, csv, glob, io, json, os, re, sys, unicodedata, zipfile
from multiprocessing import Pool

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
_spec = importlib.util.spec_from_file_location("triagem_externas", os.path.join(os.path.dirname(os.path.abspath(__file__)), "triagem-externas.py"))
TE = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(TE)

def arg(n, d=None):
    for a in sys.argv[1:]:
        if a.startswith(f"--{n}="): return a.split("=", 1)[1]
    return d

def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^A-Z0-9 ]+", " ", unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().upper())).strip()

ESTRITO = re.compile(r"\b(CONCRETO USINADO|CONCRETOS USINADOS|USINAS? DE CONCRETO|CENTRAL DE CONCRETO|CENTRAIS DE CONCRETO|CONCRETEIRAS?|REDIMIX|REDI MIX|READY ?MIX|READYMIX)\b")
SO_BOMBA = TE.BOMBA
# "bombeamento de concreto usinado" / "bomba para concreto usinado" descreve serviço de bomba, não usina.
SEM_BOMBA = re.compile(r"\b(SERVICOS? DE )?(BOMBEAMENTO|BOMBAS?|LOCACAO DE BOMBAS?) (DE|PARA|DO) CONCRETOS? USINADOS?\b")
LOCACAO_TXT = re.compile(r"\b(LOCAC\w*|ALUGUE\w*|LOCADORA)\b")
LOCACAO_BOMBA = re.compile(r"\b(LOCAC\w*|ALUGUE\w*|LOCADORA)\b.*\b(BOMBAS?|BETONEIRAS?)\b|\b(BOMBAS?|BETONEIRAS?)\b.*\b(LOCAC\w*|ALUGUE\w*|LOCADORA)\b|\bBETONLOC\b")
REVENDA = re.compile(r"\b(COMERCIO|COMERCIAL|MATERIAIS? (DE|PARA) CONSTRUCAO|MAT CONSTRUCAO|DEPOSITO|DISTRIBUIDORA|REPRESENTAC\w*|IMPORTAC\w*)\b")
REVENDA_CNAE = re.compile(r"^(4744|4679|4789|4742|4741|4684|4662|4663)")
LIVRES = {"GMAIL.COM", "HOTMAIL.COM", "YAHOO.COM.BR", "YAHOO.COM", "OUTLOOK.COM", "BOL.COM.BR", "UOL.COM.BR", "TERRA.COM.BR",
          "IG.COM.BR", "LIVE.COM", "ICLOUD.COM", "HOTMAIL.COM.BR", "OUTLOOK.COM.BR", "GLOBO.COM", "MSN.COM", "R7.COM", "ZIPMAIL.COM.BR"}

def chaves(r):
    """Chaves de contato de uma linha de Estabelecimentos."""
    ks = set()
    for d, t in ((r[21], r[22]), (r[23], r[24])):
        t = re.sub(r"\D", "", t or ""); d = re.sub(r"\D", "", d or "")
        if len(t) >= 8: ks.add("tel:" + d + t[-8:])
    em = (r[27] or "").strip().upper()
    if "@" in em:
        ks.add("email:" + em)
        dom = em.split("@", 1)[1]
        if dom not in LIVRES and not dom.endswith(".GOV.BR"): ks.add("dom:" + dom)
    cep = re.sub(r"\D", "", r[18] or ""); num = re.sub(r"\D", "", r[15] or "")
    if len(cep) == 8 and num: ks.add("end:" + cep + "|" + num + "|" + norm(r[14])[:20])
    return ks

def varrer(args):
    zp, alvo, base = args
    linhas_alvo, chaves_base = [], collections.defaultdict(set)
    with zipfile.ZipFile(zp) as z:
        for nome in z.namelist():
            with z.open(nome) as f:
                for bruta in io.TextIOWrapper(f, encoding="latin-1", newline=""):
                    raiz = bruta[1:9]
                    if raiz not in alvo and raiz not in base: continue
                    r = next(csv.reader([bruta], delimiter=";"))
                    if len(r) < 28: continue
                    if r[0] in alvo: linhas_alvo.append(r)
                    if r[0] in base:
                        for k in chaves(r): chaves_base[k].add(r[0])
    return linhas_alvo, {k: sorted(v) for k, v in chaves_base.items()}

def main():
    viz = json.load(open(arg("vizinhos"), encoding="utf-8"))
    base = set(open(arg("base-raizes")).read().split())
    pasta, out = arg("pasta"), arg("saida"); os.makedirs(out, exist_ok=True)
    MUN = TE.municipios()

    # 1) triagem por raiz (mesma função usada em PE)
    grupos = collections.OrderedDict()
    for e in viz: grupos.setdefault(e["raiz"], []).append(e)
    empresas = []
    for raiz, ests in grupos.items():
        m = next((e for e in ests if e["matriz"]), ests[0])
        nome = re.sub(r"\s+", " ", TE.norm(f'{m["razao_social"]} ' + " ".join(e["fantasia"] for e in ests)))
        vizinhos = sorted({v for e in ests for v in e["cnaes_vizinhos"]})
        if raiz in base: cat, just = "0", "a raiz do CNPJ já está na Base Nacional (unidade sem o CNAE 2330-3/05)"
        else: cat, just = TE.classificar(nome, m["cnae_principal"], vizinhos)
        # 2) separação mais fina (nacional)
        art = bool(TE.ARTEFATO.search(nome))
        if cat == "0": grupo = "JA_NA_BASE"
        elif m["uf"] == "PE": grupo = "PE_JA_ANALISADA_NO_PILOTO"; just = "Pernambuco preservado: externas de PE já analisadas e decididas no piloto (09/10/2026)"
        elif LOCACAO_BOMBA.search(nome) and not ESTRITO.search(SEM_BOMBA.sub(" ", LOCACAO_TXT.sub(" ", nome))): grupo = "LOCACAO_DE_BOMBAS_OU_BETONEIRAS"
        elif ESTRITO.search(SEM_BOMBA.sub(" ", nome)): grupo = "INCLUIR_CONCRETO_USINADO"; just = "nome indica concreto usinado / usina ou central de concreto / concreteira"
        elif LOCACAO_BOMBA.search(nome): grupo = "LOCACAO_DE_BOMBAS_OU_BETONEIRAS"
        elif cat == "b": grupo = "SO_BOMBEAMENTO"
        elif REVENDA_CNAE.match(m["cnae_principal"]) or (REVENDA.search(nome) and m["cnae_principal"][:2] in {"46", "47"}): grupo = "FORNECEDOR_OU_REVENDA"
        elif cat == "a": grupo = "SEM_EVIDENCIA_SUFICIENTE"; just = "nome com 'concreto' sem indicar concreto usinado/usina/central (regra nacional mais rígida): " + just
        elif cat == "c": grupo = "POTENCIAL_COMPRADORA_NAO_CONCRETEIRA"
        else: grupo = "SEM_EVIDENCIA_SUFICIENTE"
        empresas.append({"grupo": grupo, "categoria_pe": cat, "justificativa": just, "raiz": raiz, "razao_social": m["razao_social"],
            "fantasias": sorted({e["fantasia"] for e in ests if e["fantasia"]}), "estabelecimentos_vizinhos": len(ests),
            "cnae_principal": m["cnae_principal"], "cnaes_vizinhos": vizinhos, "uf": m["uf"], "ufs": sorted({e["uf"] for e in ests}),
            "municipios": sorted({MUN.get(e["municipio_rfb"], e["municipio_rfb"]) for e in ests}), "porte": m.get("porte"),
            "termos": sorted({t for e in ests for t in e["termos"]})})

    incluir = {e["raiz"] for e in empresas if e["grupo"] == "INCLUIR_CONCRETO_USINADO"}
    externas = {e["raiz"] for e in empresas if e["grupo"] != "JA_NA_BASE"}

    # 3) segunda passada: todas as unidades das incluídas + chaves de contato da base e das externas
    arquivos = sorted(glob.glob(os.path.join(pasta, "Estabelecimentos*.zip")))
    linhas, chaves_base = [], collections.defaultdict(set)
    with Pool(min(len(arquivos), os.cpu_count() or 2)) as pool:
        for la, cb in pool.imap_unordered(varrer, [(a, externas, base) for a in arquivos]):
            linhas += la
            for k, v in cb.items(): chaves_base[k].update(v)
    por_raiz = collections.defaultdict(list)
    for r in linhas: por_raiz[r[0]].append(r)

    # chave fraca: compartilhada por mais de 5 raízes (contador, gmail compartilhado etc.)
    uso = collections.Counter()
    for k, v in chaves_base.items(): uso[k] += len(v)
    chaves_ext = {raiz: set().union(*[chaves(r) for r in rs]) for raiz, rs in por_raiz.items()}
    for raiz, ks in chaves_ext.items():
        for k in ks: uso[k] += 1
    forte = lambda k: uso[k] <= 5

    # 4) duplicidade com a base e entre externas (só para quem seria incluída)
    dup = collections.Counter()
    for e in empresas:
        if e["grupo"] == "JA_NA_BASE": dup["raiz_ja_na_base"] += 1
    rep_de = {}
    inc_ord = sorted(incluir, key=lambda r: (-sum(1 for x in por_raiz[r] if x[5] == "02"), r))
    vistos = {}
    for e in empresas:
        if e["raiz"] not in incluir: continue
        ks = {k for k in chaves_ext.get(e["raiz"], set()) if forte(k)}
        hit = sorted({(k.split(":")[0], rz) for k in ks for rz in chaves_base.get(k, ())})
        if hit:
            e["grupo"] = "DUPLICIDADE_COM_A_BASE"
            e["justificativa"] = "mesmo " + ", ".join(sorted({t for t, _ in hit})) + " de candidata já na base (" + ", ".join(sorted({r for _, r in hit})[:5]) + ")"
            for t in {t for t, _ in hit}: dup[f"base_{t}"] += 1
            dup["base_total_empresas"] += 1
    for r in inc_ord:
        e = next(x for x in empresas if x["raiz"] == r)
        if e["grupo"] != "INCLUIR_CONCRETO_USINADO": continue
        ks = {k for k in chaves_ext.get(r, set()) if forte(k)}
        par = next((vistos[k] for k in ks if k in vistos), None)
        if par:
            e["grupo"] = "DUPLICIDADE_ENTRE_EXTERNAS"; e["justificativa"] = f"mesmo grupo (contato/endereço) da externa {par}, que foi incluída"
            dup["entre_externas"] += 1; rep_de[r] = par; continue
        for k in ks: vistos[k] = r

    # 5) JSON de importação (formato do importar-externas-cnae-vizinho.ts)
    emp_info = {}
    finais = {e["raiz"] for e in empresas if e["grupo"] == "INCLUIR_CONCRETO_USINADO"}
    for zp in sorted(glob.glob(os.path.join(pasta, "Empresas*.zip"))):
        with zipfile.ZipFile(zp) as z:
            for nome in z.namelist():
                with z.open(nome) as f:
                    for bruta in io.TextIOWrapper(f, encoding="latin-1", newline=""):
                        if bruta[1:9] not in finais: continue
                        r = next(csv.reader([bruta], delimiter=";"))
                        emp_info[r[0]] = r
    imp = []
    for e in empresas:
        if e["grupo"] != "INCLUIR_CONCRETO_USINADO": continue
        er = emp_info.get(e["raiz"], [e["raiz"], e["razao_social"], "", "", "0", "", ""])
        cap = er[4].replace(".", "").replace(",", ".") if len(er) > 4 else "0"
        uns = []
        for r in sorted(por_raiz[e["raiz"]], key=lambda r: (r[3] != "1", r[0] + r[1] + r[2])):
            uns.append({"cnpj": r[0] + r[1] + r[2], "matriz": r[3] == "1", "fantasia": r[4].strip() or None, "situacao": r[5],
                "inicio": f"{r[10][:4]}-{r[10][4:6]}-{r[10][6:8]}" if len(r[10]) == 8 else None, "cnaePrincipal": r[11],
                "sec": [s for s in r[12].split(",") if s], "tipoLogradouro": r[13].strip() or None, "logradouro": r[14].strip() or None,
                "numero": r[15].strip() or None, "complemento": r[16].strip() or None, "bairro": r[17].strip() or None, "cep": r[18].strip() or None,
                "municipioNome": MUN.get(r[20], r[20]), "uf": r[19]})
        if any(u["cnaePrincipal"] == "2330305" or "2330305" in u["sec"] for u in uns):
            e["grupo"] = "JA_NA_BASE"; e["justificativa"] = "tem unidade com 2330-3/05 (fora do recorte de externas)"; continue
        if not any(u["situacao"] == "02" for u in uns): continue
        ativa = next((u for u in uns if u["situacao"] == "02" and u["matriz"]), next(u for u in uns if u["situacao"] == "02"))
        imp.append({"raiz": e["raiz"], "razao": er[1].strip() or e["razao_social"], "natureza": (er[2] or None) if len(er) > 2 else None,
            "porte": (er[5] or None) if len(er) > 5 else None, "capital": float(cap) if re.fullmatch(r"[\d.]+", cap or "") else None, "unidades": uns,
            "fila": {"uf": ativa["uf"], "municipio": ativa["municipioNome"]},
            "resultado": {"status": "EM_VERIFICACAO", "confianca": None, "tipoAtividade": None,
                "justificativa": f"Origem CNAE vizinho (sem 2330-3/05). Nome indica concreto usinado/usina/central de concreto ({', '.join(e['termos'])}). Sem verificação pública ainda: confirmar na fila.",
                "evidencias": [], "filaMotivo": "CNAE vizinho: nome indica concreto usinado. Confirmar se produz/fornece concreto usinado."}})

    ordem = ["INCLUIR_CONCRETO_USINADO", "SO_BOMBEAMENTO", "LOCACAO_DE_BOMBAS_OU_BETONEIRAS", "FORNECEDOR_OU_REVENDA",
             "POTENCIAL_COMPRADORA_NAO_CONCRETEIRA", "SEM_EVIDENCIA_SUFICIENTE", "DUPLICIDADE_COM_A_BASE", "DUPLICIDADE_ENTRE_EXTERNAS", "PE_JA_ANALISADA_NO_PILOTO", "JA_NA_BASE"]
    empresas.sort(key=lambda x: (ordem.index(x["grupo"]), x["uf"], x["razao_social"]))
    json.dump(empresas, open(os.path.join(out, "externas-BR-triagem.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    with open(os.path.join(out, "externas-BR-triagem.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["grupo", "uf", "razao_social", "fantasias", "raiz", "cnae_principal", "cnaes_vizinhos", "porte", "municipios", "justificativa"])
        for x in empresas: w.writerow([x["grupo"], x["uf"], x["razao_social"], " / ".join(x["fantasias"]), x["raiz"], x["cnae_principal"], ",".join(x["cnaes_vizinhos"]), x["porte"], ", ".join(x["municipios"]), x["justificativa"]])
    json.dump(imp, open(os.path.join(out, "importacao-BR.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    c = collections.Counter(x["grupo"] for x in empresas)
    por_uf = collections.defaultdict(collections.Counter)
    for x in empresas: por_uf[x["uf"]][x["grupo"]] += 1
    res = {"estabelecimentos": len(viz), "empresas": len(empresas), "por_grupo": {k: c[k] for k in ordem}, "para_importar": len(imp),
           "duplicidades_evitadas": dict(dup), "por_uf": {u: dict(v) for u, v in sorted(por_uf.items())}}
    json.dump(res, open(os.path.join(out, "externas-BR-resumo.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in res.items() if k != "por_uf"}, ensure_ascii=False, indent=1))

if __name__ == "__main__":
    main()
