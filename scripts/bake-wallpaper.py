#!/usr/bin/env python3
"""Gera o fundo do site a partir de assets/wallpaper.jpg.

Por que assar a imagem em vez de tratar no CSS:

1. **Escurecer no CSS e uniforme; o problema e o PICO.** O wallpaper original
   tem luminancia media 148 mas vai de nuvem clara (229) a folhagem escura na
   MESMA linha. Um scrim uniforme forte o bastante pra domar a nuvem apaga a
   folhagem — some a imagem inteira. Rebaixar por pixel trata os dois.
2. **`filter` numa camada de tela cheia custa composicao a cada scroll.**
   Assado, o custo e zero.
3. **Peso.** Pixelizar comprime absurdamente bem: 1,9 MB -> 45 KB.

O JPG fonte fica em `assets/` (fora de `public/`) de proposito: ele nao e
servido, so alimenta este script. Trocar o wallpaper e substituir o arquivo e
rodar `npm run bake:wallpaper`.
"""

from pathlib import Path
from PIL import Image, ImageEnhance

RAIZ = Path(__file__).resolve().parent.parent
FONTE = RAIZ / "assets" / "wallpaper.jpg"
DESTINO = RAIZ / "public" / "images"

# A PIXELIZACAO SAIU.
#
# Ela existia porque o site inteiro era pixel/neon de canto reto, e o fundo tinha
# de falar a mesma lingua. Com a virada pro console macio — raio, elevacao, Lexend,
# arte oficial em alta — um fundo em bloco de 4px passou a ser a unica peca da
# tela ainda no dialeto antigo. Fundo pixelizado atras de render oficial suavizado
# nao le como estilo, le como imagem de baixa resolucao.
#
# O que o script mantem, e que era o valor de verdade dele: medir a fonte e
# DERIVAR o quanto escurecer. Ver `fator_de_brilho`.
PERFIS = [(2560, "wallpaper.webp"), (1280, "wallpaper-sm.webp")]

QUALIDADE = 80

# O ALVO e a luminancia media, nao o fator. Fator fixo so funciona pra uma arte:
# o 0.27 daqui foi calculado pra uma foto de media 148, e aplicado numa arte que
# ja nasce escura (a cidade neon, media 44) devolveria um retangulo preto. Medir a
# fonte e derivar o fator faz trocar o wallpaper ser trocar o arquivo — que e o
# que o cabecalho deste script promete.
# A arte NOVA ja nasce escura (media 19 medida no arquivo, contra 44 da anterior
# e 148 da foto original). O ALVO continua em 38 e a funcao so ESCURECE, entao ela
# passa reto — o que e o comportamento certo: nao ha o que domar. O numero fica
# como teto pra o dia em que a fonte for uma arte clara de novo.
ALVO = 38           # luminancia media do fundo, medida depois de assar
SATURACAO = 0.78    # so o suficiente pra cor de tipo/raridade ganhar da arte
AZUL = 1.06         # a arte ja e azul-noite; empurrar mais vira monocromatico


def fator_de_brilho(img) -> float:
    """Quanto multiplicar pra chegar no ALVO. Teto em 1.0: a funcao ESCURECE —
    clarear arte escura levantaria o ruido junto e nao e o que o fundo precisa."""
    amostra = list(img.convert("L").resize((64, 64)).get_flattened_data())
    media = sum(amostra) / len(amostra)
    return min(1.0, ALVO / max(1.0, media))


def assar(largura: int, nome: str) -> None:
    src = Image.open(FONTE).convert("RGB")
    altura = round(largura * src.size[1] / src.size[0])

    # LANCZOS: reducao com o melhor detalhe preservado. Antes havia aqui um
    # BOX seguido de NEAREST pra fabricar o pixel; sem pixel, o que se quer e
    # descer sem serrilhar.
    out = src.resize((largura, altura), Image.LANCZOS)

    out = ImageEnhance.Color(out).enhance(SATURACAO)
    out = ImageEnhance.Brightness(out).enhance(fator_de_brilho(src))

    r, g, b = out.split()
    out = Image.merge("RGB", (
        r.point(lambda v: int(v * 0.88)),
        g.point(lambda v: int(v * 0.95)),
        b.point(lambda v: min(255, int(v * AZUL))),
    ))

    destino = DESTINO / nome
    out.save(destino, "WEBP", quality=QUALIDADE, method=6)

    amostra = list(out.convert("L").resize((16, 16)).get_flattened_data())
    media = sum(amostra) / len(amostra)
    kb = destino.stat().st_size / 1024
    print(f"  {nome:22} {largura}x{altura}  "
          f"luminancia {media:.0f}  {kb:.0f} KB")


if __name__ == "__main__":
    if not FONTE.exists():
        raise SystemExit(f"faltou a fonte: {FONTE}")
    DESTINO.mkdir(parents=True, exist_ok=True)
    print(f"assando de {FONTE.name}:")
    for largura, nome in PERFIS:
        assar(largura, nome)
