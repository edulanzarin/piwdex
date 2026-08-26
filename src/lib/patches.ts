// O DIÁRIO DO CATÁLOGO: o que o JOGO mudou, e quando.
//
// A `/atualizacoes` conta o que eu mudei no site. Esta é a outra metade, e é a
// que muda a decisão de quem joga: no patch de 20/08/2026 o Ledian perdeu dois
// drops e o ouro por abate desabou. Quem trocou de caçada na véspera decidiu com
// um número que o jogo tinha acabado de aposentar, e não havia uma linha em
// lugar nenhum — nem aqui, nem no jogo — dizendo isso.
//
// A matéria-prima já existia e ninguém usava: o `source.ts` pergunta o ETag do
// `creatures.json` quase a cada visita e sabe o SEGUNDO em que o catálogo mudou.
// Só que ele usa esse sinal pra recarregar e joga fora — o que mudou nunca foi
// olhado. Este arquivo é o olhar.
//
// ---
//
// A ARMADILHA, e é ela que desenha o resto do arquivo.
//
// Comparar dois snapshots meus não compara duas versões do jogo. Compara duas
// versões do jogo VISTAS por duas versões da minha ingestão — e quando a minha
// muda, o diff mente com a maior confiança. No histórico do repositório o caso
// está pronto: entre 16/08 e 20/08 o diff acusa 481 das 482 espécies "mudando de
// golpe". O jogo não mexeu em golpe nenhum; foi o campo `tm` nascendo na minha
// normalização.
//
// Publicar isso seria inventar um patch. Então:
//
//   1. O snapshot carrega o número da PIPELINE que o produziu. Lados de pipeline
//      diferente não se comparam — a passada fica registrada como pulada, com o
//      motivo, em vez de virar notícia.
//   2. Mesmo dentro da mesma pipeline, mudança que atinge o catálogo INTEIRO é
//      tratada como suspeita e sai como aviso preso ao patch. Rebalanceamento
//      geral existe e é raro; mudança minha de shape é comum e se parece com
//      ele. Na dúvida, a tela diz que está em dúvida.
//
// É o mesmo princípio do piso de plausibilidade do `source.ts`: a fonte pode
// responder lixo, e "não sei" nunca pode sair como afirmação.

import type { Creature, Hunt, Item, Snapshot } from "./types";

/**
 * A versão da INGESTÃO — não do jogo, e não do site.
 *
 * Sobe UM a cada mudança em `scripts/ingest.mjs` que altere o valor de qualquer
 * campo comparado aqui: campo novo, default diferente, escala convertida. Quem
 * esquecer de subir troca um erro barulhento (uma passada pulada, dita na tela)
 * por um silencioso (um patch inventado, publicado com data e tudo).
 *
 * 1 = ingestão original.
 * 2 = `tm`, `area` e `captureBase` param de sumir na normalização (e94739e).
 */
export const PIPELINE = 2;

/** Acima disto, mudança do mesmo campo deixa de parecer patch e passa a parecer
 *  eu. Não bloqueia nada: vira aviso preso ao patch. */
const SUSPEITA = 0.55;

/** Teto de mudanças guardadas por patch. Patch grande de verdade passa de mil
 *  linhas, e o diário é versionado no git: sem teto, uma passada ruim vira um
 *  commit de dezenas de MB. O que foi cortado é CONTADO, nunca calado. */
const TETO = 1200;

export type Natureza =
  | "especie-nova"
  | "especie-sumiu"
  | "stat"
  | "tipo"
  | "raridade"
  | "nivel"
  | "xp"
  | "ouro"
  | "ouro-abate"
  | "evolucao"
  | "drop-novo"
  | "drop-sumiu"
  | "drop-chance"
  | "golpe-novo"
  | "golpe-sumiu"
  | "golpe-poder"
  | "golpe-recarga"
  | "golpe-nivel"
  | "item-novo"
  | "item-sumiu"
  | "item-preco"
  | "spot-novo"
  | "spot-sumiu"
  | "spot-nivel";

export type Familia = "especie" | "item" | "spot";

export interface Alvo {
  familia: Familia;
  /** `pokeId` da espécie, `id` do item, `slug` do ponto de caça */
  id: number | string;
  nome: string;
}

export interface Mudanca {
  natureza: Natureza;
  alvo: Alvo;
  /** o campo, o drop ou o golpe de que se fala. Ausente quando a natureza basta. */
  detalhe?: string;
  de?: number | string | null;
  para?: number | string | null;
}

