#!/usr/bin/env python3
"""Gera os icones em pixel art do piwdex.

Por que um script e nao PNG solto no repositorio: icone se ajusta. Trocar a
paleta do site (como aconteceu na virada pro grafite morno) muda a cor de TODOS
eles, e com o desenho em codigo isso e uma constante — com PNG pronto, e redesenhar
seis arquivos a mao e esquecer um.

    python3 scripts/bake-icons.py

## Duas licoes que o desenho ensinou, e que valem pra qualquer icone novo aqui

1. **Circulo pequeno por formula de distancia sai LOSANGO.** A 5 e 7 pixels a
   diferenca entre disco e losango e o que separa "lente" de "cristal" — a
   primeira lente da Pokedex parecia uma cruz de hospital. Use as mascaras
   `D5`/`D7`/`D9`, desenhadas a mao.

2. **Brilho no CENTRO le como furo.** Deslocado pro alto-esquerda le como vidro.
   Vale pra lente, para bola e para qualquer superficie curva.
"""

import json
import subprocess
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "public" / "images" / "icons"
RENDER = Path.home() / ".claude/skills/pixel-art-gen/scripts/render_pixel_art.py"

# ---------------------------------------------------------------------------
# Paleta — sai dos tokens do site, e e por isso que ela mora aqui e nao em cada
# icone. Trocar o tema e trocar estas linhas.
# ---------------------------------------------------------------------------
OUT    = "#171310"   # contorno, sempre
CORPO  = "#2f2a25"   # = --color-surface-2
CORPOL = "#453d35"   # = --color-surface-3, a aresta de luz
AREIA  = "#cdbba3"   # = --color-accent
AREIAD = "#927b5d"   # = --color-accent-soft
BRANCO = "#f0ecea"   # = --color-text
FRIO   = "#7fd0f5"   # o detalhe FRIO: um por icone, e o que identifica de longe
FRIOD  = "#3aa0d8"

# cor de cada ferramenta, igual ao `--color-t-*`
T = {
    "pokedex": ("#ff5c72", "#c03a50", "#ff8494"),
    "itens": ("#46e08a", "#2a9c5c", "#84f0b4"),
    "calculadora": ("#5b9dff", "#3665b0", "#9cc4ff"),
    "hunt": ("#ffb454", "#c07f2e", "#ffd49a"),
    "breeding": ("#f472b6", "#b04a80", "#f9a8d4"),
    "meta": ("#2ee6d6", "#1a9c92", "#7ff2e8"),
}

D5 = [".XXX.", "XXXXX", "XXXXX", "XXXXX", ".XXX."]
D7 = ["..XXX..", ".XXXXX.", "XXXXXXX", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX.."]
D9 = ["...XXX...", ".XXXXXXX.", ".XXXXXXX.", "XXXXXXXXX", "XXXXXXXXX",
      "XXXXXXXXX", ".XXXXXXX.", ".XXXXXXX.", "...XXX..."]

W = H = 32


class Tela:
    def __init__(self):
        self.px = {}

    def p(self, x, y, c):
        if 0 <= x < W and 0 <= y < H:
            self.px[(x, y)] = c

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.p(x, y, c)

    def masc(self, m, x0, y0, c):
        for dy, linha in enumerate(m):
            for dx, ch in enumerate(linha):
                if ch == "X":
                    self.p(x0 + dx, y0 + dy, c)

    def linha(self, x0, y0, x1, y1, c):
        n = max(abs(x1 - x0), abs(y1 - y0)) or 1
        for i in range(n + 1):
            self.p(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), c)

    def contornar(self):
        """Contorno de 1px em toda a silhueta. Sem ele o icone se dissolve sobre o
        wallpaper — a arte tem cor parecida com o fundo em varios trechos."""
        for (x, y) in list(self.px.keys()):
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if (x + dx, y + dy) not in self.px:
                    self.p(x + dx, y + dy, OUT)

    def salvar(self, nome):
        DESTINO.mkdir(parents=True, exist_ok=True)
        j = DESTINO / f"{nome}.json"
        j.write_text(json.dumps({
            "width": W, "height": H, "background": "transparent",
            "grid_lines": False, "pixel_size": 4,
            "pixels": [{"x": x, "y": y, "color": c} for (x, y), c in sorted(self.px.items())],
        }))
        subprocess.run(["python3", str(RENDER), str(j), "-o", str(DESTINO / f"{nome}.png"), "-p", "4"],
                       check=True, capture_output=True)
        j.unlink()
        print(f"  {nome}.png  ({len(self.px)} pixels)")


