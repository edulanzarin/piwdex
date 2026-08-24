/**
 * ENGENHARIA REVERSA da tier list do piwtools.
 *
 * A pergunta nao e "copiar", e ENTENDER: os jogadores comparam as duas listas, e a
 * deles bate com a intuicao de quem joga (Rhydon alto, Gengar alto, muralha pura
 * baixa) enquanto a nossa nao. Antes de trocar o nosso calculo, vale descobrir que
 * grandeza a deles esta medindo.
 *
 * O metodo e o unico honesto com 35 pontos: calcular varias FORMULAS CANDIDATAS
 * sobre o nosso proprio catalogo e medir qual reproduz a ORDEM deles. Correlacao
 * de posto (Spearman) e nao de valor — a escala deles e desconhecida, mas a ordem
 * e observavel.
 */
import { getData } from "../src/lib/data";
import type { Creature } from "../src/lib/types";

/** O S-tier do piwtools, lido das capturas (24/08/2026). Posicao e nota. */
const DELES: [string, number][] = [
  ["Zapdos", 78.9], ["Moltres", 78.2], ["Mega Alakazam", 78.2], ["Rhydon", 77.4],
  ["Slaking", 77], ["Gengar", 76.6], ["Flareon", 76.5], ["Mewtwo", 76.1],
  ["Ho-oh", 75.5], ["Golem", 73.8], ["Tyranitar", 72], ["Dragonite", 71.5],
  ["Magneton", 71.1], ["Mew", 70.8], ["Charizard", 70.4], ["Aerodactyl", 69.1],
  ["Muk", 68.2], ["Mega Gardevoir", 68.1], ["Mega Lucario", 67], ["Arcanine", 66.9],
  ["Flygon", 66.5], ["Sceptile", 66.2], ["Rhyperior", 66], ["Haunter", 65.6],
  ["Entei", 65.6], ["Kangaskhan", 65.5], ["Rapidash", 65], ["Cloyster", 64.9],
  ["Exeggutor", 64.6], ["Articuno", 64.6], ["Snorlax", 63.7], ["Mega Altaria", 63.7],
  ["Magmar", 63.6], ["Alakazam", 63.3], ["Lugia", 63.2],
];

const db = await getData();

/** Acha a criatura pelo nome como o piwtools escreve. */
function achar(nome: string): Creature | undefined {
  const alvo = nome.toLowerCase().replace(/[^a-z]/g, "");
  return db.creatures.find((c) => c.name.toLowerCase().replace(/[^a-z]/g, "") === alvo);
}

/** Poder do melhor golpe ofensivo, com STAB. Sem alvo — e o que a coluna
 *  "Ranking ofensivo" deles parece medir (ela MOSTRA o nome de um golpe so). */
function melhorGolpe(c: Creature): { poder: number; dps: number } {
  let poder = 0;
  let dps = 0;
  for (const a of c.attacks) {
    if (a.power <= 0 || a.tm != null) continue;
    const stab = a.type === c.type1 || a.type === c.type2 ? 1.5 : 1;
    const off = a.category === "SPECIAL" ? c.baseSpAtk : c.baseAtk;
    const p = a.power * stab * off;
    const d = a.cooldownMs > 0 ? p / (a.cooldownMs / 1000) : 0;
    if (p > poder) poder = p;
    if (d > dps) dps = d;
  }
  return { poder, dps };
}

interface Candidata {
  nome: string;
  calc: (c: Creature) => number;
}

const CANDIDATAS: Candidata[] = [
  { nome: "soma de stats", calc: (c) => c.baseHp + c.baseAtk + c.baseDef + c.baseSpAtk + c.baseSpDef + c.baseSpeed },
  { nome: "maior ofensivo (atk ou spa)", calc: (c) => Math.max(c.baseAtk, c.baseSpAtk) },
  { nome: "melhor golpe (poder x stat)", calc: (c) => melhorGolpe(c).poder },
  { nome: "melhor golpe (dps)", calc: (c) => melhorGolpe(c).dps },
  { nome: "golpe + bulk", calc: (c) => melhorGolpe(c).poder / 1000 + (c.baseHp + c.baseDef + c.baseSpDef) },
  {
    nome: "golpe 55 + bulk 30 + speed 15",
    calc: (c) => {
      const g = melhorGolpe(c).poder / 400;
      const b = (c.baseHp + c.baseDef + c.baseSpDef) / 3;
      return 0.55 * g + 0.30 * b + 0.15 * c.baseSpeed;
    },
  },
  {
    nome: "ofensivo 60 + bulk 25 + speed 15 (so stat)",
    calc: (c) =>
      0.60 * Math.max(c.baseAtk, c.baseSpAtk) +
      0.25 * ((c.baseHp + c.baseDef + c.baseSpDef) / 3) +
      0.15 * c.baseSpeed,
  },
  {
    nome: "dps 55 + bulk 30 + speed 15",
    calc: (c) => {
      const g = melhorGolpe(c).dps / 300;
      const b = (c.baseHp + c.baseDef + c.baseSpDef) / 3;
      return 0.55 * g + 0.30 * b + 0.15 * c.baseSpeed;
    },
  },
];

