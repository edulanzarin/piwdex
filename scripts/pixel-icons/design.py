import sys
sys.path.insert(0, ".")
from draw import Canvas, save

# Fonte 3x5 — o suficiente pra rotular uma tela sem virar borrao.
FONTE = {
    "I": ["111", ".1.", ".1.", ".1.", "111"],
    "V": ["1.1", "1.1", "1.1", "1.1", ".1."],
    "%": ["1.1", "..1", ".1.", "1..", "1.1"],
}

def texto(c, s, x, y, ch):
    for letra in s:
        g = FONTE.get(letra)
        if g:
            for j, row in enumerate(g):
                for i, p in enumerate(row):
                    if p == "1":
                        c.set(x + i, y + j, ch)
        x += 4

def halo(c, ch="e"):
    """Halo de acento bem escuro POR FORA do contorno preto — e o que da o
    neon do pokedex.png sem clarear o icone inteiro."""
    novos = []
    for y in range(c.n):
        for x in range(c.n):
            if c.px[y][x] != ".":
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < c.n and 0 <= ny < c.n and c.px[ny][nx] == "k":
                    novos.append((x, y)); break
    for x, y in novos:
        c.set(x, y, ch)

def acabar(c):
    c.outline("k")
    halo(c)
    return c

# ---------------------------------------------------------------- ITENS: bau
def itens():
    c = Canvas()
    c.rrect(3, 14, 28, 28, "m", r=2)              # corpo
    c.rect(3, 23, 28, 28, "d")
    c.rrect(3, 4, 28, 15, "m", r=3)               # tampa
    c.rect(5, 4, 26, 5, "l")                      # aresta de luz
    c.rect(3, 12, 28, 13, "d")
    c.rect(3, 14, 28, 17, "c")                    # a FRESTA — o que faz ler bau
    c.rect(3, 15, 28, 16, "a")
    c.rect(5, 15, 26, 15, "b")
    c.rect(8, 4, 10, 28, "c")                     # cintas na cor da ferramenta
    c.rect(9, 4, 9, 28, "a")
    c.rect(22, 4, 24, 28, "c")
    c.rect(23, 4, 23, 28, "a")
    c.rect(3, 24, 6, 28, "l")                     # cantoneiras
    c.rect(25, 24, 28, 28, "l")
    c.rect(3, 26, 6, 27, "g")
    c.rect(25, 26, 28, 27, "g")
    c.rrect(12, 10, 19, 23, "l", r=1)             # fechadura
    c.rrect(13, 11, 18, 22, "e", r=1)
    c.rect(14, 13, 17, 20, "a")                   # cristal aceso
    c.rect(15, 13, 16, 15, "b")
    c.rect(14, 20, 17, 21, "c")
    return acabar(c)

# -------------------------------------------------- CALCULADORA: aparelho de IV
def calculadora():
    c = Canvas()
    c.rrect(6, 2, 26, 30, "m", r=3)               # carcaca
    c.rect(7, 3, 25, 4, "l")                      # aresta de luz
    c.rect(6, 27, 26, 30, "d")
    c.rect(6, 5, 8, 26, "c")                      # trilho lateral de cor
    c.rect(7, 5, 7, 26, "a")
    c.rect(6, 11, 8, 13, "d"); c.rect(6, 19, 8, 21, "d")
    c.rect(22, 2, 26, 6, "c")                     # canto de cor
    c.rect(23, 3, 26, 4, "a")
    c.rrect(10, 5, 25, 15, "l", r=1)              # moldura da tela
    c.rect(11, 6, 24, 14, "e")
    c.rect(11, 6, 24, 6, "c")
    texto(c, "IV%", 13, 8, "a")
    c.rect(13, 13, 22, 13, "c")                   # linha de base da leitura
    c.rect(13, 13, 18, 13, "b")
    for j, y in enumerate((18, 22, 26)):           # teclado 4x3
        for i, x in enumerate((11, 15, 19, 23)):
            cor = "a" if (i, j) == (3, 2) else "l"
            c.rect(x, y, x + 2, y + 2, cor)
            c.rect(x, y, x + 2, y, "g" if cor == "l" else "b")
            c.rect(x, y + 2, x + 2, y + 2, "d" if cor == "l" else "c")
    return acabar(c)

# ------------------------------------------------------------- HUNT: radar
def hunt():
    c = Canvas()
    import math
    c.rect(12, 27, 19, 30, "m")                   # pedestal
    c.rect(13, 27, 18, 30, "l")
    c.rrect(8, 29, 23, 31, "m", r=1)
    c.rect(9, 30, 22, 31, "c")
    c.disc(16, 15, 12, "a")                       # aro aceso
    c.ring(16, 15, 12, "b")
    c.disc(16, 15, 10, "d")
    c.disc(16, 15, 9, "s")                        # tela quase preta
    c.ring(16, 15, 6, "c")                        # UM anel de alcance, so
    c.line(7, 15, 25, 15, "c")                    # cruz
    c.line(16, 6, 16, 24, "c")
    for y in range(6, 16):                        # cunha de varredura
        for x in range(16, 26):
            dx, dy = x - 16, 15 - y
            if dx * dx + dy * dy > 81:
                continue
            ang = math.degrees(math.atan2(dy, max(dx, 0.01)))
            if ang <= 52:
                c.set(x, y, "a" if ang <= 30 else "c")
    c.line(16, 15, 24, 10, "b")                   # borda de ataque
    c.set(11, 11, "w"); c.set(20, 20, "b"); c.set(11, 19, "b")   # alvos
    c.disc(16, 15, 1, "b")                        # centro
    return acabar(c)

