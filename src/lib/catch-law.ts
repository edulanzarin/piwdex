// A LEI de captura, na parte PURA (sem token, sem banco) — o /hunt publico precisa dela.
//
// O jogo nao publica a chance de captura por especie, e isso foi VERIFICADO ate o fim:
// nao ha campo no catalogo; `pokepedia/systems/capture` responde 200 mas com o corpo de
// "ainda nao documentado"; os 38 chunks do bundle nao tem source map (114 URLs .map
// testadas, todas 404) nem qualquer identificador de chance de captura; e o `catchChance`
// do hunt-config e a chance de SHINY (o editor de admin do jogo rotula esse mesmo campo
// como `admin.shinyCatchChance`), nao a normal. O frame `catch-result` devolve so
// `success` — quem rola o dado e o servidor.
//
// Some-se o mecanismo que as proprias strings do jogo descrevem: alem da chance por
// arremesso (funcao de HP, nivel e bola), existe um MEDIDOR DE INVESTIMENTO por especie
// que sobe a cada bola e ZERA na captura. Ou seja, nem existe "a chance do Pinsir" como
// numero fixo — ela se move dentro de cada ciclo.
//
// Entao o caminho e derivar, e o dado pra isso e o proprio medidor
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
// Por que VALOR e nao nivel, ja que a copy do jogo fala em "HP, nivel e bola": porque foi
// testado. Nas 52 especies com bola suficiente, ja normalizadas pela bola, valor explica
// melhor (r -0,81, erro mediano 1,91x) que nivel (-0,69, 2,52x), XP (-0,70) ou stats
// (-0,55) — e juntar valor com nivel PIORA (2,06x). O HP da copy e do arremesso ativo num
// selvagem enfraquecido; na hunt os corpos ja estao abatidos, entao esse termo nao varia.
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