export interface Patch {
  /** `AAAA-MM-DD`, com sufixo no segundo patch do mesmo dia. É a rota. */
  id: string;
  /** `AAAA-MM-DD` do lado novo */
  data: string;
  /** ISO do carimbo da fonte no lado NOVO */
  quando: string;
  /** ISO do carimbo do lado ANTERIOR: é o intervalo que esta entrada cobre */
  desde: string;
  pipeline: number;
  /** de onde saiu a comparação: `ingestao`, ou o par de revisões do git */
  origem: string;
  mudancas: Mudanca[];
  /** quantas mudanças o TETO cortou. 0 = a entrada está inteira. */
  cortadas: number;
  avisos: string[];
}

export interface Diario {
  pipeline: number;
  atualizadoEm: string;
  /** do mais novo pro mais antigo */
  patches: Patch[];
}

// ---------------------------------------------------------------------------
// O diff
// ---------------------------------------------------------------------------

const STATS: Array<[keyof Creature, string]> = [
  ["baseHp", "Vida"],
  ["baseAtk", "Ataque"],
  ["baseDef", "Defesa"],
  ["baseSpAtk", "Atq. Esp."],
  ["baseSpDef", "Def. Esp."],
  ["baseSpeed", "Velocidade"],
];

const porChave = <T, K extends string | number>(xs: T[], k: (x: T) => K): Map<K, T> =>
  new Map(xs.map((x) => [k(x), x]));

/**
 * O OURO POR ABATE — a única derivada que entra no diário, e a exceção precisa
 * de defesa.
 *
 * A regra do arquivo é comparar só o que vem cru da fonte, porque conta minha
 * que muda não é patch do jogo. Esta sobrevive à regra por dois motivos. Ela é
 * DEFINIÇÃO, não modelo: chance vezes quantidade vezes preço de balcão, sem um
 * parâmetro que eu possa ajustar depois e sem nada empírico dentro. E cada lado
 * é calculado com a mesma fórmula sobre o seu próprio catálogo, então a
 * diferença só pode ter vindo do jogo.
 *
 * Sem ela o diário fica tecnicamente correto e inútil. O patch de 20/08 sai como
 * cinco linhas de "Straw de 80% pra 4,4%" espalhadas entre outras 1.200, e a
 * única frase que muda a decisão de quem lê — o Ledian rende 13x menos ouro —
 * não aparece em lugar nenhum, porque ela não está em campo nenhum: está na
 * soma deles.
 */
function ouroPorAbate(c: Creature, precos: Map<string, number>): number {
  let total = 0;
  for (const l of c.loot ?? []) {
    const preco = precos.get(l.name);
    if (!preco) continue;
    // `chance` é 0..100000, então a probabilidade é ela sobre cem mil.
    total += (l.chance / 100_000) * ((l.minCount + l.maxCount) / 2) * preco;
  }
  return total;
}

/** Abaixo disto o ouro por abate mexeu, mas não o bastante pra alguém trocar de
 *  caçada — e um patch cheio de linhas de 3% enterra as de 13x. */
const OURO_MINIMO_FATOR = 1.2;
/** Ouro por abate de menos de dez peças é ruído de arredondamento em cima de um
 *  drop raro, não renda. */
const OURO_MINIMO_ABS = 10;

/** Chave de drop e de golpe é o NOME: o jogo não dá id a nenhum dos dois, e o
 *  nome é o que o jogador lê na tela. */
const porNome = <T extends { name: string }>(xs: T[]): Map<string, T> =>
  new Map(xs.map((x) => [x.name, x]));

type Valor = number | string | null | undefined;

