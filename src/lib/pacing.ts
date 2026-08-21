/**
 * Piso de tempo de carregamento.
 *
 * O Eduardo pediu que a tela de loading SEMPRE apareca, mesmo quando o dado ja
 * esta em memoria e a pagina renderiza em 20ms. Sem isso o loading pisca ou nem
 * chega a existir, e o trabalho de anima-lo nao aparece pra ninguem.
 *
 * O que isso e, sem eufemismo: **a pagina fica de proposito mais lenta do que
 * poderia.** Vale saber o preco antes de manter — atrasar navegacao e a coisa
 * que a gente adora no primeiro dia e xinga no trigesimo, e mexe em metrica de
 * verdade (LCP, e o Google usa isso). Por isso a decisao mora num arquivo so,
 * com um interruptor a vista: `MINIMO_MS = 0` desliga tudo, sem tocar em pagina
 * nenhuma.
 *
 * O atraso e um PISO, nao uma soma: se a fonte demorou 1,8s, espera-se so os
 * 200ms que faltam. Ninguem paga duas vezes.
 */

/** Piso do tempo total de render. `0` desliga. */
export const MINIMO_MS = 1200;

/**
 * Espera o que faltar pra fechar o piso, contando de `inicio`.
 *
 * ```ts
 * const t0 = agora();
 * const dados = await buscar();
 * await fecharPiso(t0);
 * ```
 */
export const agora = (): number => Date.now();

export async function fecharPiso(inicio: number, minimo = MINIMO_MS): Promise<void> {
  if (minimo <= 0) return;
  const falta = minimo - (Date.now() - inicio);
  if (falta > 0) await new Promise((r) => setTimeout(r, falta));
}
