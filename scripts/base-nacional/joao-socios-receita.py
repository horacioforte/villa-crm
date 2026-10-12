#!/usr/bin/env python3
"""João — quadro societário (QSA) da Receita para o público do João (dados abertos, gratuitos).

Lê Socios*.zip da competência e grava, para as raízes pedidas, os sócios e administradores:
nome, qualificação (cargo), data de entrada e — para sócio pessoa jurídica — o CNPJ (usado para agrupar
grupos econômicos). Não grava CPF (nem a parte mascarada vai para a saída; só uma chave de comparação
interna com hash, para distinguir homônimos). Exclui menores (qualificação 30 ou faixa etária 1).
Uso: python3 joao-socios-receita.py --pasta=<competência> --raizes=<arquivo com cnpjBasico na 2ª coluna |> --saida=socios.json
"""
import csv, glob, hashlib, io, json, os, sys, zipfile

def arg(n, d=None):
    for a in sys.argv[1:]:
        if a.startswith(f"--{n}="): return a.split("=", 1)[1]
    return d

def main():
    pasta = arg("pasta")
    raizes = set()
    for l in open(arg("raizes"), encoding="utf-8"):
        p = l.strip().split("|")
        if len(p) > 1 and p[1].isdigit(): raizes.add(p[1])
        elif p[0].isdigit(): raizes.add(p[0])
    qual = {}
    with zipfile.ZipFile(os.path.join(pasta, "Qualificacoes.zip")) as z:
        for n in z.namelist():
            for r in csv.reader(io.TextIOWrapper(z.open(n), encoding="latin-1"), delimiter=";"): qual[r[0]] = r[1]
    out = {r: [] for r in raizes}
    for zp in sorted(glob.glob(os.path.join(pasta, "Socios*.zip"))):
        with zipfile.ZipFile(zp) as z:
            for n in z.namelist():
                for bruta in io.TextIOWrapper(z.open(n), encoding="latin-1", newline=""):
                    if bruta[1:9] not in raizes: continue
                    r = next(csv.reader([bruta], delimiter=";"))
                    if len(r) < 11: continue
                    if r[4] == "30" or r[10] == "1": continue  # menor de idade: nunca registra
                    tipo = {"1": "PJ", "2": "PF", "3": "ESTRANGEIRO"}.get(r[1], r[1])
                    item = {"tipo": tipo, "nome": r[2].strip(), "qualificacaoCodigo": r[4], "qualificacao": qual.get(r[4], r[4]),
                            "entrada": f"{r[5][:4]}-{r[5][4:6]}-{r[5][6:8]}" if len(r[5]) == 8 else None}
                    if tipo == "PJ": item["cnpjSocio"] = r[3]
                    else: item["chaveDoc"] = hashlib.sha256((r[3] + "|" + r[2].strip()).encode()).hexdigest()[:16]
                    if r[8].strip(): item["representante"] = r[8].strip(); item["qualificacaoRepresentante"] = qual.get(r[9], r[9])
                    out[r[0]].append(item)
    json.dump(out, open(arg("saida"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps({"raizes": len(raizes), "com_socios": sum(1 for v in out.values() if v), "registros": sum(len(v) for v in out.values())}))

if __name__ == "__main__":
    main()