# ---------------------------------------------------------------------------
# Os icones
# ---------------------------------------------------------------------------

def pokedex():
    """Aparelho fechado, lente azul. A lente e o detalhe frio."""
    c, cd, cl = T["pokedex"]
    t = Tela()
    t.rect(6, 3, 25, 28, CORPO)
    for dx, dy in [(0,0),(1,0),(0,1),(19,0),(18,0),(19,1),(0,25),(1,25),(0,24),(19,25),(18,25),(19,24)]:
        t.px.pop((6+dx, 3+dy), None)
    t.rect(8, 3, 23, 3, CORPOL)
    t.rect(6, 5, 6, 26, CORPOL)
    t.rect(7, 4, 24, 12, c)
    t.rect(7, 11, 24, 12, cd)
    t.rect(8, 4, 23, 4, cl)
    t.masc(D7, 8, 5, OUT)
    t.masc(D5, 9, 6, FRIOD)
    t.p(10, 7, FRIO); t.p(11, 7, FRIO); t.p(10, 8, FRIO)
    t.p(10, 7, "#e8f7ff")
    for i, cc in enumerate([cd, AREIA, "#8fd9c8"]):
        t.p(17 + i*3, 8, OUT); t.p(18 + i*3, 8, cc)
    t.rect(9, 15, 22, 22, OUT)
    t.rect(10, 16, 21, 21, "#16332f")
    t.rect(10, 16, 21, 16, "#265049")
    t.masc(D9, 11, 15, "#8fd9c8")
    for dy, ln in enumerate(D9[5:], start=5):
        for dx, ch in enumerate(ln):
            if ch == "X": t.p(11+dx, 15+dy, "#3f8578")
    t.rect(11, 19, 19, 19, OUT)
    t.masc([".X.", "XXX", ".X."], 14, 18, OUT)
    t.p(15, 19, BRANCO)
    t.rect(9, 24, 9, 26, AREIA); t.rect(8, 25, 10, 25, AREIA)
    t.rect(18, 25, 19, 26, c); t.rect(21, 25, 22, 26, "#8fd9c8")
    t.contornar(); t.salvar("pokedex")


def itens():
    """Bolsa de cordao, com moeda saindo. O fecho e o detalhe frio.

    A primeira versao era um TRAPEZIO e leu como piramide. O que faz uma bolsa
    parecer bolsa nao e o corpo, e a CINTURA: o estrangulamento logo abaixo da
    boca, com o corpo estufando pra fora depois dele. Sem essa curva, qualquer
    forma que afina em cima vira montanha.
    """
    c, cd, cl = T["itens"]
    t = Tela()
    # perfil por linha: cintura em y=11, barriga larga no meio, base arredondada
    perfil = {
        10: 5, 11: 4, 12: 5, 13: 7, 14: 8, 15: 9, 16: 10, 17: 10,
        18: 11, 19: 11, 20: 11, 21: 11, 22: 10, 23: 10, 24: 9, 25: 7, 26: 5,
    }
    for y, larg in perfil.items():
        t.rect(16 - larg, y, 15 + larg, y, c)
    # sombra na metade de baixo e luz na borda esquerda: volume sem sombra solta
    for y, larg in perfil.items():
        if y >= 19:
            t.rect(16 - larg, y, 15 + larg, y, cd)
        t.p(16 - larg, y, cl if y < 19 else c)
    # boca franzida
    t.rect(11, 8, 20, 10, AREIAD)
    for x in range(12, 21, 3):
        t.rect(x, 8, x, 10, AREIA)
    t.rect(11, 8, 20, 8, AREIA)
    # cordao caindo dos dois lados
    t.linha(11, 9, 8, 6, AREIA); t.linha(20, 9, 23, 6, AREIA)
    t.p(8, 6, AREIAD); t.p(23, 6, AREIAD)
    # fecho: o frio
    t.masc(D5, 14, 15, OUT)
    t.masc([".X.", "XXX", ".X."], 15, 16, FRIOD)
    t.p(15, 16, FRIO)
    # UMA moeda saindo, e nao tres: tres viraram confete e ninguem leu moeda
    t.masc(D7, 19, 2, OUT)
    t.masc(D5, 20, 3, AREIA)
    t.masc([".X.", "XXX", ".X."], 21, 4, AREIAD)
    t.p(21, 4, BRANCO)
    t.contornar(); t.salvar("itens")


