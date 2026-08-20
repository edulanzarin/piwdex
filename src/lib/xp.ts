// Curva de XP do Poke Idle World — a mesma pro treinador e pro pokemon.
//
// A doc do jogo (pokepedia/systems/xp) publica a formula fechada:
//
//   XP total acumulado pra estar no nivel L = round( 50/3 * (L^3 - 6L^2 + 17L - 12) )
//
// Nao ha teto de nivel; a curva so fica mais cara. Cada abate paga XP pro TREINADOR e
// pro POKEMON ativo — dois niveis independentes na mesma curva.
//
// Conferido contra a conta real: no nivel 257 o jogo pede 3.264.100 XP pro proximo, e
// `total(258) - total(257)` da exatamente 3.264.100.

/** XP acumulado necessario pra estar no nivel L (L=1 -> 0). */
export function xpTotalForLevel(level: number): number {
  const L = Math.max(1, Math.floor(level));
  return Math.round((50 / 3) * (L ** 3 - 6 * L ** 2 + 17 * L - 12));
}

/** Quanto XP custa sair do nivel L pro L+1 — o tamanho do nivel. */
export function xpForLevelUp(level: number): number {
  const L = Math.max(1, Math.floor(level));
  return xpTotalForLevel(L + 1) - xpTotalForLevel(L);
}

export interface XpProgress {
  level: number;
  /** custo total deste nivel */
  need: number;
  /** XP ja feito dentro do nivel — null quando a fonte nao informa */
  done: number | null;
  /** quanto falta pro proximo nivel — null sem o `done` */
  left: number | null;
  /** 0..1 do nivel — null sem o `done` */
  pct: number | null;
}

/**
 * Progresso dentro do nivel. `totalXp` e o XP ACUMULADO do individuo (o numero que o
 * jogo guarda); quando a fonte nao manda esse campo, ainda dá pra dizer o TAMANHO do
 * nivel — que combinado com o XP/h da hunt ja responde "quanto tempo falta".
 */
export function xpProgress(level: number, totalXp?: number | null): XpProgress {
  const need = xpForLevelUp(level);
  if (totalXp == null || !Number.isFinite(totalXp) || totalXp <= 0) {
    return { level, need, done: null, left: null, pct: null };
  }
  const floor = xpTotalForLevel(level);
  // XP acumulado abaixo do piso do nivel = fonte inconsistente; trata como sem dado.
  const done = Math.max(0, Math.min(need, totalXp - floor));
  return { level, need, done, left: need - done, pct: need > 0 ? done / need : null };
}

/** Horas pra fechar o que falta do nivel, no ritmo informado. null = sem ritmo. */
export function hoursToLevel(p: XpProgress, xpPerHour: number): number | null {
  if (!xpPerHour || xpPerHour <= 0) return null;
  return (p.left ?? p.need) / xpPerHour;
}
