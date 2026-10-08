#!/usr/bin/env python3
"""Triagem automática SEM pesquisa web das candidatas da Base Nacional.

Lê um export JSON (somente leitura) das candidatas e unidades, aplica regras
determinísticas sobre CNAE, nome, porte, natureza, unidades e localização, e
gera uma classificação PRELIMINAR. Não acessa banco nem internet; não altera
nenhuma classificação gravada. A classificação preliminar NÃO é confirmação.

Uso: python3 triagem-sem-web.py --entrada=export.json --saida=pasta [--uf=PE]
     [--pesquisadas=arquivo.json ...]   (ids já pesquisados → trava anti-repetição)
"""
import json, sys, os, re, unicodedata, collections, csv

def arg(n, d=None):
    for a in sys.argv[1:]:
        if a.startswith(f"--{n}="): return a.split("=", 1)[1]
    return d
def args(n): return [a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith(f"--{n}=")]

def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().upper()
    return re.sub(r"[^A-Z0-9@. ]+", " ", s)

# Regiões metropolitanas das capitais (municípios "não interior"). PE detalhado; demais UFs: só a capital.
METRO = {
 "PE": {"RECIFE","JABOATAO DOS GUARARAPES","OLINDA","PAULISTA","CABO DE SANTO AGOSTINHO","CAMARAGIBE",
        "SAO LOURENCO DA MATA","IGARASSU","ABREU E LIMA","IPOJUCA","MORENO","ITAPISSUMA","ILHA DE ITAMARACA",
        "ITAMARACA","ARACOIABA"},
}
CAPITAIS = {"AC":"RIO BRANCO","AL":"MACEIO","AP":"MACAPA","AM":"MANAUS","BA":"SALVADOR","CE":"FORTALEZA","DF":"BRASILIA",
 "ES":"VITORIA","GO":"GOIANIA","MA":"SAO LUIS","MT":"CUIABA","MS":"CAMPO GRANDE","MG":"BELO HORIZONTE","PA":"BELEM",
 "PB":"JOAO PESSOA","PR":"CURITIBA","PE":"RECIFE","PI":"TERESINA","RJ":"RIO DE JANEIRO","RN":"NATAL","RS":"PORTO ALEGRE",
 "RO":"PORTO VELHO","RR":"BOA VISTA","SC":"FLORIANOPOLIS","SP":"SAO PAULO","SE":"ARACAJU","TO":"PALMAS"}
def interior(cidade, uf):
    c = norm(cidade).strip()
    return c not in METRO.get(uf, set()) and c != CAPITAIS.get(uf)

KW_CONCRETO = re.compile(r"\b(CONCRET\w*|CONCREMIX|BETON\w*|\w*MIX|USINA\w*|BOMBEAMENTO|CONCRET)\b")
KW_ARGAMASSA = re.compile(r"\b(ARGAMASS\w*|\w*MASSA|REBOCO|REJUNTE|GESSO|CAL|CIMENTO COLA|ACRILIC\w*)\b")
KW_PREMOLD = re.compile(r"\b(PRE ?MOLDAD\w*|PREMOLDAD\w*|ARTEFATO\w*|BLOCO\w*|LAJE\w*|POSTE\w*|TUBO\w*|MOUR\w*|PAVI\w*|BLOKRET\w*|PISO\w*|CERAMIC\w*)\b")
KW_CONSTR = re.compile(r"\b(CONSTRU\w*|ENGENHARIA|INCORPORA\w*|EDIFICA\w*|OBRAS?|EMPREENDIMENTO\w*|PROJETO\w*|ARQUITETURA)\b")
KW_LOJA = re.compile(r"\b(MATERIA\w* DE CONSTRUCAO|MAT CONSTRUCAO|MADEIREIRA|DEPOSITO|HOME CENTER|FERRAGENS?|VIDRACARIA)\b")
KW_FORTE = re.compile(r"\b(CONCRETEIRA|CONCRETAGEM|CONCREMIX|USINA DE CONCRETO|BETONEIRA\w*|BOMBEAMENTO)\b")
NAO_CONC = re.compile(r"\b(ARTEFATOS?|BLOCOS?|PRE ?MOLDADOS?|PISOS?|LAJES?|TUBOS?) DE CONCRETO\b")
KW_TRANSP = re.compile(r"\b(TRANSPORT\w*|LOGISTIC\w*|FRETE\w*|CARGAS?)\b")

