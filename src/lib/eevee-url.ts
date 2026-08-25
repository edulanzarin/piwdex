// A pergunta do Eevee na URL.
//
// Mesmo contrato da calculadora, e com o mesmo alcance: viaja o ramo escolhido e
// o Eevee inteiro — nivel, quality e os seis stats. Os stats entram pela mesma
// razao que entram no `/calc`: sem eles o link abre uma tela que responde sobre
// outro pokemon, e "olha o meu" volta a ser print.
//
// O que NAO viaja e o IV. Ele nao e dado de entrada: e leitura, derivada dos seis
// stats pela formula. Mandar os dois seria mandar a pergunta e a resposta, e a
// resposta poderia chegar discordando da pergunta.

import { TROCAS } from "./eevee";

export interface EeveeState {
  /** indice em TROCAS */
  ramo: number;
  level: number;
  quality: number;
  /** os seis stats do SEU Eevee, ordem canonica; zeros = nao informado */
  stats: number[];
}

/** Fabrica, e nao constante compartilhada: o array de stats e mutavel, e espalhar
 *  uma constante com `...EMPTY_EEVEE` faria dois estados dividirem o MESMO array.
 *  Foi exatamente o defeito que o `slotVazio()` do Stadium teve. */
export const eeveeVazio = (): EeveeState => ({
  ramo: 0,
  level: 100,
  quality: 1,
  stats: [0, 0, 0, 0, 0, 0],
});

export const EMPTY_EEVEE = eeveeVazio();

const num = (v: string | null, fallback: number): number => {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function parseEeveeState(sp: URLSearchParams): EeveeState {
  // O ramo viaja por NOME e nao por indice: `?r=espeon` sobrevive a loja ganhar um
  // sexto destino, e `?r=4` viraria outro pokemon no dia em que a lista crescer.
  const nome = (sp.get("r") ?? "").toLowerCase();
  const i = TROCAS.findIndex((t) => t.nome.toLowerCase() === nome);
  const cru = (sp.get("s") ?? "").split("-");
  return {
    ramo: i >= 0 ? i : EMPTY_EEVEE.ramo,
    level: Math.max(1, num(sp.get("lv"), EMPTY_EEVEE.level)),
    quality: Math.max(0, num(sp.get("q"), EMPTY_EEVEE.quality)),
    stats: Array.from({ length: 6 }, (_, k) =>
      Math.max(0, num(cru[k] ?? null, 0)),
    ),
  };
}

export function buildEeveeSearch(s: EeveeState): string {
  const p = new URLSearchParams();
  if (s.ramo !== EMPTY_EEVEE.ramo)
    p.set("r", TROCAS[s.ramo].nome.toLowerCase());
  if (s.level !== EMPTY_EEVEE.level) p.set("lv", String(s.level));
  if (s.quality !== EMPTY_EEVEE.quality) p.set("q", String(s.quality));
  if (s.stats.some((v) => v > 0)) p.set("s", s.stats.join("-"));
  const str = p.toString();
  return str ? `?${str}` : "";
}