function difEspecie(a: Creature, b: Creature, out: Mudanca[]): void {
  const alvo: Alvo = { familia: "especie", id: b.pokeId, nome: b.name };
  const poe = (natureza: Natureza, detalhe: string | undefined, de: Valor, para: Valor) => {
    out.push({ natureza, alvo, ...(detalhe ? { detalhe } : {}), de: de ?? null, para: para ?? null });
  };

  for (const [campo, rotulo] of STATS) {
    if (a[campo] !== b[campo]) poe("stat", rotulo, a[campo] as number, b[campo] as number);
  }
  if (a.type1 !== b.type1) poe("tipo", "primeiro tipo", a.type1, b.type1);
  if (a.type2 !== b.type2) poe("tipo", "segundo tipo", a.type2, b.type2);
  if (a.rarity !== b.rarity) poe("raridade", undefined, a.rarity, b.rarity);
  if (a.huntLevel !== b.huntLevel) poe("nivel", undefined, a.huntLevel, b.huntLevel);
  if (a.experience !== b.experience) poe("xp", undefined, a.experience, b.experience);
  // `sellValue` é o ouro por abate e `priceNpc` o preço de balcão. São dois
  // números diferentes que quase sempre andam juntos, e o primeiro é o que muda
  // a caçada — por isso cada um sai com o seu rótulo, e não somados.
  if (a.sellValue !== b.sellValue) poe("ouro", "por abate", a.sellValue, b.sellValue);
  if (a.priceNpc !== b.priceNpc) poe("ouro", "no balcão", a.priceNpc, b.priceNpc);
  if (a.evolvesToId !== b.evolvesToId) poe("evolucao", "evolui para", a.evolvesToId, b.evolvesToId);
  if (a.evolveLevel !== b.evolveLevel) poe("evolucao", "nível da evolução", a.evolveLevel, b.evolveLevel);

  const la = porNome(a.loot ?? []);
  const lb = porNome(b.loot ?? []);
  for (const [nome, drop] of lb) {
    const antes = la.get(nome);
    if (!antes) poe("drop-novo", nome, null, drop.chance);
    else if (antes.chance !== drop.chance) poe("drop-chance", nome, antes.chance, drop.chance);
  }
  for (const [nome, drop] of la) if (!lb.has(nome)) poe("drop-sumiu", nome, drop.chance, null);

  const ga = porNome(a.attacks ?? []);
  const gb = porNome(b.attacks ?? []);
  for (const [nome, g] of gb) {
    const antes = ga.get(nome);
    if (!antes) {
      poe("golpe-novo", nome, null, g.power);
      continue;
    }
    if (antes.power !== g.power) poe("golpe-poder", nome, antes.power, g.power);
    if (antes.cooldownMs !== g.cooldownMs) poe("golpe-recarga", nome, antes.cooldownMs, g.cooldownMs);
    if (antes.learnLevel !== g.learnLevel) poe("golpe-nivel", nome, antes.learnLevel, g.learnLevel);
  }
  for (const [nome, g] of ga) if (!gb.has(nome)) poe("golpe-sumiu", nome, g.power, null);
}

/**
 * O que mudou entre dois catálogos.
 *
 * Só compara o que vem CRU da fonte. Nada derivado entra aqui — índice reverso
 * de drop, tier, XP/h e ameaça são conta minha, e conta minha que muda não é
 * patch do jogo: isso é assunto da `/atualizacoes`.
 */
