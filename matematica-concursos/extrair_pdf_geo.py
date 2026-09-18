#!/usr/bin/env python3
"""Extracao geometrica do PDF.

A extracao por texto puro joga fora a posicao de cada caractere, e e isso que
achata a matematica: expoente vira digito solto ("3 3" para 3 cubo), fracao vira
duas linhas, e coluna vizinha vira lixo no meio da frase.

Aqui cada run de texto vem com x, y e corpo de fonte, e a reconstrucao usa isso:

  - cabecalho/rodape: descartados por faixa de y, nao por casar string
  - expoente:  corpo menor E linha de base ACIMA da dominante  -> unicode
  - subscrito: corpo menor E linha de base ABAIXO da dominante -> _n
  - coluna:    vao horizontal grande dentro da mesma linha     -> quebra
  - fracao:    linha curta e numerica logo abaixo, alinhada    -> (a)/(b)
"""
import sys, re, json, unicodedata

for _n in ['cryptography', 'cryptography.hazmat', 'cryptography.hazmat.primitives',
           'cryptography.hazmat.bindings', 'cryptography.hazmat.bindings._rust']:
    sys.modules[_n] = None
from pypdf import PdfReader

BASE = "/tmp/claude-0/-home-user-planilha-financeira/c2dece5a-6b39-5ba2-b263-42ad75f96f21/scratchpad"

Y_TOPO, Y_BASE = 770, 38      # faixa util da pagina
TOL_LINHA = 3.0               # mesma linha se |dy| <= isso
RAZAO_MENOR = 0.80            # corpo abaixo disso = super/subscrito
VAO_COLUNA = 52               # vao em x que separa colunas
LARG_CHAR = 0.45              # largura media de char em em (Times)
LARG_ESPACO = 0.25

SUP = {'0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
       '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
       'n': 'ⁿ', '+': '⁺', '-': '⁻', '(': '⁽', ')': '⁾'}
SUB = {'0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
       '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'}


# O PDF usa duas subfontes Tahoma e cada uma quebra glifos DIFERENTES.
# Confirmado por amostra no documento inteiro:
#   corpo:   'foℓ'->foi, 'єaxa'->taxa, 'Єuros'->Juros, 'Єoão'->João
#   titulos: 'ℓe'->de, 'Quanℓo'->Quando, 'Єg'->kg, '4Єm'->4km
MAPA_FONTE = {
    '/PUNRFN+Tahoma': {'ℓ': 'i', 'є': 't', 'Є': 'J'},
    '/DWFSOV+Tahoma': {'ℓ': 'd', 'Є': 'k'},
}
MAPA_PADRAO = MAPA_FONTE['/PUNRFN+Tahoma']   # 97% das ocorrencias
fontes_desconhecidas = set()


def conserta_fonte(s, fonte):
    mapa = MAPA_FONTE.get(fonte)
    if mapa is None:
        if any(c in s for c in 'ℓєЄ'):
            fontes_desconhecidas.add(fonte)
        mapa = MAPA_PADRAO
    for quebrado, certo in mapa.items():
        s = s.replace(quebrado, certo)
    return s.replace(' ', ' ')


def coleta(pagina):
    runs = []

    def visitor(text, cm, tm, fd, fs):
        if not text or not text.strip():
            return
        corpo = abs(fs * (tm[0] if tm[0] else 1.0))
        if corpo < 1:
            corpo = abs(fs) or 8.5
        fonte = str(fd.get('/BaseFont', fd.get('/Name', '?'))) if fd else '?'
        runs.append({'t': conserta_fonte(text.replace('\n', ' '), fonte),
                     'x': tm[4], 'y': tm[5], 'c': corpo, 'f': fonte})

    pagina.extract_text(visitor_text=visitor)
    return [r for r in runs if Y_BASE <= r['y'] <= Y_TOPO]


def x_inicial(r):
    """x do primeiro caractere nao-branco do run."""
    brancos = len(r['t']) - len(r['t'].lstrip())
    return r['x'] + brancos * LARG_ESPACO * r['c']