def calculadora():
    """Aparelho de calcular com visor aceso. O visor e o detalhe frio."""
    c, cd, cl = T["calculadora"]
    t = Tela()
    t.rect(7, 4, 24, 28, CORPO)
    for dx, dy in [(0,0),(17,0),(0,24),(17,24)]:
        t.px.pop((7+dx, 4+dy), None)
    t.rect(9, 4, 22, 4, CORPOL); t.rect(7, 6, 7, 26, CORPOL)
    # visor
    t.rect(9, 7, 22, 13, OUT)
    t.rect(10, 8, 21, 12, "#123244")
    t.rect(10, 8, 21, 8, "#1d4a60")
    # digitos de 7 segmentos, so tracos: numero desenhado le como texto e polui
    for x0 in (12, 16, 19):
        t.rect(x0, 10, x0+2, 10, FRIO)
        t.rect(x0, 10, x0, 11, FRIOD)
    # teclas: 3x3 mais a coluna de operacao na cor da ferramenta
    for i in range(3):
        for j in range(3):
            t.rect(9 + j*4, 16 + i*4, 11 + j*4, 18 + i*4, AREIA)
            t.rect(9 + j*4, 18 + i*4, 11 + j*4, 18 + i*4, AREIAD)
    t.rect(21, 16, 23, 26, c)
    t.rect(21, 24, 23, 26, cd)
    t.rect(21, 16, 23, 16, cl)
    t.contornar(); t.salvar("calculadora")


def hunt():
    """Mira aberta, com pegada ABAIXO dela. A mira e o detalhe frio.

    Duas versoes falharam antes, e pelo mesmo motivo com desenhos diferentes: eu
    empilhava dois simbolos no MESMO espaco. Grama atras do alvo virou cerca;
    pegada dentro do anel da mira virou borrao laranja.

    A 32px nao cabem dois simbolos sobrepostos — o olho nao separa camada nessa
    resolucao. Cabem dois LADO A LADO, se cada um tiver ar em volta. A mira ficou
    grande e VAZADA no centro (anel, nao disco), e a pegada desceu pro rodape.
    """
    c, cd, cl = T["hunt"]
    t = Tela()

    # ---- a mira: anel de 2px, vazado, ocupando o alto ----
    R, cx, cy = 9, 15, 12
    for y in range(cy - R, cy + R + 1):
        for x in range(cx - R, cx + R + 1):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if R - 2.1 <= d <= R:
                t.p(x, y, FRIO if d > R - 1.2 else FRIOD)
    # as quatro hastes atravessando o anel
    t.rect(cx, cy - R - 3, cx, cy - R + 3, FRIO)
    t.rect(cx, cy + R - 3, cx, cy + R + 3, FRIO)
    t.rect(cx - R - 3, cy, cx - R + 3, cy, FRIO)
    t.rect(cx + R - 3, cy, cx + R + 3, cy, FRIO)
    # o ponto no centro: pequeno, pra o anel continuar vazado
    t.masc([".X.", "XXX", ".X."], cx - 1, cy - 1, c)

    # ---- a pegada, embaixo e menor: o rastro ----
    t.masc(D7, 12, 23, cd)
    t.masc(D5, 13, 24, c)
    for dx in (9, 13, 17, 21):
        t.masc([".X.", "XXX", ".X."], dx, 20, c)
    t.contornar(); t.salvar("hunt")