export function diffCatalogo(
  antes: Snapshot,
  depois: Snapshot,
): { mudancas: Mudanca[]; avisos: string[] } {
  const mudancas: Mudanca[] = [];
  const avisos: string[] = [];

  // Preço de balcão por nome de item, um mapa de cada lado: o ouro por abate de
  // ANTES tem que ser calculado com os preços de antes, senão uma mudança de
  // preço de item apareceria como mudança de drop.
  const precoAntes = new Map(antes.items.map((i) => [i.name, i.npcPrice]));
  const precoDepois = new Map(depois.items.map((i) => [i.name, i.npcPrice]));

  const ca = porChave(antes.creatures, (c: Creature) => c.pokeId);
  const cb = porChave(depois.creatures, (c: Creature) => c.pokeId);
  for (const [id, nova] of cb) {
    const velha = ca.get(id);
    if (!velha) {
      mudancas.push({
        natureza: "especie-nova",
        alvo: { familia: "especie", id, nome: nova.name },
        para: nova.huntLevel,
      });
      continue;
    }
    difEspecie(velha, nova, mudancas);

    const antesOuro = ouroPorAbate(velha, precoAntes);
    const depoisOuro = ouroPorAbate(nova, precoDepois);
    const relevante =
      Math.max(antesOuro, depoisOuro) >= OURO_MINIMO_ABS &&
      Math.max(antesOuro, depoisOuro) / Math.max(Math.min(antesOuro, depoisOuro), 1e-9) >= OURO_MINIMO_FATOR;
    if (relevante) {
      mudancas.push({
        natureza: "ouro-abate",
        alvo: { familia: "especie", id, nome: nova.name },
        de: Math.round(antesOuro * 10) / 10,
        para: Math.round(depoisOuro * 10) / 10,
      });
    }
  }
  for (const [id, velha] of ca) {
    if (cb.has(id)) continue;
    mudancas.push({
      natureza: "especie-sumiu",
      alvo: { familia: "especie", id, nome: velha.name },
      de: velha.huntLevel,
    });
  }

  const ia = porChave(antes.items, (i: Item) => i.id);
  const ib = porChave(depois.items, (i: Item) => i.id);
  for (const [id, novo] of ib) {
    const velho = ia.get(id);
    if (!velho) {
      mudancas.push({
        natureza: "item-novo",
        alvo: { familia: "item", id, nome: novo.name },
        para: novo.npcPrice,
      });
      continue;
    }
    if (velho.npcPrice !== novo.npcPrice) {
      mudancas.push({
        natureza: "item-preco",
        alvo: { familia: "item", id, nome: novo.name },
        de: velho.npcPrice,
        para: novo.npcPrice,
      });
    }
  }
  for (const [id, velho] of ia) {
    if (ib.has(id)) continue;
    mudancas.push({
      natureza: "item-sumiu",
      alvo: { familia: "item", id, nome: velho.name },
      de: velho.npcPrice,
    });
  }

  const ha = porChave(antes.hunts, (h: Hunt) => h.slug);
  const hb = porChave(depois.hunts, (h: Hunt) => h.slug);
  for (const [slug, novo] of hb) {
    const velho = ha.get(slug);
    if (!velho) {
      mudancas.push({
        natureza: "spot-novo",
        alvo: { familia: "spot", id: slug, nome: novo.name },
        para: novo.level,
      });
      continue;
    }
    // Posição no mapa (`pixel`, `range`) fica de fora de propósito: o jogo mexe
    // o marcador uns pixels e ninguém troca de decisão por isso. Nível, sim.
    if (velho.level !== novo.level) {
      mudancas.push({
        natureza: "spot-nivel",
        alvo: { familia: "spot", id: slug, nome: novo.name },
        de: velho.level,
        para: novo.level,
      });
    }
  }
  for (const [slug, velho] of ha) {
    if (hb.has(slug)) continue;
    mudancas.push({
      natureza: "spot-sumiu",
      alvo: { familia: "spot", id: slug, nome: velho.name },
      de: velho.level,
    });
  }

  // ---- a guarda de suspeita ----
  // Conta por (natureza + detalhe), que é o grão em que uma mudança minha de
  // shape aparece: não é "o Bulbasaur mudou", é "TODO MUNDO mudou o mesmo campo".
  const universo = Math.max(depois.creatures.length, 1);
  const conta = new Map<string, number>();
  for (const m of mudancas) {
    if (m.alvo.familia !== "especie") continue;
    conta.set(`${m.natureza} ${m.detalhe ?? ""}`, (conta.get(`${m.natureza} ${m.detalhe ?? ""}`) ?? 0) + 1);
  }
  for (const [chave, n] of conta) {
    if (n / universo < SUSPEITA) continue;
    const [natureza, detalhe] = chave.split(" ");
    avisos.push(
      `${n} das ${universo} espécies mudaram ${detalhe || naturezaLabel(natureza as Natureza)} na mesma passada. ` +
        "Rebalanceamento geral parece com isso, e mudança da minha ingestão também — " +
        "este bloco merece conferência antes de ser lido como patch do jogo.",
    );
  }

  return { mudancas, avisos };
}

/**
 * A comparação vale?
 *
 * Devolve o MOTIVO quando não vale, e `null` quando vale — a forma que obriga o
 * chamador a olhar o motivo, em vez de um booleano que ele lê ao contrário.
 */
export function podeComparar(antes: Snapshot, depois: Snapshot): string | null {
  const pa = antes.pipeline ?? 1;
  const pb = depois.pipeline ?? 1;
  if (pa !== pb) {
    return `a ingestão mudou entre as duas pontas (pipeline ${pa} contra ${pb}): o diff mediria a minha mudança, não a do jogo`;
  }
  if (!antes.creatures?.length || !depois.creatures?.length) return "um dos lados está vazio";
  return null;
}

// ---------------------------------------------------------------------------
// Ordenação e prosa
// ---------------------------------------------------------------------------

