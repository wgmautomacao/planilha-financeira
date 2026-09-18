#!/usr/bin/env python3
"""Passe 3: monta o banco sobre o texto GEOMETRICO e audita cada resolucao.

O passe 2 trabalhava sobre texto achatado e precisava de filtros de lixo por
string. Aqui o cabecalho ja saiu por faixa de y, a coluna vizinha ja foi
separada, expoente e fracao ja estao reconstruidos — entao os filtros
heuristicos que podiam destruir linha de conta legitima foram removidos.

Cada resolucao recebe um laudo. O que nao passa nao entra no app: questao com
resolucao quebrada fica em quarentena para reescrita, nao vai para o comprador.
"""
import re, json, collections, random

BASE = "/tmp/claude-0/-home-user-planilha-financeira/c2dece5a-6b39-5ba2-b263-42ad75f96f21/scratchpad"

FIGURA = re.compile(
    r'\b(figura|gr[áa]fico ao lado|gr[áa]fico abaixo|gr[áa]fico acima|o gr[áa]fico da|'
    r'tabela abaixo|tabela acima|tabela a seguir|esquema (abaixo|acima|a seguir)|'
    r'desenho|ilustra[çc][ãa]o|diagrama (abaixo|acima|a seguir)|conforme (a )?figura|'
    r'malha quadriculada|planta baixa|croqui)\b', re.I)

CAPITULOS = [
    ('logica',         r'L[ÓO]GIC|PROPOSI[ÇC]|TABELA[ -]VERDADE|CONECTIVOS|SILOGISMO|QUANTIFICADOR'),
    ('financeiro',     r'C[ÁA]LCULO FINANCEIRO|RENDAS CERTAS|AMORTIZA[ÇC][ÃA]O|TABELAS FINANCEIRAS|TAXAS? EQUIVALENTE'),
    ('descontos',      r'DESCONTOS? SIMPLES|DESCONTOS? COMPOSTOS?|DESCONTO RACIONAL|DESCONTO COMERCIAL|DESCONTO BANC[ÁA]RIO'),
    ('juroscompostos', r'JUROS COMPOSTOS'),
    ('jurossimples',   r'JUROS SIMPLES'),
    ('porcentagem',    r'PORCENTAGEM|PERCENTAGEM'),
    ('probabilidade',  r'PROBABILIDADE'),
    ('combinatoria',   r'AN[ÁA]LISE COMBINAT|PERMUTA[ÇC][ÃA]O|ARRANJO|FATORIAL'),
    ('progressoes',    r'PROGRESS[ÕO]ES|PROGRESS[ÃA]O ARITM|PROGRESS[ÃA]O GEOM'),
    ('regratres',      r'RAZ[ÃA]O E PROPOR|REGRA DE TR[ÊE]S|GRANDEZAS PROPORCIONAIS|DIVIS[ÃA]O PROPORCIONAL'),
    ('equacoes',       r'EQUA[ÇC][ÃA]O DO 1|EQUA[ÇC][ÃA]O DO 2|SISTEMAS? DE EQUA|FUN[ÇC][ÕO]ES|INEQUA[ÇC]'),
    ('estatistica',    r'M[ÉE]DIA ARITM|ESTAT[ÍI]STICA|MEDIANA'),
    ('numeros',        r'N[ÚU]MEROS REAIS|OPERA[ÇC][ÕO]ES COM N[ÚU]MEROS|POTENCIA[ÇC][ÃA]O|RADICIA[ÇC][ÃA]O|'
                       r'DIVISIBILIDADE|M[ÍI]NIMO COMUM|M[ÁA]XIMO COMUM|SISTEMA DE MEDIDAS|'
                       r'N[ÚU]MEROS NATURAIS|N[ÚU]MEROS INTEIROS|FRA[ÇC][ÕO]ES|CONJUNTO DOS N'),
]
CAPITULOS = [(t, re.compile(p)) for t, p in CAPITULOS]