/** Spearman: correlacao entre POSICOES, nao entre valores. A escala deles e
 *  desconhecida — a ordem nao. */
function spearman(a: number[], b: number[]): number {
  const posto = (xs: number[]) => {
    const idx = xs.map((v, i) => [v, i] as const).sort((x, y) => y[0] - x[0]);
    const r = new Array(xs.length).fill(0);
    idx.forEach(([, i], k) => (r[i] = k + 1));
    return r;
  };
  const ra = posto(a);
  const rb = posto(b);
  const n = a.length;
  let d2 = 0;
  for (let i = 0; i < n; i++) d2 += (ra[i] - rb[i]) ** 2;
  return 1 - (6 * d2) / (n * (n * n - 1));
}

const achados = DELES.map(([nome, nota]) => ({ nome, nota, c: achar(nome) }));
const faltando = achados.filter((x) => !x.c);
const ok = achados.filter((x) => x.c) as { nome: string; nota: number; c: Creature }[];

console.log(`\n${ok.length}/${DELES.length} especies casadas com o nosso catalogo`);
if (faltando.length) console.log(`  nao achei: ${faltando.map((x) => x.nome).join(", ")}`);

console.log(`\nCorrelacao de POSTO com a ordem do piwtools (1.0 = ordem identica):\n`);
const notas = ok.map((x) => x.nota);
const placar = CANDIDATAS.map((f) => ({
  nome: f.nome,
  rho: spearman(notas, ok.map((x) => f.calc(x.c))),
})).sort((a, b) => b.rho - a.rho);

for (const p of placar) {
  console.log(`  ${p.rho.toFixed(3).padStart(6)}   ${p.nome}`);
}

// ---------------------------------------------------------------------------
// Varredura de PESOS
// ---------------------------------------------------------------------------
//
// A candidata vencedora acertou a forma; falta o quanto de cada coisa. Como sao
// tres pesos que somam 1, da pra varrer o simplex inteiro em passo de 5% — sao
// 231 combinacoes, e testar todas custa menos que argumentar sobre uma.
//
// Os tres eixos entram NORMALIZADOS pelo maior do catalogo. Sem isso o peso nao
// significa nada: "0.55 de golpe" contra um numero na casa dos milhares e "0.30
// de bulk" contra um na casa das centenas nao sao 55% e 30% de coisa nenhuma.

const todos = db.creatures.filter((c) => c.captureBase == null || c.area === "orre");
const maxGolpe = Math.max(...todos.map((c) => melhorGolpe(c).poder));
const maxBulk = Math.max(...todos.map((c) => (c.baseHp + c.baseDef + c.baseSpDef) / 3));
const maxVel = Math.max(...todos.map((c) => c.baseSpeed));

let melhor = { g: 0, b: 0, v: 0, rho: -2 };
for (let g = 0; g <= 100; g += 5) {
  for (let b = 0; b + g <= 100; b += 5) {
    const v = 100 - g - b;
    const rho = spearman(
      notas,
      ok.map((x) => {
        const c = x.c;
        return (
          (g / 100) * (melhorGolpe(c).poder / maxGolpe) +
          (b / 100) * ((c.baseHp + c.baseDef + c.baseSpDef) / 3 / maxBulk) +
          (v / 100) * (c.baseSpeed / maxVel)
        );
      }),
    );
    if (rho > melhor.rho) melhor = { g, b, v, rho };
  }
}

console.log(`\nMELHOR AJUSTE de pesos (varredura de 231 combinacoes):`);
console.log(`  golpe ${melhor.g}%  ·  bulk ${melhor.b}%  ·  velocidade ${melhor.v}%`);
console.log(`  correlacao de posto: ${melhor.rho.toFixed(3)}`);
console.log("");
