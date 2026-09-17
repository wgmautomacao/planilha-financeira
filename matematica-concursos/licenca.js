/* Ponto Cego — licença
 *
 * HONESTIDADE SOBRE O QUE ISSO É: validação no cliente. O algoritmo abaixo
 * está no JS que o comprador baixa, então qualquer pessoa com conhecimento
 * técnico consegue ler e gerar chaves. Isso NÃO é proteção contra pirataria —
 * é atrito contra compartilhamento casual, que é o vazamento real de produto
 * low ticket (o comprador manda o link no grupo do WhatsApp).
 *
 * Duas coisas dão o atrito: a chave é nominal (o nome de quem comprou fica
 * gravado e aparece no rodapé do app, então chave compartilhada exibe o nome
 * de outra pessoa), e a ativação é registrada com data.
 *
 * Para validação de verdade: webhook da Kiwify/Hotmart gravando a venda num
 * endpoint, e o app consultando. Está documentado no VENDAS.md como v2.
 */
(function (global) {
  'use strict';

  const CHAVE_LS = 'pontocego.licenca.v1';
  const ALFA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';   // Crockford: sem I, L, O, U
  const SAL = 'pontocego-mat-2026';

  /* FNV-1a 32 bits — o gerador em Python replica exatamente isto */
  function hash32(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function grupoVerificador(g1, g2) {
    const h = hash32(SAL + g1 + g2);
    let out = '';
    for (let i = 0; i < 4; i++) out += ALFA[(h >>> (i * 5)) & 31];
    return out;
  }

  function normaliza(bruta) {
    return String(bruta || '')
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, '')
      .replace(/I/g, '1').replace(/L/g, '1')
      .replace(/O/g, '0').replace(/U/g, 'V');
  }

  /** Aceita "PC-A1B2-C3D4-E5F6", "pc a1b2 c3d4 e5f6" ou "PCA1B2C3D4E5F6". */
  function valida(bruta) {
    const s = normaliza(bruta);
    if (!/^PC[0-9A-HJKMNP-TV-Z]{12}$/.test(s)) return false;
    return grupoVerificador(s.slice(2, 6), s.slice(6, 10)) === s.slice(10, 14);
  }

  function formata(bruta) {
    const s = normaliza(bruta);
    if (s.length !== 14) return String(bruta || '').toUpperCase();
    return 'PC-' + s.slice(2, 6) + '-' + s.slice(6, 10) + '-' + s.slice(10, 14);
  }

  function lida() {
    try {
      const cru = localStorage.getItem(CHAVE_LS);
      return cru ? JSON.parse(cru) : null;
    } catch (e) { return null; }
  }

  function grava(dados) {
    try { localStorage.setItem(CHAVE_LS, JSON.stringify(dados)); } catch (e) { /* storage bloqueado */ }
  }

  let cache = lida();

  const LICENCA = {
    /** Já tem licença ativa neste navegador? */
    ativa() {
      return !!(cache && cache.chave && valida(cache.chave));
    },

    dados() {
      return cache ? Object.assign({}, cache) : null;
    },

    /** Ativa e persiste. Devolve {ok:true} ou {ok:false, motivo}. */
    ativar(chaveBruta, nome) {
      if (!chaveBruta || !String(chaveBruta).trim()) {
        return { ok: false, motivo: 'Cole a chave que você recebeu por e-mail depois da compra.' };
      }
      if (!valida(chaveBruta)) {
        return { ok: false, motivo: 'Essa chave não é válida. Confira se copiou inteira, incluindo o "PC-" do começo.' };
      }
      cache = {
        chave: formata(chaveBruta),
        nome: String(nome || '').trim().slice(0, 60),
        em: new Date().toISOString().slice(0, 10)
      };
      grava(cache);
      return { ok: true };
    },

    remover() {
      cache = null;
      try { localStorage.removeItem(CHAVE_LS); } catch (e) { /* idem */ }
    },

    valida,
    formata
  };

  global.LICENCA = LICENCA;
})(window);