/** Chance de loot vem na escala 0..100000; a porcentagem é ela dividida por mil. */
export const chancePct = (chance: number): number => chance / 1000;

const ehNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Quanto esta mudança MEXE, de 0 a 1 — e é isto que ordena a página.
 *
 * Ordenar por natureza (todo ouro, depois todo XP) enterraria o nerf do Ledian
 * embaixo de vinte espécies que mudaram 1 de ouro. O que interessa a quem lê não
 * é o campo, é o tamanho do tranco.
 */
export function impacto(m: Mudanca): number {
  switch (m.natureza) {
    case "especie-nova":
    case "especie-sumiu":
    case "spot-novo":
    case "spot-sumiu":
      return 1;
    case "drop-sumiu":
    case "drop-novo":
    case "golpe-novo":
    case "golpe-sumiu":
    case "tipo":
    case "raridade":
    case "evolucao":
      return 0.8;
    case "item-novo":
    case "item-sumiu":
      return 0.5;
    default:
      break;
  }
  if (!ehNum(m.de) || !ehNum(m.para)) return 0.4;
  // O ouro por abate entra com meio ponto de vantagem: ele é a frase que troca a
  // caçada de quem lê, e sem o piso um nerf de 13x na renda sairia embaixo dos
  // cinco drops que o causaram — a consequência abaixo da causa.
  if (m.natureza === "ouro-abate") {
    const r = Math.max(Math.abs(m.de), Math.abs(m.para)) / Math.max(Math.min(Math.abs(m.de), Math.abs(m.para)), 1e-9);
    return Math.min(0.99, 0.5 + Math.log10(Math.max(r, 1)) / 2);
  }
  const de = Math.abs(m.de);
  const para = Math.abs(m.para);
  if (de === 0 && para === 0) return 0;
  // Razão, e não diferença: 493 -> 38 de ouro conta mais que 8.000 -> 8.600 de
  // XP, embora a diferença bruta do segundo seja maior.
  const razao = Math.max(de, para) / Math.max(Math.min(de, para), 1e-9);
  return Math.min(0.95, Math.log10(Math.max(razao, 1)) / 2);
}

export const porImpacto = (a: Mudanca, b: Mudanca): number => impacto(b) - impacto(a);

const NATUREZA_LABEL: Record<Natureza, string> = {
  "especie-nova": "espécie nova",
  "especie-sumiu": "espécie removida",
  stat: "stat base",
  tipo: "tipo",
  raridade: "raridade",
  nivel: "nível de caça",
  xp: "XP por abate",
  ouro: "ouro",
  "ouro-abate": "ouro por abate",
  evolucao: "evolução",
  "drop-novo": "drop novo",
  "drop-sumiu": "drop removido",
  "drop-chance": "chance de drop",
  "golpe-novo": "golpe novo",
  "golpe-sumiu": "golpe removido",
  "golpe-poder": "poder de golpe",
  "golpe-recarga": "recarga de golpe",
  "golpe-nivel": "nível do golpe",
  "item-novo": "item novo",
  "item-sumiu": "item removido",
  "item-preco": "preço de item",
  "spot-novo": "ponto de caça novo",
  "spot-sumiu": "ponto de caça removido",
  "spot-nivel": "nível do ponto",
};

export const naturezaLabel = (n: Natureza): string => NATUREZA_LABEL[n] ?? n;

/** A família a que a natureza pertence — a página agrupa por ela. */
export const familiaDe = (n: Natureza): Familia =>
  n.startsWith("item-") ? "item" : n.startsWith("spot-") ? "spot" : "especie";

const fmt = (n: number): string =>
  Number.isInteger(n)
    ? n.toLocaleString("pt-BR")
    : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** "13x menos", "2,4x mais". O fator só aparece quando diz mais que os dois
 *  números crus — ou seja, quando é grande. */
export function fator(de: number, para: number): string | null {
  if (de <= 0 || para <= 0) return null;
  const r = para > de ? para / de : de / para;
  if (r < 1.5) return null;
  const s = r >= 10 ? String(Math.round(r)) : fmt(Math.round(r * 10) / 10);
  return `${s}x ${para > de ? "mais" : "menos"}`;
}

