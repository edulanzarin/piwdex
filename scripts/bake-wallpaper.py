#!/usr/bin/env python3
"""Gera o fundo do site a partir de assets/wallpaper.<ext>.

Por que assar a imagem em vez de tratar no CSS:

1. **`filter` numa camada de tela cheia custa composicao a cada scroll.**
   Assado, o custo e zero. Vale pro brilho e vale, sobretudo, pro DESFOQUE:
   `blur()` em `position: fixed` de tela inteira e a coisa mais cara que da pra
   pedir a um compositor.
2. **Peso.** O PNG fonte tem 8,5 MB; o que sai daqui tem dezenas de KB.
3. **O tratamento e derivado da FONTE.** Trocar o wallpaper e trocar o arquivo em
   `assets/` e rodar `npm run bake:wallpaper` — os numeros se recalculam.

A fonte fica em `assets/` (fora de `public/`) de proposito: ela nao e servida, so
alimenta este script. A EXTENSAO nao importa — jpg, png, webp, o que for. Ela
importava, e a arte nova chegou em png contra um `FONTE` cravado em `.jpg`;
descobrir isso e um erro de "faltou a fonte" com o arquivo ali do lado.
"""

from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter

RAIZ = Path(__file__).resolve().parent.parent
ASSETS = RAIZ / "assets"
DESTINO = RAIZ / "public" / "images"

# A PIXELIZACAO SAIU.
#
# Ela existia porque o site inteiro era pixel/neon de canto reto, e o fundo tinha
# de falar a mesma lingua. Com a virada pro console macio — raio, elevacao, Lexend,
# arte oficial em alta — um fundo em bloco de 4px passou a ser a unica peca da
# tela ainda no dialeto antigo. Fundo pixelizado atras de render oficial suavizado
# nao le como estilo, le como imagem de baixa resolucao.
PERFIS = [(2560, "wallpaper.webp"), (1280, "wallpaper-sm.webp")]

QUALIDADE = 80

# O ALVO e a luminancia media, nao o fator. Fator fixo so funciona pra uma arte:
# um 0.27 calculado pra uma foto de media 148 aplicado numa arte que ja nasce
# escura devolveria um retangulo preto. Medir a fonte e derivar o fator faz trocar
# o wallpaper ser trocar o arquivo — que e o que o cabecalho promete.
#
# A arte de ago/2026 (Pikachu sob a folha) mede 77 de media, contra 19 da cidade
# anterior: e a primeira fonte CLARA desde a foto original, e a primeira em que a
# funcao de brilho volta a ter trabalho (fator ~0.49).
ALVO = 38           # luminancia media do fundo, medida depois de assar
SATURACAO = 0.74    # so o suficiente pra cor de tipo/raridade ganhar da arte

# ---------------------------------------------------------------------------
# O DESFOQUE, e por que ele nao estava aqui antes
# ---------------------------------------------------------------------------
#
# A regra antiga era "a imagem NAO leva blur — quem borra e o vidro dos paineis",
# e ela era certa pra uma cidade neon: geometria dura, luz pontual, nada que o
# olho tente LER. A arte nova e ilustracao — tem um personagem no meio, folhagem
# desenhada, estrelas com contorno. Nitida atras de um painel de vidro ela nao le
# como ambiente, le como conteudo que alguem cobriu, e o olho volta pra ela.
#
# O raio e FRACAO DA LARGURA, nao pixel fixo: os dois perfis tem de sair com o
# mesmo desfoque APARENTE, e um raio de 3 num arquivo de 2560 e outra coisa num
# de 1280. E leve de proposito — o suficiente pra tirar a aresta da ilustracao,
# nao pra transformar a cena em mancha.
DESFOQUE = 1 / 850  # 2560 -> 3.0px, 1280 -> 1.5px


def fonte() -> Path:
    """A arte fonte, seja qual for a extensao."""
    achados = sorted(
        p for p in ASSETS.glob("wallpaper.*") if p.suffix.lower() != ".py"
    )
    if not achados:
        raise SystemExit(f"faltou a fonte: {ASSETS}/wallpaper.<ext>")
    if len(achados) > 1:
        raise SystemExit(
            "ha mais de um wallpaper em assets/ "
            f"({', '.join(p.name for p in achados)}) — deixe so o que vale."
        )
    return achados[0]


def fator_de_brilho(img) -> float:
    """Quanto multiplicar pra chegar no ALVO. Teto em 1.0: a funcao ESCURECE —
    clarear arte escura levantaria o ruido junto e nao e o que o fundo precisa."""
    amostra = list(img.convert("L").resize((64, 64)).get_flattened_data())
    media = sum(amostra) / len(amostra)
    return min(1.0, ALVO / max(1.0, media))


def assar(src: Image.Image, largura: int, nome: str) -> None:
    altura = round(largura * src.size[1] / src.size[0])

    # LANCZOS: reducao com o melhor detalhe preservado. O desfoque vem DEPOIS da
    # reducao, senao ele e reamostrado junto e cada perfil sai com um raio
    # aparente diferente.
    out = src.resize((largura, altura), Image.LANCZOS)
    out = out.filter(ImageFilter.GaussianBlur(largura * DESFOQUE))

    out = ImageEnhance.Color(out).enhance(SATURACAO)
    out = ImageEnhance.Brightness(out).enhance(fator_de_brilho(src))

    destino = DESTINO / nome
    out.save(destino, "WEBP", quality=QUALIDADE, method=6)

    amostra = sorted(out.convert("L").resize((64, 64)).get_flattened_data())
    media = sum(amostra) / len(amostra)
    kb = destino.stat().st_size / 1024
    print(
        f"  {nome:22} {largura}x{altura}  "
        f"luminancia media {media:.0f}  p98 {amostra[int(len(amostra) * 0.98)]:>3}  "
        f"{kb:.0f} KB"
    )


if __name__ == "__main__":
    f = fonte()
    src = Image.open(f).convert("RGB")
    bruto = sorted(src.convert("L").resize((64, 64)).get_flattened_data())
    print(
        f"assando de {f.name} ({src.size[0]}x{src.size[1]}, "
        f"media {sum(bruto) / len(bruto):.0f}, p98 {bruto[int(len(bruto) * 0.98)]}):"
    )
    DESTINO.mkdir(parents=True, exist_ok=True)
    for largura, nome in PERFIS:
        assar(src, largura, nome)
