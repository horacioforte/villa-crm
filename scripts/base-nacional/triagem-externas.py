#!/usr/bin/env python3
"""Triagem automática (gratuita, sem internet) das empresas FORA da base encontradas em CNAEs vizinhos.

Entrada: JSON gerado por robo-cnaes-vizinhos.py (um item por estabelecimento) e, opcionalmente, a lista de
raízes de CNPJ que já estão na Base Nacional. Agrupa por raiz (empresa) e separa em:
  0) UNIDADE_DE_EMPRESA_JA_NA_BASE — a raiz já está na Base Nacional (não é empresa nova);
  a) POSSIVEL_CONCRETEIRA_SEM_2330305 — nome indica concreto (não artefato) e CNAE de serviço/obra;
  b) BOMBEAMENTO_OU_LOCACAO_DE_BOMBA — nome indica bombas de concreto, bombeamento ou concretagem;
  c) POTENCIAL_COMPRADORA_NAO_CONCRETEIRA — locadora de máquinas/betoneiras, pré-moldados, construtora ou
     transportadora ligada a concreto;
  d) SEM_EVIDENCIA_SUFICIENTE — "MIX" ou "argamassa" em nome sem relação clara (mercado, distribuidora etc.).
Nada é importado. Classificação preliminar: não confirma nem descarta ninguém.
Uso: python3 triagem-externas.py --entrada=cnaes-vizinhos-PE.json --base-raizes=raizes.txt --saida=pasta
"""
import json, sys, os, re, csv, collections

def arg(n, d=None):
    for a in sys.argv[1:]:
        if a.startswith(f"--{n}="): return a.split("=", 1)[1]
    return d

BOMBA = re.compile(r"\b(BOMBAS? (DE|PARA) CONCRETO|BOMBEAMENTO|BOBEAMENTO|CONCRETAGE(M|NS)|CONCRETO BOMB\w*|LOCACO?E?S? DE BOMBAS?)\b")
CONCRETO_FORTE = re.compile(r"\b(CONCRETO USINADO|CONCRETEIRA|REDIMIX|CONCRETOS? ESPECIAIS|SOLUCOES EM CONCRETO)\b")
CONCRETO = re.compile(r"\b(CONCRETOS?|\w+MIX CONCRETOS?|CONCRETO \w*MIX)\b")
ARTEFATO = re.compile(r"\b(ARTEFAT\w*|PRE ?-?FABRICAD\w*|PRE ?-?MOLDAD\w*|BLOCOS?|TUBOS?|POSTES?|CONCRETO ARMADO|ESTRUTURAS EM CONCRETO|FUROS?|CORTES?|PISOS?|TIJOLOS?|CERAMICA)\b")
BETONEIRA = re.compile(r"\b(BETONEIRAS?|BETONLOC)\b")
LOCACAO = {"7732201", "7739099"}
PREMOLD = {"2330301", "2330302", "2330303", "2330304", "2330399"}
SERVICO = {"4399199", "4299599", "4391600"}

def norm(s):
    import unicodedata
    return re.sub(r"[^A-Z0-9 ]+", " ", unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().upper())

def classificar(nome, princ, vizinhos):
    if BOMBA.search(nome): return "b", "nome indica bombas de concreto/bombeamento/concretagem"
    art = bool(ARTEFATO.search(nome))
    if CONCRETO_FORTE.search(nome) and not art: return "a", "nome indica concreto usinado/fornecimento de concreto"
    if CONCRETO.search(nome) and not art and (princ in SERVICO or princ in PREMOLD or princ in LOCACAO):
        return "a", f"nome com 'concreto' e CNAE principal {princ} (serviço/obra/pré-moldado), sem 2330-3/05"
    if BETONEIRA.search(nome): return "c", "locação/comércio de betoneiras"
    if princ in LOCACAO or (set(vizinhos) & LOCACAO and re.search(r"\b(LOCAC\w*|MAQUINAS?|EQUIPAMENTOS?)\b", nome)):
        return "c", "locadora de máquinas/equipamentos (possível compradora)"
    if (CONCRETO.search(nome) or re.search(r"\bCONCRET\w*", nome)) and (art or princ in PREMOLD): return "c", "pré-moldados/artefatos ou serviços em concreto"
    if re.search(r"\bCONCRET\w*", nome) and princ[:2] in {"41", "42", "43", "71"}: return "c", "construtora/engenharia com 'concreto' no nome"
    if re.search(r"\bCONCRET\w*", nome) and princ[:2] in {"49"}: return "c", "transportadora com 'concreto' no nome"
    return "d", "termo genérico no nome (MIX/argamassa/concret*) sem relação clara com concreto usinado"

