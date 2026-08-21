// Cartao de compartilhamento, desenhado em canvas NO NAVEGADOR.
//
// Por que no cliente e nao no servidor: o dado ja esta todo na tela, e gerar a
// imagem aqui significa que nada do pokemon do jogador sai da maquina dele — a
// pagina nao precisa mandar nada pra lugar nenhum pra ele poder postar o print
// no grupo. Servidor de imagem seria uma rota nova, um cache novo e um dado de
// usuario trafegando, tudo pra desenhar 20 retangulos.
//
// O desenho e proposital em pixel/neon: e a mesma linguagem do site, e o que
// circula no grupo tem de parecer o site.

export interface ShareStat {
  label: string;
  /** texto ja formatado ("25–32" ou "30,1") */
  texto: string;
  /** 0..1 */
  ratio: number;
  range?: [number, number];
}

export interface ShareCard {
  nome: string;
  level: number;
  quality: number;
  tierLabel: string;
  tierColor: string;
  tipos: { nome: string; cor: string }[];
  spriteUrl: string | null;
  stats: ShareStat[];
  ivTotal: string;
  ivPct: string;
  poder: string;
  /** null quando a leitura nao fecha — o cartao nao pode anunciar nota inventada */
  confiavel: boolean;
  tint: string;
}

const W = 1000;
const H = 520;

const COR = {
  fundo: "#0b0d12",
  grade: "#151920",
  linha: "#272d38",
  linhaForte: "#39414f",
  texto: "#e8edf7",
  dim: "#97a3b8",
  mute: "#5f6b80",
  trilho: "#1c212b",
};

/** Carrega a imagem pronta pra canvas. `crossOrigin` e obrigatorio: sem ele o
 *  canvas fica "tainted" e o `toBlob` explode em SecurityError. */
function carregar(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // sem sprite o cartao ainda vale
    img.src = src;
  });
}

/** A familia real que o next/font gerou — em canvas nao da pra usar a variavel
 *  CSS, entao lemos a pilha ja resolvida do proprio body. */
function familia(): string {
  if (typeof window === "undefined") return "sans-serif";
  const f = getComputedStyle(document.body).fontFamily;
  return f || "sans-serif";
}

function pix(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number) {
  // caixa alta com tracking, como a classe `.pix` da interface
  const letras = texto.toUpperCase().split("");
  let cursor = x;
  for (const l of letras) {
    ctx.fillText(l, cursor, y);
    cursor += ctx.measureText(l).width + 1.4;
  }
  return cursor - x;
}

function larguraPix(ctx: CanvasRenderingContext2D, texto: string): number {
  return texto
    .toUpperCase()
    .split("")
    .reduce((a, l) => a + ctx.measureText(l).width + 1.4, 0);
}

function blocos(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  largura: number,
  d: ShareStat,
  tint: string,
) {
  const n = 14;
  const gap = 2;
  const w = (largura - gap * (n - 1)) / n;
  const trava = (v: number) => Math.max(0, Math.min(1, v));
  const cheio = Math.round(trava(d.ratio) * n);
  const de = d.range ? Math.floor(trava(d.range[0]) * n) : cheio;
  const ate = d.range ? Math.max(de + 1, Math.ceil(trava(d.range[1]) * n)) : cheio;

  for (let i = 0; i < n; i++) {
    const naFaixa = d.range ? i >= de && i < ate : false;
    const aceso = i < cheio || naFaixa;
    ctx.globalAlpha = aceso ? (naFaixa ? 1 : 0.55) : 1;
    ctx.fillStyle = aceso ? tint : COR.trilho;
    ctx.fillRect(x + i * (w + gap), y, w, 10);
  }
  ctx.globalAlpha = 1;
}