ALVO = "2330305"
PREMOLD_CNAE = {"2330301","2330302","2330303","2330304","2330399","2391501","2391502","2391503"}
ARGAM_CNAE = {"2392300","2320600","2399199","2399101"}   # cal/gesso, cimento, minerais não metálicos
CONSTR_PREF = ("41","42","43","71")
LOJA_CNAE_PREF = ("4744","4742","4743","4679","4674","4673","4741","4789","4761")
TRANSP_PREF = ("49","52")
MINER_PREF = ("08",)                   # extração de areia/brita: pedreira pode ter usina
LOCACAO = {"7732201","7739099","7732202"}
SERV_CONCRETO = {"4399103","4399105"}   # obras de alvenaria / perfuração; 4399-1/03 (alvenaria) é fraco
SERVICOS_CONSTRUCAO = {"4399101","4399199","4399104"}

def triar(x, uf):
    units = [u for u in (x.get("unidades") or []) if u.get("ativa")]
    nome = norm(f"{x.get('razao') or ''} {x.get('fantasia') or ''} " + " ".join((u.get('fantasia') or '') for u in units))
    princ = {u.get("cnae") for u in units}
    sec = set(); [sec.update(u.get("sec") or []) for u in units]
    A = any(u.get("alvo") for u in units)
    sinais = []
    nome_c = NAO_CONC.sub(' ', nome); forte = bool(KW_FORTE.search(nome_c))
    conc = bool(KW_CONCRETO.search(nome_c)) or forte; arg = bool(KW_ARGAMASSA.search(nome))
    pre = bool(KW_PREMOLD.search(nome)); con = bool(KW_CONSTR.search(nome))
    loja = bool(KW_LOJA.search(nome)); tra = bool(KW_TRANSP.search(nome))
    if A: sinais.append("CNAE principal 2330-3/05")
    else: sinais.append("2330-3/05 só secundário")
    if conc: sinais.append("nome: concreto/mix/beton")
    if arg: sinais.append("nome: argamassa/massa/cal/gesso")
    if pre: sinais.append("nome: pré-moldado/artefato")
    if con: sinais.append("nome: construtora/engenharia")
    if loja: sinais.append("nome: comércio/materiais")
    if tra: sinais.append("nome: transporte")
    if princ & LOCACAO or sec & LOCACAO: sinais.append("CNAE locação de máquinas")
    if any(p.startswith(MINER_PREF) for p in princ): sinais.append("CNAE principal mineração (areia/brita)")
    p_pre = bool(princ & PREMOLD_CNAE); p_arg = bool(princ & ARGAM_CNAE)
    p_con = any(p.startswith(CONSTR_PREF) for p in princ if p not in SERVICOS_CONSTRUCAO|SERV_CONCRETO)
    p_loja = any(p.startswith(LOJA_CNAE_PREF) for p in princ)
    p_tra = any(p.startswith(TRANSP_PREF) for p in princ)
    p_min = any(p.startswith(MINER_PREF) for p in princ)
    p_loc = bool(princ & LOCACAO)

    # Ordem de decisão: sinais específicos de concreto primeiro; argamassa antes de "mix" genérico.
    p_cim = "2320600" in princ
    mei = x.get("natureza") == "2135" and x.get("porte") == "01"
    if forte or (conc and not arg and (A or p_loc or p_min or "4399" in "".join(princ))):
        cl = "FORTE_INDICIO_CONCRETEIRA"
    elif A and not (arg or pre or loja or tra) :
        cl = "FORTE_INDICIO_CONCRETEIRA" if conc else "POSSIVEL_CONCRETEIRA"
    elif conc and not arg:
        cl = "POSSIVEL_CONCRETEIRA"
    elif p_cim:
        cl = "PROVAVEL_NAO_CONCRETEIRA"; sinais.append("perfil cimenteira")
    elif arg or (p_arg and not conc):
        cl = "PROVAVEL_ARGAMASSEIRA"
    elif p_min or p_loc:
        cl = "POSSIVEL_CONCRETEIRA"          # pedreira/locadora com 2330-3/05: pode ter usina ou ser compradora
    elif pre or p_pre:
        cl = "PROVAVEL_NAO_CONCRETEIRA"      # pré-moldados/artefatos
        sinais.append("perfil pré-moldados/artefatos")
    elif p_con or (con and not p_loja):
        cl = "PROVAVEL_CONSTRUTORA"
    elif p_loja or loja:
        cl = "PROVAVEL_LOJA_REVENDA"
    elif p_tra or tra:
        cl = "PROVAVEL_TRANSPORTADORA"
    elif A:
        cl = "INCONCLUSIVA"
    elif mei and not conc:
        cl = "PROVAVEL_NAO_CONCRETEIRA"; sinais.append("empresário individual/ME sem sinal de concreto")
    elif princ and not any(p.startswith(("23","08","43","41","42","77","46","47","49","71")) for p in princ):
        cl = "PROVAVEL_NAO_CONCRETEIRA"
    else:
        cl = "INCONCLUSIVA"

    pe_units = [u for u in units if u.get("uf") == uf] if uf else units
    n_int = sum(1 for u in pe_units if interior(u.get("cidade"), u.get("uf")))
    score = (40 if A else 0) + (30 if conc and not arg else 0) + 5*min(len(units), 6) \
        + (10 if n_int else 0) + {"05": 10, "03": 5}.get(x.get("porte"), 0) \
        + (5 if (x.get("capital") or 0) >= 500000 else 0) + (5 if p_loc or p_min else 0) \
        - (10 if x.get("natureza") == "2135" else 0)
    return cl, sinais, score, n_int