def municipios():
    """Nomes dos municípios pelo código da Receita (tabela oficial já versionada no CRM)."""
    caminho = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "lib", "base-nacional", "municipios-receita.generated.ts")
    try: return dict(re.findall(r'"(\d{4})": "([^"]+)"', open(caminho, encoding="utf-8").read()))
    except OSError: return {}

def main():
    MUN = municipios()
    d = json.load(open(arg("entrada"), encoding="utf-8"))
    base = set(open(arg("base-raizes")).read().split()) if arg("base-raizes") else set()
    out = arg("saida"); os.makedirs(out, exist_ok=True)
    grupos = collections.OrderedDict()
    for e in d: grupos.setdefault(e["raiz"], []).append(e)
    empresas = []
    for raiz, ests in grupos.items():
        m = next((e for e in ests if e["matriz"]), ests[0])
        nome = norm(f'{m["razao_social"]} ' + " ".join(e["fantasia"] for e in ests))
        vizinhos = sorted({v for e in ests for v in e["cnaes_vizinhos"]})
        if raiz in base: cat, just = "0", "a raiz do CNPJ já está na Base Nacional (unidade sem o CNAE 2330-3/05)"
        else: cat, just = classificar(nome, m["cnae_principal"], vizinhos)
        empresas.append({"categoria": cat, "justificativa": just, "raiz": raiz, "razao_social": m["razao_social"],
            "fantasias": sorted({e["fantasia"] for e in ests if e["fantasia"]}), "estabelecimentos": len(ests),
            "cnpjs": [e["cnpj"] for e in ests], "cnae_principal": m["cnae_principal"], "cnaes_vizinhos": vizinhos,
            "forte_no_nome": any(e["forte"] for e in ests), "termos": sorted({t for e in ests for t in e["termos"]}),
            "porte": m.get("porte"), "municipios_rfb": sorted({e["municipio_rfb"] for e in ests}),
            "municipios": sorted({MUN.get(e["municipio_rfb"], e["municipio_rfb"]) for e in ests})})
    ordem = {"0": 0, "a": 1, "b": 2, "c": 3, "d": 4}
    empresas.sort(key=lambda x: (ordem[x["categoria"]], not x["forte_no_nome"], x["razao_social"]))
    json.dump(empresas, open(os.path.join(out, "externas-triagem.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    rot = {"0": "Unidade de empresa já na base", "a": "a) Possível concreteira sem 2330-3/05", "b": "b) Bombeamento/locação de bombas",
           "c": "c) Potencial compradora não concreteira", "d": "d) Sem evidência suficiente"}
    with open(os.path.join(out, "externas-triagem.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["categoria", "nome_forte", "razao_social", "fantasias", "raiz", "estabelecimentos", "cnae_principal", "cnaes_vizinhos", "porte", "municipios", "justificativa"])
        for x in empresas: w.writerow([rot[x["categoria"]], "sim" if x["forte_no_nome"] else "", x["razao_social"], " / ".join(x["fantasias"]), x["raiz"], x["estabelecimentos"], x["cnae_principal"], ",".join(x["cnaes_vizinhos"]), x["porte"], ", ".join(x["municipios"]), x["justificativa"]])
    c = collections.Counter(x["categoria"] for x in empresas)
    print(json.dumps({"estabelecimentos": len(d), "empresas": len(empresas), "por_categoria": {rot[k]: c[k] for k in ordem},
                      "fortes": sum(1 for x in empresas if x["forte_no_nome"])}, ensure_ascii=False, indent=1))

if __name__ == "__main__":
    main()
