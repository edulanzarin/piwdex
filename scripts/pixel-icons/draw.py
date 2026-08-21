"""Motor de desenho em grid de caractere -> JSON do render_pixel_art.py.

O icone se descreve por FORMA (retangulo, retangulo redondo, disco, linha), nao
por coordenada solta: 32x32 escrito a mao em JSON e erro de indice garantido.
"""
import json

N = 32

# Paleta base, tirada do proprio pokedex.png do Eduardo (quantizado) e alinhada
# com os tokens do globals.css.
BASE = {
    "k": "#000000",   # contorno duro
    "s": "#0B0D12",   # sombra profunda (o bg do site)
    "d": "#1A1E27",   # chassi escuro
    "m": "#262C38",   # chassi medio
    "l": "#39414F",   # chassi claro / aresta de luz
    "g": "#97A3B8",   # metal
    "w": "#E8EDF7",   # branco do texto
}

# a = cheio, b = brilho, c = sombra do acento, e = tela (acento bem escuro)
ACCENTS = {
    "itens":       ("#46E08A", "#8CF3BA", "#1E7A4A", "#0E3326"),
    "calculadora": ("#5B9DFF", "#A6C8FF", "#2A5296", "#0F2murky"),
    "hunt":        ("#FFB454", "#FFD79A", "#8F5A17", "#33220A"),
    "breeding":    ("#F472B6", "#FBAFD5", "#8C3468", "#33132A"),
    "meta":        ("#2EE6D6", "#8CF6EC", "#157A72", "#0A2F2E"),
}
ACCENTS["calculadora"] = ("#5B9DFF", "#A6C8FF", "#2A5296", "#0F1E38")


class Canvas:
    def __init__(self, n=N):
        self.n = n
        self.px = [["." for _ in range(n)] for _ in range(n)]

    def set(self, x, y, ch):
        if 0 <= x < self.n and 0 <= y < self.n and ch != ".":
            self.px[y][x] = ch

    def rect(self, x0, y0, x1, y1, ch):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, ch)

    def rrect(self, x0, y0, x1, y1, ch, r=1):
        """Retangulo com canto cortado — o canto reto de 1px e o que faz a peca
        parecer desenhada em pixel, e nao um div com border-radius."""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                dx = min(x - x0, x1 - x)
                dy = min(y - y0, y1 - y)
                if dx + dy < r:
                    continue
                self.set(x, y, ch)

    def outline(self, ch="k", over=None):
        """Contorno 4-vizinhos em volta de tudo que ja foi pintado."""
        alvo = set(over) if over else None
        novos = []
        for y in range(self.n):
            for x in range(self.n):
                if self.px[y][x] != ".":
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < self.n and 0 <= ny < self.n:
                        v = self.px[ny][nx]
                        if v != "." and (alvo is None or v in alvo):
                            novos.append((x, y))
                            break
        for x, y in novos:
            self.set(x, y, ch)

    def disc(self, cx, cy, r, ch):
        for y in range(self.n):
            for x in range(self.n):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.4:
                    self.set(x, y, ch)

    def ring(self, cx, cy, r, ch):
        for y in range(self.n):
            for x in range(self.n):
                d2 = (x - cx) ** 2 + (y - cy) ** 2
                if (r - 1) ** 2 < d2 <= r * r + r * 0.4:
                    self.set(x, y, ch)

    def line(self, x0, y0, x1, y1, ch):
        dx, dy = abs(x1 - x0), abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx - dy
        while True:
            self.set(x0, y0, ch)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 > -dy:
                err -= dy
                x0 += sx
            if e2 < dx:
                err += dx
                y0 += sy

    def art(self, rows, x0=0, y0=0):
        """Cola um bloco de texto — pra detalhe fino que forma nenhuma resolve."""
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                self.set(x0 + i, y0 + j, ch)

    def show(self):
        return "\n".join("".join(r) for r in self.px)

    def to_json(self, palette, pixel_size=40):
        pixels = []
        for y in range(self.n):
            for x in range(self.n):
                ch = self.px[y][x]
                if ch == ".":
                    continue
                pixels.append({"x": x, "y": y, "color": palette[ch]})
        return {
            "width": self.n,
            "height": self.n,
            "background": "transparent",
            "grid_lines": False,
            "pixel_size": pixel_size,
            "pixels": pixels,
        }


def palette_for(tool):
    a, b, c, e = ACCENTS[tool]
    p = dict(BASE)
    p.update({"a": a, "b": b, "c": c, "e": e})
    return p


def pad(canvas, n=44):
    """Reenquadra a arte numa moldura maior.

    O pokedex.png do Eduardo ocupa 73% da altura do arquivo; arte colada na
    borda ficaria visivelmente MAIOR que ele dentro da mesma caixa de CSS, e a
    fileira de icones perderia o alinhamento. Margem transparente em vez de
    reescala: o grid continua inteiro, sem reamostrar pixel.
    """
    novo = Canvas(n)
    off = (n - canvas.n) // 2
    for y in range(canvas.n):
        for x in range(canvas.n):
            novo.set(x + off, y + off, canvas.px[y][x])
    return novo


def save(canvas, tool, path, moldura=44):
    with open(path, "w") as f:
        json.dump(pad(canvas, moldura).to_json(palette_for(tool)), f)
