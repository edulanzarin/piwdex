// Formula de stats/IV/poder do Poke Idle World.
//
// Extraida e VERIFICADA contra o jogo (via engenharia reversa do calculo do
// piwtools + conferencia com valores reais do jogo):
//   stat  = round( (base + 2*IV) * (nivel/100) * qualidade^exp )
//   poder = round( soma(stats) * qualidade )
//   IV    = (stat / ((nivel/100) * qualidade^exp) - base) / 2
// exp por stat: HP e Speed = 0.95; ATK, DEF, SpAtk, SpDef = 0.8. ivMultiplier = 2.
//
// Conferencia (Electrode nv54, qualidade 1.8, base HP60/Atk50):
//   HP 113 -> IV 29.9 ; Atk 78 -> IV 20.1 ; soma 679 * 1.8 = 1222 de poder. Bate.
// Ver [[Poke Idle World - endpoints publicos de dados]].

// Ordem canonica: hp, atk, def, spAtk, spDef, speed.
export const STAT_KEYS = ["hp", "atk", "def", "spAtk", "spDef", "speed"] as const;
export const STAT_LABELS = ["HP", "ATK", "DEF", "SP.ATK", "SP.DEF", "SPEED"] as const;

const QUALITY_EXP = [0.95, 0.8, 0.8, 0.8, 0.8, 0.95];
const IV_MULT = 2;

/** Fator (nivel/100) * qualidade^exp de um stat — o multiplicador comum. */
function factor(level: number, quality: number, i: number): number {
  return (level / 100) * Math.pow(quality, QUALITY_EXP[i]);
}

/** Stat final de UM stat a partir de base, IV, nivel e qualidade. */
export function projectStat(base: number, iv: number, level: number, quality: number, i: number): number {
  return Math.round((base + IV_MULT * iv) * factor(level, quality, i));
}

/** Projeta os 6 stats + soma + poder. bases/ivs na ordem STAT_KEYS. */
export function projectAll(bases: number[], ivs: number[], level: number, quality: number) {
  const stats = bases.map((b, i) => projectStat(b, ivs[i], level, quality, i));
  const sum = stats.reduce((a, b) => a + b, 0);
  const power = Math.round(sum * quality);
  return { stats, sum, power };
}

/** IV individual a partir do stat observado (inverte a formula). Pode dar fracionario. */
export function estimateIv(base: number, stat: number, level: number, quality: number, i: number): number {
  const f = factor(level, quality, i);
  if (f === 0) return 0;
  return (stat / f - base) / IV_MULT;
}

/** Estima os 6 IVs (clamp em >=0) + total, a partir dos stats observados. */
export function estimateIvs(bases: number[], stats: number[], level: number, quality: number) {
  const ivs = bases.map((b, i) => Math.max(0, estimateIv(b, stats[i], level, quality, i)));
  const total = ivs.reduce((a, b) => a + b, 0);
  return { ivs, total };
}

/** Teto de IV do jogo. Estimativa acima disso nao e um bicho melhor — e sinal de
 *  que o nivel ou a qualidade informados estao errados. */
export const IV_MAX = 32;

/**
 * INTERVALO de IV compativel com o stat observado.
 *
 * O stat que o jogo mostra e ARREDONDADO, entao um mesmo numero na tela cabe num
 * intervalo de IV, nao num ponto. Isso nao e preciosismo: o fator
 * `(nivel/100) * qualidade^exp` cresce com o nivel, e em nivel baixo ele e tao
 * pequeno que meia unidade de stat vale dezenas de IV — num nivel 5, "HP 12" e
 * compativel com IV 4 e com IV 30 ao mesmo tempo.
 *
 * Devolver so o ponto medio faria a tela afirmar "IV 17,3" quando o dado nao
 * distingue 4 de 30. Quem mostra estimativa mostra a largura dela.
 */
export function ivRange(
  base: number, stat: number, level: number, quality: number, i: number,
): [number, number] {
  const f = factor(level, quality, i);
  if (f === 0) return [0, IV_MAX];
  return [
    ((stat - 0.5) / f - base) / IV_MULT,
    ((stat + 0.5) / f - base) / IV_MULT,
  ];
}

/** Poder a partir de stats ja observados (soma * qualidade). */
export function powerOf(stats: number[], quality: number): number {
  return Math.round(stats.reduce((a, b) => a + b, 0) * quality);
}