export async function desenharCartao(d: ShareCard): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const fam = familia();
  ctx.textBaseline = "alphabetic";

  // ---- fundo e grade ----
  ctx.fillStyle = COR.fundo;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = COR.grade;
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
    ctx.stroke();
  }

  // ---- moldura na cor do pokemon ----
  ctx.strokeStyle = d.tint;
  ctx.lineWidth = 3;
  ctx.strokeRect(10.5, 10.5, W - 21, H - 21);
  ctx.globalAlpha = 0.25;
  ctx.strokeRect(18.5, 18.5, W - 37, H - 37);
  ctx.globalAlpha = 1;

  // ---- coluna da esquerda: identidade ----
  const CX = 40;
  const img = d.spriteUrl ? await carregar(d.spriteUrl) : null;
  if (img) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, CX + 22, 52, 160, 160);
  }

  ctx.fillStyle = COR.texto;
  ctx.font = `700 34px ${fam}`;
  pix(ctx, d.nome, CX, 262);

  ctx.fillStyle = d.tint;
  ctx.font = `700 20px ${fam}`;
  pix(ctx, `nível ${d.level}`, CX, 296);

  let tx = CX;
  ctx.font = `700 14px ${fam}`;
  for (const t of d.tipos) {
    const w = larguraPix(ctx, t.nome) + 22;
    ctx.strokeStyle = t.cor;
    ctx.lineWidth = 2;
    ctx.strokeRect(tx + 0.5, 320.5, w, 30);
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = t.cor;
    ctx.fillRect(tx, 320, w, 30);
    ctx.globalAlpha = 1;
    ctx.fillStyle = t.cor;
    pix(ctx, t.nome, tx + 11, 340);
    tx += w + 8;
  }

  ctx.strokeStyle = COR.linha;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(CX, 376.5);
  ctx.lineTo(CX + 220, 376.5);
  ctx.stroke();

  ctx.fillStyle = COR.mute;
  ctx.font = `700 13px ${fam}`;
  pix(ctx, "poder", CX, 404);
  ctx.fillStyle = COR.texto;
  ctx.font = `700 40px ${fam}`;
  ctx.fillText(d.poder, CX, 446);

  // ---- divisor ----
  ctx.strokeStyle = COR.linhaForte;
  ctx.beginPath();
  ctx.moveTo(300.5, 44);
  ctx.lineTo(300.5, H - 44);
  ctx.stroke();

  // ---- coluna da direita: a leitura ----
  const RX = 336;
  ctx.fillStyle = COR.mute;
  ctx.font = `700 14px ${fam}`;
  pix(ctx, "iv estimado", RX, 68);

  ctx.fillStyle = d.confiavel ? d.tint : COR.mute;
  ctx.font = `700 64px ${fam}`;
  ctx.fillText(d.ivPct, RX, 132);

  ctx.fillStyle = COR.dim;
  ctx.font = `700 22px ${fam}`;
  ctx.fillText(d.ivTotal, RX + ctx.measureText(d.ivPct).width + 200, 132);

  ctx.fillStyle = COR.mute;
  ctx.font = `700 13px ${fam}`;
  pix(ctx, "do máximo", RX + 4, 156);
  pix(ctx, "iv total", RX + ctx.measureText(d.ivPct).width + 204, 156);

  // quality
  ctx.strokeStyle = COR.linha;
  ctx.beginPath();
  ctx.moveTo(RX, 180.5);
  ctx.lineTo(W - 44, 180.5);
  ctx.stroke();

  ctx.fillStyle = COR.mute;
  ctx.font = `700 13px ${fam}`;
  pix(ctx, "quality", RX, 210);
  ctx.fillStyle = d.tierColor;
  ctx.font = `700 24px ${fam}`;
  ctx.fillText(String(d.quality), RX + 90, 213);
  ctx.font = `700 16px ${fam}`;
  pix(ctx, d.tierLabel, RX + 160, 211);

  // ---- os seis stats, 2 colunas ----
  const colW = 300;
  const startY = 254;
  d.stats.forEach((st, i) => {
    const cx = RX + (i % 2) * (colW + 24);
    const cy = startY + Math.floor(i / 2) * 66;
    ctx.fillStyle = COR.mute;
    ctx.font = `700 13px ${fam}`;
    pix(ctx, st.label, cx, cy);
    ctx.fillStyle = COR.texto;
    ctx.font = `700 18px ${fam}`;
    const w = ctx.measureText(st.texto).width;
    ctx.fillText(st.texto, cx + colW - w, cy + 2);
    blocos(ctx, cx, cy + 14, colW, st, d.tint);
  });

  // ---- rodape ----
  ctx.strokeStyle = COR.linha;
  ctx.beginPath();
  ctx.moveTo(40, H - 58.5);
  ctx.lineTo(W - 40, H - 58.5);
  ctx.stroke();

  ctx.fillStyle = d.tint;
  ctx.font = `700 17px ${fam}`;
  pix(ctx, "piwdex.com.br", 40, H - 30);
  // Sem rodape explicativo: o cartao vai pro grupo do jogo, onde ninguem le
  // legenda. Quando a leitura NAO fecha, ai sim vale a linha — e ela e a unica.
  if (!d.confiavel) {
    ctx.fillStyle = "#ffb454";
    ctx.font = `400 14px ${fam}`;
    const t = "leitura inconsistente: confira nível e quality";
    ctx.fillText(t, W - 40 - ctx.measureText(t).width, H - 30);
  }

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

/** Copia pra area de transferencia; devolve false quando o navegador nao deixa
 *  (Firefox ainda nao escreve imagem), e ai o chamador baixa o arquivo. */
export async function copiarImagem(blob: Blob): Promise<boolean> {
  try {
    if (!("ClipboardItem" in window)) return false;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}

export function baixarImagem(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}
