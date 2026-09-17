# Como colocar o Ponto Cego à venda

Preço definido: **R$ 34,97**, pagamento único.

## Links

| O quê | URL |
|---|---|
| App | https://claude.ai/artifact/3iDbn3XyGtYZJA7pA6DfZK |
| Página de vendas | https://claude.ai/artifact/JoNFHnY4y4dUcxRaitsVaR |

**Os dois nascem privados.** Enquanto você não compartilhar, ninguém abre — e o
botão da página de vendas cai num app que o comprador não acessa. Abra cada um
e use o menu de compartilhar da própria página antes de anunciar. Teste numa
aba anônima: se abrir ali, está público.

## Os 4 passos

### 1. Criar o produto na Kiwify (ou Hotmart)

Produto digital, R$ 34,97, entrega por e-mail. No conteúdo de entrega, o
comprador precisa receber duas coisas:

```
Seu acesso ao Ponto Cego:

1. Abra: https://claude.ai/artifact/3iDbn3XyGtYZJA7pA6DfZK
2. Vá em Treinar e cole sua chave:

   PC-XXXX-XXXX-XXXX

Cole uma vez e o treino completo abre. A chave é sua — guarde este e-mail.
```

### 2. Gerar as chaves

```bash
python3 gerar_chaves.py 100          # 100 chaves
python3 gerar_chaves.py 500 --csv    # com cabeçalho, para importar
```

Conferir uma chave que o comprador diz não funcionar:

```bash
python3 gerar_chaves.py --conferir PC-7C1P-6B5Z-QKQQ
```

**Como a Kiwify entrega chave única:** em *Produto → Conteúdo → Chaves/Serial*,
importe o CSV. Cada venda consome uma chave da lista. Se o seu plano não tiver
esse recurso, use uma chave por lote (uma para os 100 primeiros compradores,
outra depois) e troque quando quiser cortar quem compartilhou — chave antiga
para de ser distribuída, mas continua valendo para quem já ativou.

### 3. Configurar o checkout

Em `config.js`, uma linha:

```js
linkCheckout: 'https://pay.kiwify.com.br/SEU-LINK',
```

E em `vendas.html`, no bloco `var VENDAS`:

```js
checkout: 'https://pay.kiwify.com.br/SEU-LINK'
```

Enquanto estiverem em `'CONFIGURAR'`, os botões de compra avisam que a venda não
está no ar em vez de virarem link quebrado. Depois de trocar, republique.

### 4. Anunciar

O ativo de tráfego não é a página de vendas: é **o diagnóstico grátis**. Ele não
pede cartão, e-mail nem cadastro, e devolve em 12 minutos um radar que o
visitante reconhece como verdadeiro sobre ele. Anuncie o diagnóstico, não o
produto. A venda acontece na tela de resultado, quando o app nomeia o pior
tópico dele.

## O que a licença faz — e o que não faz

A validação roda **no navegador do comprador**. O algoritmo está no `licenca.js`
que ele baixa junto com o app. Quem entende de programação consegue ler e gerar
chaves válidas.

Isso não é descuido, é escolha de escopo: o vazamento real de produto low ticket
não é engenharia reversa, é o comprador mandando o link no grupo do WhatsApp.
Contra isso a chave funciona, e dois detalhes aumentam o atrito:

- a chave é **nominal** — o nome digitado na ativação aparece no painel, então
  chave compartilhada exibe o nome de outra pessoa;
- a ativação grava **data**, o que te dá base para conferir suporte.

**Para validação de verdade (v2):** webhook da Kiwify gravando cada venda num
endpoint (`/licenca/verificar?chave=...`), e o app consultando na ativação. Aí a
chave é revogável e o compartilhamento morre. Precisa de um servidor — qualquer
serverless resolve, e é a evolução natural depois das primeiras 50 vendas.

## O que está no grátis e o que está no pago

| Grátis | Pago |
|---|---|
| Diagnóstico completo (14 questões) | Ponto Cego: 10 questões nos 3 piores tópicos |
| Radar de 14 eixos | Simulado cronometrado, 25 min, penalidade Cebraspe |
| Tela de erros nomeados | Treino por tópico, com nível progressivo |
| Pontos, patente e ofensiva | As 1.044 questões de prova |

A fronteira é deliberada: **o grátis entrega o diagnóstico, o pago entrega a
cura.** É o inverso da amostra grátis tradicional, que dá um pedaço pequeno de
tudo. Aqui o visitante recebe algo completo e conclusivo — e sai sabendo
exatamente o que está comprando.

## Sobre a página de vendas

Duas decisões que contrariam o padrão do mercado, de propósito:

**Não tem depoimento.** O produto é novo e não existe aluno aprovado para
mostrar. A página diz isso com essas palavras e explica que a prova é o
diagnóstico grátis. Quando você tiver comprador com resultado real — print do
radar antes e depois, nota de simulado que subiu — substitua essa seção por
depoimentos verdadeiros, com autorização.

**Não tem contador de escassez.** Contador que reinicia a cada visita é mentira
verificável, e o comprador de concurso é cético por profissão. Se você quiser
urgência, use uma que seja real: preço de lançamento com data de fim que você
cumpre, ou lote de vagas que você de fato fecha.

Tem também uma seção **"O que isso não é"** listando o que o produto não faz.
Ela reduz conversão bruta e reduz reembolso mais ainda — e em produto de R$ 34,97
o reembolso é o que mata a margem, não a conversão.

## Riscos declarados

1. **Origem do banco de questões.** Os enunciados são de provas públicas e estão
   creditados à banca quando a fonte informa (421 das 1.044; as outras 623
   aparecem como "questão de concurso"). As **resoluções**, porém, são texto
   autoral extraído do PDF de origem. Vender isso é exposição real. A saída é
   substituir progressivamente por resolução própria — já é o padrão nas questões
   geradas. Enquanto não trocar, o risco é seu e está registrado aqui.
2. **Sem sincronização entre dispositivos.** Está declarado na página de vendas e
   no FAQ. É a reclamação de suporte mais provável.
3. **Resoluções achatadas.** 82 das 1.044 têm layout visivelmente quebrado
   (fração ou expoente que o PDF desenhava em duas linhas). Vale revisar essas 82
   à mão antes de escalar tráfego.