/**
 * A mudança em uma frase, do ponto de vista de quem joga.
 *
 * O SUJEITO é opcional, e isso é correção de uma tela ruim. Na ficha do patch as
 * mudanças vêm agrupadas por alvo, com o nome dele no cabeçalho do bloco — e
 * cada linha repetia esse mesmo nome: "Ledian rende 37,5...", "Ledian: Bug Gosme
 * de 15%...", seis vezes embaixo de um cabeçalho escrito LEDIAN. O nome virava a
 * primeira palavra de toda linha, que é o lugar onde o olho procura o que MUDOU.
 *
 * Fora do grupo (o cartão da lista, uma busca por espécie) o sujeito é
 * obrigatório, porque ali a linha viaja sozinha.
 */
export function frase(m: Mudanca, opts: { sujeito?: boolean } = {}): string {
  const { liga, texto } = parte(m);
  if (opts.sujeito === false) return texto.charAt(0).toUpperCase() + texto.slice(1);
  return `${m.alvo.nome}${liga}${texto}`;
}

/** O corpo da frase sem o sujeito, e como ele se liga a ele. `liga` é ": " onde
 *  o sujeito é rótulo do que vem depois, e " " onde ele é quem pratica. */
function parte(m: Mudanca): { liga: string; texto: string } {
  const de = m.de;
  const para = m.para;
  const v = (x: unknown) => (ehNum(x) ? fmt(x) : String(x ?? "nada"));
  const salto = ehNum(de) && ehNum(para) ? fator(de, para) : null;
  const sufixo = salto ? ` — ${salto}` : "";
  const rotulo = (texto: string) => ({ liga: ": ", texto });
  const acao = (texto: string) => ({ liga: " ", texto });

  switch (m.natureza) {
    case "especie-nova":
      return acao(`entrou no catálogo${ehNum(para) && para > 0 ? `, caçável no nível ${v(para)}` : ""}.`);
    case "especie-sumiu":
      return acao("saiu do catálogo.");
    case "stat":
      return rotulo(`${m.detalhe} base de ${v(de)} pra ${v(para)}${sufixo}.`);
    case "tipo":
      return rotulo(`${m.detalhe} de ${v(de)} pra ${v(para)}.`);
    case "raridade":
      return acao(`mudou de raridade: ${v(de)} virou ${v(para)}.`);
    case "nivel":
      return acao(`passou a ser caçado no nível ${v(para)}, e não mais ${v(de)}.`);
    case "xp":
      return acao(`dá ${v(para)} de XP por abate, contra ${v(de)} antes${sufixo}.`);
    case "ouro":
      return rotulo(`${m.detalhe} de ${v(de)} pra ${v(para)} de ouro${sufixo}.`);
    case "ouro-abate":
      return acao(`rende ${v(para)} de ouro por abate, contra ${v(de)} antes${sufixo}.`);
    case "evolucao":
      return rotulo(`${m.detalhe} de ${v(de)} pra ${v(para)}.`);
    case "drop-novo":
      return acao(`passou a dropar ${m.detalhe}${ehNum(para) ? ` (${fmt(chancePct(para))}%)` : ""}.`);
    case "drop-sumiu":
      return acao(`parou de dropar ${m.detalhe}${ehNum(de) ? ` (dropava a ${fmt(chancePct(de))}%)` : ""}.`);
    case "drop-chance":
      return rotulo(`${m.detalhe} de ${ehNum(de) ? fmt(chancePct(de)) : "?"}% pra ${ehNum(para) ? fmt(chancePct(para)) : "?"}%${sufixo}.`);
    case "golpe-novo":
      return acao(`aprendeu ${m.detalhe}${ehNum(para) && para > 0 ? `, de ${v(para)} de poder` : ""}.`);
    case "golpe-sumiu":
      return acao(`perdeu ${m.detalhe}.`);
    case "golpe-poder":
      return rotulo(`${m.detalhe} de ${v(de)} pra ${v(para)} de poder${sufixo}.`);
    case "golpe-recarga":
      return rotulo(`${m.detalhe} recarrega em ${ehNum(para) ? fmt(para / 1000) : "?"}s, e não mais ${ehNum(de) ? fmt(de / 1000) : "?"}s${sufixo}.`);
    case "golpe-nivel":
      return acao(`aprende ${m.detalhe} no nível ${v(para)}, e não mais ${v(de)}.`);
    case "item-novo":
      return acao("entrou no catálogo de itens.");
    case "item-sumiu":
      return acao("saiu do catálogo de itens.");
    case "item-preco":
      return acao(`vale ${v(para)} de ouro no NPC, contra ${v(de)} antes${sufixo}.`);
    case "spot-novo":
      return acao(`abriu como ponto de caça${ehNum(para) && para > 0 ? `, no nível ${v(para)}` : ""}.`);
    case "spot-sumiu":
      return acao("deixou de ser ponto de caça.");
    case "spot-nivel":
      return acao(`virou ponto de nível ${v(para)}, e não mais ${v(de)}.`);
  }
}

