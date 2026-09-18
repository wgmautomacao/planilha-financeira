/* Ponto Cego — motor de questões
 *
 * Cada questão nasce de um gerador: parâmetros sorteados, resposta CALCULADA
 * e — o ponto do app — distratores presos a erros com nome. Nenhuma alternativa
 * errada é número aleatório: cada uma é o resultado de um erro clássico de prova,
 * e é esse nome que volta para o candidato no feedback e no painel de erros.
 *
 * Banco real: se window.BANCO_REAL existir (array de questões extraídas de um
 * PDF de questões resolvidas), ele entra no sorteio junto com os geradores.
 * Formato em README.md.
 */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------- sorteio */

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const ri = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

  function shuffle(rng, arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pickN(rng, arr, n) {
    return shuffle(rng, arr.slice()).slice(0, n);
  }

  /* ------------------------------------------------------------- aritmética */

  const fat = (n) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
  const C = (n, k) => fat(n) / (fat(k) * fat(n - k));
  const A = (n, k) => fat(n) / fat(n - k);
  const mdc = (a, b) => (b === 0 ? a : mdc(b, a % b));
  const mmc = (a, b) => (a * b) / mdc(a, b);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  /* ------------------------------------------------------------- formatação */

  const numBR = (v, dec) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

  const casas = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? 0 : 1);
  const plural = (v, s, p) => (Math.abs(v - 1) < 1e-9 ? s : p);

  const FMT = {
    int: (v) => Math.round(v).toLocaleString('pt-BR'),
    num: (v) => numBR(v, casas(v)),
    num2: (v) => numBR(v, 2),
    brl: (v) => 'R$ ' + numBR(v, 2),
    pct: (v) => numBR(v, casas(v)) + '%',
    prob: (v) => numBR(v * 100, Math.abs(v * 100 - Math.round(v * 100)) < 1e-9 ? 0 : 1) + '%',
    horas: (v) => numBR(v, casas(v)) + ' ' + plural(v, 'hora', 'horas'),
    dias: (v) => numBR(v, casas(v)) + ' ' + plural(v, 'dia', 'dias'),
    minutos: (v) => numBR(v, casas(v)) + ' ' + plural(v, 'minuto', 'minutos'),
    metros: (v) => numBR(v, casas(v)) + ' m',
    pecas: (v) => Math.round(v).toLocaleString('pt-BR') + ' peças',
    questoes: (v) => Math.round(v).toLocaleString('pt-BR') + ' questões',
    pessoas: (v) => Math.round(v).toLocaleString('pt-BR') + ' pessoas',
    maneiras: (v) => Math.round(v).toLocaleString('pt-BR') + ' maneiras',
    anagramas: (v) => Math.round(v).toLocaleString('pt-BR') + ' anagramas',
    senhas: (v) => Math.round(v).toLocaleString('pt-BR') + ' senhas',
    nota: (v) => numBR(v, 2),
    texto: (v) => String(v)
  };

  /* --------------------------------------------------- montagem da questão */

  function montarAlternativas(rng, item) {
    const F = FMT[item.fmt] || FMT.num;
    const numerico = typeof item.correta === 'number';
    const limite = item.max != null ? item.max : Infinity;

    const corretaTxt = F(item.correta);
    const vistos = new Set([corretaTxt]);
    const alts = [{ txt: corretaTxt, ok: true, erro: null }];

    for (const e of item.erros || []) {
      if (alts.length >= 5) break;
      if (e.v == null) continue;
      if (typeof e.v === 'number' && (!isFinite(e.v) || e.v <= 0 || e.v > limite)) continue;
      const t = F(e.v);
      if (vistos.has(t)) continue;
      vistos.add(t);
      alts.push({ txt: t, ok: false, erro: e.nome });
    }

    // rede de segurança: nunca exibir menos de 5 alternativas
    const fatores = [0.5, 1.25, 0.75, 1.5, 2, 0.9, 3, 1.1];
    for (let i = 0; numerico && alts.length < 5 && i < fatores.length; i++) {
      const v = item.correta * fatores[i];
      if (v <= 0 || v > limite) continue;
      const t = F(v);
      if (vistos.has(t)) continue;
      vistos.add(t);
      alts.push({ txt: t, ok: false, erro: 'Erro de conta no valor final' });
    }

    return shuffle(rng, alts).map((a, i) => Object.assign(a, { letra: 'ABCDE'[i] }));
  }

  /* ============================== GERADORES ============================== */
  /* Cada gerador recebe rng e devolve { enunciado, correta, fmt, erros, resolucao }
     ou null quando o sorteio caiu em parâmetros ruins (o motor tenta de novo). */

  const G = {};

  /* ----------------------------------------------------- 1. porcentagem -- */

  G.porcentagem = [
    { nivel: 2, nome: 'aumento e desconto sucessivos', f(rng) {
      const V = ri(rng, 4, 30) * 50;
      const a = pick(rng, [10, 15, 20, 25, 30]);
      const b = pick(rng, [10, 15, 20, 25, 30].filter((x) => x !== a));
      const fa = 1 + a / 100, fd = 1 - b / 100;
      const correta = V * fa * fd;
      const acumulado = (fa * fd - 1) * 100;
      return {
        enunciado: `Uma mercadoria custava ${FMT.brl(V)}. Em janeiro sofreu aumento de ${a}% e, na liquidação de julho, desconto de ${b}% **sobre o preço já aumentado**. Qual o preço final?`,
        correta, fmt: 'brl',
        erros: [
          { v: V * (1 + (a - b) / 100), nome: `Somar percentuais sucessivos (${a}% − ${b}%) em vez de multiplicar os fatores` },
          { v: V * fa, nome: 'Parar no aumento e esquecer o desconto' },
          { v: V * fa * (1 + b / 100), nome: 'Tratar o desconto como se fosse outro aumento' },
          { v: V * fd, nome: 'Aplicar o desconto sobre o preço antigo' },
          { v: V, nome: 'Supor que aumento e desconto se cancelam' }
        ],
        resolucao: [
          `Aumento de ${a}% → fator **${numBR(fa, 2)}**. Desconto de ${b}% → fator **${numBR(fd, 2)}**.`,
          `Preço final = ${FMT.brl(V)} × ${numBR(fa, 2)} × ${numBR(fd, 2)} = **${FMT.brl(correta)}**.`,
          `A variação acumulada é ${numBR(acumulado, 2)}%, e não ${a - b}%. Percentual sucessivo multiplica fator, não soma taxa — é aqui que a banca ganha a questão.`
        ]
      };
    } },

    { nivel: 3, nome: 'ponto percentual x aumento percentual', f(rng) {
      const p = pick(rng, [4, 5, 6, 8, 10, 12]);
      const q = p + pick(rng, [2, 3, 4, 5]);
      const correta = (q - p) / p * 100;
      return {
        enunciado: `A taxa de inadimplência de um órgão passou de ${p}% para ${q}%. O aumento **percentual** da inadimplência foi de aproximadamente:`,
        correta, fmt: 'pct', max: 1000,
        erros: [
          { v: q - p, nome: 'Confundir ponto percentual com aumento percentual' },
          { v: (q - p) / q * 100, nome: 'Dividir a variação pelo valor final em vez do inicial' },
          { v: q / p * 100, nome: 'Esquecer de descontar os 100% da base' },
          { v: p / q * 100, nome: 'Inverter a razão entre inicial e final' },
          { v: (q + p) / p * 100, nome: 'Somar em vez de subtrair no numerador' }
        ],
        resolucao: [
          `Variação absoluta: ${q}% − ${p}% = ${q - p} **pontos percentuais**.`,
          `Aumento percentual = variação ÷ valor **inicial** = ${q - p} ÷ ${p} = ${numBR((q - p) / p, 4)}.`,
          `Logo, **${FMT.pct(correta)}**. Subiu ${q - p} pontos percentuais, mas cresceu ${FMT.pct(correta)} — são duas coisas diferentes, e a banca oferece as duas.`
        ]
      };
    } },

    { nivel: 2, nome: 'preço antes do desconto', f(rng) {
      const d = pick(rng, [10, 20, 25, 40, 50]);
      const original = ri(rng, 5, 40) * 20;
      const pago = original * (1 - d / 100);
      return {
        enunciado: `Após um desconto de ${d}%, uma servidora pagou ${FMT.brl(pago)} por um curso preparatório. Qual era o preço sem desconto?`,
        correta: original, fmt: 'brl',
        erros: [
          { v: pago * (1 + d / 100), nome: 'Aplicar o percentual sobre o valor já descontado' },
          { v: pago * (1 - d / 100), nome: 'Aplicar o desconto uma segunda vez' },
          { v: pago / (1 + d / 100), nome: 'Dividir pelo fator de aumento em vez do fator de desconto' },
          { v: pago + d, nome: 'Somar o percentual como se fosse reais' },
          { v: pago * 100 / d, nome: 'Dividir pela taxa em vez do complemento da taxa' }
        ],
        resolucao: [
          `O valor pago é ${100 - d}% do preço original: ${FMT.brl(pago)} = P × ${numBR(1 - d / 100, 2)}.`,
          `P = ${FMT.brl(pago)} ÷ ${numBR(1 - d / 100, 2)} = **${FMT.brl(original)}**.`,
          `Aumentar ${d}% sobre o valor pago daria ${FMT.brl(pago * (1 + d / 100))} — errado, porque a base do desconto era o preço cheio, não o preço pago.`
        ]
      };
    } }
  ];

  /* --------------------------------------------------- 2. regra de três -- */

  G.regratres = [
    { nivel: 3, nome: 'regra de três composta', f(rng) {
      const m = pick(rng, [3, 4, 5, 6]);
      const h = pick(rng, [4, 5, 6, 8]);
      const taxa = pick(rng, [5, 8, 10, 12, 15]);
      const p = m * h * taxa;
      const n = m + pick(rng, [2, 3, 4]);
      const k = pick(rng, [3, 6, 9, 10, 12].filter((x) => x !== h));
      if (!k) return null;
      const correta = taxa * n * k;
      return {
        enunciado: `${m} máquinas produzem ${FMT.int(p)} peças em ${h} horas de operação. Mantido o mesmo ritmo, quantas peças ${n} máquinas produzem em ${k} horas?`,
        correta, fmt: 'pecas',
        erros: [
          { v: p * n / m, nome: 'Ajustar as máquinas e ignorar a mudança no tempo' },
          { v: p * k / h, nome: 'Ajustar o tempo e ignorar a mudança no número de máquinas' },
          { v: p * (m / n) * (k / h), nome: 'Tratar “máquinas” como grandeza inversamente proporcional' },
          { v: p * (n / m) * (h / k), nome: 'Tratar “horas” como grandeza inversamente proporcional' },
          { v: p + (n - m) * h * taxa, nome: 'Somar a produção das máquinas extras sem corrigir o tempo' }
        ],
        resolucao: [
          `Produção de 1 máquina em 1 hora: ${FMT.int(p)} ÷ (${m} × ${h}) = **${taxa} peças**.`,
          `Ambas as grandezas são **diretamente** proporcionais: mais máquinas → mais peças; mais horas → mais peças.`,
          `${taxa} × ${n} máquinas × ${k} horas = **${FMT.int(correta)} peças**.`
        ]
      };
    } },

    { nivel: 2, nome: 'torneiras / trabalho conjunto', f(rng) {
      const [a, b] = pick(rng, [[3, 6], [2, 6], [4, 12], [6, 12], [5, 20], [10, 15], [12, 4], [9, 18], [20, 30]]);
      const correta = a * b / (a + b);
      return {
        enunciado: `A torneira A enche sozinha um reservatório em ${a} horas; a torneira B, em ${b} horas. Abertas **juntas**, em quanto tempo enchem o reservatório?`,
        correta, fmt: 'horas',
        erros: [
          { v: a + b, nome: 'Somar os tempos individuais' },
          { v: (a + b) / 2, nome: 'Tirar a média dos tempos' },
          { v: Math.abs(a - b), nome: 'Subtrair os tempos' },
          { v: a * b, nome: 'Multiplicar os tempos sem somar as taxas' },
          { v: Math.min(a, b) / 2, nome: 'Supor metade do tempo da torneira mais rápida' }
        ],
        resolucao: [
          `Some **taxas**, nunca tempos: A faz 1/${a} do tanque por hora, B faz 1/${b}.`,
          `Juntas: 1/${a} + 1/${b} = ${numBR(1 / a + 1 / b, 4)} do tanque por hora.`,
          `Tempo = 1 ÷ ${numBR(1 / a + 1 / b, 4)} = **${FMT.horas(correta)}** — sempre menor que o tempo da torneira mais rápida (${Math.min(a, b)} h). Se sua resposta deu mais que isso, o erro é estrutural.`
        ]
      };
    } },

    { nivel: 1, nome: 'proporção inversa', f(rng) {
      const x = pick(rng, [6, 8, 10, 12, 15, 20]);
      const d = pick(rng, [12, 15, 18, 20, 24, 30]);
      const y = x + pick(rng, [2, 4, 5, 10]);
      const correta = x * d / y;
      if (!Number.isInteger(correta) || correta < 2) return null;
      return {
        enunciado: `${x} servidores digitalizam um acervo em ${d} dias. No mesmo ritmo, quantos dias levariam ${y} servidores?`,
        correta, fmt: 'dias',
        erros: [
          { v: y * d / x, nome: 'Usar proporção direta onde a relação é inversa' },
          { v: d - (y - x), nome: 'Descontar um dia por servidor acrescentado' },
          { v: d, nome: 'Supor que o prazo não muda' },
          { v: x * d, nome: 'Multiplicar sem dividir pela nova equipe' },
          { v: d * y / (x + y), nome: 'Ratear o prazo entre as duas equipes' }
        ],
        resolucao: [
          `Mais servidores, menos dias: grandezas **inversamente** proporcionais.`,
          `Trabalho total = ${x} × ${d} = **${x * d} servidor-dias**.`,
          `${x * d} ÷ ${y} = **${FMT.dias(correta)}**. Na inversa você multiplica em cruz na mesma linha; na direta, cruzado. Errar isso custa a questão inteira.`
        ]
      };
    } }
  ];

  /* ---------------------------------------------------------- 3. juros --- */

  G.jurossimples = [
    { nivel: 1, nome: 'montante a juros simples', f(rng) {
      const Cap = ri(rng, 4, 30) * 500;
      const i = pick(rng, [1, 1.5, 2, 2.5, 3]);
      const t = pick(rng, [4, 5, 6, 8, 10, 12]);
      const J = Cap * i / 100 * t;
      const correta = Cap + J;
      return {
        enunciado: `Um capital de ${FMT.brl(Cap)} foi aplicado a juros **simples** de ${FMT.pct(i)} ao mês durante ${t} meses. Qual o montante no fim do período?`,
        correta, fmt: 'brl',
        erros: [
          { v: Cap * Math.pow(1 + i / 100, t), nome: 'Aplicar juros compostos num problema de juros simples' },
          { v: J, nome: 'Responder o juro em vez do montante' },
          { v: Cap * (1 + i / 100), nome: 'Considerar apenas um mês de aplicação' },
          { v: Cap + Cap * i * t, nome: 'Esquecer de dividir a taxa por 100' },
          { v: Cap * (1 + t / 100), nome: 'Trocar a taxa pelo prazo na fórmula' }
        ],
        resolucao: [
          `Juros simples: J = C × i × t = ${FMT.brl(Cap)} × ${numBR(i / 100, 4)} × ${t} = **${FMT.brl(J)}**.`,
          `Montante = C + J = ${FMT.brl(Cap)} + ${FMT.brl(J)} = **${FMT.brl(correta)}**.`,
          `No regime simples o juro incide sempre sobre o capital inicial. Quem eleva o fator a ${t} está em regime composto e responde ${FMT.brl(Cap * Math.pow(1 + i / 100, t))}.`
        ]
      };
    } }
  ];

  G.juroscompostos = [
    { nivel: 2, nome: 'montante a juros compostos', f(rng) {
      const Cap = ri(rng, 2, 20) * 1000;
      const i = pick(rng, [10, 20, 25, 50]);
      const t = pick(rng, [2, 3]);
      const correta = Cap * Math.pow(1 + i / 100, t);
      return {
        enunciado: `Um capital de ${FMT.brl(Cap)} é aplicado a juros **compostos** de ${i}% ao mês por ${t} meses. Qual o montante?`,
        correta, fmt: 'brl',
        erros: [
          { v: Cap * (1 + i * t / 100), nome: 'Usar juros simples em regime composto' },
          { v: correta - Cap, nome: 'Responder o juro composto em vez do montante' },
          { v: Cap * (1 + i / 100), nome: 'Capitalizar apenas um período' },
          { v: Cap * Math.pow(1 + i / 100, t + 1), nome: 'Contar um período de capitalização a mais' },
          { v: Cap * (1 + Math.pow(i / 100, t)), nome: 'Elevar a taxa em vez do fator (1 + i)' }
        ],
        resolucao: [
          `M = C × (1 + i)^t = ${FMT.brl(Cap)} × ${numBR(1 + i / 100, 2)}^${t}.`,
          `${numBR(1 + i / 100, 2)}^${t} = ${numBR(Math.pow(1 + i / 100, t), 4)} → M = **${FMT.brl(correta)}**.`,
          `A juros simples daria ${FMT.brl(Cap * (1 + i * t / 100))}. A diferença de ${FMT.brl(correta - Cap * (1 + i * t / 100))} é o juro sobre juro — exatamente o que a alternativa armadilha remove.`
        ]
      };
    } },

    { nivel: 3, nome: 'capital a partir do juro composto', f(rng) {
      const i = pick(rng, [10, 20, 25, 50]);
      const Cap = ri(rng, 2, 20) * 1000;
      const fator = Math.pow(1 + i / 100, 2) - 1;
      const J = Cap * fator;
      return {
        enunciado: `Aplicado a juros compostos de ${i}% ao mês, um capital rendeu ${FMT.brl(J)} de **juros** em 2 meses. Qual era o capital inicial?`,
        correta: Cap, fmt: 'brl',
        erros: [
          { v: J / (2 * i / 100), nome: 'Tratar o rendimento como juros simples' },
          { v: J / (i / 100), nome: 'Considerar um único período de capitalização' },
          { v: J * fator, nome: 'Multiplicar pelo fator em vez de dividir' },
          { v: J / Math.pow(1 + i / 100, 2), nome: 'Dividir pelo fator de montante em vez do fator de juro' },
          { v: J, nome: 'Confundir o juro acumulado com o capital' }
        ],
        resolucao: [
          `Em 2 meses o montante é C × ${numBR(1 + i / 100, 2)}² = C × ${numBR(Math.pow(1 + i / 100, 2), 4)}.`,
          `O **juro** é a diferença: J = C × (${numBR(Math.pow(1 + i / 100, 2), 4)} − 1) = C × ${numBR(fator, 4)}.`,
          `C = ${FMT.brl(J)} ÷ ${numBR(fator, 4)} = **${FMT.brl(Cap)}**. Dividir por 2i (juros simples) dá ${FMT.brl(J / (2 * i / 100))} e é o distrator mais marcado.`
        ]
      };
    } }
  ];

  /* ----------------------------------------------------- 4. progressões -- */

  G.progressoes = [
    { nivel: 1, nome: 'termo geral da PA', f(rng) {
      const a1 = ri(rng, 2, 12);
      const r = pick(rng, [3, 4, 5, 6, 7, 8]);
      const n = pick(rng, [12, 15, 18, 20, 25, 30]);
      const correta = a1 + (n - 1) * r;
      return {
        enunciado: `Numa progressão aritmética o primeiro termo é ${a1} e a razão é ${r}. Qual é o ${n}º termo?`,
        correta, fmt: 'int',
        erros: [
          { v: a1 + n * r, nome: 'Esquecer o (n − 1) no termo geral da PA' },
          { v: a1 + (n - 2) * r, nome: 'Descontar dois termos em vez de um' },
          { v: n * r, nome: 'Ignorar o primeiro termo' },
          { v: a1 * n, nome: 'Multiplicar o primeiro termo pela posição' },
          { v: (a1 + r) * (n - 1), nome: 'Somar a₁ com a razão antes de multiplicar' }
        ],
        resolucao: [
          `aₙ = a₁ + (n − 1) · r.`,
          `a${n} = ${a1} + (${n} − 1) × ${r} = ${a1} + ${(n - 1) * r} = **${correta}**.`,
          `O (n − 1) existe porque do 1º ao ${n}º termo você dá ${n - 1} passos, não ${n}. Sem ele a resposta sai ${a1 + n * r}.`
        ]
      };
    } },

    { nivel: 2, nome: 'soma dos termos da PA', f(rng) {
      const a1 = ri(rng, 5, 15);
      const r = pick(rng, [2, 3, 4, 5]);
      const n = pick(rng, [10, 12, 14, 20, 30]);
      const an = a1 + (n - 1) * r;
      const correta = n * (a1 + an) / 2;
      if (!Number.isInteger(correta)) return null;
      return {
        enunciado: `Uma candidata resolve ${a1} questões no primeiro dia e, a cada dia, ${r} questões **mais** que no dia anterior. Quantas questões ela terá resolvido ao fim de ${n} dias?`,
        correta, fmt: 'questoes',
        erros: [
          { v: n * (a1 + an), nome: 'Esquecer de dividir a soma da PA por 2' },
          { v: (a1 + an) / 2, nome: 'Calcular a média dos extremos em vez da soma' },
          { v: n * an, nome: 'Multiplicar o último dia pelo número de dias' },
          { v: n * a1, nome: 'Supor ritmo constante ao longo dos dias' },
          { v: an, nome: 'Responder o total do último dia em vez do acumulado' }
        ],
        resolucao: [
          `Último dia: a${n} = ${a1} + ${n - 1} × ${r} = **${an} questões**.`,
          `Sₙ = n · (a₁ + aₙ) / 2 = ${n} × (${a1} + ${an}) / 2.`,
          `= ${n} × ${a1 + an} / 2 = **${FMT.int(correta)} questões**. Sem o ÷2 a resposta dobra para ${FMT.int(n * (a1 + an))} — o erro mais comum da fórmula.`
        ]
      };
    } },

    { nivel: 2, nome: 'termo geral da PG', f(rng) {
      const a1 = pick(rng, [2, 3, 5, 10]);
      const q = pick(rng, [2, 3]);
      const n = pick(rng, [5, 6, 7, 8]);
      const correta = a1 * Math.pow(q, n - 1);
      return {
        enunciado: `Numa progressão geométrica o primeiro termo é ${a1} e a razão é ${q}. Qual é o ${n}º termo?`,
        correta, fmt: 'int',
        erros: [
          { v: a1 * Math.pow(q, n), nome: 'Esquecer o (n − 1) no expoente da PG' },
          { v: a1 + (n - 1) * q, nome: 'Aplicar a fórmula da PA numa PG' },
          { v: a1 * q * n, nome: 'Multiplicar em vez de potenciar' },
          { v: a1 * Math.pow(q, n - 2), nome: 'Descontar dois termos no expoente' },
          { v: Math.pow(a1 * q, n - 1), nome: 'Elevar o produto a₁ · q em vez de só a razão' }
        ],
        resolucao: [
          `aₙ = a₁ · q^(n − 1).`,
          `a${n} = ${a1} × ${q}^${n - 1} = ${a1} × ${FMT.int(Math.pow(q, n - 1))} = **${FMT.int(correta)}**.`,
          `Na PG a razão **multiplica**; na PA, soma. Quem troca as fórmulas responde ${a1 + (n - 1) * q}.`
        ]
      };
    } },

    { nivel: 3, nome: 'soma dos termos da PG', f(rng) {
      const a1 = pick(rng, [2, 3, 5]);
      const q = pick(rng, [2, 3]);
      const n = pick(rng, [5, 6, 7]);
      const an = a1 * Math.pow(q, n - 1);
      const correta = a1 * (Math.pow(q, n) - 1) / (q - 1);
      return {
        enunciado: `Uma dívida cresce em progressão geométrica: ${a1} no primeiro mês e razão ${q}. Qual a **soma** dos ${n} primeiros termos?`,
        correta, fmt: 'int',
        erros: [
          { v: a1 * Math.pow(q, n) / (q - 1), nome: 'Esquecer o −1 no numerador da soma da PG' },
          { v: an, nome: 'Responder o último termo em vez da soma' },
          { v: a1 * (Math.pow(q, n - 1) - 1) / (q - 1), nome: 'Usar n − 1 no expoente da soma' },
          { v: n * (a1 + an) / 2, nome: 'Usar a fórmula da soma da PA numa PG' },
          { v: a1 * n * q, nome: 'Multiplicar termo, quantidade e razão' }
        ],
        resolucao: [
          `Sₙ = a₁ · (qⁿ − 1) / (q − 1).`,
          `S${n} = ${a1} × (${q}^${n} − 1) / (${q} − 1) = ${a1} × ${FMT.int(Math.pow(q, n) - 1)} / ${q - 1}.`,
          `= **${FMT.int(correta)}**. O expoente é n (${n}), não n − 1: a soma inclui o último termo.`
        ]
      };
    } }
  ];

  /* -------------------------------------------------- 5. combinatória ---- */

  G.combinatoria = [
    { nivel: 1, nome: 'combinação simples', f(rng) {
      const m = ri(rng, 6, 12);
      const k = pick(rng, [2, 3]);
      const correta = C(m, k);
      return {
        enunciado: `De um grupo de ${m} servidores, quantas comissões distintas de ${k} membros **sem cargos definidos** podem ser formadas?`,
        correta, fmt: 'maneiras',
        erros: [
          { v: A(m, k), nome: 'Contar a ordem onde ela não importa (arranjo em vez de combinação)' },
          { v: Math.pow(m, k), nome: 'Permitir que a mesma pessoa ocupe duas vagas' },
          { v: m * k, nome: 'Multiplicar os dois números do enunciado' },
          { v: C(m - 1, k), nome: 'Deixar um servidor fora da contagem' },
          { v: fat(m) / fat(k), nome: 'Esquecer o (m − k)! no denominador' }
        ],
        resolucao: [
          `Comissão sem cargos → a ordem **não** importa → combinação.`,
          `C(${m},${k}) = ${m}! / (${k}! · ${m - k}!) = **${FMT.int(correta)}**.`,
          `Se o enunciado dissesse “presidente e secretário”, a ordem passaria a contar e a resposta seria A(${m},${k}) = ${FMT.int(A(m, k))}. Uma palavra muda a fórmula.`
        ]
      };
    } },

    { nivel: 2, nome: 'anagramas com repetição', f(rng) {
      const palavras = [
        { p: 'BANCA', n: 5, div: 2, rep: 'A aparece 2 vezes' },
        { p: 'RECURSO', n: 7, div: 2, rep: 'R aparece 2 vezes' },
        { p: 'GABARITO', n: 8, div: 2, rep: 'A aparece 2 vezes' },
        { p: 'CARTAO', n: 6, div: 2, rep: 'A aparece 2 vezes' },
        { p: 'APROVADO', n: 8, div: 4, rep: 'A aparece 2 vezes e O aparece 2 vezes' },
        { p: 'PARCELA', n: 7, div: 2, rep: 'A aparece 2 vezes' }
      ];
      const w = pick(rng, palavras);
      const correta = fat(w.n) / w.div;
      return {
        enunciado: `Quantos anagramas distintos podem ser formados com as letras da palavra **${w.p}**?`,
        correta, fmt: 'anagramas',
        erros: [
          { v: fat(w.n), nome: 'Ignorar as letras repetidas da palavra' },
          { v: w.div === 4 ? fat(w.n) / 2 : fat(w.n) / 4, nome: 'Descontar as repetições pela metade errada' },
          { v: fat(w.n - 1), nome: 'Fixar indevidamente uma letra' },
          { v: fat(w.n) / (w.div * 2), nome: 'Dividir por um fator de repetição inexistente' },
          { v: C(w.n, 2), nome: 'Usar combinação em problema de permutação' }
        ],
        resolucao: [
          `${w.p} tem ${w.n} letras, e ${w.rep}.`,
          `Permutação com repetição: ${w.n}! ÷ ${w.div} = ${FMT.int(fat(w.n))} ÷ ${w.div}.`,
          `= **${FMT.int(correta)} anagramas**. Sem dividir pelas repetições você conta duas vezes trocas de letras iguais — que não geram palavra nova.`
        ]
      };
    } },

    { nivel: 3, nome: 'comissão com composição exigida', f(rng) {
      const h = ri(rng, 4, 7);
      const mu = ri(rng, 4, 7);
      const kh = 2;
      const km = pick(rng, [2, 3]);
      if (km > mu) return null;
      const correta = C(h, kh) * C(mu, km);
      return {
        enunciado: `Uma comissão será formada por ${kh} dos ${h} homens e ${km} das ${mu} mulheres de um setor. De quantas maneiras ela pode ser composta?`,
        correta, fmt: 'maneiras',
        erros: [
          { v: C(h + mu, kh + km), nome: 'Ignorar a exigência de composição por grupo' },
          { v: C(h, kh) + C(mu, km), nome: 'Somar em vez de multiplicar escolhas independentes' },
          { v: A(h, kh) * A(mu, km), nome: 'Contar a ordem dentro de cada grupo' },
          { v: km !== kh ? C(h, km) * C(mu, kh) : null, nome: 'Trocar as quantidades exigidas entre os grupos' },
          { v: C(h, kh) * C(mu, km) * 2, nome: 'Duplicar a contagem final' }
        ],
        resolucao: [
          `Escolha dos homens: C(${h},${kh}) = ${FMT.int(C(h, kh))}.`,
          `Escolha das mulheres: C(${mu},${km}) = ${FMT.int(C(mu, km))}.`,
          `Eventos independentes **multiplicam**: ${FMT.int(C(h, kh))} × ${FMT.int(C(mu, km))} = **${FMT.int(correta)}**. Somar (${FMT.int(C(h, kh) + C(mu, km))}) responderia “ou”, não “e”.`
        ]
      };
    } },

    { nivel: 2, nome: 'princípio multiplicativo (senhas)', f(rng) {
      const d = pick(rng, [3, 4]);
      let correta = 1;
      for (let i = 0; i < d; i++) correta *= (10 - i);
      return {
        enunciado: `Quantas senhas de ${d} algarismos **distintos** podem ser formadas com os dígitos de 0 a 9?`,
        correta, fmt: 'senhas',
        erros: [
          { v: Math.pow(10, d), nome: 'Permitir repetição de algarismos' },
          { v: C(10, d), nome: 'Ignorar que a ordem dos algarismos importa' },
          { v: 9 * (correta / 10), nome: 'Excluir o zero da primeira posição sem o enunciado pedir' },
          { v: fat(10) / fat(d), nome: 'Inverter o denominador da fórmula do arranjo' },
          { v: 10 * d, nome: 'Multiplicar a base pelo número de posições' }
        ],
        resolucao: [
          `Primeira posição: 10 opções. A cada posição, uma opção a menos (algarismos distintos).`,
          `${Array.from({ length: d }, (_, i) => 10 - i).join(' × ')} = **${FMT.int(correta)} senhas**.`,
          `Com repetição permitida seriam 10^${d} = ${FMT.int(Math.pow(10, d))}. A palavra “distintos” vale ${FMT.int(Math.pow(10, d) - correta)} senhas de diferença.`
        ]
      };
    } }
  ];

  /* -------------------------------------------------- 6. probabilidade --- */

  G.probabilidade = [
    { nivel: 2, nome: 'retiradas sem reposição', f(rng) {
      const b = ri(rng, 3, 7);
      const pr = ri(rng, 3, 7);
      const n = b + pr;
      const correta = (b / n) * ((b - 1) / (n - 1));
      return {
        enunciado: `Uma urna contém ${b} bolas brancas e ${pr} bolas pretas. Retiram-se duas bolas, uma após a outra, **sem reposição**. Qual a probabilidade de ambas serem brancas?`,
        correta, fmt: 'prob', max: 1,
        erros: [
          { v: Math.pow(b / n, 2), nome: 'Tratar a retirada como se fosse com reposição' },
          { v: (b / n) * (b / (n - 1)), nome: 'Reduzir o total e esquecer de reduzir as brancas' },
          { v: (b / n) + ((b - 1) / (n - 1)), nome: 'Somar as probabilidades em vez de multiplicar' },
          { v: 2 * b / n, nome: 'Dobrar a probabilidade de uma única retirada' },
          { v: (b * (b - 1)) / (n * n), nome: 'Reduzir as brancas e esquecer de reduzir o total' }
        ],
        resolucao: [
          `1ª bola branca: ${b}/${n}.`,
          `2ª bola branca, **já sem** a primeira: ${b - 1}/${n - 1}.`,
          `${b}/${n} × ${b - 1}/${n - 1} = ${numBR(correta, 4)} = **${FMT.prob(correta)}**. Com reposição daria ${FMT.prob(Math.pow(b / n, 2))} — a expressão “sem reposição” muda os dois numeradores e os dois denominadores.`
        ]
      };
    } },

    { nivel: 3, nome: 'pelo menos uma ocorrência', f(rng) {
      const [a, bq] = pick(rng, [[1, 2], [1, 3], [1, 4], [2, 5], [3, 10]]);
      const p = a / bq;
      const k = pick(rng, [2, 3]);
      const correta = 1 - Math.pow(1 - p, k);
      return {
        enunciado: `A probabilidade de um sistema falhar em um dia é ${a}/${bq}. Em ${k} dias independentes, qual a probabilidade de ocorrer **pelo menos uma** falha?`,
        correta, fmt: 'prob', max: 1,
        erros: [
          { v: Math.pow(1 - p, k), nome: 'Calcular a probabilidade de nenhuma falha e parar aí' },
          { v: p * k, nome: 'Multiplicar a probabilidade pelo número de dias' },
          { v: Math.pow(p, k), nome: 'Calcular a probabilidade de falhar em todos os dias' },
          { v: p, nome: 'Considerar um único dia' },
          { v: 1 - p * k > 0 ? 1 - p * k : null, nome: 'Subtrair de 1 a probabilidade somada' }
        ],
        resolucao: [
          `“Pelo menos uma” pede o **complementar**: 1 − P(nenhuma).`,
          `P(não falhar num dia) = 1 − ${a}/${bq} = ${numBR(1 - p, 4)}. Em ${k} dias: ${numBR(1 - p, 4)}^${k} = ${numBR(Math.pow(1 - p, k), 4)}.`,
          `P = 1 − ${numBR(Math.pow(1 - p, k), 4)} = **${FMT.prob(correta)}**. Somar ${a}/${bq} × ${k} passaria de 100% em prazos maiores — sinal de que o caminho está errado.`
        ]
      };
    } },

    { nivel: 2, nome: 'união de eventos', f(rng) {
      const inter = ri(rng, 10, 20);
      const soA = ri(rng, 15, 35);
      const soB = ri(rng, 15, 35);
      if (soA + soB + inter > 95) return null;
      const pa = soA + inter, pb = soB + inter;
      const correta = pa + pb - inter;
      return {
        enunciado: `Numa pesquisa, ${pa}% dos candidatos estudam pela manhã, ${pb}% estudam à noite e ${inter}% estudam **nos dois turnos**. Qual o percentual que estuda pela manhã **ou** à noite?`,
        correta, fmt: 'pct', max: 100,
        erros: [
          { v: pa + pb, nome: 'Contar duas vezes quem está na interseção' },
          { v: pa + pb - 2 * inter, nome: 'Descontar a interseção duas vezes' },
          { v: 100 - (pa + pb - inter), nome: 'Responder o complemento da união' },
          { v: pa * pb / 100, nome: 'Multiplicar como se os eventos fossem independentes' },
          { v: soA + soB, nome: 'Somar apenas quem estuda em um único turno' }
        ],
        resolucao: [
          `P(A ∪ B) = P(A) + P(B) − P(A ∩ B).`,
          `${pa}% + ${pb}% − ${inter}% = **${FMT.pct(correta)}**.`,
          `Sem subtrair a interseção você soma ${pa + pb}% e conta duas vezes os ${inter}% que estudam nos dois turnos.`
        ]
      };
    } }
  ];

  /* ------------------------------------------------------- 7. conjuntos -- */

  G.conjuntos = [
    { nivel: 1, nome: 'Venn com dois conjuntos', f(rng) {
      const ambos = ri(rng, 5, 20);
      const soA = ri(rng, 10, 40);
      const soB = ri(rng, 10, 40);
      const nenhum = ri(rng, 6, 25);
      const T = soA + soB + ambos + nenhum;
      const pa = soA + ambos, pb = soB + ambos;
      return {
        enunciado: `Numa repartição com ${T} servidores, ${pa} falam inglês, ${pb} falam espanhol e ${ambos} falam **os dois** idiomas. Quantos não falam nenhum dos dois?`,
        correta: nenhum, fmt: 'pessoas',
        erros: [
          { v: T - pa - pb, nome: 'Subtrair os bilíngues duas vezes (esquecer de somar a interseção)' },
          { v: T - (pa + pb + ambos), nome: 'Somar a interseção em vez de subtrair' },
          { v: T - ambos, nome: 'Descontar apenas os bilíngues' },
          { v: pa + pb - ambos, nome: 'Responder a união em vez de quem está fora dela' },
          { v: soA + soB, nome: 'Confundir “apenas um idioma” com “nenhum idioma”' }
        ],
        resolucao: [
          `União = ${pa} + ${pb} − ${ambos} = **${pa + pb - ambos} servidores** falam ao menos um idioma.`,
          `Fora da união: ${T} − ${pa + pb - ambos} = **${nenhum} servidores**.`,
          `Somar ${pa} + ${pb} sem tirar os ${ambos} bilíngues estoura o total: ${pa + pb} contra ${T} servidores existentes.`
        ]
      };
    } },

    { nivel: 3, nome: 'Venn com três conjuntos', f(rng) {
      const t = ri(rng, 4, 12);          // exatamente os três
      const ab = ri(rng, 5, 15), ac = ri(rng, 5, 15), bc = ri(rng, 5, 15);
      const soA = ri(rng, 15, 40), soB = ri(rng, 15, 40), soC = ri(rng, 15, 40);
      const nenhum = ri(rng, 5, 20);
      const AB = ab + t, AC = ac + t, BC = bc + t;
      const pa = soA + ab + ac + t;
      const pb = soB + ab + bc + t;
      const pc = soC + ac + bc + t;
      const T = soA + soB + soC + ab + ac + bc + t + nenhum;
      return {
        enunciado: `Numa pesquisa com ${T} leitores: ${pa} leem o jornal A, ${pb} leem o B, ${pc} leem o C; ${AB} leem A e B, ${AC} leem A e C, ${BC} leem B e C, e ${t} leem **os três**. Quantos leem **apenas** o jornal A?`,
        correta: soA, fmt: 'pessoas',
        erros: [
          { v: pa - AB - AC, nome: 'Esquecer de devolver a interseção tripla, descontada duas vezes' },
          { v: pa - AB - AC - t, nome: 'Descontar a interseção tripla mais uma vez' },
          { v: pa - t, nome: 'Descontar só quem lê os três' },
          { v: pa, nome: 'Ignorar as interseções e responder o total de A' },
          { v: pa - AB - AC + 2 * t, nome: 'Somar a tripla duas vezes na correção' }
        ],
        resolucao: [
          `Atenção: os ${AB} de “A e B” **já incluem** os ${t} que leem os três. O mesmo vale para A e C.`,
          `Apenas A = ${pa} − ${AB} − ${AC} + ${t} (a tripla foi descontada duas vezes e precisa voltar uma).`,
          `= **${soA} leitores**. Sem devolver a tripla a resposta cai para ${pa - AB - AC} — é o erro que a banca mais cobra em Venn de três conjuntos.`
        ]
      };
    } }
  ];

  /* --------------------------------------------------- 8. lógica --------- */

  const L_S = ['concurseiro', 'candidato', 'estudante', 'inscrito', 'aprovado'];
  const L_P = ['resolve simulados', 'lê o edital', 'estuda matemática', 'revisa os erros', 'faz questões todo dia'];

  const L_COND = [
    { p: 'o candidato estuda com constância', pn: 'o candidato não estuda com constância', q: 'o candidato é aprovado', qn: 'o candidato não é aprovado' },
    { p: 'o edital sai em janeiro', pn: 'o edital não sai em janeiro', q: 'a prova ocorre em maio', qn: 'a prova não ocorre em maio' },
    { p: 'a questão é anulada', pn: 'a questão não é anulada', q: 'a nota de corte cai', qn: 'a nota de corte não cai' },
    { p: 'o servidor faz o curso', pn: 'o servidor não faz o curso', q: 'o servidor recebe a gratificação', qn: 'o servidor não recebe a gratificação' }
  ];

  G.logica = [
    { nivel: 2, nome: 'negação de proposição universal', f(rng) {
      const s = pick(rng, L_S);
      const p = pick(rng, L_P);
      return {
        enunciado: `A negação da proposição “**Todo ${s} ${p}**” é:`,
        correta: `Algum ${s} não ${p}.`, fmt: 'texto',
        erros: [
          { v: `Nenhum ${s} ${p}.`, nome: 'Negar “todo” trocando por “nenhum”' },
          { v: `Todo ${s} não ${p}.`, nome: 'Negar o predicado e manter o quantificador universal' },
          { v: `Algum ${s} ${p}.`, nome: 'Trocar o quantificador sem negar o predicado' },
          { v: `A maioria dos ${s}s não ${p}.`, nome: 'Trocar negação lógica por noção de quantidade' }
        ],
        resolucao: [
          `A negação de “todo” é “**existe pelo menos um que não**”. Nunca é “nenhum”.`,
          `“Todo ${s} ${p}” é falsa assim que **um único** ${s} não ${p}.`,
          `Logo: **Algum ${s} não ${p}.** “Nenhum ${s} ${p}” é mais forte que a negação — afirma algo sobre todos, e é o distrator campeão.`
        ]
      };
    } },

    { nivel: 3, nome: 'negação de condicional', f(rng) {
      const c = pick(rng, L_COND);
      return {
        enunciado: `A negação de “**Se ${c.p}, então ${c.q}**” é:`,
        correta: `${cap(c.p)} e ${c.qn}.`, fmt: 'texto',
        erros: [
          { v: `Se ${c.pn}, então ${c.qn}.`, nome: 'Negar as duas partes mantendo a implicação (falácia da inversa)' },
          { v: `Se ${c.q}, então ${c.p}.`, nome: 'Responder a recíproca em vez da negação' },
          { v: `${cap(c.pn)} ou ${c.q}.`, nome: 'Responder uma equivalência da condicional em vez da negação' },
          { v: `${cap(c.pn)} e ${c.qn}.`, nome: 'Negar as duas proposições e trocar o conectivo' },
          { v: `Se ${c.p}, então ${c.qn}.`, nome: 'Negar apenas o consequente' }
        ],
        resolucao: [
          `~(p → q) ≡ **p ∧ ~q**. A negação de uma condicional nunca é outra condicional.`,
          `Uma promessa “se p, então q” só é quebrada num caso: p acontece e q não.`,
          `Logo: **${cap(c.p)} e ${c.qn}.** “Se ${c.pn}, então ${c.qn}” é a inversa — não equivale nem nega a original.`
        ]
      };
    } },

    { nivel: 3, nome: 'equivalência da condicional', f(rng) {
      const c = pick(rng, L_COND);
      return {
        enunciado: `Qual proposição é **logicamente equivalente** a “Se ${c.p}, então ${c.q}”?`,
        correta: `Se ${c.qn}, então ${c.pn}.`, fmt: 'texto',
        erros: [
          { v: `Se ${c.q}, então ${c.p}.`, nome: 'Trocar a contrapositiva pela recíproca' },
          { v: `Se ${c.pn}, então ${c.qn}.`, nome: 'Trocar a contrapositiva pela inversa' },
          { v: `${cap(c.p)} e ${c.q}.`, nome: 'Transformar a implicação em conjunção' },
          { v: `${cap(c.p)} ou ${c.qn}.`, nome: 'Errar a equivalência com “ou” (é ~p ∨ q, não p ∨ ~q)' }
        ],
        resolucao: [
          `p → q ≡ ~q → ~p (**contrapositiva**) ≡ ~p ∨ q.`,
          `Nega as duas pontas **e** inverte a ordem. Fazer só uma das duas coisas produz a inversa ou a recíproca, que não equivalem.`,
          `Resposta: **Se ${c.qn}, então ${c.pn}.**`
        ]
      };
    } },

    { nivel: 2, nome: 'modus tollens', f(rng) {
      const c = pick(rng, L_COND);
      return {
        enunciado: `Sabe-se que “Se ${c.p}, então ${c.q}” é **verdadeira** e que ${c.qn}. Conclui-se que:`,
        correta: `${cap(c.pn)}.`, fmt: 'texto',
        erros: [
          { v: `${cap(c.p)}.`, nome: 'Concluir o antecedente a partir da negação do consequente' },
          { v: `${cap(c.q)}.`, nome: 'Contradizer a informação dada no enunciado' },
          { v: `Nada se pode concluir.`, nome: 'Ignorar o modus tollens e supor que não há conclusão' },
          { v: `Se ${c.pn}, então ${c.qn}.`, nome: 'Responder a inversa em vez da conclusão' }
        ],
        resolucao: [
          `Regra: p → q verdadeira e ~q verdadeira ⟹ **~p** (modus tollens).`,
          `Se ${c.p} fosse verdade, ${c.q} teria de acontecer — e o enunciado diz que não aconteceu.`,
          `Conclusão: **${cap(c.pn)}.**`
        ]
      };
    } }
  ];

  /* ----------------------------------------------- 9. médias / estatística */

  G.estatistica = [
    { nivel: 1, nome: 'média ponderada', f(rng) {
      const pesos = shuffle(rng, [1, 2, 3]);
      const n = [ri(rng, 40, 100) / 10, ri(rng, 40, 100) / 10, ri(rng, 40, 100) / 10];
      const somaP = pesos[0] + pesos[1] + pesos[2];
      const prod = n[0] * pesos[0] + n[1] * pesos[1] + n[2] * pesos[2];
      const correta = prod / somaP;
      return {
        enunciado: `Um concurso tem três provas com pesos ${pesos[0]}, ${pesos[1]} e ${pesos[2]}. A candidata tirou ${numBR(n[0], 1)}, ${numBR(n[1], 1)} e ${numBR(n[2], 1)}, respectivamente. Qual a nota final?`,
        correta, fmt: 'nota', max: 10,
        erros: [
          { v: (n[0] + n[1] + n[2]) / 3, nome: 'Ignorar os pesos e tirar média simples' },
          { v: prod / 3, nome: 'Dividir pelo número de provas em vez da soma dos pesos' },
          { v: (n[0] + n[1] + n[2]) / somaP, nome: 'Dividir a soma simples pela soma dos pesos' },
          { v: prod / (somaP + 1), nome: 'Errar a soma dos pesos' },
          { v: Math.max(n[0], n[1], n[2]), nome: 'Responder a maior nota' }
        ],
        resolucao: [
          `Numerador: ${numBR(n[0], 1)}×${pesos[0]} + ${numBR(n[1], 1)}×${pesos[1]} + ${numBR(n[2], 1)}×${pesos[2]} = **${numBR(prod, 2)}**.`,
          `Denominador: soma dos **pesos** = ${pesos[0]} + ${pesos[1]} + ${pesos[2]} = **${somaP}**.`,
          `Nota = ${numBR(prod, 2)} ÷ ${somaP} = **${numBR(correta, 2)}**. Média simples daria ${numBR((n[0] + n[1] + n[2]) / 3, 2)} — e é a alternativa mais marcada.`
        ]
      };
    } },

    { nivel: 2, nome: 'mediana', f(rng) {
      const qtd = pick(rng, [7, 8]);
      const lista = [];
      for (let i = 0; i < qtd; i++) lista.push(ri(rng, 2, 40));
      const ord = lista.slice().sort((x, y) => x - y);
      const meio = qtd % 2 ? ord[(qtd - 1) / 2] : (ord[qtd / 2 - 1] + ord[qtd / 2]) / 2;
      const media = lista.reduce((a, b) => a + b, 0) / qtd;
      return {
        enunciado: `Os atendimentos diários de um posto foram: ${lista.join(', ')}. Qual é a **mediana** dessa série?`,
        correta: meio, fmt: 'num',
        erros: [
          { v: media, nome: 'Confundir mediana com média aritmética' },
          { v: lista[Math.floor(qtd / 2)], nome: 'Pegar o valor central sem ordenar a série antes' },
          { v: (Math.min(...lista) + Math.max(...lista)) / 2, nome: 'Tirar a média entre o menor e o maior valor' },
          { v: Math.max(...lista), nome: 'Responder o maior valor da série' },
          { v: qtd % 2 ? ord[(qtd + 1) / 2] : ord[qtd / 2], nome: 'Errar a posição central da série ordenada' }
        ],
        resolucao: [
          `Ordene primeiro — sempre: ${ord.join(', ')}.`,
          qtd % 2
            ? `Com ${qtd} valores (ímpar), a mediana é o ${(qtd + 1) / 2}º termo: **${FMT.num(meio)}**.`
            : `Com ${qtd} valores (par), é a média dos dois centrais: (${ord[qtd / 2 - 1]} + ${ord[qtd / 2]}) ÷ 2 = **${FMT.num(meio)}**.`,
          `A média da série é ${numBR(media, 2)}. Mediana e média só coincidem em distribuição simétrica — a banca escolhe séries onde elas divergem.`
        ]
      };
    } },

    { nivel: 2, nome: 'média após inclusão de elemento', f(rng) {
      const n = pick(rng, [9, 14, 19, 24]);
      const M = ri(rng, 50, 80) / 10;
      const x = ri(rng, 20, 100) / 10;
      const correta = (n * M + x) / (n + 1);
      return {
        enunciado: `A média das notas de ${n} candidatos é ${numBR(M, 1)}. Um ${n + 1}º candidato, com nota ${numBR(x, 1)}, entra no cálculo. Qual a nova média?`,
        correta, fmt: 'nota', max: 10,
        erros: [
          { v: (M + x) / 2, nome: 'Tirar a média entre a média antiga e o novo valor' },
          { v: (n * M + x) / n, nome: 'Esquecer de contar o novo elemento no denominador' },
          { v: M + x / n, nome: 'Somar o novo valor dividido pelo grupo antigo' },
          { v: M, nome: 'Supor que uma nota isolada não muda a média' },
          { v: (n * M + x) / (n + 2), nome: 'Errar o tamanho do novo grupo' }
        ],
        resolucao: [
          `Recupere a **soma**, não trabalhe com médias: soma antiga = ${n} × ${numBR(M, 1)} = **${numBR(n * M, 1)}**.`,
          `Nova soma = ${numBR(n * M, 1)} + ${numBR(x, 1)} = ${numBR(n * M + x, 1)}, agora com ${n + 1} candidatos.`,
          `Nova média = ${numBR(n * M + x, 1)} ÷ ${n + 1} = **${numBR(correta, 2)}**. Média de médias (${numBR((M + x) / 2, 2)}) só valeria se os dois grupos tivessem o mesmo tamanho.`
        ]
      };
    } }
  ];

  /* --------------------- 10. números: MMC, MDC, divisibilidade, potências */

  G.numeros = [
    { nivel: 1, nome: 'MMC aplicado (encontros)', f(rng) {
      const [a, b, c] = pickN(rng, [6, 8, 9, 10, 12, 15, 18, 20], 3);
      const correta = mmc(mmc(a, b), c);
      return {
        enunciado: `Três ônibus saem juntos do terminal às 6h e partem, respectivamente, a cada ${a}, ${b} e ${c} minutos. Depois de quantos minutos os três partirão juntos novamente?`,
        correta, fmt: 'minutos',
        erros: [
          { v: mdc(mdc(a, b), c), nome: 'Trocar MMC por MDC' },
          { v: a * b * c, nome: 'Multiplicar os intervalos em vez de tomar o MMC' },
          { v: a + b + c, nome: 'Somar os intervalos' },
          { v: Math.max(a, b, c), nome: 'Usar o maior intervalo como resposta' },
          { v: correta * 2, nome: 'Responder o segundo encontro em vez do primeiro' }
        ],
        resolucao: [
          `“Voltam a coincidir” → **MMC**. “Repartir em partes iguais” → MDC. É a única decisão da questão.`,
          `MMC(${a}, ${b}, ${c}) = **${correta}**.`,
          `${correta} minutos depois das 6h: **${Math.floor(correta / 60) > 0 ? Math.floor(correta / 60) + 'h' + String(correta % 60).padStart(2, '0') : correta + ' min'}** contados a partir da saída. O produto ${FMT.int(a * b * c)} também é múltiplo comum, mas não é o menor.`
        ]
      };
    } },

    { nivel: 2, nome: 'MDC aplicado (partes iguais)', f(rng) {
      const g = pick(rng, [6, 8, 9, 12, 15]);
      const [m1, m2, m3] = pickN(rng, [4, 5, 6, 7, 8, 9, 10, 11], 3);
      const L = [g * m1, g * m2, g * m3];
      const correta = mdc(mdc(L[0], L[1]), L[2]);
      return {
        enunciado: `Um almoxarifado tem três rolos de cabo com ${L[0]} m, ${L[1]} m e ${L[2]} m. Eles serão cortados em pedaços iguais, do **maior** tamanho possível, sem sobra. Qual o tamanho de cada pedaço?`,
        correta, fmt: 'metros',
        erros: [
          { v: mmc(mmc(L[0], L[1]), L[2]), nome: 'Trocar MDC por MMC' },
          { v: Math.min(L[0], L[1], L[2]), nome: 'Usar o menor rolo como tamanho do pedaço' },
          { v: (L[0] + L[1] + L[2]) / 3, nome: 'Tirar a média dos comprimentos' },
          { v: correta / 2, nome: 'Dividir o MDC e perder a condição de “maior possível”' },
          { v: (L[0] + L[1] + L[2]) / correta, nome: 'Responder a quantidade de pedaços em vez do tamanho' }
        ],
        resolucao: [
          `Cortar sem sobra exige um divisor **comum** dos três comprimentos; “maior possível” exige o **máximo**.`,
          `MDC(${L[0]}, ${L[1]}, ${L[2]}) = **${correta} m**.`,
          `Saem ${L[0] / correta} + ${L[1] / correta} + ${L[2] / correta} = ${(L[0] + L[1] + L[2]) / correta} pedaços. Se a pergunta fosse “quantos pedaços”, a resposta seria ${(L[0] + L[1] + L[2]) / correta} — leia o que se pede.`
        ]
      };
    } },

    { nivel: 3, nome: 'algarismo das unidades de potência', f(rng) {
      const base = pick(rng, [2, 3, 7, 8, 4, 9]);
      const exp = ri(rng, 20, 99);
      const ciclos = { 2: [2, 4, 8, 6], 3: [3, 9, 7, 1], 7: [7, 9, 3, 1], 8: [8, 4, 2, 6], 4: [4, 6], 9: [9, 1] };
      const ciclo = ciclos[base];
      const correta = ciclo[(exp - 1) % ciclo.length];
      const opcoes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => d !== correta);
      return {
        enunciado: `Qual é o algarismo das **unidades** de ${base}^${exp}?`,
        correta, fmt: 'int', max: 9,
        erros: [
          { v: ciclo[exp % ciclo.length], nome: 'Errar a posição no ciclo (usar o resto sem ajustar para base 1)' },
          { v: base, nome: 'Repetir o algarismo da base' },
          { v: ciclo[ciclo.length - 1], nome: 'Usar sempre o último termo do ciclo' },
          { v: pick(rng, opcoes), nome: 'Chutar um algarismo fora do ciclo da base' },
          { v: pick(rng, opcoes), nome: 'Chutar um algarismo fora do ciclo da base' }
        ],
        resolucao: [
          `As unidades de ${base}^n repetem em ciclo de ${ciclo.length}: ${ciclo.join(', ')} — e voltam ao começo.`,
          `${exp} ÷ ${ciclo.length} deixa resto ${exp % ciclo.length}${exp % ciclo.length === 0 ? ' (resto zero → último termo do ciclo)' : ''}.`,
          `Logo o algarismo é **${correta}**. A conta é de resto, não de potência: nenhuma calculadora de prova aguenta ${base}^${exp}.`
        ]
      };
    } }
  ];

  /* =============================== catálogo ============================== */

  /* Taxonomia dos 18 capítulos do material (programa BB / CEF), condensada em
     14 eixos. Cada tópico é servido por geradores, pelo banco real, ou por
     ambos — a coluna que falta de um lado é coberta pelo outro. */
  const TOPICOS = [
    { id: 'numeros', nome: 'Números, frações e potências', sigla: 'Núm' },
    { id: 'equacoes', nome: 'Equações, sistemas e funções', sigla: 'Eq' },
    { id: 'regratres', nome: 'Razão, proporção e regra de três', sigla: 'R3' },
    { id: 'porcentagem', nome: 'Porcentagem', sigla: '%' },
    { id: 'progressoes', nome: 'Progressões (PA e PG)', sigla: 'PA' },
    { id: 'combinatoria', nome: 'Análise combinatória', sigla: 'AC' },
    { id: 'probabilidade', nome: 'Probabilidade', sigla: 'Pr' },
    { id: 'conjuntos', nome: 'Conjuntos e diagramas', sigla: 'Cj' },
    { id: 'estatistica', nome: 'Médias e estatística', sigla: 'Est' },
    { id: 'jurossimples', nome: 'Juros simples', sigla: 'JS' },
    { id: 'juroscompostos', nome: 'Juros compostos', sigla: 'JC' },
    { id: 'descontos', nome: 'Descontos simples e compostos', sigla: 'Desc' },
    { id: 'financeiro', nome: 'Cálculo financeiro e amortização', sigla: 'Fin' },
    { id: 'logica', nome: 'Raciocínio lógico', sigla: 'RL' }
  ];

  const porId = {};
  TOPICOS.forEach((t) => { porId[t.id] = t; });

  const NIVEL_NOME = { 1: 'básica', 2: 'média', 3: 'difícil' };

  let contador = 0;

  /* ---------------------------- banco real extraído do PDF do candidato ---
     Formato compacto vindo de banco.js: t=tópico n=nível e=enunciado
     a=alternativas g=índice do gabarito b=banca r=linhas da resolução.
     O índice é montado uma única vez, na primeira consulta.               */

  let indiceReal = null;

  function indexarBancoReal() {
    if (indiceReal) return indiceReal;
    indiceReal = {};
    const bruto = global.BANCO_REAL_BRUTO;
    if (!Array.isArray(bruto)) return indiceReal;
    const cfg = global.CONFIG || {};
    for (const q of bruto) {
      if (!porId[q.t]) continue;
      /* rev:1 = enunciado e gabarito válidos, mas a resolução do PDF não
         reconstrói e foi retirada. Fica fora por padrão: questão sem resolução
         não é o que o comprador pagou. Ligável como treino seco no config. */
      if (q.rev && !cfg.incluirSemResolucao) continue;
      (indiceReal[q.t] || (indiceReal[q.t] = [])).push(q);
    }
    return indiceReal;
  }

  function totalReal(topicoId) {
    const idx = indexarBancoReal();
    return (idx[topicoId] || []).length;
  }

  function doBancoReal(rng, topicoId, nivel) {
    const idx = indexarBancoReal();
    let pool = idx[topicoId] || [];
    if (!pool.length) return null;
    if (nivel) {
      const doNivel = pool.filter((q) => q.n === nivel);
      if (doNivel.length) pool = doNivel;
    }
    const q = pick(rng, pool);
    const alts = shuffle(rng, q.a.map((txt, i) => ({
      txt,
      ok: i === q.g,
      erro: i === q.g ? null : 'Alternativa incorreta da prova original'
    }))).map((a, i) => Object.assign(a, { letra: 'ABCDE'[i] }));
    return {
      id: 'r' + (++contador),
      topico: topicoId,
      topicoNome: porId[topicoId].nome,
      nivel: q.n || 2,
      nivelNome: NIVEL_NOME[q.n || 2],
      gerador: q.b ? 'prova: ' + q.b : 'questão de prova',
      banca: q.b || '',
      enunciado: q.enunciado || q.e,
      alternativas: alts,
      resolucao: q.r || [],
      resolucaoBruta: true,
      fonte: 'real'
    };
  }

  function gerar(topicoId, nivel, semente) {
    if (!porId[topicoId]) topicoId = TOPICOS[0].id;
    const rng = mulberry32(semente != null ? semente : Math.floor(Math.random() * 2 ** 31));

    const temGerador = (G[topicoId] || []).length > 0;
    const temReal = totalReal(topicoId) > 0;

    /* Sem gerador para o tópico, o banco real é a única fonte — e mesmo onde
       há gerador, a questão de prova tem precedência em 55% dos sorteios:
       é o material do candidato, não um exercício sintético. */
    if (temReal && (!temGerador || rng() < 0.55)) {
      const real = doBancoReal(rng, topicoId, nivel);
      if (real) return real;
    }

    const lista = G[topicoId] || [];
    const candidatos = nivel ? lista.filter((g) => g.nivel === nivel) : lista;
    const fonte = candidatos.length ? candidatos : lista;

    for (let tentativa = 0; fonte.length && tentativa < 24; tentativa++) {
      const g = pick(rng, fonte);
      let item = null;
      try { item = g.f(rng); } catch (e) { item = null; }
      if (!item) continue;
      const alternativas = montarAlternativas(rng, item);
      if (alternativas.length < 5) continue;
      return {
        id: 'g' + (++contador),
        topico: topicoId,
        topicoNome: porId[topicoId].nome,
        nivel: g.nivel,
        nivelNome: NIVEL_NOME[g.nivel],
        gerador: g.nome,
        enunciado: item.enunciado,
        alternativas,
        resolucao: item.resolucao,
        fonte: 'gerado'
      };
    }

    const real = doBancoReal(rng, topicoId, null);
    if (real) return real;
    return gerar(TOPICOS[0].id, null, Math.floor(Math.random() * 2 ** 31));
  }

  global.MOTOR = {
    topicos: TOPICOS,
    porId,
    gerar,
    totalReal,
    totalGeradores: (id) => (G[id] || []).length,
    nivelNome: NIVEL_NOME,
    fmt: FMT,
    _rng: mulberry32
  };
})(window);