REFINO = [
    ('conjuntos',   r'diagrama de venn|nenhuma das duas|nenhum dos dois|apenas um(a)? (dos|das)|'
                    r'somente (ingl[êe]s|espanhol)|ambas as|conjunto[s]? A e B'),
    ('estatistica', r'm[ée]dia (aritm[ée]tica|ponderada|simples|das notas)|mediana|moda\b'),
]
REFINO = [(t, re.compile(p, re.I)) for t, p in REFINO]

MARCADOR = re.compile(r'(?<![A-Za-z0-9])([a-eA-E])\s*\)\s')
GAB_TXT = re.compile(r'(?:resposta|gabarito|alternativa correta|letra)\s*[:\-]?\s*\(?\s*([A-Ea-e])\s*\)?', re.I)
GAB = re.compile(r'\(\s*([A-Ea-e])\s*\)')


def eh_titulo(l):
    s = l.strip()
    if len(s) < 6 or len(s) > 90:
        return False
    letras = [c for c in s if c.isalpha()]
    if len(letras) < 5:
        return False
    return sum(1 for c in letras if c.isupper()) / len(letras) >= 0.85


def capitulo_de(l):
    up = l.upper()
    for topico, rx in CAPITULOS:
        if rx.search(up):
            return topico
    return None


def fatia(bloco):
    ach = [(m.group(1).lower(), m.start(), m.end()) for m in MARCADOR.finditer(bloco)]
    for i in range(len(ach)):
        if ach[i][0] != 'a':
            continue
        seq, esp = [ach[i]], 'b'
        for j in range(i + 1, len(ach)):
            if ach[j][0] == esp:
                seq.append(ach[j])
                if esp == 'e':
                    break
                esp = chr(ord(esp) + 1)
        if len(seq) < 4:
            continue
        enun = bloco[:seq[0][1]]
        txts = []
        for k, (_, ini, fim) in enumerate(seq):
            prox = seq[k + 1][1] if k + 1 < len(seq) else None
            txts.append(bloco[fim:prox] if prox else bloco[fim:])
        return enun, txts
    return None


RX_NUM = re.compile(r'\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?|\d+(?:\.\d+)?')

def valores(s):
    """Numeros como VALOR, nao como string: 'R$ 2.680,00' e '2.680' sao o
    mesmo numero. Comparar string aqui descartava gabarito correto."""
    out = set()
    for m in RX_NUM.finditer(s):
        t = m.group(0)
        if re.match(r'^\d{1,3}(?:\.\d{3})+', t):
            t = t.replace('.', '').replace(',', '.')
        elif ',' in t:
            t = t.replace(',', '.')
        try:
            out.add(round(float(t), 4))
        except ValueError:
            pass
    return out


def casa_valor(a, b):
    return any(abs(x - y) < 0.005 for x in a for y in b)


# ------------------------------------------------------------------ laudo ----

SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ'