def breeding():
    """Ovo num ninho. O brilho do ovo e o detalhe frio."""
    c, cd, cl = T["breeding"]
    t = Tela()
    # ovo: oval de 12x16
    for y in range(4, 22):
        f = (y - 4) / 17
        larg = round(3 + 6 * (f ** 0.55))
        t.rect(15 - larg, y, 16 + larg, y, BRANCO)
    for y in range(13, 22):
        f = (y - 4) / 17
        larg = round(3 + 6 * (f ** 0.55))
        t.rect(15 - larg, y, 16 + larg, y, "#cfc7c0")
    # manchas na cor da ferramenta
    for cx, cy in [(12, 9), (19, 13), (14, 17)]:
        t.masc([".X.", "XXX", ".X."], cx, cy, c)
    # brilho frio no alto-esquerda: e o que faz o ovo parecer liso
    t.rect(12, 6, 13, 7, FRIO); t.p(12, 6, "#e8f7ff")
    # ninho
    t.rect(6, 21, 25, 25, AREIAD)
    for x in range(6, 26, 2):
        t.p(x, 21, AREIA); t.p(x + 1, 23, AREIA); t.p(x, 25, AREIA)
    t.rect(8, 26, 23, 27, AREIAD)
    t.contornar(); t.salvar("breeding")


def meta():
    """Escudo com coroa e duas laminas GROSSAS atras. O escudo e o detalhe frio.

    As laminas da primeira versao eram linha de 1px e sumiram — a 32px, um traco
    diagonal fino vira ruido. Arma so le como arma com corpo: 3px de lamina,
    guarda marcada e ponta que fecha.
    """
    c, cd, cl = T["meta"]
    t = Tela()
    # laminas: tres linhas paralelas fazem o corpo
    for off in (-1, 0, 1):
        t.linha(5 + off, 24, 20 + off, 6, AREIA if off == 0 else AREIAD)
        t.linha(27 - off, 24, 12 - off, 6, AREIA if off == 0 else AREIAD)
    for x, y in [(20, 6), (19, 7), (12, 6), (13, 7)]:
        t.p(x, y, BRANCO)
    # guardas e cabos
    t.rect(3, 23, 9, 25, cd); t.rect(23, 23, 29, 25, cd)
    t.rect(4, 26, 7, 28, AREIAD); t.rect(25, 26, 28, 28, AREIAD)
    # escudo por cima, ocupando o centro
    for y in range(8, 19):
        t.rect(9, y, 22, y, FRIOD)
    for y in range(19, 27):
        larg = round(7 - (y - 18) * 0.9)
        t.rect(16 - larg, y, 15 + larg, y, FRIOD)
    t.rect(9, 8, 22, 9, FRIO)
    t.rect(9, 8, 10, 26 - 8, FRIO) if False else None
    for y in range(10, 19):
        t.p(9, y, FRIO)
    # emblema: pokebola no centro do escudo
    t.masc(D9, 11, 11, BRANCO)
    for dy, ln in enumerate(D9[5:], start=5):
        for dx, ch in enumerate(ln):
            if ch == "X": t.p(11 + dx, 11 + dy, c)
    t.rect(11, 15, 19, 15, OUT)
    t.masc([".X.", "XXX", ".X."], 14, 14, OUT)
    t.p(15, 15, BRANCO)
    t.contornar(); t.salvar("meta")


if __name__ == "__main__":
    print("assando icones:")
    for f in (pokedex, itens, calculadora, hunt, breeding, meta):
        f()
