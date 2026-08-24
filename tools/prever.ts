/**
 * O HARNESS: roda o motor de combate fora da aplicacao e imprime o que ele preve.
 *
 * Ele existe por uma razao unica e ela e a mais importante deste projeto agora: nao
 * havia como saber se uma mudanca no motor melhorou ou piorou. O site tem 6.500
 * linhas de decisao economica e ZERO teste — toda correcao era aposta, e foi assim
 * que "o Golem mata 530 e a tela fala 320" ficou de pe.
 *
 * Com ele, a frase muda de "acho que ficou melhor" pra "o Golem dava 320, agora da
 * 528, e o medido e 530".
 *
 * ## Uso
 *
 *   npx tsx tools/prever.ts                    # roda os casos medidos
 *   npx tsx tools/prever.ts Golem 422 furious_scyther
 *
 * ## O que a primeira execucao ja mostrou
 *
 * Golem nv 422 contra Furious Scyther nv 150:
 *
 *     hits    1.0 pra derrubar      <- ONE-SHOT
 *     ciclo   5.40s (2.13 de combate + 3.3 de overhead)
 *
 * Os dois numeros nao podem ser verdade ao mesmo tempo. Se um golpe ja mata, o
 * combate dura UMA RECARGA — nao 2,13s. O 2,13 vem de `hp / dps_somado`, que
 * assume os oito golpes caindo em sequencia contra um alvo que morreu no
 * primeiro. Isso e o defeito, e ele esta a uma linha de distancia.
 *
 * ## Os casos MEDIDOS
 *
 * Nao sao chute nem referencia escolhida a dedo pra fechar a conta: sao leituras
 * do robo em conta real, com hora de relogio. Cada um vale mais que cem ajustes de
 * constante, e e por isso que a lista mora no repositorio e nao numa conversa.
 */

import { getData } from "../src/lib/data";
import { getHuntPayload } from "../src/lib/hunt-data";
import { economyOf, movesResolver, unpackSpecies, withEconomy } from "../src/lib/hunt";
import { estimateHunt } from "../src/lib/combat";

interface CasoMedido {
  especie: string;
  nivel: number;
  /** slug da hunt no jogo */
  hunt: string;
  /** abates por hora OBSERVADOS */
  kosH: number;
  /** XP/h observado, quando a tela deu */
  xpH?: number;
  fonte: string;
}

const MEDIDOS: CasoMedido[] = [
  {
    especie: "Golem",
    nivel: 422,
    hunt: "furious_scyther",
    // 2,2k abates em 2h53min = 763/h. O painel do robo mostrava os dois numeros
    // na mesma tela, entao a divisao nao depende de memoria de ninguem.
    kosH: 763,
    xpH: 11_900_000,
    fonte: "painel do robo, conta Zashz, 24/08/2026",
  },
];

const pct = (previsto: number, real: number): string => {
  const d = ((previsto - real) / real) * 100;
  const sinal = d >= 0 ? "+" : "";
  return `${sinal}${d.toFixed(1)}%`;
};

async function prever(especie: string, nivel: number, huntSlug: string) {
  const db = await getData();
  const payload = await getHuntPayload();

  const c = db.creatures.find((x) => x.name.toLowerCase() === especie.toLowerCase());
  if (!c) throw new Error(`especie nao encontrada: ${especie}`);

  const spot = db.hunts.find((h) => h.slug === huntSlug);
  if (!spot) throw new Error(`hunt nao encontrada: ${huntSlug}`);

  // A hunt NAO carrega `pokeId` — ela casa por `looktype`. O caminho de volta e o
  // indice reverso que a propria lib expoe (`locationsOf`), e nao um campo que a
  // fonte nunca teve: procurar `spot.pokeId` devolvia `undefined` em silencio, e
  // `undefined === undefined` fazia o `find` casar com o alvo ERRADO em vez de
  // falhar. Ver o principio de campo cujo nome voce nao sabe.
  const dono = db.creatures.find((x) => db.locationsOf(x).some((h) => h.slug === huntSlug));
  if (!dono) throw new Error(`nenhuma especie aponta pra hunt: ${huntSlug}`);

  const alvo = payload.targets.find((t) => t.pokeId === dono.pokeId);
  if (!alvo) throw new Error(`alvo fora do payload: ${dono.name} (${dono.pokeId})`);

  const pacote = payload.species.find((s) => s.id === c.pokeId);
  if (!pacote) throw new Error(`especie fora do payload de hunt: ${especie}`);

  const econ = economyOf(payload.targets, {
    day: "",
    drops: payload.drops,
    ballKey: "poke",
    vip: false,
    xpPct: 0,
    lootPct: 0,
  });

  // IV perfeito e quality 1: o teto. O caso medido e de conta veterana, e o que
  // interessa aqui e a ORDEM DE GRANDEZA, nao o individuo exato.
  const est = estimateHunt(
    unpackSpecies(pacote),
    nivel,
    [32, 32, 32, 32, 32, 32],
    1,
    withEconomy(payload.targets, econ).find((t) => t.pokeId === alvo.pokeId)!,
    movesResolver(payload.species)(alvo.pokeId),
    "natural",
  );

  return { c, spot, alvo, est };
}

async function main() {
  const [nomeArg, nivelArg, huntArg] = process.argv.slice(2);

  const casos: CasoMedido[] =
    nomeArg && nivelArg && huntArg
      ? [{ especie: nomeArg, nivel: Number(nivelArg), hunt: huntArg, kosH: 0, fonte: "argumento" }]
      : MEDIDOS;

  for (const caso of casos) {
    const { spot, alvo, est } = await prever(caso.especie, caso.nivel, caso.hunt);
    if (!est) {
      console.log(`${caso.especie} nv ${caso.nivel} vs ${caso.hunt}: motor devolveu null`);
      continue;
    }

    console.log(`\n${caso.especie} nv ${caso.nivel}  ->  ${alvo.name} (${spot.slug}, nv ${spot.level})`);
    console.log(`  fonte da medida: ${caso.fonte}`);
    console.log(`  ciclo        ${est.ttkS.toFixed(2)}s por abate (combate + overhead)`);
    console.log(`  dps          ${Math.round(est.dps)} contra este alvo`);
    console.log(`  hits         ${est.hits.toFixed(1)} pra derrubar`);
    console.log(`  golpe        tipo ${est.moveName} (${est.category})  efetividade x${est.eff}`);
    console.log(`  alvo         hp ${alvo.hp}  nv ${alvo.huntLevel}`);
    console.log(`  uptime       ${(est.threat.uptime * 100).toFixed(0)}%   risco ${est.threat.risk}`);
    console.log(`  ---`);
    console.log(`  kos/h  previsto ${Math.round(est.kosH)}` +
      (caso.kosH ? `   medido ${caso.kosH}   erro ${pct(est.kosH, caso.kosH)}` : ""));
    if (caso.xpH) {
      console.log(`  xp/h   previsto ${Math.round(est.xpH).toLocaleString("pt-BR")}` +
        `   medido ${caso.xpH.toLocaleString("pt-BR")}   erro ${pct(est.xpH, caso.xpH)}`);
    }
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