def laudo(resol, alts):
    """Lista de problemas encontrados na resolucao. Vazia = aprovada."""
    problemas = []
    if not resol:
        return ['sem resolucao']
    texto = '\n'.join(resol)

    # 1) denominador orfao: linha que é só número, sobra de fração não casada
    orfas = [l for l in resol if re.fullmatch(r'[\s\d.,]{1,12}', l) and any(c.isdigit() for c in l)]
    if orfas:
        problemas.append('denominador orfao (%d)' % len(orfas))

    # 2) expoente perdido: "3 3", "x 2" — dígito isolado após termo, fora de conta
    perdidos = re.findall(r'(?<![\d.,])([a-zA-Z0-9)])\s(\d)(?![\d.,%°])', texto)
    if len(perdidos) >= 3:
        problemas.append('expoente possivelmente perdido (%d)' % len(perdidos))

    # 3) alternativa vazada para dentro da resolução
    if re.search(r'(?<![A-Za-z0-9])[a-e]\s*\)\s*\S', texto):
        problemas.append('alternativa vazada na resolucao')

    # 4) restos de tabela: muitas linhas ultracurtas
    curtas = sum(1 for l in resol if len(l.strip()) < 8)
    if len(resol) >= 4 and curtas / len(resol) > 0.45:
        problemas.append('resto de tabela (%d/%d linhas curtas)' % (curtas, len(resol)))

    # 5) enunciado de outra questão colado no fim
    if re.search(r'\b\d{1,3}\.\s+[A-ZÁÉÍÓÚ(]', texto):
        problemas.append('enunciado de outra questao colado')

    # 6) tabela de proporcao desenhada com tracos (layout 2-D achatado)
    if any(re.search(r'-{3,}', l) for l in resol):
        problemas.append('tabela de proporcao com tracos')

    # 7) resto tabular: linha com 3+ numeros separados por vao, sem texto
    for l in resol:
        toks = l.split()
        if len(toks) >= 3 and all(re.fullmatch(r'[\d.,%$()x+-]+', t) for t in toks) \
           and re.search(r'\s{2,}', l):
            problemas.append('resto tabular')
            break

    # 8) fração ainda empilhada: linha termina em '=' e a seguinte é numérica
    for i in range(len(resol) - 1):
        if resol[i].rstrip().endswith(('=', '⇒', '+', '-', '.')) and \
           re.fullmatch(r'[\s\d.,]{1,10}', resol[i + 1]) and any(c.isdigit() for c in resol[i + 1]):
            problemas.append('fracao ainda empilhada')
            break

    return problemas


RX_EXP_ENUN = re.compile(r'(?<![a-zA-Z\u00c0-\u00ff])([xyznkb])\s([2-9])(?![\d.,%\u00b0\u00ba])')
RX_EXP_PAREN = re.compile(r'\)\s([2-9])(?![\d.,%\u00b0\u00ba])')

def laudo_enunciado(enun):
    """Expoente perdido no ENUNCIADO e pior que resolucao quebrada: muda a
    questao. 'x 2 - 7x + 12' nao e a mesma equacao que 'x² - 7x + 12'."""
    problemas = []
    if RX_EXP_ENUN.search(enun) or RX_EXP_PAREN.search(enun):
        problemas.append('expoente perdido no enunciado')
    return problemas


