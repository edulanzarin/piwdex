// Cartao de compartilhamento, desenhado em canvas NO NAVEGADOR.
//
// Por que no cliente e nao no servidor: o dado ja esta todo na tela, e gerar a
// imagem aqui significa que nada do pokemon do jogador sai da maquina dele — a
// pagina nao precisa mandar nada pra lugar nenhum pra ele poder postar o print
// no grupo. Servidor de imagem seria uma rota nova, um cache novo e um dado de
// usuario trafegando, tudo pra desenhar 20 retangulos.
//
// O desenho segue a linguagem do site, e essa e a regra que manda: o que circula
// no grupo tem de parecer o site. Por isso ele foi REDESENHADO junto com a virada
// pro console macio — a versao anterior era do dialeto antigo e ficou orfa dele:
// grade de 20px no fundo, moldura dupla em fio neon, tudo de canto reto e os
// medidores em blocos.
//
// Os blocos sao o caso mais claro. O medidor da interface saiu de bloco pra linha
// continua de proposito (ver `ui/stat-bar.tsx`): bloco QUANTIZA um valor continuo,
// e com 14 deles cada um vale 7% — entao 17,6 e 19,9 de IV acendem o mesmo tanto
// e a barra afirma que sao iguais. Numa peca cujo trabalho e mostrar uma
// ESTIMATIVA, jogar fora a precisao e o defeito, nao o estilo.

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

// Os MESMOS tokens da interface, em hex — canvas nao le variavel CSS. Eles sao
// copia, e copia diverge: a regra e que trocar a paleta do site e trocar estas
// linhas, e o teste e abrir o cartao ao lado da tela.
const COR = {
  fundo: "#100e0c",       // --color-bg
  painel: "#1f1c18",      // --color-surface
  painel2: "#2a2521",     // --color-surface-2
  linha: "#2f2a26",       // --color-line
  linhaForte: "#3f3933",  // --color-line-strong
  texto: "#f0ecea",       // --color-text
  dim: "#c4bcb4",         // --color-text-dim
  mute: "#988f86",        // --color-text-mute
};

const RAIO = 18;

/** Retangulo de canto arredondado. `roundRect` e recente o bastante pra merecer
 *  reserva: sem ela, um navegador antigo nao desenha NADA e o cartao sai vazio —
 *  falha silenciosa e pior que canto reto. */
function caixa(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const k = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

/** Desenha com opacidade e devolve o alfa ao normal. `globalAlpha` em vez de
 *  `color-mix` no `fillStyle`: canvas depende do parser de cor do navegador pra
 *  funcao CSS, e quando ele nao entende nao pinta nada — falha calada. */
function rgba(cor: string, alfa: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(cor.trim());
  if (!m) return cor; // nao e hex: devolve como veio, e o alfa fica por conta do chamador
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}

function comAlfa(ctx: CanvasRenderingContext2D, alfa: number, desenhar: () => void) {
  const antes = ctx.globalAlpha;
  ctx.globalAlpha = alfa;
  desenhar();
  ctx.globalAlpha = antes;
}

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

/**
 * O MEDIDOR, na mesma forma do da interface: trilho em pilula, preenchimento
 * continuo e a faixa de incerteza ACESA por cima.
 *
 * A faixa tem piso de largura (1,5% do trilho). Sem ele, "de 25,0 a 25,1" vira
 * meio pixel, que o canvas arredonda pra zero — e some justamente o que o cartao
 * existe pra mostrar, que e o tamanho da duvida.
 */
function medidor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  largura: number,
  d: ShareStat,
  tint: string,
) {
  const h = 8;
  const trava = (v: number) => Math.max(0, Math.min(1, v));

  ctx.fillStyle = COR.painel2;
  caixa(ctx, x, y, largura, h, h / 2);
  ctx.fill();

  const cheio = trava(d.ratio) * largura;
  if (cheio > 0) {
    ctx.save();
    caixa(ctx, x, y, largura, h, h / 2);
    ctx.clip();
    comAlfa(ctx, 0.55, () => {
      ctx.fillStyle = tint;
      ctx.fillRect(x, y, cheio, h);
    });
    if (d.range) {
      const de = trava(d.range[0]) * largura;
      const ate = Math.max(de + largura * 0.015, trava(d.range[1]) * largura);
      ctx.fillStyle = tint;
      ctx.fillRect(x + de, y, ate - de, h);
    }
    ctx.restore();
  }
}


