#!/usr/bin/env python3
"""Gera chaves de licenca do Ponto Cego.

O algoritmo replica exatamente o licenca.js: FNV-1a 32 bits sobre
SAL + grupo1 + grupo2, e os 20 bits de baixo viram o grupo verificador em
base32 Crockford.

Uso:
    python3 gerar_chaves.py 100            # 100 chaves, uma por linha
    python3 gerar_chaves.py 100 --csv      # com cabecalho, pronto pra Kiwify
    python3 gerar_chaves.py --conferir PC-XXXX-XXXX-XXXX
"""
import secrets
import sys

ALFA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'   # sem I, L, O, U
SAL = 'pontocego-mat-2026'
MASCARA = 0xFFFFFFFF


def hash32(s: str) -> int:
    h = 2166136261
    for ch in s:
        h ^= ord(ch)
        h = (h * 16777619) & MASCARA
    return h


def verificador(g1: str, g2: str) -> str:
    h = hash32(SAL + g1 + g2)
    return ''.join(ALFA[(h >> (i * 5)) & 31] for i in range(4))


def grupo_aleatorio() -> str:
    return ''.join(secrets.choice(ALFA) for _ in range(4))


def nova_chave() -> str:
    g1, g2 = grupo_aleatorio(), grupo_aleatorio()
    return f'PC-{g1}-{g2}-{verificador(g1, g2)}'


def valida(bruta: str) -> bool:
    s = ''.join(c for c in bruta.upper() if c.isalnum())
    s = s.replace('I', '1').replace('L', '1').replace('O', '0').replace('U', 'V')
    if len(s) != 14 or not s.startswith('PC'):
        return False
    if any(c not in ALFA for c in s[2:]):
        return False
    return verificador(s[2:6], s[6:10]) == s[10:14]


def main() -> None:
    argv = sys.argv[1:]

    if '--conferir' in argv:
        alvo = argv[argv.index('--conferir') + 1]
        print('VALIDA' if valida(alvo) else 'INVALIDA', alvo)
        return

    quantas = 10
    for a in argv:
        if a.isdigit():
            quantas = int(a)
            break

    csv = '--csv' in argv
    if csv:
        print('chave')

    vistas = set()
    while len(vistas) < quantas:
        k = nova_chave()
        if k in vistas:
            continue
        vistas.add(k)
        print(k)


if __name__ == '__main__':
    main()
