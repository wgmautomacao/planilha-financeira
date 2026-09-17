# Ponto Cego

App de matemática para concurso. A tese é simples: o candidato competente não
perde por falta de conteúdo, perde por não saber **onde** está perdendo ponto.
Então o app não ensina tudo — ele mede, nomeia o erro e devolve o candidato
para ele até sumir.

## Duas fontes de questão

| Fonte | Volume | Como funciona |
|---|---|---|
| **Questões de prova** | 1.044 | Extraídas do PDF `Matematica-1400-Questoes-Resolvidas-e-Gabaritadas.pdf` (Prof. Paulo Delgado / exercitando.com.br), com enunciado, 4–5 alternativas, gabarito e a resolução original |
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
index.html       markup e shell do app
estilos.css      tokens de cor/tipo, tema claro e escuro
banco.js         window.BANCO_REAL_BRUTO — as 1.044 questões (gerado, não editar à mão)
motor.js         geradores + índice do banco real + montagem de alternativas
app.js           estado, telas, gamificação, radar
extrair_pdf.py   o extrator que produziu banco.js
```

## Como o banco foi extraído

O PDF tem a fonte quebrada: `i` sai como `U+2113` e `t` como `U+0454`. O
extrator conserta esses três caracteres, remove cabeçalho/rodapé de página,
quebra o texto em blocos numerados, separa enunciado / alternativas / resolução
e acha o gabarito na resolução.

Dois filtros de qualidade fazem o corte de 1.591 blocos para 1.044 questões:

1. **Questões que dependem de figura são descartadas** (38). O gráfico não vem
   no texto extraído, e questão sem o gráfico é questão sem resposta.
2. **Validação numérica do gabarito** (24 descartadas). O número da alternativa
   apontada tem que aparecer na resolução. A checagem confirma 88% dos
   gabaritos, contra 32% para uma alternativa errada de controle — é o que dá
   confiança de que a letra extraída é a certa.

Reproduzir:

```bash
python3 extrair_pdf.py     # ajuste BASE para o diretório com banco.txt
```

O `banco.txt` vem de `pypdf`. Atenção: em containers onde o módulo
`cryptography` quebra (panic do pyo3), stube-o antes de importar o `pypdf`:

```python
import sys
for n in ['cryptography', 'cryptography.hazmat', 'cryptography.hazmat.bindings',
          'cryptography.hazmat.bindings._rust']:
    sys.modules[n] = None
from pypdf import PdfReader
```

## Limitações declaradas

- **O progresso fica no navegador** (`localStorage`). Sobrevive a recarregar e a
  republicar a página, mas não atravessa dispositivos: o que você treinou no
  celular não aparece no computador.
- **As resoluções das questões de prova vêm como texto corrido do PDF.** Frações
  e expoentes que o PDF desenhava em duas linhas chegam achatados
  (`a.b 2 = 3 3` era `a·b² = 3³`). São legíveis, não bonitas. As resoluções das
  questões geradas são escritas passo a passo.
- **O nível (1 a 3) é heurístico**, por tercil de tamanho do enunciado dentro do
  tópico. Não é calibração por taxa de acerto real.
- **Conjuntos e Estatística só têm questões geradas** — o material original não
  traz capítulo próprio desses dois tópicos.
