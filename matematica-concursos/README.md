# Ponto Cego

App de matemática para concurso. A tese é simples: o candidato competente não
perde por falta de conteúdo, perde por não saber **onde** está perdendo ponto.
Então o app não ensina tudo — ele mede, nomeia o erro e devolve o candidato
para ele até sumir.

## Duas fontes de questão

| Fonte | Volume | Como funciona |
|---|---|---|
| **Questões de prova** | 520 | Extraídas de `Matematica-1400-Questoes-Resolvidas-e-Gabaritadas.pdf`, com enunciado, 4–5 alternativas, gabarito e resolução — todas com resolução auditada linha a linha |
| **Questões geradas** | ilimitado | 30 geradores paramétricos: sorteiam números, **calculam** a resposta e montam cada distrator a partir de um erro clássico nomeado |

A diferença que importa está na segunda linha. Numa questão gerada, marcar a
alternativa C não devolve "errado" — devolve *"Somar percentuais sucessivos em
vez de multiplicar os fatores"*. Esse nome é acumulado e ranqueado na tela
**Erros**, que responde a única pergunta que muda nota: qual erro você comete
mais.

## Mecânica

- **Diagnóstico** — 14 questões, uma por tópico. Sem medição não há treino.
- **Ponto Cego** — 10 questões sorteadas só nos seus 3 piores tópicos.
- **Simulado** — 10 questões, 25 minutos, sem gabarito no meio do caminho.
  Penalidade estilo Cebraspe opcional (errada anula certa no líquido).
- **Treino por tópico** — o nível das questões sobe conforme seu domínio.

Pontuação: 10 pontos base + 5 por nível + 5 abaixo de 25 s, com **1,5×** quando
o tópico está abaixo de 50% de domínio — o app paga mais para você treinar o que
dói. Patentes de Inscrito a Primeiro Lugar, ofensiva diária, 9 conquistas.
O radar mostra os 14 eixos contra a linha de corte de 70%.

## Arquivos

```
index.html            markup e shell do app
estilos.css           tokens de cor/tipo, tema claro e escuro
config.js             preço, link de checkout, flags — o único arquivo do dono
licenca.js            validação da chave de licença
banco.js              window.BANCO_REAL_BRUTO (gerado, não editar à mão)
motor.js              geradores + índice do banco real + montagem de alternativas
app.js                estado, telas, gamificação, radar
vendas.html           página de vendas
extrair_pdf_geo.py    extrator geométrico do PDF
montar_banco.py       parser das questões + auditoria das resoluções
gerar_chaves.py       gerador de chaves de licença
quarentena.json       as 361 questões cuja resolução aguarda reescrita
```

## Como o banco foi extraído

Extração de texto puro não serve para este PDF: ela descarta a posição de cada
caractere, e é a posição que carrega a matemática. `extrair_pdf_geo.py` lê cada
run de texto com x, y e corpo de fonte, e reconstrói a partir da geometria.

Cinco defeitos foram encontrados e corrigidos. Os dois primeiros estavam
corrompendo o conteúdo de forma silenciosa:

**1. Fontes quebradas, com mapas diferentes.** O PDF usa duas subfontes Tahoma e
cada uma quebra glifos distintos. A primeira versão do extrator aplicava um mapa
global e errava as duas:

| Fonte | Glifo | Certo | O que a versão anterior fazia |
|---|---|---|---|
| `/PUNRFN+Tahoma` (corpo) | `ℓ` | `i` | correto |
| `/PUNRFN+Tahoma` | `є` | `t` | correto |
| `/PUNRFN+Tahoma` | `Є` | **`J`** | escrevia `T` — toda fórmula de juros saía `T = C·i·t` |
| `/DWFSOV+Tahoma` (títulos) | `ℓ` | **`d`** | escrevia `i` — "Divisibilidade" saía "Divisibiliiaie" |
| `/DWFSOV+Tahoma` | `Є` | **`k`** | escrevia `T` — "kg" e "km" saíam errados |

O mapa foi confirmado por amostragem no documento inteiro: `Єuros`→Juros,
`Єoão`→João, `Єosé`→José, `ℓe`→de, `Quanℓo`→Quando, `4Єm`→4km, `Єg`→kg.

**2. Expoentes perdidos na tolerância de linha.** O expoente fica ~4 unidades
acima da linha de base — acima de qualquer tolerância razoável de "mesma linha",
então ia para uma linha própria e se perdia. Consequência: `x² − 7x + 12 = 0`
chegava como `x − 7x + 12 = 0`, que **é outra equação**. Correção: a linha é
definida pelos runs de corpo normal, e super/subscritos são anexados depois à
linha mais próxima. Expoentes recuperados: **72 → 1.735**.

