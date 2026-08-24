import { buildRoute } from "@/lib/combat";
import { getData } from "@/lib/data";
import { getHuntPayload } from "@/lib/hunt-data";
import { economyOf, movesResolver, unpackSpecies, withEconomy } from "@/lib/hunt";
import type { ActivePoke } from "@/lib/robo/jogo/pokes";
import type { PassoRota } from "@/lib/robo/motor/tipos";

/**
 * A caçada automática: subir o líder até um nível, trocando de hunt sozinho.
 *
 * O cálculo NÃO é novo. É o mesmo `buildRoute` que a ferramenta pública de rota
 * usa — a que já responde "quem cacar do 40 ao 80" com dano, ameaça e XP por
 * hora nível a nível. Escrever uma segunda versão aqui daria duas respostas
 * diferentes para a mesma pergunta, e a do robô seria a que ninguém revisa.
 *
 * O que esta camada acrescenta é a única coisa que faltava para a rota virar
 * ação: o **slug**. O motor de rota raciocina em espécie (`pokeId`), e o
 * `enter-hunt` do jogo quer o slug do ponto no mapa.
 */

/**
 * Onde cada espécie é caçável, e por qual slug.
 *
 * Uma espécie aparece em vários pontos. Fica o de MENOR nível: é o que o motor
 * de rota assume ao estimar (`huntLevel` é o mínimo), então usar outro faria o
 * robô entrar num ponto mais duro que o estimado, e a ameaça calculada deixaria
 * de valer.
 */
/**
 * Onde cacar cada especie, e o NIVEL que o ponto exige.
 *
 * O nivel vinha junto e era descartado no fim — era so criterio pra escolher o
 * ponto mais barato. Ele voltou a importar: o jogo recusa entrada em hunt acima
 * do nivel do TREINADOR, e sem esse numero o robo planejava rotas que o jogo
 * ignora em silencio.
 */
export async function pontosPorEspecie(): Promise<Map<number, { slug: string; level: number }>> {
  const db = await getData();
  const mapa = new Map<number, { slug: string; level: number }>();
  for (const c of db.creatures) {
    for (const h of db.locationsOf(c)) {
      const atual = mapa.get(c.pokeId);
      if (!atual || h.level < atual.level) mapa.set(c.pokeId, { slug: h.slug, level: h.level });
    }
  }
  return mapa;
}

/**
 * Os IVs individuais, que o jogo não manda.
 *
 * O frame `pokes` entrega `ivTotal` (a soma) e nunca os seis separados. Espalhar
 * o total igualmente é a única leitura honesta possível: erra a distribuição,
 * acerta o montante, e o montante é o que domina a estimativa de dano. Um chute
 * de distribuição enviesaria o ranking de alvos sem nenhuma evidência por trás.
 */
const ivsDe = (ivTotal: number): number[] => {
  const cada = Math.max(0, Math.min(31, Math.round(ivTotal / 6)));
  return [cada, cada, cada, cada, cada, cada];
};

export interface Plano {
  passos: PassoRota[];
  /** o motor não achou alvo para alguma faixa: a rota existe, mas com buraco */
  incompleto: boolean;
  horas: number;
}

/**
 * Planeja a subida do líder até `nivelAlvo`.
 *
 * `null` quando não há o que planejar: espécie fora do catálogo, ou o líder já
 * passou do alvo.
 */
export async function planejarRota(
  lider: Pick<ActivePoke, "speciesId" | "level" | "ivTotal" | "quality">,
  nivelAlvo: number,
  /**
   * `nivelTreinador` nao e enfeite: o jogo recusa entrada em hunt acima do
   * nivel do TREINADOR, mesmo com o pokemon muito acima dela. E a regra que
   * impede comprar um bicho nivel 500 numa conta nova e subir num dia.
   *
   * Sem ela o robo montava rotas perfeitas no papel e o `enter-hunt` era
   * ignorado em silencio — o sintoma era "sem combate" reentrando pra sempre,
   * sem nada na tela explicando.
   */
  opcoes: { vip?: boolean; bola?: string; nivelTreinador?: number | null } = {},
): Promise<Plano | null> {
  if (nivelAlvo <= lider.level) return null;

  const payload = await getHuntPayload();
  const pacote = payload.species.find((s) => s.id === lider.speciesId);
  if (!pacote) return null;

  const econ = economyOf(payload.targets, {
    day: "",
    drops: payload.drops,
    ballKey: opcoes.bola ?? "poke",
    vip: !!opcoes.vip,
    xpPct: 0,
    lootPct: 0,
  });

  const passosCrus = buildRoute(
    unpackSpecies(pacote),
    lider.level,
    nivelAlvo,
    withEconomy(payload.targets, econ),
    movesResolver(payload.species),
    lider.quality || 1,
    ivsDe(lider.ivTotal),
    "natural",
  );

  const pontos = await pontosPorEspecie();
  const teto = opcoes.nivelTreinador ?? null;
  const passos: PassoRota[] = [];
  for (const p of passosCrus) {
    const ponto = pontos.get(p.enemy.pokeId);
    const slug = ponto?.slug;
    // Faixa sem slug é faixa que o robô não consegue executar. Ela sai do plano e
    // marca o buraco, em vez de virar um passo que trava a caçada na hora de
    // mandar `enter-hunt` com `undefined`.
    if (!slug) continue;
    passos.push({
      de: p.from,
      ate: p.to,
      slug,
      alvo: p.enemy.name,
      speciesId: p.enemy.pokeId,
      xpH: Math.round(p.est.xpH),
      goldH: Math.round(p.est.goldH),
      horas: p.hours,
      risco: p.est.threat.risk,
      exigeNivel: ponto?.level ?? 0,
      // O jogo recusa entrada acima do nivel do TREINADOR. A faixa continua no
      // plano — ela abre quando o treinador chegar la, e ele chega cacando as
      // de baixo.
      travado: teto != null && (ponto?.level ?? 0) > teto,
    });
  }
  if (!passos.length) return null;

  return {
    passos,
    incompleto: passosCrus.some((p) => p.partial) || passos.length !== passosCrus.length,
    horas: passos.reduce((a, p) => a + p.horas, 0),
  };
}

/** O passo que vale para um nível. `null` quando o nível já passou do plano. */
/**
 * A faixa que vale AGORA.
 *
 * Duas condicoes, e a segunda chegou com a regra do jogo: a faixa tem que
 * conter o nivel do pokemon E estar destravada. Uma faixa travada e o jogo
 * recusando a entrada — mandar `enter-hunt` nela produz o silencio que ja
 * custou uma investigacao inteira ("sem combate", reentrando pra sempre).
 *
 * Quando a faixa certa esta travada, cai na ULTIMA destravada abaixo dela: o
 * treinador sobe cacando, e cacar onde da e o que destrava a de cima. Parar
 * seria esperar um nivel que so chega cacando.
 */
export const passoDoNivel = (passos: PassoRota[], nivel: number): PassoRota | null => {
  const naFaixa = passos.find((p) => nivel >= p.de && nivel < p.ate && !p.travado);
  if (naFaixa) return naFaixa;
  const abaixo = passos.filter((p) => !p.travado && p.de <= nivel);
  return abaixo[abaixo.length - 1] ?? passos.find((p) => !p.travado) ?? null;
};
