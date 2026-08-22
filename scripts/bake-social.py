#!/usr/bin/env python3
"""Gera o icone do site e a imagem de compartilhamento.

Por que assar e nao gerar em tempo de request:

1. **O favicon tem de ser ESTAVEL.** Trocar depois leva semanas pra o Google
   reprocessar, e no intervalo o resultado da busca fica sem icone nenhum.
2. **A og:image por ficha nao vale o risco agora.** Gerar por request numa rota
   que ja e dinamica, com fallback que pode ir buscar sprite fora, pendura a
   resposta — e a resposta e o que o rastreador mede.

Fonte da arte: o mesmo wallpaper do site e a mesma pokebola da marca, desenhada
aqui em vez de importada — o componente e SVG no React, e repetir 30 linhas de
circulo em Python custa menos que arrastar um pipeline de SVG pra ca.

Rodar: `npm run bake:social`
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
FONTE_TTF = Path("/tmp/oxanium.ttf")          # baixada do repo do Google Fonts
WALLPAPER = RAIZ / "public" / "images" / "wallpaper.webp"
APP = RAIZ / "src" / "app"

VERMELHO = (255, 92, 114)
ESCURO = (11, 13, 18)
CLARO = (232, 237, 247)
NEON = (46, 230, 214)
ACENTO = (168, 191, 224)


def pokebola(lado: int) -> Image.Image:
    """A marca: metade vermelha, metade clara, faixa e miolo. Desenhada em 4x e
    reduzida — circulo pequeno sem supersampling vira escada."""
    s = lado * 4
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    borda = max(2, s // 22)
    d.ellipse([0, 0, s - 1, s - 1], fill=CLARO, outline=ESCURO, width=borda)
    d.pieslice([0, 0, s - 1, s - 1], 180, 360, fill=VERMELHO, outline=ESCURO, width=borda)
    faixa = s // 11
    d.rectangle([0, s // 2 - faixa // 2, s, s // 2 + faixa // 2], fill=ESCURO)
    miolo = s // 5
    c = s // 2
    d.ellipse([c - miolo, c - miolo, c + miolo, c + miolo], fill=CLARO, outline=ESCURO, width=borda)
    d.ellipse([c - miolo // 2, c - miolo // 2, c + miolo // 2, c + miolo // 2], fill=VERMELHO)
    return im.resize((lado, lado), Image.LANCZOS)


def fonte(tamanho: int, peso: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONTE_TTF), tamanho)
    try:
        f.set_variation_by_axes([peso])   # Oxanium e variavel: o eixo e o peso
    except Exception:
        pass
    return f


def icone() -> None:
    """Favicon: so a pokebola. Num quadrado de 32px o aparelho da home vira
    mancha — o que sobrevive nesse tamanho e a silhueta mais simples."""
    for lado, nome in [(512, "icon.png"), (180, "apple-icon.png")]:
        fundo = Image.new("RGBA", (lado, lado), ESCURO + (255,))
        bola = pokebola(int(lado * 0.82))
        fundo.paste(bola, ((lado - bola.width) // 2, (lado - bola.height) // 2), bola)
        fundo.save(APP / nome)
        print(f"  {nome:20} {lado}x{lado}  {(APP / nome).stat().st_size / 1024:.0f} KB")


def social() -> None:
    """1200x630: a proporcao que WhatsApp, Discord e Twitter cortam sem perder o
    meio. O fundo e o wallpaper do site — quem ve o card reconhece o site antes
    de ler o nome."""
    L, A = 1200, 630
    fundo = Image.open(WALLPAPER).convert("RGB")
    escala = max(L / fundo.width, A / fundo.height)
    fundo = fundo.resize((round(fundo.width * escala), round(fundo.height * escala)), Image.LANCZOS)
    x = (fundo.width - L) // 2
    y = int(fundo.height * 0.10)
    im = fundo.crop((x, y, x + L, y + A))

    # Veu escuro: o card leva texto grande por cima, e a cidade neon tem pico
    # claro. Mesmo problema do wallpaper, mesma solucao — so que aqui uniforme
    # basta, porque a area de texto e conhecida.
    veu = Image.new("RGBA", (L, A), (0, 0, 0, 0))
    ImageDraw.Draw(veu).rectangle([0, 0, L, A], fill=(6, 7, 10, 150))
    im = Image.alpha_composite(im.convert("RGBA"), veu).convert("RGB")

    d = ImageDraw.Draw(im)
    bola = pokebola(120)
    im.paste(bola, (96, 150), bola)

    d.text((240, 150), "PIW", font=fonte(104, 700), fill=CLARO)
    largura_piw = d.textlength("PIW", font=fonte(104, 700))
    d.text((240 + largura_piw, 150), "dex", font=fonte(104, 700), fill=ACENTO)

    d.text((240, 272), "DEX E FERRAMENTAS DE POKE IDLE WORLD", font=fonte(26, 600), fill=(151, 163, 184))

    d.text((96, 380), "Stats, drops com a chance real, onde farmar cada item,", font=fonte(34, 500), fill=CLARO)
    d.text((96, 428), "rota de caça e tier list — direto do catálogo do jogo.", font=fonte(34, 500), fill=CLARO)

    d.text((96, 516), "piwdex.com.br", font=fonte(28, 600), fill=NEON)

    # JPEG e nao PNG: o card e uma FOTO com texto por cima, e em PNG ele sai com
    # 610 KB — peso que o rastreador baixa a cada rastreio e o WhatsApp a cada
    # link colado. Em JPEG 88 a diferenca visivel e nenhuma e o arquivo cai 80%.
    destino = APP / "opengraph-image.jpg"
    im.save(destino, quality=88, optimize=True, progressive=True)
    print(f"  {'opengraph-image.jpg':20} {L}x{A}  {destino.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    if not FONTE_TTF.exists():
        raise SystemExit(
            "faltou a Oxanium: baixe o TTF variavel do repo do Google Fonts em /tmp/oxanium.ttf\n"
            "  curl -sL -o /tmp/oxanium.ttf https://github.com/google/fonts/raw/main/ofl/oxanium/Oxanium%5Bwght%5D.ttf"
        )
    print("assando icone e card social:")
    icone()
    social()