/** Sem acento e em minúscula — mesma normalização da busca da dex e dos itens. */
export const semAcento = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** A mudança bate com o que foi digitado? Procura no NOME do alvo e no detalhe
 *  (o drop, o golpe, o campo), que é o que a pessoa tem na cabeça: ela busca
 *  "Ledian" ou "Straw", e não "drop-chance". */
export function combina(m: Mudanca, termo: string): boolean {
  const t = semAcento(termo.trim());
  if (!t) return true;
  return semAcento(m.alvo.nome).includes(t) || semAcento(m.detalhe ?? "").includes(t);
}

/** Quantas mudanças de cada natureza, da mais frequente pra menos. */
export function resumo(p: Patch): Array<{ natureza: Natureza; n: number }> {
  const conta = new Map<Natureza, number>();
  for (const m of p.mudancas) conta.set(m.natureza, (conta.get(m.natureza) ?? 0) + 1);
  return [...conta.entries()]
    .map(([natureza, n]) => ({ natureza, n }))
    .sort((a, b) => b.n - a.n || a.natureza.localeCompare(b.natureza));
}

/** Quantos alvos distintos o patch tocou — a medida de tamanho que quem lê
 *  entende, muito mais do que a contagem de mudanças. */
export function alvosTocados(p: Patch, familia: Familia): number {
  const s = new Set<string>();
  for (const m of p.mudancas) if (m.alvo.familia === familia) s.add(String(m.alvo.id));
  return s.size;
}

/** Junta o patch por alvo, na ordem do que mais mexeu — é assim que a ficha do
 *  patch se lê: por bicho, não por campo. */
export function porAlvo(p: Patch): Array<{ alvo: Alvo; mudancas: Mudanca[]; peso: number }> {
  const mapa = new Map<string, { alvo: Alvo; mudancas: Mudanca[]; peso: number }>();
  for (const m of p.mudancas) {
    const k = `${m.alvo.familia}:${m.alvo.id}`;
    const g = mapa.get(k) ?? { alvo: m.alvo, mudancas: [], peso: 0 };
    g.mudancas.push(m);
    g.peso = Math.max(g.peso, impacto(m));
    mapa.set(k, g);
  }
  const saida = [...mapa.values()];
  for (const g of saida) g.mudancas.sort(porImpacto);
  return saida.sort((a, b) => b.peso - a.peso || b.mudancas.length - a.mudancas.length);
}

/**
 * Monta a entrada do diário.
 *
 * O `id` sai da data, com sufixo quando o dia já tem patch: dois patches no
 * mesmo dia acontecem (o 20/08 teve um às 00h47 e outro às 04h16), e uma rota
 * por dia perderia o segundo.
 */
/** Quando o JOGO publicou este catalogo. Cai na hora da captura só nos snapshots
 *  anteriores ao diário, que não guardavam a data da fonte. */
export const carimbo = (s: Snapshot): string => s.publicadoEm || s.generatedAt;

export function montaPatch(args: {
  antes: Snapshot;
  depois: Snapshot;
  origem: string;
  jaExistem: Patch[];
}): Patch | null {
  const { antes, depois, origem, jaExistem } = args;
  const { mudancas, avisos } = diffCatalogo(antes, depois);
  if (!mudancas.length) return null;

  const ordenadas = [...mudancas].sort(porImpacto);
  const cortadas = Math.max(0, ordenadas.length - TETO);
  const quando = carimbo(depois);
  const data = quando.slice(0, 10);
  const irmaos = jaExistem.filter((p) => p.data === data).length;

  return {
    id: irmaos ? `${data}-${irmaos + 1}` : data,
    data,
    quando,
    desde: carimbo(antes),
    pipeline: depois.pipeline ?? PIPELINE,
    origem,
    mudancas: ordenadas.slice(0, TETO),
    cortadas,
    avisos,
  };
}

export const DIARIO_VAZIO: Diario = { pipeline: PIPELINE, atualizadoEm: "", patches: [] };