GENERICOS = {"GMAIL.COM","HOTMAIL.COM","YAHOO.COM.BR","YAHOO.COM","OUTLOOK.COM","BOL.COM.BR","UOL.COM.BR","LIVE.COM",
             "TERRA.COM.BR","ICLOUD.COM","IG.COM.BR","HOTMAIL.COM.BR","OUTLOOK.COM.BR","GLOBO.COM","MSN.COM"}
STOP = {"LTDA","ME","EPP","EIRELI","S","A","SA","DE","DA","DO","DOS","DAS","E","CONCRETO","CONCRETOS","COMERCIO","INDUSTRIA",
        "SERVICOS","CONSTRUCOES","CONSTRUCAO","ENGENHARIA","ARGAMASSA","ARGAMASSAS","MATERIAIS","TRANSPORTES","LTDA.","EMPRESA",
        "PRE","MOLDADOS","ARTEFATOS","CIMENTO","MIX","CONCRETAGEM","LOCACAO","LOCACOES","FILIAL","MATRIZ","GRUPO","DISTRIBUIDORA",
        "BRASIL","NORDESTE","PERNAMBUCO","PE","INDUSTRIAL","FABRICACAO","SERVICO",
        "EMPREENDIMENTOS","CONSTRUTORA","GESSO","GESSOS","COMERCIAL","CENTRAL","PREPARACAO","ECO","REI","GOLD","SOLUCOES",
        "SILVA","SANTOS","LIMA","SOUZA","OLIVEIRA","ANDRADE","MORAES","FERREIRA","ALVES","PEREIRA","COSTA","RODRIGUES","BARROS",
        "NASCIMENTO","GOMES","MARINHO","CAVALCANTE","MELO","ARAUJO","JUNIOR","NETO","FILHO","AGRESTE","SERTAO","PREMOLDADOS",
        "MASSA","LOCADORA","PARTICIPACOES","IMOBILIARIA","INCORPORADORA","EQUIPAMENTOS","MINERACAO","DISTRIBUICAO"}
def marca(x):
    for n in (x.get("fantasia"), x.get("razao")):
        toks = [t for t in norm(n).replace(".", " ").split() if t not in STOP and len(t) > 2 and not t.isdigit()]
        if toks: return toks[0]
    return None