export async function desenharCartao(d: ShareCard): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // ---- o FUNDO, e o que saiu dele ----
  //
  // Saiu a grade de 20px e saiu a moldura dupla em fio na cor do pokemon. As
  // duas eram do dialeto de console-terminal, o mesmo que a faixa de topo das
  // ferramentas ja tinha abandonado: enfeite que nao pertence nao le como
  // "estilo diferente", le como peca que ninguem terminou.
  //
  // O que entra no lugar e o recurso que o site usa hoje pra dar profundidade:
  // uma superficie sobre o fundo, canto arredondado, e um halo de cor MUITO
  // diluido atras da arte. Luz e elevacao no lugar de fio e grade.
  ctx.fillStyle = COR.fundo;
  ctx.fillRect(0, 0, W, H);

  const M = 14;
  ctx.fillStyle = COR.painel;
  caixa(ctx, M, M, W - M * 2, H - M * 2, RAIO);
  ctx.fill();
  ctx.strokeStyle = COR.linha;
  ctx.lineWidth = 1;
  ctx.stroke();

  // A aresta de luz no topo — a mesma marca que faz o painel do site parecer
  // ter espessura. Custa uma linha e e o que separa "superficie" de "retangulo
  // mais claro".
  ctx.save();
  caixa(ctx, M, M, W - M * 2, H - M * 2, RAIO);
  ctx.clip();
  comAlfa(ctx, 0.06, () => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(M, M, W - M * 2, 1);
  });
  ctx.restore();

  const fam = familia();
  ctx.textBaseline = "alphabetic";

  // ---- coluna da esquerda: identidade ----
  const CX = 56;
  const ARTE_CX = CX + 92;
  const ARTE_CY = 158;

  // O halo sai da faixa da QUALITY, e nao do tipo: o cartao fala do INDIVIDUO
  // que a pessoa mediu, e a faixa e a leitura dele. Mesma decisao do cabecalho
  // da calculadora.
  //
  // O gradiente tem de MORRER em transparente, e as duas paradas nao podem ser a
  // mesma cor: com a mesma nos dois extremos ele desenha um disco de borda dura,
  // que le como adesivo colado em vez de luz. E a parada final e `rgba(...,0)` da
  // MESMA cor, e nao a palavra `transparent` — esta interpola por preto
  // transparente em parte dos motores e suja a borda do halo.
  const R = 190;
  const halo = ctx.createRadialGradient(ARTE_CX, ARTE_CY, 0, ARTE_CX, ARTE_CY, R);
  halo.addColorStop(0, rgba(d.tierColor, 0.34));
  halo.addColorStop(0.55, rgba(d.tierColor, 0.13));
  halo.addColorStop(1, rgba(d.tierColor, 0));
  ctx.save();
  caixa(ctx, M, M, W - M * 2, H - M * 2, RAIO);
  ctx.clip();
  ctx.fillStyle = halo;
  ctx.fillRect(ARTE_CX - R, ARTE_CY - R, R * 2, R * 2);
  ctx.restore();

  const img = d.spriteUrl ? await carregar(d.spriteUrl) : null;
  if (img) {
    // SUAVIZADO, e nao `imageSmoothingEnabled = false`. A arte que chega aqui e
    // o render oficial em alta — o mesmo do resto do site desde a virada —, e
    // escalar render suave com vizinho-mais-proximo so serrilha.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const L = 216;
    ctx.drawImage(img, ARTE_CX - L / 2, ARTE_CY - L / 2, L, L);
  }

  // O EPITETO acima do nome, na cor da faixa — o arranjo do card e da ficha.
  ctx.fillStyle = d.tierColor;
  ctx.font = `700 15px ${fam}`;
  pix(ctx, `${d.tierLabel} · quality ${d.quality}`, CX, 300);

  ctx.fillStyle = COR.texto;
  ctx.font = `700 40px ${fam}`;
  pix(ctx, d.nome, CX, 348);

  ctx.fillStyle = COR.mute;
  ctx.font = `700 16px ${fam}`;
  pix(ctx, `nível ${d.level}`, CX, 376);

  // Os tipos em PILULA. Aqui a palavra fica, e a regra e diferente da tela: o
  // cartao circula fora do site, onde ninguem tem tooltip nem aprendeu os
  // discos — o simbolo sozinho viraria enigma pra quem so viu a imagem.
  let tx = CX;
  ctx.font = `700 13px ${fam}`;
  for (const t of d.tipos) {
    const w = larguraPix(ctx, t.nome) + 26;
    comAlfa(ctx, 0.16, () => {
      ctx.fillStyle = t.cor;
      caixa(ctx, tx, 400, w, 28, 14);
      ctx.fill();
    });
    comAlfa(ctx, 0.5, () => {
      ctx.strokeStyle = t.cor;
      ctx.lineWidth = 1.5;
      caixa(ctx, tx, 400, w, 28, 14);
      ctx.stroke();
    });
    ctx.fillStyle = t.cor;
    pix(ctx, t.nome, tx + 13, 419);
    tx += w + 8;
  }

  // ---- divisor ----
  comAlfa(ctx, 0.9, () => {
    ctx.strokeStyle = COR.linha;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(320.5, 56);
    ctx.lineTo(320.5, H - 92);
    ctx.stroke();
  });

  // ---- coluna da direita: a leitura ----
  const RX = 360;
  const RW = W - M - 42 - RX;

  ctx.fillStyle = COR.mute;
  ctx.font = `700 13px ${fam}`;
  pix(ctx, "iv estimado", RX, 74);

  // O numero grande e o TOTAL vivem na mesma linha de base, e o segundo e
  // posicionado a partir da DIREITA da coluna. Antes ele saia de
  // `RX + medida(pct) + 200`, um deslocamento cravado que so ficava certo pra
  // um comprimento de texto: "100%" e "7%" empurravam o total pra lugares
  // diferentes, e num deles ele encostava na borda.
  ctx.fillStyle = d.confiavel ? d.tierColor : COR.mute;
  ctx.font = `700 66px ${fam}`;
  ctx.fillText(d.ivPct, RX, 138);

  ctx.fillStyle = COR.dim;
  ctx.font = `700 24px ${fam}`;
  const totalX = RX + RW - ctx.measureText(d.ivTotal).width;
  ctx.fillText(d.ivTotal, totalX, 138);

  ctx.fillStyle = COR.mute;
  ctx.font = `700 12px ${fam}`;
  pix(ctx, "do máximo", RX + 4, 162);
  pix(ctx, "iv total", totalX, 162);

  comAlfa(ctx, 0.9, () => {
    ctx.strokeStyle = COR.linha;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(RX, 190.5);
    ctx.lineTo(RX + RW, 190.5);
    ctx.stroke();
  });

  ctx.fillStyle = COR.mute;
  ctx.font = `700 12px ${fam}`;
  pix(ctx, "poder agora", RX, 220);
  ctx.fillStyle = COR.texto;
  ctx.font = `700 34px ${fam}`;
  // Sem projecao aqui: o cartao mostra o pokemon que a pessoa informou, e nao
  // uma versao dele que ainda nao existe.
  ctx.fillText(d.poder, RX, 254);

  // ---- os seis stats, 2 colunas ----
  const gap = 28;
  const colW = (RW - gap) / 2;
  const startY = 306;
  d.stats.forEach((st, i) => {
    const cx = RX + (i % 2) * (colW + gap);
    const cy = startY + Math.floor(i / 2) * 56;
    ctx.fillStyle = COR.mute;
    ctx.font = `700 12px ${fam}`;
    pix(ctx, st.label, cx, cy);
    ctx.fillStyle = COR.texto;
    ctx.font = `700 17px ${fam}`;
    ctx.fillText(st.texto, cx + colW - ctx.measureText(st.texto).width, cy + 1);
    medidor(ctx, cx, cy + 12, colW, st, d.tierColor);
  });

  // ---- rodape ----
  ctx.fillStyle = COR.mute;
  ctx.font = `700 15px ${fam}`;
  pix(ctx, "piwdex.com.br", CX, H - 44);
  // Sem rodape explicativo: o cartao vai pro grupo do jogo, onde ninguem le
  // legenda. Quando a leitura NAO fecha, ai sim vale a linha — e ela e a unica.
  if (!d.confiavel) {
    ctx.fillStyle = "#ffb454";
    ctx.font = `400 14px ${fam}`;
    const t = "leitura inconsistente: confira nível e quality";
    ctx.fillText(t, W - M - 42 - ctx.measureText(t).width, H - 44);
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
