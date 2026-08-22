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
 * 200ms que faltam. Ninguem paga duas vezes. E RASTREADOR nao paga nada — ver
 * `ehRastreador` no fim do arquivo.
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

/**
 * Quem NAO espera: rastreador.
 *
 * O piso existe pra uma pessoa ver a tela de carregamento. Robo de busca nao ve
 * tela nenhuma — ele mede o tempo até o primeiro byte e vai embora. Como as rotas
 * sao dinamicas, o piso era pago em TODA renderizacao, e um rastreamento das ~910
 * fichas que o sitemap anuncia custava ~18 minutos de CPU parada num `setTimeout`.
 * Isso mexe em LCP, que o Google usa como sinal — ou seja, o piso estava cobrando
 * de posicao de busca por um efeito que o robo nem chega a ver.
 *
 * A lista e curta e conservadora de proposito: na duvida, ESPERA. Errar pra
 * "tratou uma pessoa como robo" quebra o pedido do Eduardo; errar pro outro lado
 * so gasta 1,2s de um robo.
 */
const ROBOS = /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|lighthouse|pagespeed|headlesschrome/i;

async function ehRastreador(): Promise<boolean> {
  try {
    const { headers } = await import("next/headers");
    const ua = (await headers()).get("user-agent") ?? "";
    return ROBOS.test(ua);
  } catch {
    // fora de um request (build, script) nao ha cabecalho — e ai tambem nao ha
    // ninguem olhando a tela de carregamento.
    return true;
  }
}

export async function fecharPiso(inicio: number, minimo = MINIMO_MS): Promise<void> {
  if (minimo <= 0) return;
  if (await ehRastreador()) return;
  const falta = minimo - (Date.now() - inicio);
  if (falta > 0) await new Promise((r) => setTimeout(r, falta));
}
