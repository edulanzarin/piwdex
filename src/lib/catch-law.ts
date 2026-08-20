// A LEI de captura, na parte PURA (sem token, sem banco) — o /hunt publico precisa dela.
//
// O jogo nao publica a chance de captura por especie: nao ha campo no catalogo, nao ha
// `pokepedia/systems/capture`, e o `catchChance` do hunt-config e ZERO em todo spot. O que
// da pra fazer e derivar, e o dado pra isso e o medidor de investimento do proprio jogo
// (/api/game/used-balls: bolas gastas por especie desde a ultima captura).
//
// Normalizando cada observacao pelo catchRate MEDIO das bolas usadas nela — a chance e
// linear na bola, e a formula do shiny visivel no bundle do jogo prova isso — o que
// explica a dificuldade e o VALOR DE VENDA, e forte: correlacao -0,82 em log-log (contra
// -0,65 sem normalizar).
//
//     chanceBase = a * sellValue^b
//     chance     = min(1, chanceBase * catchRate da bola)
//
// Conferencia independente: pro Yanma (9.000) a lei da 2,98% por abate com Ultra Ball; a
// hunt real mediu 2,4% (14 capturas em 586 abates).
//
// NAO e a formula do jogo. E ajuste empirico com erro mediano de ~1,9x — serve pra
// ORDENAR alvos. Na area logada o ajuste e refeito com as especies da conta de quem
// pergunta; aqui ficam os valores de partida, medidos em ago/2026.

export const CATCH_LAW_FALLBACK = { a: 4.738, b: -0.709 };

/** Chance de captura por ABATE prevista pela lei, com a bola informada. */
export function predictCatchRate(
  law: { a: number; b: number },
  sellValue: number,
  ballCatchRate: number,
): number {
  if (sellValue <= 0) return 0;
  return Math.min(1, law.a * Math.pow(sellValue, law.b) * Math.max(1, ballCatchRate));
}
