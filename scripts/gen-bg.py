#!/usr/bin/env python3
"""Gera o fundo pixel-art noturno do piwdex (cena de rota) e salva escalado grande.
Procedural pra nao ter que colocar milhares de pixels na mao. Roda com Pillow.
"""
import random
from PIL import Image

random.seed(70)  # piwdex = porta 4070; deterministico pra o build ser reproduzivel

W, H = 320, 180
SCALE = 8  # 2560x1440, pixels nitidos via nearest

img = Image.new("RGB", (W, H))
px = img.load()

# --- ceu: gradiente vertical de azul-noite pra quase preto ---
top = (20, 26, 58)
bot = (7, 10, 22)
for y in range(H):
    t = y / (H - 1)
    r = int(top[0] + (bot[0] - top[0]) * t)
    g = int(top[1] + (bot[1] - top[1]) * t)
    b = int(top[2] + (bot[2] - top[2]) * t)
    for x in range(W):
        px[x, y] = (r, g, b)

def blend(x, y, color, a):
    if 0 <= x < W and 0 <= y < H:
        o = px[x, y]
        px[x, y] = tuple(int(o[i] + (color[i] - o[i]) * a) for i in range(3))

# --- estrelas ---
for _ in range(220):
    x, y = random.randint(0, W - 1), random.randint(0, int(H * 0.7))
    c = random.choice([(255, 255, 255), (207, 227, 255), (180, 200, 255)])
    blend(x, y, c, random.uniform(0.4, 1.0))

# --- lua grande (canto sup. direito), com leve cratera ---
mx, my, mr = 250, 40, 22
for y in range(my - mr, my + mr):
    for x in range(mx - mr, mx + mr):
        d = ((x - mx) ** 2 + (y - my) ** 2) ** 0.5
        if d <= mr:
            shade = 1 - (d / mr) * 0.25
            base = (232, 236, 214)
            col = tuple(int(c * shade) for c in base)
            # halo interno mais frio na borda
            px[x, y] = col
# crateras
for cx, cy, cr in [(244, 34, 4), (256, 46, 3), (248, 48, 2)]:
    for y in range(cy - cr, cy + cr + 1):
        for x in range(cx - cr, cx + cr + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= cr * cr:
                blend(x, y, (198, 202, 178), 0.6)
# halo da lua
for _ in range(600):
    ang = random.uniform(0, 6.283)
    rr = mr + random.uniform(0, 14)
    x = int(mx + rr * random.uniform(-1, 1))
    y = int(my + rr * random.uniform(-1, 1))
    if (x - mx) ** 2 + (y - my) ** 2 > mr * mr:
        blend(x, y, (200, 215, 255), 0.03)

# --- montanhas distantes (silhueta azulada) ---
def hill(cx, base_y, width, height, color):
    for x in range(cx - width, cx + width):
        t = 1 - abs(x - cx) / width
        h = int(height * t)
        for y in range(base_y - h, base_y):
            blend(x, y, color, 1.0)

hill(70, 138, 70, 46, (26, 34, 60))
hill(150, 140, 90, 60, (22, 30, 54))
hill(250, 138, 80, 40, (24, 32, 58))

# --- neblina/base ---
for y in range(120, 150):
    a = (y - 120) / 30 * 0.25
    for x in range(W):
        blend(x, y, (40, 60, 90), a * 0.5)

# --- chao (grama noturna) ---
ground_y = 148
for y in range(ground_y, H):
    t = (y - ground_y) / (H - ground_y)
    col = (int(14 + 10 * t), int(30 + 18 * (1 - t)), int(22 + 8 * t))
    for x in range(W):
        px[x, y] = col
# textura de grama
for _ in range(1400):
    x = random.randint(0, W - 1)
    y = random.randint(ground_y, H - 1)
    blend(x, y, random.choice([(20, 52, 34), (12, 34, 24), (28, 66, 42)]), 0.5)

# --- arvores silhueta (copas arredondadas) ---
def tree(cx, base_y, size, color):
    # tronco
    for y in range(base_y - size, base_y):
        for x in range(cx - 1, cx + 1):
            blend(x, y, (18, 22, 18), 1.0)
    # copa
    top_y = base_y - size
    for y in range(top_y - size, top_y + 3):
        for x in range(cx - size, cx + size):
            d = ((x - cx) ** 2 + ((y - (top_y - size // 2)) * 1.2) ** 2) ** 0.5
            if d <= size:
                blend(x, y, color, 1.0)

random.seed(7)
for i in range(9):
    cx = 10 + i * 38 + random.randint(-6, 6)
    s = random.randint(9, 15)
    tree(cx, ground_y + 4, s, (16, 30, 24))

# --- pokebola distante como "segundo satelite" (bem sutil, canto esq sup) ---
bx, by, br = 40, 30, 9
for y in range(by - br, by + br + 1):
    for x in range(bx - br, bx + br + 1):
        d = ((x - bx) ** 2 + (y - by) ** 2) ** 0.5
        if d <= br:
            if abs(y - by) <= 1:
                blend(x, y, (30, 30, 34), 0.5)
            elif y < by:
                blend(x, y, (200, 70, 70), 0.35)
            else:
                blend(x, y, (220, 220, 225), 0.32)
blend(bx, by, (30, 30, 34), 0.6)

# escala nearest -> pixels nitidos
big = img.resize((W * SCALE, H * SCALE), Image.NEAREST)
big.save("public/bg-pixel.png")
print("ok", big.size)