def x_final(r):
    return r['x'] + len(r['t'].rstrip()) * LARG_CHAR * r['c']


def agrupa_linhas(runs):
    """As linhas sao definidas pelos runs de corpo normal; expoente e subscrito
    sao ANEXADOS a linha mais proxima depois.

    Agrupar tudo por uma tolerancia unica nao funciona: o expoente fica ~4
    unidades acima da linha de base, acima de qualquer tolerancia razoavel para
    'mesma linha', e era assim que ele ia para uma linha propria e se perdia."""
    if not runs:
        return []
    corpos = sorted(r['c'] for r in runs)
    corpo_med = corpos[len(corpos) // 2]
    limiar = corpo_med * 0.85

    grandes = sorted((r for r in runs if r['c'] >= limiar), key=lambda r: (-r['y'], r['x']))
    pequenos = [r for r in runs if r['c'] < limiar]

    linhas = []
    for r in grandes:
        if linhas and abs(r['y'] - linhas[-1]['y']) <= TOL_LINHA:
            linhas[-1]['runs'].append(r)
        else:
            linhas.append({'y': r['y'], 'runs': [r]})

    alcance = 0.62 * corpo_med          # cobre expoente (+4) e subscrito (-1)
    for r in pequenos:
        melhor, dist = None, 1e9
        for L in linhas:
            d = abs(r['y'] - L['y'])
            if d < dist:
                melhor, dist = L, d
        if melhor is not None and dist <= alcance:
            melhor['runs'].append(r)
        else:
            linhas.append({'y': r['y'], 'runs': [r]})

    linhas.sort(key=lambda L: -L['y'])
    return [sorted(L['runs'], key=lambda q: q['x']) for L in linhas]


def marca_nivel(linha):
    """Devolve (corpo_dominante, y_dominante) da linha."""
    corpo = max(r['c'] for r in linha)
    grandes = [r for r in linha if r['c'] >= corpo * RAZAO_MENOR]
    ys = sorted(r['y'] for r in grandes)
    return corpo, ys[len(ys) // 2]


def traduz(txt, mapa, prefixo):
    limpo = txt.strip()
    if not limpo:
        return ''
    if all(c in mapa for c in limpo):
        return ''.join(mapa[c] for c in limpo)
    return prefixo + (limpo if len(limpo) == 1 else '(' + limpo + ')')


def monta_linha(linha):
    """Junta os runs de uma linha, convertendo super/subscrito e quebrando coluna.
    Devolve lista de dicts {txt, ancoras}, um por coluna. `ancoras` mapeia
    posicao no texto -> x na pagina, e e o que permite ao juntador de fracao
    achar o token que esta EXATAMENTE acima do denominador."""
    corpo, ybase = marca_nivel(linha)
    colunas, atual, fim_ant = [], [], None

    for r in linha:
        if fim_ant is not None and x_inicial(r) - fim_ant > VAO_COLUNA:
            colunas.append(atual)
            atual = []
        menor = r['c'] < corpo * RAZAO_MENOR
        dy = r['y'] - ybase
        tipo = 'n'
        if menor and dy > 0.4:
            tipo = 'sup'
        elif menor and dy < -0.4:
            tipo = 'sub'
        atual.append((tipo, r))
        fim_ant = x_final(r)

    colunas.append(atual)

    saida = []
    for col in colunas:
        buf, ancoras = '', []
        ant = None
        for tipo, r in col:
            txt = r['t']
            # negrito falso: o PDF redesenha o mesmo glifo deslocado meio ponto,
            # o que produzia '⇒⇒ ⇒⇒' e '−− −−' no texto extraido
            if ant is not None and txt.strip() == ant['t'].strip() \
               and abs(r['x'] - ant['x']) < 0.35 * r['c'] and len(txt.strip()) <= 3:
                continue
            ant = r
            if tipo == 'sup':
                buf = buf.rstrip() + traduz(txt, SUP, '^')
                continue
            if tipo == 'sub':
                buf = buf.rstrip() + traduz(txt, SUB, '_')
                continue
            # espaco implicito: o run comeca depois de um vao visivel
            if buf and not buf.endswith(' ') and not txt.startswith(' '):
                ancoras.append((len(buf), x_inicial(r)))
                buf += ' ' + txt.lstrip()
            else:
                ancoras.append((len(buf) + len(txt) - len(txt.lstrip()), x_inicial(r)))
                buf += txt
        if buf.strip():
            saida.append({'txt': buf.rstrip(), 'ancoras': ancoras,
                          'corpo': corpo})
    return saida


TOKEN = re.compile(r'[\d\w.,%$()²³⁰-₟/+-]+')

def token_sobre(entrada, x_alvo):
    """Indices (ini, fim) do token do texto que fica sobre x_alvo."""
    txt = entrada['txt']
    anc = entrada['ancoras']
    if not anc:
        return None
    base = anc[0]
    for idx, x in anc:
        if x <= x_alvo + 1:
            base = (idx, x)
        else:
            break
    corpo = entrada.get('corpo') or 8.5
    desloc = int(round((x_alvo - base[1]) / max(LARG_CHAR * corpo, 0.5)))
    pos = max(0, min(len(txt) - 1, base[0] + desloc))

    # cai dentro de um token: expande para as bordas
    if txt[pos].isspace():
        esq = pos
        while esq > 0 and txt[esq - 1].isspace():
            esq -= 1
        pos = max(0, esq - 1)
    if txt[pos].isspace():
        return None
    ini = pos
    while ini > 0 and TOKEN.match(txt[ini - 1]):
        ini -= 1
    fim = pos + 1
    while fim < len(txt) and TOKEN.match(txt[fim]):
        fim += 1
    return (ini, fim)


# ---------------------------------------------------------------- fracoes ----

def x_do_indice(entrada, idx):
    anc = entrada['ancoras']
    if not anc:
        return 0.0
    base = anc[0]
    for a in anc:
        if a[0] <= idx:
            base = a
        else:
            break
    corpo = entrada.get('corpo') or 8.5
    return base[1] + (idx - base[0]) * LARG_CHAR * corpo


def tokens_com_x(entrada):
    return [(m.group(0), x_do_indice(entrada, m.start()))
            for m in re.finditer(r'\S+', entrada['txt'])]


RX_DEN_TOK = re.compile(r'^[\d.,]{1,8}[%]?$|^[\d.,]{1,6}[a-zA-Z]{0,2}$')

def junta_fracoes(linhas_geo):
    """Uma linha curta e numerica, recuada e logo abaixo de outra, e o
    denominador de uma fracao que o PDF desenhava empilhada. Cada denominador e
    casado por coordenada x com o token que esta acima dele — uma linha pode
    carregar duas fracoes (o classico "3/4 ... 3/24" da mesma conta)."""
    saida, i, n = [], 0, len(linhas_geo)
    while i < n:
        y, cols, xi = linhas_geo[i]
        casou = False

        if len(cols) == 1 and i + 1 < n:
            y2, cols2, xi2 = linhas_geo[i + 1]
            alto = cols[0]
            if len(cols2) == 1 and not alto['txt'].rstrip().endswith(('?', ':', '!')):
                dens = tokens_com_x(cols2[0])
                gap = y - y2
                ok = (
                    1 <= len(dens) <= 3
                    and 6 < gap < 15
                    and xi2 > xi + 6
                    and all(RX_DEN_TOK.match(d[0]) for d in dens)
                    and all(any(c.isdigit() for c in d[0]) for d in dens)
                )
                if ok:
                    txt = alto['txt']
                    alvos = []
                    for tok, xd in dens:
                        pos = token_sobre(alto, xd)
                        if pos:
                            alvos.append((pos, tok))
                    alvos.sort(key=lambda a: -a[0][0])
                    usados = []
                    for (ini, fim), tok in alvos:
                        if any(not (fim <= a or ini >= b) for a, b in usados):
                            continue
                        if not any(c.isdigit() or c.isalpha() for c in txt[ini:fim]):
                            continue
                        txt = txt[:ini] + '(' + txt[ini:fim] + '/' + tok + ')' + txt[fim:]
                        usados.append((ini, fim))
                    if usados:
                        saida.append((y, [{'txt': txt, 'ancoras': alto['ancoras'],
                                           'corpo': alto.get('corpo')}], xi))
                        i += 2
                        casou = True

        if not casou:
            saida.append((y, cols, xi))
            i += 1
    return saida


def acha_gutter(runs, largura):
    """O material e diagramado em duas colunas. A calha e o x vertical que quase
    nenhum run atravessa — achar isso e tratar cada coluna como uma pagina
    independente e o que impede a coluna da direita de invadir a frase da
    esquerda. Devolve None em pagina de coluna unica."""
    melhor = None
    limite_cruz = max(2, int(0.035 * len(runs)))
    for X in range(int(0.40 * largura), int(0.62 * largura), 2):
        cruza = sum(1 for r in runs if x_inicial(r) < X - 2 and x_final(r) > X + 2)
        esq = sum(1 for r in runs if x_final(r) <= X + 2)
        dirr = sum(1 for r in runs if x_inicial(r) >= X - 2)
        if esq < 6 or dirr < 6:
            continue
        if melhor is None or cruza < melhor[0]:
            melhor = (cruza, X)
    if melhor and melhor[0] <= limite_cruz:
        return melhor[1]
    return None


def texto_de_coluna(runs):
    geo = []
    for linha in agrupa_linhas(runs):
        cols = monta_linha(linha)
        if not cols:
            continue
        geo.append((linha[0]['y'], cols, x_inicial(linha[0])))
    geo = junta_fracoes(geo)
    saida = []
    for _y, cols, _xi in geo:
        saida.append(re.sub(r'[ \t]{2,}', '  ', cols[0]['txt']).strip())
        for extra in cols[1:]:
            saida.append('    ' + re.sub(r'[ \t]{2,}', '  ', extra['txt']).strip())
    return '\n'.join(saida)


def processa():
    leitor = PdfReader(f"{BASE}/banco.pdf")
    paginas, duas_colunas = [], 0
    for pagina in leitor.pages:
        runs = coleta(pagina)
        if not runs:
            paginas.append('')
            continue
        largura = float(pagina.mediabox.width) or 595.0
        X = acha_gutter(runs, largura)
        if X is None:
            paginas.append(texto_de_coluna(runs))
        else:
            duas_colunas += 1
            esq = [r for r in runs if x_inicial(r) < X]
            dirr = [r for r in runs if x_inicial(r) >= X]
            paginas.append(texto_de_coluna(esq) + '\n' + texto_de_coluna(dirr))

    # residuo de negrito falso que escapou da deduplicacao por run
    paginas = [re.sub(r'([\u21d2\u21d4\u2192\u2212\u2013\u2260\u2264\u2265\u2206\u2229\u222a])'
                      r'(?:\s*\1)+', r'\1', p) for p in paginas]
    saida = '\n\f\n'.join(paginas)
    open(f"{BASE}/banco_geo.txt", 'w').write(saida)
    print("paginas tratadas como duas colunas:", duas_colunas, "de", len(paginas))
    return saida, paginas


if __name__ == '__main__':
    texto, paginas = processa()
    print("paginas:", len(paginas))
    print("chars:", len(texto))
    print("expoentes unicode:", sum(texto.count(c) for c in '⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ'))
    print("expoentes ^(...):", texto.count('^'))
    print("subscritos:", sum(texto.count(c) for c in '₀₁₂₃₄₅₆₇₈₉'))
    print("fracoes inline:", len(re.findall(r'\([^()\n]{1,14}/[^()\n]{1,14}\)', texto)))
    if fontes_desconhecidas:
        print("ATENCAO - fontes sem mapa, usando o padrao:", fontes_desconhecidas)
    if len(sys.argv) > 1:
        pg = int(sys.argv[1])
        print("\n" + "=" * 60 + f" PAGINA {pg}")
        print(paginas[pg][:1800])