def main():
    texto = open(f"{BASE}/banco_geo.txt").read()
    linhas = texto.split('\n')

    inicios, capitulo = [], None
    for i, l in enumerate(linhas):
        if eh_titulo(l):
            c = capitulo_de(l)
            if c:
                capitulo = c
        if re.match(r'^\s*\d{1,4}\s*[\.\)]\s+\S', l):
            inicios.append((i, capitulo))

    aprovadas, quarentena, desc = [], [], collections.Counter()
    motivos = collections.Counter()

    for idx, (ini, cap) in enumerate(inicios):
        fim = inicios[idx + 1][0] if idx + 1 < len(inicios) else len(linhas)
        bloco = '\n'.join(linhas[ini:fim]).strip()
        if len(bloco) < 60:
            desc['bloco curto'] += 1
            continue

        corte = fatia(bloco)
        if not corte:
            desc['sem alternativas'] += 1
            continue
        enun, txts = corte

        partes = txts[-1].split('\n')
        txts[-1] = partes[0]
        cauda = '\n'.join(partes[1:]).strip()

        cab = re.match(r'^\s*(\d{1,4})\s*[\.\)]\s*(\(([^)\n]{2,60})\))?\s*', enun)
        numero = cab.group(1) if cab else None
        banca = (cab.group(3) or '').strip() if cab else ''
        enun = enun[cab.end():] if cab else enun
        enun = re.sub(r'\s+', ' ', enun).strip()

        alts = [re.sub(r'\s+', ' ', t).strip() for t in txts]

        if len(enun) < 30:
            desc['enunciado curto'] += 1; continue
        if len(enun) > 1200:
            desc['enunciado gigante'] += 1; continue
        if FIGURA.search(enun):
            desc['depende de figura'] += 1; continue
        if any(not a for a in alts):
            desc['alternativa vazia'] += 1; continue
        if max(len(a) for a in alts) > 200:
            desc['alternativa gigante'] += 1; continue
        if len(set(alts)) != len(alts):
            desc['alternativas repetidas'] += 1; continue

        m = list(GAB_TXT.finditer(cauda)) or list(GAB.finditer(cauda))
        if not m:
            desc['sem gabarito'] += 1; continue
        gi = ord(m[-1].group(1).upper()) - ord('A')
        if gi >= len(alts):
            desc['gabarito fora do range'] += 1; continue

        na, nr = valores(alts[gi]), valores(cauda)
        if na and nr and not casa_valor(na, nr):
            desc['gabarito divergente da resolucao'] += 1; continue

        topico = cap
        for t, rx in REFINO:
            if rx.search(enun):
                topico = t; break
        if not topico:
            desc['sem topico'] += 1; continue

        resol = [l.rstrip() for l in cauda.split('\n') if l.strip()][:16]
        probs = laudo_enunciado(enun) + laudo(resol, alts) \
            + [p for a in alts for p in laudo_enunciado(a)][:1]

        reg = {'n': numero, 'banca': banca, 'topico': topico,
               'enunciado': enun, 'alternativas': alts, 'gabarito': gi,
               'resolucao': resol, 'problemas': probs}

        if probs:
            for p in probs:
                motivos[re.sub(r'\s*\(.*', '', p)] += 1
            quarentena.append(reg)
        else:
            aprovadas.append(reg)

    total = len(aprovadas) + len(quarentena)
    print(f"blocos numerados: {len(inicios)}")
    print(f"questoes extraidas: {total}")
    print(f"  APROVADAS (resolucao sem defeito detectado): {len(aprovadas)}")
    print(f"  QUARENTENA (resolucao com defeito): {len(quarentena)}")
    print("\ndescartes antes do laudo:")
    for k, v in desc.most_common():
        print(f"   {v:5d}  {k}")
    print("\nmotivos de quarentena:")
    for k, v in motivos.most_common():
        print(f"   {v:5d}  {k}")

    # nivel por tercil de tamanho dentro do topico, so nas aprovadas
    por_t = collections.defaultdict(list)
    for q in aprovadas:
        por_t[q['topico']].append(len(q['enunciado']))
    cortes = {}
    for t, ls in por_t.items():
        ls = sorted(ls)
        cortes[t] = (ls[len(ls) // 3], ls[2 * len(ls) // 3])
    for q in aprovadas:
        a, b = cortes[q['topico']]
        n = len(q['enunciado'])
        q['nivel'] = 1 if n <= a else (2 if n <= b else 3)

    print("\naprovadas por topico:")
    for t, n in collections.Counter(q['topico'] for q in aprovadas).most_common():
        print(f"   {n:5d}  {t}")

    json.dump(aprovadas, open(f"{BASE}/aprovadas.json", 'w'), ensure_ascii=False)
    json.dump(quarentena, open(f"{BASE}/quarentena.json", 'w'), ensure_ascii=False)
    print(f"\ngravados aprovadas.json e quarentena.json")

    random.seed(11)
    for q in random.sample(aprovadas, 3):
        print("\n" + "=" * 62)
        print(f"[{q['topico']}/n{q['nivel']}] {q['banca']!r}")
        print("ENUN:", q['enunciado'][:230])
        for i, a in enumerate(q['alternativas']):
            print(f"   {'>>' if i == q['gabarito'] else '  '} {'ABCDE'[i]}) {a[:56]}")
        print("RESOLUCAO:")
        for l in q['resolucao']:
            print("     " + l[:88])


if __name__ == '__main__':
    main()