**3. Duas colunas costuradas como uma.** O material é diagramado em duas colunas.
O extrator agora acha a calha — o x vertical que quase nenhum run atravessa — e
trata cada coluna como página independente (166 das 170 páginas).

**4. Frações empilhadas.** O PDF não desenha barra de fração: o denominador fica
na linha de baixo, recuado. Cada denominador é casado **por coordenada x** com o
token exatamente acima dele, e uma linha pode carregar duas frações.

**5. Negrito falso.** O PDF redesenha o mesmo glifo deslocado meio ponto, o que
produzia `⇒⇒ ⇒⇒` e `−− −−` no texto.

Cabeçalho e rodapé saem por faixa de y, não por casar string — o que eliminou o
lixo de rodapé que antes aparecia no meio de enunciado.

## Auditoria: o que entra e o que não entra

De 1.457 blocos numerados, 881 questões saem íntegras. Cada uma passa por dois
laudos, e **o que não passa não vai para o comprador**:

| Descarte | Nº | Motivo |
|---|---|---|
| Sem alternativas | 270 | Exemplo resolvido da teoria, não questão |
| Gabarito divergente da resolução | 86 | O valor da alternativa apontada não aparece na resolução |
| Sem gabarito | 81 | Resolução não indica a letra |
| Bloco curto | 63 | Numeração de fórmula |
| Depende de figura | 38 | O gráfico não vem no texto — questão sem resposta |
| Outros | 38 | Alternativa vazia, repetida ou gigante |

Das 881, o laudo de resolução aprova **520** e manda **361** para quarentena:

| Defeito na resolução | Nº |
|---|---|
| Denominador órfão (fração que não casou) | 191 |
| Resto tabular | 88 |
| Expoente possivelmente perdido | 86 |
| Alternativa vazada na resolução | 78 |
| Tabela de proporção desenhada com traços | 64 |
| Enunciado de outra questão colado | 33 |
| Resto de tabela | 26 |
| **Expoente perdido no enunciado** | 15 |
| Fração ainda empilhada | 9 |

As 15 últimas são as mais graves: enunciado sem expoente é questão errada, não
resolução feia. Iam para o comprador na versão anterior.

As 361 em quarentena mantêm enunciado e gabarito válidos, e estão em
`quarentena.json` com o laudo de cada uma. No `banco.js` elas aparecem com
`rev: 1` e **resolução vazia**, fora do app por padrão. `CONFIG.incluirSemResolucao`
liga como treino seco.

### Por que não tentei adivinhar as frações que faltam

Um juntador de frações mais agressivo recuperaria boa parte dos 191
denominadores órfãos. Não foi feito de propósito: fração adivinhada errado
produz uma **fórmula incorreta que parece correta**, e isso é pior que um dígito
solto visivelmente estranho. O critério é conservador — só casa quando o
alinhamento por coordenada não deixa dúvida.

### Validação do gabarito

O número da alternativa apontada tem que aparecer na resolução, comparado como
**valor numérico**, não como string. Comparar string descartava gabarito correto:
`R$ 2.680,00` e `2.680` são o mesmo número. A checagem confirma 88% dos
gabaritos contra 32% de uma alternativa errada de controle, e cinco resoluções
aprovadas foram conferidas na mão, conta por conta — todas corretas.

### Reproduzir

```bash
python3 extrair_pdf_geo.py     # PDF -> banco_geo.txt (ajuste BASE)
python3 montar_banco.py        # -> aprovadas.json + quarentena.json + laudo
```

Em containers onde o módulo `cryptography` quebra (panic do pyo3), o `pypdf` só
importa com ele stubado — os dois scripts já fazem isso no topo.

## Limitações declaradas

- **O progresso fica no navegador** (`localStorage`). Sobrevive a recarregar e a
  republicar a página, mas não atravessa dispositivos.
- **361 questões de prova estão sem resolução**, à espera de reescrita.
- **O nível (1 a 3) é heurístico**, por tercil de tamanho do enunciado dentro do
  tópico. Não é calibração por taxa de acerto real.
- **Conjuntos e Estatística só têm questões geradas** — o material original não
  traz capítulo próprio desses dois tópicos.
- **A licença é validada no cliente** e serve contra compartilhamento casual, não
  contra engenharia reversa. Ver `VENDAS.md`.
