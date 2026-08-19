"""Assa o wallpaper do site: public/images/wallpaper.jpg -> wallpaper.webp

O fundo e uma camada FIXA de tela cheia. Blur em runtime nessa camada e caro em
celular fraco, entao o desfoque vai assado no arquivo; no CSS sobram so brightness
e saturate (baratos), calibraveis pelos tokens --bg-* do globals.css.

    python3 scripts/bake-wallpaper.py

2560x1440 basta: a imagem fica desfocada e escurecida, detalhe fino nao aparece.
"""
from PIL import Image, ImageFilter
import os

SRC = "public/images/wallpaper.jpg"
OUT = "public/images/wallpaper.webp"
WIDTH, HEIGHT = 2560, 1440
BLUR = 4          # raio do desfoque assado
QUALITY = 80

im = Image.open(SRC).convert("RGB").resize((WIDTH, HEIGHT), Image.LANCZOS)
im = im.filter(ImageFilter.GaussianBlur(BLUR))
im.save(OUT, "WEBP", quality=QUALITY, method=6)

src_kb = os.path.getsize(SRC) / 1024
out_kb = os.path.getsize(OUT) / 1024
print(f"{SRC} ({src_kb:.0f} KB) -> {OUT} ({out_kb:.0f} KB)")
