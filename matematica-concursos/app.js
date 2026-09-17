/* Ponto Cego — estado, telas e gamificação.
 * Progresso fica no navegador (localStorage), sobrevive a recarregamento e a
 * republicação da página, e não sai deste dispositivo.
 */
(function () {
  'use strict';

  const M = window.MOTOR;
  const CHAVE = 'pontocego.v1';
  const CORTE = 70;                 // nota de corte de referência, em %

  /* ------------------------------------------------------------- patentes */

  const PATENTES = [
    { p: 0, nome: 'Inscrito' },
    { p: 150, nome: 'Treineiro' },
    { p: 400, nome: 'Concurseiro' },
    { p: 900, nome: 'Linha de Corte' },
    { p: 1800, nome: 'Classificável' },
    { p: 3200, nome: 'Aprovado' },
    { p: 5200, nome: 'Primeiro Lugar' }
  ];

  const CONQUISTAS = [
    { id: 'mapa', nome: 'Mapa aberto', desc: 'Concluiu o diagnóstico completo', teste: (e) => e.diagnosticoFeito },
    { id: 'semrasura', nome: 'Sem rasura', desc: '10 acertos seguidos', teste: (e) => e.melhorSeq >= 10 },
    { id: 'relogio', nome: 'Contra o relógio', desc: '20 acertos em menos de 25 segundos cada', teste: (e) => e.rapidas >= 20 },
    { id: 'corte', nome: 'Acima da linha', desc: 'Simulado com 70% ou mais', teste: (e) => e.historico.some((h) => h.modo === 'simulado' && h.total && h.acertos / h.total >= 0.7) },
    { id: 'limpo', nome: 'Gabarito limpo', desc: 'Simulado sem nenhum erro', teste: (e) => e.historico.some((h) => h.modo === 'simulado' && h.total && h.acertos === h.total) },
    { id: 'sete', nome: 'Sete dias', desc: 'Ofensiva de 7 dias', teste: (e) => ofensiva(e) >= 7 },
    { id: 'mil', nome: 'Mil líquidos', desc: '1.000 pontos acumulados', teste: (e) => e.pontos >= 1000 },
    { id: 'virada', nome: 'Ponto cego fechado', desc: 'Um tópico saiu de menos de 40% para mais de 70%', teste: (e) => (e.viradas || []).length > 0 },
    { id: 'radar', nome: 'Radar sem buraco', desc: 'Nenhum tópico medido abaixo de 50%', teste: (e) => M.topicos.every((t) => (e.medido[t.id] || 0) >= 3 && (e.dominio[t.id] || 0) >= 50) }
  ];

  /* --------------------------------------------------------------- estado */

  function novoEstado() {
    return {
      versao: 1, pontos: 0, dominio: {}, medido: {}, minimo: {}, erros: {},
      conquistas: [], dias: [], viradas: [], seqAcertos: 0, melhorSeq: 0,
      rapidas: 0, respondidas: 0, acertos: 0, tempoTotal: 0, simulados: 0,
      diagnosticoFeito: false, historico: []
    };
  }

  let E = novoEstado();

  function carregar() {
    try {
      const cru = localStorage.getItem(CHAVE);
      if (cru) E = Object.assign(novoEstado(), JSON.parse(cru));
    } catch (e) { /* navegação privada, storage bloqueado: segue com estado limpo */ }
  }

  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(E)); } catch (e) { /* idem */ }
  }

  /* ------------------------------------------------------------ utilitários */

  const $ = (id) => document.getElementById(id);
  const hoje = () => new Date().toISOString().slice(0, 10);

  function escapa(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* **negrito** → <strong>, o resto é escapado */
  function md(s) {
    return escapa(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  function fmtTempo(seg) {
    const m = Math.floor(seg / 60), s = Math.floor(seg % 60);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function dominioDe(t) { return E.dominio[t] != null ? E.dominio[t] : 0; }
  function foiMedido(t) { return (E.medido[t] || 0) > 0; }

  function patenteAtual() {
    let i = 0;
    for (let k = 0; k < PATENTES.length; k++) if (E.pontos >= PATENTES[k].p) i = k;
    return { i, atual: PATENTES[i], prox: PATENTES[i + 1] || null };
  }

  function ofensiva(e) {
    const dias = (e.dias || []).slice().sort();
    if (!dias.length) return 0;
    const ultimo = dias[dias.length - 1];
    const d0 = new Date(hoje() + 'T00:00:00');
    const du = new Date(ultimo + 'T00:00:00');
    const gap = Math.round((d0 - du) / 86400000);
    if (gap > 1) return 0;                     // ofensiva quebrada
    let n = 1;
    for (let k = dias.length - 1; k > 0; k--) {
      const a = new Date(dias[k] + 'T00:00:00');
      const b = new Date(dias[k - 1] + 'T00:00:00');
      if (Math.round((a - b) / 86400000) === 1) n++; else break;
    }
    return n;
  }

  function piores(n) {
    return M.topicos.slice()
      .map((t) => ({ t, d: dominioDe(t.id), m: E.medido[t.id] || 0 }))
      .sort((a, b) => (a.d - b.d) || (a.m - b.m))
      .slice(0, n)
      .map((x) => x.t);
  }

  function taxaAcerto() {
    return E.respondidas ? Math.round(E.acertos / E.respondidas * 100) : null;
  }

  function classeBarra(v) { return v < 40 ? 'baixo' : v < CORTE ? 'medio' : 'alto'; }

  function balao(texto, tipo) {
    const cx = $('flutuante');
    const b = document.createElement('div');
    b.className = 'balao' + (tipo ? ' ' + tipo : '');
    b.textContent = texto;
    cx.appendChild(b);
    setTimeout(() => b.remove(), 1600);
  }

  /* --------------------------------------------------------------- sessão */

  let S = null;            // sessão corrente
  let relogio = null;

  const ROTULO_MODO = {
    diagnostico: 'Diagnóstico',
    cego: 'Ponto Cego',
    simulado: 'Simulado',
    topico: 'Treino de tópico'
  };

  function montarFila(modo, topicoId) {
    const fila = [];
    if (modo === 'diagnostico') {
      M.topicos.forEach((t) => fila.push(M.gerar(t.id, null)));
    } else if (modo === 'topico') {
      for (let i = 0; i < 10; i++) {
        const d = dominioDe(topicoId);
        const nivel = d < 40 ? 1 : d < CORTE ? 2 : 3;
        fila.push(M.gerar(topicoId, i % 3 === 2 ? null : nivel));
      }
    } else if (modo === 'cego') {
      const alvo = piores(3);
      for (let i = 0; i < 10; i++) {
        const t = alvo[i % alvo.length];
        const d = dominioDe(t.id);
        fila.push(M.gerar(t.id, d < 40 ? 1 : 2));
      }
    } else {
      const todos = M.topicos.slice();
      for (let i = 0; i < 10; i++) {
        const t = todos[Math.floor(Math.random() * todos.length)];
        fila.push(M.gerar(t.id, null));
      }
    }
    return fila;
  }

  function iniciarSessao(modo, topicoId) {
    S = {
      modo, topicoId,
      fila: montarFila(modo, topicoId),
      i: 0,
      respostas: [],
      marcada: null,
      confirmada: false,
      inicioQuestao: Date.now(),
      inicioSessao: Date.now(),
      pontosGanhos: 0,
      dominioAntes: {},
      penalidade: modo === 'simulado' && $('optPenalidade').checked,
      limite: modo === 'simulado' ? 25 * 60 : null
    };
    M.topicos.forEach((t) => { S.dominioAntes[t.id] = dominioDe(t.id); });
    mostrarTela('questao');
    renderQuestao();
    iniciarRelogio();
  }

  function iniciarRelogio() {
    pararRelogio();
    relogio = setInterval(() => {
      if (!S) return pararRelogio();
      const decorrido = (Date.now() - S.inicioQuestao) / 1000;
      const cr = $('qCrono');
      if (S.limite) {
        const resta = S.limite - (Date.now() - S.inicioSessao) / 1000;
        if (resta <= 0) { finalizar(true); return; }
        cr.textContent = fmtTempo(resta);
        cr.classList.toggle('apertado', resta < 120);
      } else {
        cr.textContent = fmtTempo(decorrido);
        cr.classList.remove('apertado');
      }
    }, 500);
  }

  function pararRelogio() {
    if (relogio) { clearInterval(relogio); relogio = null; }
  }

  function questaoAtual() { return S.fila[S.i]; }

  function renderQuestao() {
    const q = questaoAtual();
    S.marcada = null;
    S.confirmada = false;
    S.inicioQuestao = Date.now();

    $('qTopico').textContent = q.topicoNome;
    $('qNivel').textContent = q.fonte === 'real'
      ? (q.banca ? q.banca : 'questão de prova')
      : 'nível ' + q.nivelNome;
    $('qContador').textContent = (S.i + 1) + '/' + S.fila.length;
    $('qProgresso').style.width = (S.i / S.fila.length * 100) + '%';
    $('qEnunciado').innerHTML = md(q.enunciado);

    const ul = $('qAlternativas');
    ul.innerHTML = '';
    q.alternativas.forEach((a) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'alt';
      b.dataset.letra = a.letra;
      const longa = a.txt.length > 34;
      b.innerHTML = '<span class="bolha">' + a.letra + '</span>' +
        '<span class="alt-texto' + (longa ? ' longa' : '') + '">' + escapa(a.txt) + '</span>';
      b.addEventListener('click', () => marcar(a.letra));
      li.appendChild(b);
      ul.appendChild(li);
    });

    $('qFeedback').hidden = true;
    $('btnConfirmar').disabled = true;
    $('btnConfirmar').textContent = 'Confirmar';
    $('telas').scrollTop = 0;
  }

  function marcar(letra) {
    if (S.confirmada) return;
    S.marcada = letra;
    document.querySelectorAll('#qAlternativas .alt').forEach((b) => {
      b.classList.toggle('marcada', b.dataset.letra === letra);
    });
    $('btnConfirmar').disabled = false;
  }

  function confirmar() {
    if (!S) return;
    if (S.confirmada) { avancar(); return; }
    if (!S.marcada) return;

    const q = questaoAtual();
    const alt = q.alternativas.find((a) => a.letra === S.marcada);
    const certa = q.alternativas.find((a) => a.ok);
    const acertou = !!alt.ok;
    const tempo = (Date.now() - S.inicioQuestao) / 1000;

    S.confirmada = true;
    S.respostas.push({
      topico: q.topico, letra: S.marcada, certa: certa.letra,
      acertou, tempo, erro: acertou ? null : alt.erro, nivel: q.nivel
    });

    // contabilidade
    const antes = dominioDe(q.topico);
    const ganhos = registrar(q, acertou, tempo, antes);
    S.pontosGanhos += ganhos;

    document.querySelectorAll('#qAlternativas .alt').forEach((b) => { b.disabled = true; });

    /* No simulado o gabarito não aparece: a prova não te conta o resultado
       questão por questão. Só o cartão-resposta no fim. */
    if (S.modo === 'simulado') {
      balao('marcada');
      avancar();
      return;
    }

    document.querySelectorAll('#qAlternativas .alt').forEach((b) => {
      if (b.dataset.letra === certa.letra) b.classList.add('certa');
      else if (b.dataset.letra === S.marcada) b.classList.add('errada');
    });

    mostrarFeedback(q, acertou, alt, ganhos);
    balao(acertou ? '+' + ganhos + ' líquidos' : 'erro registrado', acertou ? 'ok' : 'no');
    $('btnConfirmar').textContent = S.i + 1 >= S.fila.length ? 'Ver resultado' : 'Próxima';
  }

  function mostrarFeedback(q, acertou, alt, ganhos) {
    const fb = $('qFeedback');
    fb.hidden = false;
    fb.className = 'feedback ' + (acertou ? 'ok' : 'nao');
    $('fbCabeca').textContent = acertou
      ? 'Correta — +' + ganhos + ' pontos líquidos'
      : 'Errada — a resposta era ' + q.alternativas.find((a) => a.ok).letra;

    const eErro = $('fbErro');
    if (!acertou && alt.erro) {
      eErro.hidden = false;
      eErro.innerHTML = '<strong>Seu erro:</strong> ' + escapa(alt.erro);
    } else {
      eErro.hidden = true;
    }

    const ol = $('fbResolucao');
    ol.innerHTML = '';
    (q.resolucao || []).forEach((passo) => {
      const li = document.createElement('li');
      if (q.resolucaoBruta) {
        li.innerHTML = '<span class="m">' + escapa(passo) + '</span>';
      } else {
        li.innerHTML = md(passo);
      }
      ol.appendChild(li);
    });
    if (!(q.resolucao || []).length) {
      const li = document.createElement('li');
      li.textContent = 'Sem resolução registrada para esta questão.';
      ol.appendChild(li);
    }
  }

  function registrar(q, acertou, tempo, antes) {
    const t = q.topico;

    // domínio: média móvel puxada pelo nível da questão
    const alpha = 0.18 + 0.06 * q.nivel;
    const depois = Math.max(0, Math.min(100, antes + alpha * ((acertou ? 100 : 0) - antes)));
    E.dominio[t] = Math.round(depois * 10) / 10;
    E.medido[t] = (E.medido[t] || 0) + 1;
    E.minimo[t] = E.minimo[t] == null ? E.dominio[t] : Math.min(E.minimo[t], E.dominio[t]);
    if (E.dominio[t] > 70 && E.minimo[t] < 40 && !(E.viradas || []).includes(t)) {
      (E.viradas || (E.viradas = [])).push(t);
    }

    E.respondidas++;
    E.tempoTotal += tempo;
    if (acertou) {
      E.acertos++;
      E.seqAcertos++;
      E.melhorSeq = Math.max(E.melhorSeq, E.seqAcertos);
      if (tempo < 25) E.rapidas++;
    } else {
      E.seqAcertos = 0;
      const nome = q.alternativas.find((a) => a.letra === S.marcada).erro;
      if (nome) {
        const reg = E.erros[nome] || { n: 0, topico: t };
        reg.n++; reg.topico = t;
        E.erros[nome] = reg;
      }
    }

    let ganhos = 0;
    if (acertou) {
      ganhos = 10 + 5 * q.nivel + (tempo < 25 ? 5 : 0);
      if (antes < 50) ganhos = Math.round(ganhos * 1.5);   // bônus de ponto cego
      E.pontos += ganhos;
    }

    const d = hoje();
    if (!E.dias.includes(d)) E.dias.push(d);
    salvar();
    return ganhos;
  }

  function avancar() {
    if (S.i + 1 >= S.fila.length) return finalizar(false);
    S.i++;
    renderQuestao();
  }

  function finalizar(porTempo) {
    pararRelogio();
    // guarda o que a sessão viu: S é zerado no fim desta função
    respostasDaSessao = S.respostas.slice();
    dominioAntesDaSessao = Object.assign({}, S.dominioAntes);
    const total = S.respostas.length;
    const acertos = S.respostas.filter((r) => r.acertou).length;

    if (S.modo === 'diagnostico') E.diagnosticoFeito = true;
    if (S.modo === 'simulado') E.simulados++;
    E.historico.push({
      data: hoje(), modo: S.modo, acertos, total,
      pontos: S.pontosGanhos, tempo: Math.round((Date.now() - S.inicioSessao) / 1000)
    });
    if (E.historico.length > 60) E.historico = E.historico.slice(-60);

    const novas = CONQUISTAS.filter((c) => !E.conquistas.includes(c.id) && c.teste(E));
    novas.forEach((c) => E.conquistas.push(c.id));
    salvar();

    renderResultado(porTempo, novas);
    mostrarTela('resultado');
    S = null;
  }

  /* -------------------------------------------------------------- resultado */

  function renderResultado(porTempo, novas) {
    const hist = E.historico[E.historico.length - 1];
    const total = hist.total, acertos = hist.acertos;
    const pct = total ? Math.round(acertos / total * 100) : 0;

    $('resModo').textContent = ROTULO_MODO[hist.modo] || 'Treino';
    $('resPlacar').textContent = acertos + ' de ' + total;

    const linhas = [];
    if (porTempo) linhas.push('O tempo acabou — o que não foi marcado não conta.');
    linhas.push(pct + '% de aproveitamento.');
    if (hist.modo === 'simulado') {
      const liq = S && S.penalidade ? acertos - (total - acertos) : acertos;
      if (S && S.penalidade) linhas.push('Com penalidade: ' + liq + ' ponto(s) líquido(s).');
      linhas.push(pct >= CORTE
        ? 'Acima da linha de corte de referência (' + CORTE + '%).'
        : 'Abaixo da linha de corte de referência (' + CORTE + '%). Faltaram ' + (Math.ceil(total * CORTE / 100) - acertos) + ' acerto(s).');
    }
    linhas.push('+' + hist.pontos + ' pontos líquidos.');
    $('resLinha').textContent = linhas.join(' ');

    // cartão-resposta
    const g = $('resGabarito');
    g.innerHTML = '';
    respostasDaSessao.forEach((r) => {
      const d = document.createElement('div');
      d.className = 'marca ' + (r.acertou ? 'ok' : 'no');
      d.textContent = r.letra;
      d.title = r.acertou ? 'Acertou' : 'Certa era ' + r.certa;
      g.appendChild(d);
    });

    // movimento no radar
    const dl = $('resDeltas');
    dl.innerHTML = '';
    const tocados = {};
    respostasDaSessao.forEach((r) => { tocados[r.topico] = true; });
    const chaves = Object.keys(tocados);
    if (!chaves.length) dl.innerHTML = '<li class="vazio-msg">Nenhum tópico medido.</li>';
    chaves.forEach((t) => {
      const antes = dominioAntesDaSessao[t] || 0;
      const agora = dominioDe(t);
      const dif = Math.round((agora - antes) * 10) / 10;
      const li = document.createElement('li');
      li.innerHTML = escapa(M.porId[t].nome) + ' — <b class="' + (dif > 0 ? 'sobe' : dif < 0 ? 'cai' : '') + '">' +
        (dif > 0 ? '+' : '') + dif.toLocaleString('pt-BR') + '</b> → ' + Math.round(agora) + '%';
      dl.appendChild(li);
    });

    // erros da sessão
    const el = $('resErros');
    el.innerHTML = '';
    const errosSessao = {};
    respostasDaSessao.forEach((r) => {
      if (r.erro) errosSessao[r.erro] = (errosSessao[r.erro] || 0) + 1;
    });
    const listaErros = Object.keys(errosSessao);
    if (!listaErros.length) {
      el.innerHTML = '<li class="vazio-msg">Nenhum erro nesta rodada.</li>';
    } else {
      listaErros.forEach((nome) => {
        const li = document.createElement('li');
        li.innerHTML = '<strong>' + escapa(nome) + '</strong>' +
          (errosSessao[nome] > 1 ? ' (' + errosSessao[nome] + '×)' : '');
        el.appendChild(li);
      });
    }

    // conquistas
    const box = $('resConquistasBox');
    const cl = $('resConquistas');
    cl.innerHTML = '';
    box.hidden = !novas.length;
    novas.forEach((c) => {
      const li = document.createElement('li');
      li.className = 'conquista';
      li.innerHTML = '<b>' + escapa(c.nome) + '</b><span>' + escapa(c.desc) + '</span>';
      cl.appendChild(li);
    });

    renderTopo();
  }

  /* guarda o que a sessão viu, porque S é zerado ao finalizar */
  let respostasDaSessao = [];
  let dominioAntesDaSessao = {};

  /* ------------------------------------------------------------------ topo */

  function renderTopo() {
    const { atual, prox } = patenteAtual();
    $('patenteNome').textContent = atual.nome;
    $('mPontos').textContent = E.pontos.toLocaleString('pt-BR');
    $('mOfensiva').textContent = ofensiva(E) + 'd';
    const ta = taxaAcerto();
    $('mAcerto').textContent = ta == null ? '—' : ta + '%';

    if (prox) {
      const faixa = prox.p - atual.p;
      const dentro = E.pontos - atual.p;
      $('patenteBarra').style.width = Math.min(100, dentro / faixa * 100) + '%';
      $('patenteFaltam').textContent = (prox.p - E.pontos).toLocaleString('pt-BR') + ' pontos para ' + prox.nome;
    } else {
      $('patenteBarra').style.width = '100%';
      $('patenteFaltam').textContent = 'Patente máxima alcançada';
    }
  }

  /* ---------------------------------------------------------------- painel */

  function renderPainel() {
    const totReal = M.topicos.reduce((s, t) => s + M.totalReal(t.id), 0);
    const cont = $('tContagem');
    if (cont) cont.textContent = totReal.toLocaleString('pt-BR');

    const medidos = M.topicos.filter((t) => foiMedido(t.id));
    const cego = medidos.length ? piores(1)[0] : null;

    if (!E.diagnosticoFeito && !medidos.length) {
      $('cegoTopico').textContent = 'Sem medição ainda';
      $('cegoTexto').textContent = 'Rode o diagnóstico: ' + M.topicos.length +
        ' questões, uma de cada tópico. No fim você sabe exatamente onde está perdendo ponto.';
      $('btnCegoPrincipal').textContent = 'Rodar diagnóstico';
      $('btnCegoPrincipal').dataset.modo = 'diagnostico';
    } else {
      const d = Math.round(dominioDe(cego.id));
      $('cegoTopico').textContent = cego.nome;
      $('cegoTexto').textContent = 'Domínio de ' + d + '% — ' + (d < CORTE
        ? 'abaixo da linha de corte. São ' + (CORTE - d) + ' pontos percentuais de prejuízo no seu pior eixo.'
        : 'seu pior eixo já está acima do corte. A partir daqui o ganho vem de velocidade e nível 3.');
      $('btnCegoPrincipal').textContent = 'Treinar 10 no ponto cego';
      $('btnCegoPrincipal').dataset.modo = 'cego';
    }

    const topo = Object.keys(E.erros).sort((a, b) => E.erros[b].n - E.erros[a].n)[0];
    if (topo) {
      $('erroTopo').textContent = topo;
      $('erroTopoCont').textContent = E.erros[topo].n + ' ' +
        (E.erros[topo].n === 1 ? 'vez' : 'vezes') + ' — em ' + M.porId[E.erros[topo].topico].nome + '.';
    } else {
      $('erroTopo').textContent = 'Nenhum erro registrado ainda';
      $('erroTopoCont').textContent = 'Os erros só aparecem quando você responde.';
    }

    $('nQuestoes').textContent = E.respondidas.toLocaleString('pt-BR');
    $('nSimulados').textContent = E.simulados;
    $('nTempo').textContent = E.respondidas
      ? Math.round(E.tempoTotal / E.respondidas) + 's'
      : '—';

    listaTopicos($('listaTopicosPainel'), true);
    renderTopo();
  }

  function listaTopicos(ul, ordenar) {
    ul.innerHTML = '';
    let lista = M.topicos.slice();
    if (ordenar) lista.sort((a, b) => dominioDe(a.id) - dominioDe(b.id));
    lista.forEach((t) => {
      const v = Math.round(dominioDe(t.id));
      const medido = foiMedido(t.id);
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'linha-topico';
      b.innerHTML =
        '<span><span class="lt-nome">' + escapa(t.nome) + '</span> ' +
        '<span class="lt-sigla">' + escapa(t.sigla) + '</span></span>' +
        '<span class="lt-barra"><i class="' + classeBarra(v) + '" style="width:' + (medido ? v : 0) + '%"></i></span>' +
        '<span class="lt-valor' + (medido ? '' : ' vazio') + '">' + (medido ? v + '%' : '—') + '</span>';
      b.addEventListener('click', () => iniciarSessao('topico', t.id));
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  /* --------------------------------------------------------------- treinar */

  function renderTreinar() {
    const alvo = piores(3).map((t) => t.sigla).join(' · ');
    $('metaCego').textContent = E.respondidas
      ? 'Agora sorteando em: ' + alvo
      : 'Ainda sem medição — vai sortear qualquer tópico';

    const grade = $('gradeTopicos');
    grade.innerHTML = '';
    M.topicos.forEach((t) => {
      const v = Math.round(dominioDe(t.id));
      const reais = M.totalReal(t.id);
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip-topico';
      b.innerHTML = '<b>' + escapa(t.nome) + '</b><span>' +
        (foiMedido(t.id) ? v + '% · ' : '') +
        (reais ? reais + ' de prova' : 'geradas') + '</span>';
      b.addEventListener('click', () => iniciarSessao('topico', t.id));
      li.appendChild(b);
      grade.appendChild(li);
    });
  }

  /* ----------------------------------------------------------------- radar */

  function desenharRadar() {
    const svg = $('radarSvg');
    const cx = 170, cy = 170, R = 108;
    const ts = M.topicos;
    const n = ts.length;
    const ang = (i) => (Math.PI * 2 * i / n) - Math.PI / 2;
    const ponto = (i, r) => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r];

    let s = '';

    // anéis
    [25, 50, 75, 100].forEach((v) => {
      const pts = ts.map((_, i) => ponto(i, R * v / 100).map((x) => x.toFixed(1)).join(',')).join(' ');
      s += '<polygon points="' + pts + '" fill="none" stroke="var(--traco)" stroke-width="1"/>';
    });

    // eixos
    ts.forEach((_, i) => {
      const [x, y] = ponto(i, R);
      s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) +
        '" stroke="var(--traco)" stroke-width="1"/>';
    });

    // linha de corte
    const corte = ts.map((_, i) => ponto(i, R * CORTE / 100).map((x) => x.toFixed(1)).join(',')).join(' ');
    s += '<polygon points="' + corte + '" fill="none" stroke="var(--marcatexto)" stroke-width="1.6" stroke-dasharray="4 3"/>';

    // domínio
    const algumMedido = ts.some((t) => foiMedido(t.id));
    if (algumMedido) {
      const pts = ts.map((t, i) => ponto(i, R * Math.max(dominioDe(t.id), 1.5) / 100)
        .map((x) => x.toFixed(1)).join(',')).join(' ');
      s += '<polygon points="' + pts + '" fill="var(--caneta)" fill-opacity="0.18" stroke="var(--caneta)" stroke-width="2"/>';
      ts.forEach((t, i) => {
        const [x, y] = ponto(i, R * Math.max(dominioDe(t.id), 1.5) / 100);
        s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3" fill="var(--caneta)"/>';
      });
    } else {
      s += '<text x="' + cx + '" y="' + cy + '" text-anchor="middle" fill="var(--tinta-3)" ' +
        'font-size="11" font-family="IBM Plex Mono, monospace">sem medição</text>';
    }

    // rótulos
    ts.forEach((t, i) => {
      const [x, y] = ponto(i, R + 22);
      const a = ang(i);
      const cos = Math.cos(a);
      const anchor = Math.abs(cos) < 0.3 ? 'middle' : (cos > 0 ? 'start' : 'end');
      const v = foiMedido(t.id) ? Math.round(dominioDe(t.id)) + '%' : '—';
      s += '<text x="' + x.toFixed(1) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="' + anchor +
        '" font-size="10.5" font-family="IBM Plex Mono, monospace" fill="var(--tinta-3)">' +
        escapa(t.sigla) + ' <tspan fill="var(--tinta-2)" font-weight="600">' + v + '</tspan></text>';
    });

    svg.innerHTML = s;
  }

  function renderRadar() {
    desenharRadar();
    listaTopicos($('listaTopicosRadar'), true);
    const g = $('gradeConquistas');
    g.innerHTML = '';
    CONQUISTAS.forEach((c) => {
      const tem = E.conquistas.includes(c.id);
      const li = document.createElement('li');
      li.className = 'conquista' + (tem ? '' : ' bloqueada');
      li.innerHTML = '<b>' + escapa(c.nome) + '</b><span>' + escapa(c.desc) + '</span>';
      g.appendChild(li);
    });
  }

  /* ----------------------------------------------------------------- erros */

  function renderErros() {
    const ul = $('listaErros');
    ul.innerHTML = '';
    const nomes = Object.keys(E.erros).sort((a, b) => E.erros[b].n - E.erros[a].n);
    if (!nomes.length) {
      ul.innerHTML = '<li class="vazio-msg">Nada aqui ainda. Responda um bloco de questões e seus erros aparecem nomeados, do mais frequente para o menos.</li>';
      return;
    }
    nomes.forEach((nome) => {
      const reg = E.erros[nome];
      const li = document.createElement('li');
      li.className = 'item-erro';
      li.innerHTML =
        '<span><span class="item-erro-nome">' + escapa(nome) + '</span>' +
        '<span class="item-erro-topico">' + escapa(M.porId[reg.topico] ? M.porId[reg.topico].nome : '—') +
        ' — <button type="button" class="link-treino" data-topico="' + escapa(reg.topico) + '">treinar este tópico</button></span></span>' +
        '<span class="item-erro-cont">' + reg.n + '<em>' + (reg.n === 1 ? 'vez' : 'vezes') + '</em></span>';
      ul.appendChild(li);
    });
    ul.querySelectorAll('.link-treino').forEach((b) => {
      b.addEventListener('click', () => iniciarSessao('topico', b.dataset.topico));
    });
  }

  /* ----------------------------------------------------------------- telas */

  const TELAS = ['painel', 'treinar', 'questao', 'resultado', 'radar', 'erros'];

  function mostrarTela(nome) {
    TELAS.forEach((t) => {
      const el = $('tela-' + t);
      if (el) el.hidden = (t !== nome);
    });
    document.querySelectorAll('#tabs .tab').forEach((b) => {
      b.classList.toggle('ativa', b.dataset.tela === nome);
    });
    if (nome === 'painel') renderPainel();
    if (nome === 'treinar') renderTreinar();
    if (nome === 'radar') renderRadar();
    if (nome === 'erros') renderErros();
    $('telas').scrollTop = 0;
  }

  /* ------------------------------------------------------------- cabeamento */

  function sair() {
    if (!S) return mostrarTela('painel');
    if (S.respostas.length && !confirm('Sair agora descarta as ' + S.respostas.length + ' resposta(s) desta rodada. Sair?')) return;
    pararRelogio();
    S = null;
    mostrarTela('painel');
  }

  function ligar() {
    document.querySelectorAll('#tabs .tab').forEach((b) => {
      b.addEventListener('click', () => {
        if (S && S.respostas.length) { if (!confirm('Sair da rodada em andamento?')) return; }
        pararRelogio(); S = null;
        mostrarTela(b.dataset.tela);
      });
    });

    $('btnCegoPrincipal').addEventListener('click', (ev) => {
      iniciarSessao(ev.currentTarget.dataset.modo || 'cego');
    });
    $('btnCegoSimulado').addEventListener('click', () => iniciarSessao('simulado'));

    document.querySelectorAll('.modo').forEach((b) => {
      b.addEventListener('click', () => iniciarSessao(b.dataset.modo));
    });

    $('btnConfirmar').addEventListener('click', confirmar);
    $('btnAbandonar').addEventListener('click', sair);
    $('btnResPainel').addEventListener('click', () => mostrarTela('painel'));
    $('btnResDeNovo').addEventListener('click', () => iniciarSessao('cego'));

    $('btnZerar').addEventListener('click', () => {
      if (!confirm('Isso apaga pontos, radar, erros e conquistas deste navegador. Não tem volta. Zerar?')) return;
      E = novoEstado();
      salvar();
      mostrarTela('painel');
    });

    // teclado: A–E marca, Enter confirma
    document.addEventListener('keydown', (ev) => {
      if (!S || $('tela-questao').hidden) return;
      const k = ev.key.toUpperCase();
      if ('ABCDE'.includes(k) && k.length === 1) { marcar(k); ev.preventDefault(); }
      if (ev.key === 'Enter') { confirmar(); ev.preventDefault(); }
    });
  }

  /* ------------------------------------------------------------------ boot */

  function iniciar() {
    carregar();
    ligar();
    mostrarTela('painel');
  }

  iniciar();
})();