def main():
    ent = arg("entrada"); out = arg("saida"); uf = arg("uf")
    dados = json.load(open(ent, encoding="utf-8"))
    pesquisadas = {}
    for f in args("pesquisadas"):
        for r in json.load(open(f, encoding="utf-8")):
            pesquisadas[r["id"]] = os.path.basename(f)
    os.makedirs(out, exist_ok=True)
    # Agrupamentos (todas as candidatas do export, inclusive já pesquisadas → reaproveitamento)
    por_tel = collections.defaultdict(set); por_dom = collections.defaultdict(set); por_marca = collections.defaultdict(set)
    for x in dados:
        for u in x.get("unidades") or []:
            e = (u.get("email") or "").strip().upper()
            if "@" in e:
                d = e.split("@", 1)[1]
                if d not in GENERICOS: por_dom[d].add(x["id"])
        for u in x.get("unidades") or []:
            t = re.sub(r"\D", "", u.get("tel") or "")
            if len(t) >= 10: por_tel[t].add(x["id"])
        m = marca(x)
        if m: por_marca[m].add(x["id"])
    grupos = []
    for k, ids in por_dom.items():
        if len(ids) > 1: grupos.append({"tipo": "dominio_email", "chave": k.lower(), "ids": sorted(ids)})
    for k, ids in por_tel.items():
        if len(ids) > 1: grupos.append({"tipo": "telefone_receita", "chave": k[:2] + "****" + k[-2:], "ids": sorted(ids)})
    for k, ids in por_marca.items():
        if len(ids) > 1: grupos.append({"tipo": "marca_nome (indício, não comprovado)", "chave": k, "ids": sorted(ids)})
    grupo_de = collections.defaultdict(list)
    for i, g in enumerate(grupos):
        for cid in g["ids"]: grupo_de[cid].append(i)
    status_de = {x["id"]: x.get("status") for x in dados}

    linhas = []
    for x in dados:
        if x.get("status") != "PENDENTE":
            continue                     # preserva tudo o que já foi validado/gravado
        cl, sinais, score, n_int = triar(x, uf)
        # grupo com membro já pesquisado → reaproveitar (só domínio de e-mail comprova relação)
        reaproveita = []
        for gi in grupo_de.get(x["id"], []):
            g = grupos[gi]
            if g["tipo"].startswith("marca"): continue          # marca só é indício; não reaproveita resultado
            for o in g["ids"]:
                if o != x["id"] and status_de.get(o) not in (None, "PENDENTE"):
                    reaproveita.append(f'{g["tipo"]}:{g["chave"]}→{status_de[o]}')
        ja = pesquisadas.get(x["id"])
        if ja and cl == "FORTE_INDICIO_CONCRETEIRA":
            fila = "JA_PESQUISADA_REABERTURA_SUGERIDA"   # só com nova fonte e autorização; não entra na fila
        elif ja:
            fila = "DISPENSADA_JA_PESQUISADA"
        elif cl in ("FORTE_INDICIO_CONCRETEIRA", "POSSIVEL_CONCRETEIRA", "INCONCLUSIVA"):
            fila = "PESQUISAR"
        else:
            fila = "DISPENSADA_TRIAGEM"
        units = [u for u in x.get("unidades") or [] if u.get("ativa")]
        linhas.append({"id": x["id"], "razao": x.get("razao"), "fantasia": x.get("fantasia"), "porte": x.get("porte"),
            "natureza": x.get("natureza"), "classe": "A" if any(u.get("alvo") for u in units) else "B",
            "unidades_ativas": len(units), "unidades_interior_uf": n_int,
            "cidades": sorted({f'{u.get("cidade")}/{u.get("uf")}' for u in units})[:8],
            "cnae_principal": sorted({u.get("cnae") for u in units}),
            "triagem": cl, "sinais": sinais, "score": score, "fila": fila, "ja_pesquisada_em": ja,
            "reaproveitar_de": reaproveita})
    ORD={"PESQUISAR":0,"JA_PESQUISADA_REABERTURA_SUGERIDA":1}
    linhas.sort(key=lambda r: (ORD.get(r["fila"], 2), -r["score"]))
    json.dump(linhas, open(os.path.join(out, "triagem.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(grupos, open(os.path.join(out, "grupos.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    with open(os.path.join(out, "triagem.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["fila","triagem","score","classe","razao","fantasia","porte","unid_ativas","unid_interior","cidades","cnae_principal","sinais","ja_pesquisada_em","reaproveitar_de","id"])
        for r in linhas:
            w.writerow([r["fila"],r["triagem"],r["score"],r["classe"],r["razao"],r["fantasia"] or "",r["porte"],r["unidades_ativas"],
                        r["unidades_interior_uf"],", ".join(r["cidades"]),", ".join(r["cnae_principal"]),"; ".join(r["sinais"]),
                        r["ja_pesquisada_em"] or "","; ".join(r["reaproveitar_de"]),r["id"]])
    c = collections.Counter(r["triagem"] for r in linhas); q = collections.Counter(r["fila"] for r in linhas)
    print(json.dumps({"pendentes": len(linhas), "triagem": c, "fila": q, "grupos": len(grupos)}, ensure_ascii=False, indent=1))

if __name__ == "__main__":
    main()
