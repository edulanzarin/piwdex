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

# bloco: tamanho do "pixel" em px na imagem final. 8 no 2560 e o ponto em que
# ainda se le PIXEL, mas uma fresta estreita entre paineis mostra estrutura
# suficiente pra parecer cena — a 16 aquilo virava artefato de compressao.
PERFIS = [(2560, "wallpaper.webp", 8), (1280, "wallpaper-sm.webp", 4)]

BRILHO = 0.27       # media alvo ~37 (de 148)
SATURACAO = 0.44    # a arte crua briga com a cor de tipo/raridade por cima
AZUL = 1.20         # puxa pro azul-noite do tema


def assar(largura: int, nome: str, bloco: int) -> None:
    src = Image.open(FONTE).convert("RGB")
    altura = round(largura * src.size[1] / src.size[0])

    # BOX na descida (media dos pixels do bloco) e NEAREST na subida (mantem a
    # borda dura). Inverter os dois devolve um borrao, nao pixel art.
    out = src.resize((largura // bloco, altura // bloco), Image.BOX)
    out = out.resize((largura, altura), Image.NEAREST)

    out = ImageEnhance.Color(out).enhance(SATURACAO)
    out = ImageEnhance.Brightness(out).enhance(BRILHO)

    r, g, b = out.split()
    out = Image.merge("RGB", (
        r.point(lambda v: int(v * 0.88)),
        g.point(lambda v: int(v * 0.95)),
        b.point(lambda v: min(255, int(v * AZUL))),
    ))

    destino = DESTINO / nome
    out.save(destino, "WEBP", quality=90, method=6)

    amostra = list(out.convert("L").resize((16, 16)).get_flattened_data())
    media = sum(amostra) / len(amostra)
    kb = destino.stat().st_size / 1024
    print(f"  {nome:22} {largura}x{altura}  bloco {bloco}px  "
          f"luminancia {media:.0f}  {kb:.0f} KB")


if __name__ == "__main__":
    if not FONTE.exists():
        raise SystemExit(f"faltou a fonte: {FONTE}")
    DESTINO.mkdir(parents=True, exist_ok=True)
    print(f"assando de {FONTE.name}:")
    for largura, nome, bloco in PERFIS:
        assar(largura, nome, bloco)