# ------------------------------------------------------- BREEDING: ovo no ninho
# Meia-largura por linha: e o que faz um OVO em vez de uma pedra — estreito em
# cima, cheio embaixo. Formula elipse nao entrega isso sem virar bola.
OVO = [2, 3, 4, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 9, 9, 8, 8, 7, 6]

def breeding():
    c = Canvas()
    for j, half in enumerate(OVO):
        y = 2 + j
        c.rect(16 - half, y, 16 + half, y, "w")
        c.rect(16 + half - 1, y, 16 + half, y, "g")     # sombra a direita
        if half > 4:
            c.set(16 - half + 1, y, "w")
    c.set(13, 5, "w"); c.set(12, 6, "w"); c.set(13, 6, "w")   # brilho
    for x, y, r in ((12, 9, 2), (20, 11, 2), (14, 16, 2), (21, 18, 1), (16, 6, 1), (17, 21, 1)):
        c.disc(x, y, r, "a")
        c.set(x, y - r, "b")
    # Ninho em TIGELA: largo na boca, estreito no fundo. Barra reta virava
    # colchao — o que diz "ninho" e o afunilamento mais o graveto atravessado.
    BOCA = [(2, 29), (2, 29), (3, 28), (4, 27), (5, 26), (6, 25), (7, 24),
            (8, 23), (9, 22), (11, 20)]
    for j, (x0, x1) in enumerate(BOCA):
        y = 20 + j
        c.rect(x0, y, x1, y, "m" if j % 2 else "d")
    for j, (x0, x1) in enumerate(BOCA):           # gravetos atravessados
        y = 20 + j
        for x in range(x0 + (j % 3), x1, 5):
            c.set(x, y, "l")
            c.set(x + 1, y, "g" if j < 3 else "d")
    c.rect(2, 20, 29, 20, "c")                    # calor da boca do ninho
    c.rect(4, 20, 27, 20, "a")
    c.rect(6, 21, 25, 21, "c")
    return acabar(c)

# ----------------------------------------------------- META: escudo e espadas
def escudo(c, ch, inset=0):
    top, bot = 3 + inset, 29 - inset
    for y in range(top, bot + 1):
        t = (y - top) / (bot - top)
        half = (11 - inset) if t < 0.5 else (11 - inset) * (1 - (t - 0.5) / 0.5) + 0.6
        for x in range(16 - int(half), 16 + int(half) + 1):
            c.set(x, y, ch)

def lamina(c, x0, y0, x1, y1):
    """Lamina de aco com fio claro, guarda e cabo na cor da ferramenta."""
    c.line(x0, y0, x1, y1, "g")
    c.line(x0 + 1, y0, x1 + 1, y1, "w")
    sg = 1 if x1 > x0 else -1
    gx, gy = x1, y1                               # ponta do cabo
    c.line(gx - 3 * sg, gy - 3, gx + 2 * sg, gy + 2, "a")   # guarda
    c.line(gx - 3 * sg, gy - 2, gx + 2 * sg, gy + 3, "c")
    c.line(gx + sg, gy + 1, gx + 3 * sg, gy + 3, "d")       # cabo
    c.line(gx + 2 * sg, gy + 1, gx + 4 * sg, gy + 3, "d")

def meta():
    c = Canvas()
    escudo(c, "a")                                # borda acesa
    escudo(c, "l", inset=1)
    escudo(c, "m", inset=2)
    escudo(c, "d", inset=3)
    c.rect(7, 4, 24, 5, "l")                      # aresta de luz no topo
    c.rect(8, 4, 23, 4, "g")
    for y in range(6, 24):                        # face escura com brilho no meio
        t = (y - 6) / 18
        w = int(9 * (1 - t * 0.75))
        c.rect(16 - w, y, 16 + w, y, "e")
    lamina(c, 24, 8, 9, 23)                       # espadas cruzadas, por cima
    lamina(c, 7, 8, 22, 23)
    c.disc(16, 15, 2, "c")                        # no cruzamento
    c.ring(16, 15, 2, "a")
    c.set(16, 15, "b")
    return acabar(c)


ICONES = {"itens": itens, "calculadora": calculadora, "hunt": hunt,
          "breeding": breeding, "meta": meta}

if __name__ == "__main__":
    for nome, fn in ICONES.items():
        save(fn(), nome, f"{nome}.json")
    print("ok:", ", ".join(ICONES))
