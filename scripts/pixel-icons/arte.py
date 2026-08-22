"""Arte de INTERFACE — a que nao pertence a uma ferramenta.

O `design.py` desenha os seis icones das ferramentas (os cards da home). Aqui
ficam as pecas que o resto do site pedia e nao tinha: 404, estado vazio, selo de
frescor, categoria de item, cabecalho de pagina.

Mesmo vocabulario, e isso e o que faz o conjunto parecer um conjunto: grid 32x32
numa moldura de 44, contorno preto de 1px, halo de acento escuro por fora, e a
paleta do `draw.py` (chassi escuro do site + um acento).

REGRA DE TAMANHO, aprendida a duras penas: esta arte e de FIGURA — 24px pra
cima. Abaixo disso ela nao le, e o site ja tentou (a versao 8x8 desenhada a mao
foi reprovada, e por isso o chrome miudo — chevron, X, filtro — e lucide ate
hoje). Simbolo pequeno continua sendo lucide de proposito.
"""
import sys
sys.path.insert(0, ".")
from draw import Canvas, acabar, save


# ---------------------------------------------------------------- pecas comuns
def pokebola(c, cx, cy, r, cima="a", baixo="w", botao=True):
    """A pokebola canonica: calota colorida, casco claro, faixa preta, botao."""
    dentro = lambda x, y: (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.4
    for y in range(cy - r - 1, cy + r + 2):
        for x in range(cx - r - 1, cx + r + 2):
            if not dentro(x, y):
                continue
            c.set(x, y, cima if y < cy - 1 else baixo)
    for y in range(cy - 1, cy + 2):                      # faixa, recortada no disco
        for x in range(cx - r - 1, cx + r + 2):
            if dentro(x, y):
                c.set(x, y, "k")
    c.set(cx - r + 1, cy - r + 3, "b")                   # brilho da calota
    c.set(cx - r + 2, cy - r + 2, "b")
    if botao:
        c.disc(cx, cy, 3, "k")
        c.disc(cx, cy, 2, "l")
        c.disc(cx, cy, 1, "w")


def talhar(c, pontos):
    """Abre uma fenda TRANSPARENTE por cima do que ja foi pintado.

    E o que faz uma coisa parecer quebrada em vez de riscada: o buraco mostra o
    fundo, e o contorno preto entra depois e fecha a borda nova."""
    for x, y in pontos:
        if 0 <= x < c.n and 0 <= y < c.n:
            c.px[y][x] = "."


# ------------------------------------------------------- 404: pokebola rachada
def quebrada():
    c = Canvas()
    pokebola(c, 16, 15, 12, botao=False)
    # A fenda em ZIGUEZAGUE, nao reta: corte reto le como "cortado ao meio com
    # faca", o que se quer aqui e "trincou".
    fenda = []
    x = 13
    for y in range(2, 28):
        x += (1 if (y // 3) % 2 else -1)
        fenda += [(x + d, y) for d in (0, 1)]
    talhar(c, fenda)
    c.disc(16, 15, 3, "k")                    # botao apagado
    c.disc(16, 15, 2, "d")
    for x, y in ((6, 27), (25, 26), (10, 30), (22, 30)):   # cacos no chao
        c.rect(x, y, x + 1, y + 1, "w")
        c.set(x + 1, y + 1, "g")
    c.rect(4, 31, 27, 31, "s")                # sombra
    return acabar(c)


# ------------------------------------- estado vazio: o filtro nao deixou nada passar
def vazio():
    """FUNIL. A primeira tentativa foi uma pokebola aberta e nao leu — virou uma
    impressora. O funil resolve por dois motivos: a silhueta (triangulo invertido)
    nao colide com nenhuma outra arte do site, e ele DIZ filtro, que e exatamente o
    estado — nao "faltou pokemon", e sim "nada passou pelo filtro"."""
    c = Canvas()
    c.rect(3, 4, 28, 7, "l")                      # aba de cima
    c.rect(3, 4, 28, 4, "b")
    c.rect(3, 7, 28, 8, "c")
    c.rect(4, 5, 27, 6, "a")                      # o acento e AREA, nao fio
    for j in range(11):                           # corpo afunilando
        y = 9 + j
        meia = 12 - j
        c.rect(16 - meia, y, 16 + meia, y, "m")
        c.rect(16 - meia, y, 16 - meia + 1, y, "l")
        c.rect(16 + meia - 1, y, 16 + meia, y, "d")
    c.rect(14, 20, 18, 27, "m")                   # tubo
    c.rect(14, 20, 15, 27, "l")
    c.rect(17, 20, 18, 27, "d")
    c.rect(13, 27, 19, 29, "l")                   # bico
    c.rect(14, 28, 18, 29, "c")
    c.disc(16, 31, 1, "a")                        # UMA gota, e ja caindo fora
    return acabar(c)


# ---------------------------------------------- selo AO VIVO / SNAPSHOT
def ao_vivo():
    """Torre transmitindo. Massa no mastro e ondas de 2px: a primeira versao tinha
    arco de 1px e saiu parecendo glifo de wi-fi ao lado de icones que tem volume."""
    import math
    c = Canvas()
    c.rect(13, 20, 19, 29, "m")                   # base
    c.rect(13, 20, 14, 29, "l")
    c.rect(18, 20, 19, 29, "d")
    c.rect(9, 29, 23, 31, "m")                    # sapata
    c.rect(10, 29, 22, 30, "l")
    c.rect(10, 31, 22, 31, "d")
    c.rect(11, 24, 21, 25, "m")                   # travessa
    c.rect(11, 24, 21, 24, "l")
    c.rrect(11, 10, 21, 21, "l", r=2)             # cabine
    c.rect(12, 11, 20, 12, "b")
    c.rect(13, 13, 19, 19, "a")                   # painel aceso: AREA de acento
    c.rect(13, 13, 19, 14, "b")
    c.rect(13, 19, 19, 20, "c")
    for r in (7, 10, 13):                         # ondas grossas dos dois lados
        for ang in range(-46, 47, 2):
            dx = int(r * math.sin(math.radians(ang)))
            dy = int(r * math.cos(math.radians(ang)))
            for lado in (-1, 1):
                c.set(16 + lado * dy, 15 + dx, "a" if r < 13 else "c")
    return acabar(c)


def snapshot():
    """CARTUCHO. A ideia e "copia salva, nao transmissao ao vivo", e cartucho diz
    isso de primeira no vocabulario de jogo — a antena quebrada da primeira versao
    virou uma bolsa. O par ao-vivo/snapshot nao compartilha silhueta de proposito:
    o Chip ja carrega a palavra, entao a arte pode ser inequivoca em vez de esperta."""
    c = Canvas()
    c.rrect(4, 3, 28, 29, "m", r=2)               # corpo
    c.rect(5, 4, 27, 5, "l")
    c.rect(4, 26, 28, 29, "d")
    c.rrect(7, 6, 25, 17, "l", r=1)               # etiqueta
    c.rect(8, 7, 24, 16, "e")
    c.rect(9, 9, 23, 10, "a")
    c.rect(9, 12, 19, 13, "c")
    c.rect(9, 14, 21, 15, "c")
    c.rect(8, 20, 24, 25, "d")                    # contatos
    for x in range(9, 24, 3):
        c.rect(x, 21, x + 1, 24, "g")
    return acabar(c)



# ============================================================================
# Categorias de ITEM.
# ----------------------------------------------------------------------------
# Oito artes que precisam se distinguir ENTRE SI num card de 24px e nao colidir
# com o bau que ja representa a ferramenta Itens. A separacao e por SILHUETA
# primeiro (bolsa, gema, garrafa, ampola, bandeira, disco, carta, engradado) e
# so depois por cor — cor sozinha nao separa pra quem nao distingue matiz, que e
# a mesma regra que o type-icon.tsx ja segue.
# ============================================================================

def item_drop():
    """Bolsa amarrada, com uma moeda escapando pela boca.

    O CORPO e que leva o acento. A primeira versao tinha bolsa de chassi escuro e
    so um remendo colorido: a 44px ela virava uma mancha preta. Nas artes que
    funcionaram (gema, frasco, bandeira, disco) o acento e a AREA dominante — e
    isso que sobrevive quando o icone encolhe."""
    c = Canvas()
    c.rect(11, 5, 21, 8, "c")                     # gargalo, em sombra do acento
    c.rect(12, 5, 20, 6, "a")
    for j in range(19):                           # corpo bojudo, todo em acento
        y = 10 + j
        t = j / 18
        meia = int(6 + 8 * (1 - (t - 0.5) ** 2 * 3.4))
        c.rect(16 - meia, y, 16 + meia, y, "a")
        c.rect(16 - meia, y, 16 - meia + 2, y, "b")
        c.rect(16 + meia - 1, y, 16 + meia, y, "c")
    c.rect(8, 9, 24, 11, "d")                     # cordao escuro, contra o acento
    c.rect(9, 10, 23, 10, "g")
    c.rect(13, 22, 19, 27, "c")                   # vinco
    c.disc(24, 6, 3, "w")                         # moeda escapando
    c.ring(24, 6, 3, "g")
    c.set(23, 5, "b")
    return acabar(c)

def item_pedra():
    """Gema facetada. Tres faces com brilhos diferentes — e o que separa gema de
    pedra bruta, e a pedra evolutiva do jogo e joia, nao cascalho."""
    c = Canvas()
    for j in range(9):                            # coroa
        y = 6 + j
        meia = 5 + j
        c.rect(16 - meia, y, 16 + meia, y, "a")
    for j in range(15):                           # pavilhao afunilando
        y = 15 + j
        meia = 13 - j
        c.rect(16 - meia, y, 16 + meia, y, "a")
    c.line(16, 6, 3, 15, "b")                     # arestas da coroa
    c.line(16, 6, 29, 15, "c")
    c.line(3, 15, 16, 29, "c")
    c.line(29, 15, 16, 29, "e")
    c.line(16, 6, 16, 29, "b")
    for y in range(7, 15):                        # face esquerda mais clara
        for x in range(16 - (y - 6) - 4, 16):
            if c.px[y][x] == "a":
                c.set(x, y, "b")
    for y in range(16, 28):                       # face direita em sombra
        meia = 13 - (y - 15)
        c.rect(17, y, 16 + meia, y, "c")
    c.rect(11, 8, 13, 9, "w")                     # lampejo
    return acabar(c)


def item_cura():
    """Frasco bojudo com rolha. Silhueta larga embaixo — o oposto da ampola do
    reviver, que e estreita e alta: as duas nao podem virar a mesma mancha."""
    c = Canvas()
    c.rect(13, 3, 19, 7, "l")                     # rolha
    c.rect(14, 3, 18, 4, "g")
    c.rect(12, 7, 20, 9, "m")                     # gargalo
    for j in range(9):                            # ombro abrindo
        y = 9 + j
        meia = 4 + j
        c.rect(16 - meia, y, 16 + meia, y, "l")
    c.rect(3, 18, 29, 29, "l")                    # bojo
    c.rrect(3, 18, 29, 30, "l", r=2)
    c.rect(5, 20, 27, 29, "a")                    # liquido
    c.rect(5, 20, 27, 21, "b")                    # menisco
    c.rect(5, 27, 27, 29, "c")
    c.set(8, 24, "b"); c.set(9, 23, "b")          # bolhas
    c.set(22, 25, "b")
    c.rect(6, 12, 7, 16, "w")                     # reflexo no vidro
    return acabar(c)


def item_reviver():
    """Ampola alta e estreita, com cruz e uma faisca subindo."""
    c = Canvas()
    c.rect(13, 2, 19, 5, "g")                     # tampa metalica
    c.rect(14, 2, 18, 3, "w")
    c.rect(12, 5, 20, 27, "l")                    # corpo
    c.rect(14, 6, 18, 26, "a")                    # conteudo
    c.rect(14, 6, 18, 7, "b")
    c.rect(14, 24, 18, 26, "c")
    c.rect(11, 27, 21, 30, "l")                   # base
    c.rect(12, 28, 20, 30, "m")
    c.rect(15, 12, 17, 20, "w")                   # cruz
    c.rect(13, 15, 19, 17, "w")
    for x, y in ((23, 8), (25, 4), (21, 3)):      # faiscas subindo
        c.disc(x, y, 1, "a")
        c.set(x, y - 1, "b")
    return acabar(c)


def item_cla():
    """Estandarte tremulando na haste — o unico retangulo ONDULADO do conjunto."""
    c = Canvas()
    c.rect(5, 2, 7, 31, "m")                      # haste
    c.rect(5, 2, 5, 31, "l")
    c.rect(7, 2, 7, 31, "d")
    c.disc(6, 2, 2, "g")                          # ponteira
    for j in range(17):                           # pano, com a barra em onda
        y = 5 + j
        c.rect(8, y, 27, y, "a")
        c.set(27, y, "c")
    for x in range(8, 28):                        # ondulacao da barra
        import math
        h = int(2.4 * math.sin((x - 8) / 3.0))
        c.rect(x, 22, x, 23 + h, "a")
        c.set(x, 23 + h, "c")
    c.rect(8, 5, 27, 6, "b")                      # luz no topo do pano
    c.rect(14, 10, 21, 18, "e")                   # brasao
    c.rect(15, 11, 20, 13, "w")
    c.rect(16, 14, 19, 17, "w")
    return acabar(c)


def item_tm():
    """Disco de maquina: anel com furo central e um lampejo em diagonal."""
    c = Canvas()
    c.disc(16, 16, 14, "l")
    c.ring(16, 16, 14, "g")
    c.disc(16, 16, 12, "a")
    c.disc(16, 16, 8, "c")
    c.disc(16, 16, 5, "d")
    c.disc(16, 16, 3, "s")
    for r in (10, 12):                            # sulcos
        c.ring(16, 16, r, "b")
    c.line(8, 9, 14, 6, "w")                      # lampejo
    c.line(9, 10, 15, 7, "b")
    c.line(20, 25, 25, 21, "b")
    return acabar(c)


def item_carta():
    """Carta inclinada com o canto dobrado — a unica silhueta torta do conjunto, e
    com a FACE clara: carta escura nao le, e a face e o que se reconhece."""
    c = Canvas()
    for j in range(27):
        y = 3 + j
        off = j // 8
        c.rect(6 + off, y, 24 + off, y, "d")      # borda escura
        c.rect(7 + off, y, 23 + off, y, "a")      # face clara: a massa
    c.rect(7, 4, 23, 5, "b")
    c.rect(9, 8, 22, 10, "e")                     # faixa do titulo
    c.rect(10, 13, 22, 22, "e")                   # janela da arte
    c.rect(11, 14, 21, 21, "c")
    c.rect(13, 16, 19, 19, "b")
    c.rect(11, 25, 20, 26, "e")
    c.rect(21, 3, 25, 8, "d")                     # canto dobrado
    c.line(20, 8, 25, 3, "g")
    c.line(21, 8, 25, 4, "w")
    return acabar(c)

def item_diverso():
    """Engradado ABERTO com pecas soltas em cima. O bau da ferramenta Itens e
    fechado, com cinta e fechadura — este e de ripas e esta aberto, entao as duas
    silhuetas nao competem. Ripa clara sobre vao escuro: a 44px o que sobra e o
    listrado, e listrado nenhum outro icone tem."""
    c = Canvas()
    c.rect(4, 15, 28, 30, "e")                    # vao escuro atras das ripas
    for x in range(4, 29, 5):
        c.rect(x, 15, x + 2, 30, "a")
        c.rect(x, 15, x, 30, "b")
        c.rect(x + 2, 15, x + 2, 30, "c")
    c.rect(4, 15, 28, 17, "a")                    # aros
    c.rect(4, 15, 28, 15, "b")
    c.rect(4, 28, 28, 30, "a")
    c.rect(4, 30, 28, 30, "c")
    c.rect(4, 21, 28, 22, "a")
    c.disc(10, 9, 4, "a")                         # peca redonda saindo
    c.ring(10, 9, 4, "b")
    c.disc(10, 9, 1, "e")
    c.rrect(17, 4, 26, 13, "a", r=1)              # peca quadrada saindo
    c.rect(17, 4, 26, 5, "b")
    c.rect(17, 12, 26, 13, "c")
    c.rect(20, 7, 23, 10, "e")
    return acabar(c)

ICONES = {
    # estado do site
    "quebrada": (quebrada, "dex"),
    "vazio": (vazio, "acento"),
    "ao-vivo": (ao_vivo, "ok"),
    "snapshot": (snapshot, "aviso"),
    # categorias de item — a cor acompanha a categoria, a silhueta e que separa
    "item-drop": (item_drop, "itens"),
    "item-pedra": (item_pedra, "calculadora"),
    "item-cura": (item_cura, "dex"),
    "item-reviver": (item_reviver, "aviso"),
    "item-cla": (item_cla, "breeding"),
    "item-tm": (item_tm, "meta"),
    "item-carta": (item_carta, "acento"),
    "item-diverso": (item_diverso, "acento"),
}

if __name__ == "__main__":
    alvo = sys.argv[1:] or list(ICONES)
    for nome in alvo:
        fn, pal = ICONES[nome]
        save(fn(), pal, f"{nome}.json")
    print("ok:", ", ".join(alvo))
