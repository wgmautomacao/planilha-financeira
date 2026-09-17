#!/usr/bin/env python3
"""Passe 2: limpeza agressiva, descarte de questao dependente de figura e
validacao numerica do gabarito. Gera banco.js para o app."""
import re, json, collections, random, unicodedata

BASE = "/tmp/claude-0/-home-user-planilha-financeira/c2dece5a-6b39-5ba2-b263-42ad75f96f21/scratchpad"

# --- lixo de pagina: agora por SUBSTRING, nao por linha inteira ------------
JUNK_SUB = [
    'EXERCITANDO.COM.BR', 'exercitando.com.br',
    'Notícias e Conteúdos para Concursos',
    'Material de Estudo',
    'MATEMÁTICA BÁSICA, FINANCEIRA',
    'PROFESSOR: PAULO DELGADO',
    'CURSO DE MATEMÁTICA COMPLETO',
]

def linha_eh_lixo(l):
    s = l.strip()
    if not s:
        return False
    for j in JUNK_SUB:
        if j in s:
            return True
    if re.fullmatch(r'-?\s*\d{1,3}\s*-?', s):      # numero de pagina
        return True
    return False

def linha_eh_detrito(l):
    """Resto de diagrama/tabela: pouca letra minuscula, muito simbolo solto."""
    s = l.strip()
    if not s or len(s) > 40:
        return False
    minusculas = sum(1 for c in s if c.islower())
    if minusculas >= 4:
        return False
    # sobrou algo tipo "A B N = 20 U", "10 5 15", "R R R R"
    return bool(re.fullmatch(r'[A-Za-z0-9ΩΔ()\[\]{}=+\-*/.,;:%°<>|_~^√∩∪⇒→ \t]+', s))

def limpa(txt):
    txt = txt.replace('ℓ', 'i').replace('є', 't').replace('Є', 'T')
    txt = txt.replace(' ', ' ')
    return '\n'.join(l.rstrip() for l in txt.split('\n') if not linha_eh_lixo(l))

# --- dependencia de figura -------------------------------------------------
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

# refino por palavra-chave DENTRO do capitulo (pega Venn, media, MMC perdidos)
REFINO = [
    ('conjuntos',   r'diagrama de venn|nenhuma das duas|nenhum dos dois|apenas um(a)? (dos|das)|'
                    r'somente (ingl[êe]s|espanhol)|ambas as|conjunto[s]? A e B'),
    ('estatistica', r'm[ée]dia (aritm[ée]tica|ponderada|simples|das notas)|mediana|moda\b'),
]
REFINO = [(t, re.compile(p, re.I)) for t, p in REFINO]

def eh_titulo(l):
    s = l.strip()
    if len(s) < 6 or len(s) > 90: return False
    letras = [c for c in s if c.isalpha()]
    if len(letras) < 5: return False
    return sum(1 for c in letras if c.isupper()) / len(letras) >= 0.85

def capitulo_de(l):
    up = l.upper()
    for topico, rx in CAPITULOS:
        if rx.search(up): return topico
    return None

MARCADOR = re.compile(r'(?<![A-Za-z0-9])([a-eA-E])\s*\)\s')
GAB_TXT = re.compile(r'(?:resposta|gabarito|alternativa correta|letra)\s*[:\-]?\s*\(?\s*([A-Ea-e])\s*\)?', re.I)
GAB = re.compile(r'\(\s*([A-Ea-e])\s*\)')

def fatia(bloco):
    ach = [(m.group(1).lower(), m.start(), m.end()) for m in MARCADOR.finditer(bloco)]
    for i in range(len(ach)):
        if ach[i][0] != 'a': continue
        seq, esp = [ach[i]], 'b'
        for j in range(i + 1, len(ach)):
            if ach[j][0] == esp:
                seq.append(ach[j])
                if esp == 'e': break
                esp = chr(ord(esp) + 1)
        if len(seq) < 4: continue
        enun = bloco[:seq[0][1]]
        txts = []
        for k, (_, ini, fim) in enumerate(seq):
            prox = seq[k + 1][1] if k + 1 < len(seq) else None
            txts.append(bloco[fim:prox] if prox else bloco[fim:])
        return enun, txts
    return None

def numeros(s):
    s = re.sub(r'(\d)\.(\d{3})', r'\1\2', s)          # 1.234 -> 1234
    return set(re.findall(r'\d+(?:,\d+)?', s.replace(',', '.')).__iter__()) | \
           set(re.findall(r'\d+(?:\.\d+)?', s.replace(',', '.')))

