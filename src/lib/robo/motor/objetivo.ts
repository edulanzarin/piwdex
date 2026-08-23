import { getData } from "@/lib/data";
import { getHuntPayload } from "@/lib/hunt-data";
import { economyOf, movesResolver, rankHunts, unpackSpecies, withEconomy } from "@/lib/hunt";
import type { ActivePoke } from "@/lib/robo/jogo/pokes";
import type { Recomendacao } from "@/lib/robo/motor/tipos";

/**
 * "Quero mais dinheiro" virando conta.
 *
 * A rota de nível responde "onde subir ESTE pokémon". Esta camada responde a
 * outra pergunta, que é a que se faz primeiro: **com qual dos meus e onde**. São
 * duas grandezas cruzadas — o roster e o catálogo de alvos — e o resultado é uma
 * lista ordenada por dólares por hora, com o XP ao lado para quem quiser decidir
 * de outro jeito.
 *
 * O motor de estimativa é o mesmo da ferramenta pública (`rankHunts`), pelo mesmo
 * motivo de sempre: uma segunda opinião sobre onde caçar seria a que ninguém
 * revisa.
 */

/**
 * Onde cada espécie é caçável, e por qual slug.
 *
 * Fica o ponto de MENOR nível — é o que o motor de rota assume ao estimar
 * (`huntLevel` é o mínimo), então usar outro mandaria o robô para um ponto mais
 * duro que o estimado, e a ameaça calculada deixaria de valer.
 */
async function slugsPorEspecie(): Promise<Map<number, string>> {
  const db = await getData();
  const mapa = new Map<number, { slug: string; level: number }>();
  for (const c of db.creatures) {
    for (const h of db.locationsOf(c)) {
      const atual = mapa.get(c.pokeId);
      if (!atual || h.level < atual.level) mapa.set(c.pokeId, { slug: h.slug, level: h.level });
    }
  }
  return new Map([...mapa].map(([id, v]) => [id, v.slug]));
}

/** Os IVs individuais o jogo não manda; espalhar o total acerta o montante, que
 *  é o que domina a estimativa de dano. Ver `motor/rota.ts`. */
const ivsDe = (ivTotal: number): number[] => {
  const cada = Math.max(0, Math.min(31, Math.round(ivTotal / 6)));
  return [cada, cada, cada, cada, cada, cada];
};

export type Criterio = "dolares" | "xp";

/**
 * O melhor par (meu pokémon × caçada) para o critério pedido.
 *
 * Considera só quem está NO TIME. O robô troca de líder sozinho quando a
 * recomendação muda, e trocar de líder é barato; mexer no box para trazer um
 * candidato de fora seria o robô reorganizando a conta por conta própria, que é
 * outra decisão e não esta.
 */
export async function melhores(
  time: ActivePoke[],
  criterio: Criterio,
  opcoes: { vip?: boolean; bola?: string; limite?: number } = {},
): Promise<Recomendacao[]> {
  if (!time.length) return [];

  const payload = await getHuntPayload();
  const movesOf = movesResolver(payload.species);
  const econ = economyOf(payload.targets, {
    day: "",
    drops: payload.drops,
    ballKey: opcoes.bola ?? "poke",
    vip: !!opcoes.vip,
    xpPct: 0,
    lootPct: 0,
  });
  const alvos = withEconomy(payload.targets, econ);
  const slugs = await slugsPorEspecie();

  const saida: Recomendacao[] = [];
  for (const p of time) {
    const pacote = payload.species.find((s) => s.id === p.speciesId);
    if (!pacote) continue;

    const linhas = rankHunts(unpackSpecies(pacote), {
      targets: alvos,
      econ,
      movesOf,
      level: p.level,
      ivs: ivsDe(p.ivTotal),
      quality: p.quality || 1,
      pool: "natural",
    });

    // Alvo letal fica FORA. Ele às vezes lidera o ouro por hora — e lidera até o
    // primeiro desmaio, quando a caçada para e a média real vira zero. Ver
    // "Rendimento é vazão vezes tempo em pé, não vazão de pico".
    const bom = linhas
      .filter((l) => l.est.threat.risk !== "deadly" && slugs.has(l.target.pokeId))
      .sort((a, b) =>
        criterio === "dolares" ? b.est.goldH - a.est.goldH : b.est.xpH - a.est.xpH,
      )[0];
    if (!bom) continue;

    saida.push({
      pokeId: p.id,
      nome: p.name,
      speciesId: p.speciesId,
      level: p.level,
      slug: slugs.get(bom.target.pokeId)!,
      alvo: bom.target.name,
      alvoSpeciesId: bom.target.pokeId,
      goldH: Math.round(bom.est.goldH),
      xpH: Math.round(bom.est.xpH),
      risco: bom.est.threat.risk,
    });
  }

  return saida
    .sort((a, b) => (criterio === "dolares" ? b.goldH - a.goldH : b.xpH - a.xpH))
    .slice(0, opcoes.limite ?? 12);
}
