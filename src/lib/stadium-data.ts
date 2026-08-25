// Ponte entre o catálogo e o Stadium.
//
// Reusa o payload do Meta pras espécies (são os mesmos insumos: seis bases e o
// moveset) e acrescenta o catálogo de bosses já RESOLVIDO — cada boss com o
// pokeId da espécie de que ele é feito, ou null.
//
// A resolução acontece aqui, no servidor, e não no navegador. O `bosses.json` são
// 15 KB e o de-para precisa do catálogo inteiro de espécies pra rodar; mandar os
// dois pro cliente pra ele descobrir sozinho que "Mega Alakazam" é um Mega
// Alakazam seria pagar duas vezes por uma resposta que não muda: ela depende do
// catálogo, e não de nada que a pessoa escolha na tela.

import { cache } from "react";
import { getMetaPayload, unpackMon, type PackedMon } from "./meta-data";
import { resolverBosses, BOSSES_GERADO_EM } from "./bosses";
import type { MetaMon } from "./meta";

export interface PackedBoss {
  key: string;
  name: string;
  /** caminho no host do jogo; null quando a fonte não publica arte */
  img: string | null;
  category: string;
  level: number;
  drops: string[];
  /** pokeId da espécie de que ele é feito; null = não é pokémon nenhum */
  mon: number | null;
}

export interface StadiumPayload {
  mons: PackedMon[];
  bosses: PackedBoss[];
  catalog: { live: boolean; generatedAt: string; error: string | null };
  /** quando o catálogo de bosses foi baixado — ele não é ao vivo, ver `ingest.mjs` */
  bossesGeradoEm: string;
}

let memo: { version: string; bosses: PackedBoss[] } | null = null;

export const getStadiumPayload = cache(async (): Promise<StadiumPayload> => {
  const { mons, catalog } = await getMetaPayload();

  // A chave do memo é a MESMA versão do catálogo de espécies, e não a data do
  // bosses.json: o que muda a resolução é o catálogo (espécie que entra, nome que
  // o jogo corrige), e é ele que precisa invalidar o de-para.
  const version = `${catalog.generatedAt}:${catalog.live}`;
  if (memo?.version === version) {
    return { mons, bosses: memo.bosses, catalog, bossesGeradoEm: BOSSES_GERADO_EM };
  }

  const desempacotados = mons.map(unpackMon) as MetaMon[];
  const bosses: PackedBoss[] = resolverBosses(desempacotados).map((b) => ({
    key: b.key,
    name: b.name,
    img: b.img,
    category: b.category,
    level: b.level,
    drops: b.drops,
    mon: b.mon?.pokeId ?? null,
  }));

  memo = { version, bosses };
  return { mons, bosses, catalog, bossesGeradoEm: BOSSES_GERADO_EM };
});