def main():
    texto = limpa(open(f"{BASE}/banco.txt").read())
    linhas = texto.split('\n')

    inicios, capitulo = [], None
    for i, l in enumerate(linhas):
        if eh_titulo(l):
            c = capitulo_de(l)
            if c: capitulo = c
        if re.match(r'^\s*\d{1,4}\s*[\.\)]\s+\S', l):
            inicios.append((i, capitulo))

    questoes, desc = [], collections.Counter()

    for idx, (ini, cap) in enumerate(inicios):
        fim = inicios[idx + 1][0] if idx + 1 < len(inicios) else len(linhas)
        bloco = '\n'.join(linhas[ini:fim]).strip()
        if len(bloco) < 60: desc['bloco curto'] += 1; continue

        corte = fatia(bloco)
        if not corte: desc['sem alternativas'] += 1; continue
        enun, txts = corte

        partes = txts[-1].split('\n')
        txts[-1] = partes[0]
        cauda = '\n'.join(partes[1:]).strip()

        cab = re.match(r'^\s*(\d{1,4})\s*[\.\)]\s*(\(([^)\n]{2,60})\))?\s*', enun)
        numero = cab.group(1) if cab else None
        banca = (cab.group(3) or '').strip() if cab else ''
        enun = enun[cab.end():] if cab else enun

        # remove detrito de diagrama linha a linha DENTRO do enunciado
        enun = '\n'.join(l for l in enun.split('\n') if not linha_eh_detrito(l))
        enun = re.sub(r'\s+', ' ', enun).strip()

        alts = [re.sub(r'\s+', ' ', t).strip() for t in txts]
        alts = [re.sub(r'\s+[a-zA-Z]$', '', a) for a in alts]   # rotulo de eixo solto

        if len(enun) < 30: desc['enunciado curto'] += 1; continue
        if len(enun) > 1200: desc['enunciado gigante'] += 1; continue
        if FIGURA.search(enun): desc['depende de figura'] += 1; continue
        if any(not a for a in alts): desc['alternativa vazia'] += 1; continue
        if max(len(a) for a in alts) > 200: desc['alternativa gigante'] += 1; continue
        if len(set(alts)) != len(alts): desc['alternativas repetidas'] += 1; continue

        m = list(GAB_TXT.finditer(cauda)) or list(GAB.finditer(cauda))
        if not m: desc['sem gabarito'] += 1; continue
        gi = ord(m[-1].group(1).upper()) - ord('A')
        if gi >= len(alts): desc['gabarito fora do range'] += 1; continue

        # validacao numerica do gabarito
        na, nr = numeros(alts[gi]), numeros(cauda)
        if na and nr and not (na & nr):
            desc['gabarito divergente da resolucao'] += 1
            continue

        topico = cap
        for t, rx in REFINO:
            if rx.search(enun): topico = t; break
        if not topico: desc['sem topico'] += 1; continue

        resol = [l.rstrip() for l in cauda.split('\n') if l.strip() and not linha_eh_lixo(l)]
        resol = resol[:14]

        n_chars = len(enun)
        nivel = 1 if n_chars < 200 else (3 if n_chars > 480 or topico in ('financeiro', 'descontos') else 2)

        questoes.append({
            'n': numero, 'banca': banca, 'topico': topico, 'nivel': nivel,
            'enunciado': enun, 'alternativas': alts, 'gabarito': gi,
            'resolucao': resol,
        })

    print(f"blocos: {len(inicios)}  |  APROVEITADAS: {len(questoes)}")
    print("\ndescartes:")
    for k, v in desc.most_common(): print(f"   {v:5d}  {k}")
    print("\npor topico:")
    for t, n in collections.Counter(q['topico'] for q in questoes).most_common():
        print(f"   {n:5d}  {t}")
    print("\npor nivel:", dict(collections.Counter(q['nivel'] for q in questoes)))
    print("gabarito:", {"ABCDE"[k]: v for k, v in sorted(collections.Counter(q['gabarito'] for q in questoes).items())})
    print("com resolucao:", sum(1 for q in questoes if q['resolucao']))

    json.dump(questoes, open(f"{BASE}/questoes2.json", 'w'), ensure_ascii=False)

    random.seed(3)
    for q in random.sample(questoes, 3):
        print("\n" + "=" * 62)
        print(f"[{q['topico']}/n{q['nivel']}] {q['banca']!r}")
        print("ENUN:", q['enunciado'][:260])
        for i, a in enumerate(q['alternativas']):
            print(f"   {'>>' if i == q['gabarito'] else '  '} {'ABCDE'[i]}) {a[:60]}")
        print("RESOL:", ' | '.join(q['resolucao'])[:200])

if __name__ == '__main__':
    main()
