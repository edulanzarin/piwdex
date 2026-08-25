// Ponte entre o catalogo e a escolha do Eevee.
//
// Mesmo contrato do `stadium-data.ts`: reusa o payload do Meta pras especies (as
// seis bases e o moveset — os mesmos insumos, ja empacotados) e acrescenta o que
// so esta tela precisa.
//
// O que so esta tela precisa e o FARM. As cinco trocas cobram o mesmo ouro, entao
// a unica coisa que separa uma da outra e de onde cai a pedra — e isso e uma
// travessia do indice reverso de drop (`dropSourcesOf`) cruzada com os pontos de
// caca (`locationsOf`) de cada criatura que solta. Sao 184 fontes somando as
// cinco pedras; refazer essa varredura no navegador exigiria mandar o loot das
// 482 especies pra ele, que e justamente o que o payload do Meta economiza.
//
// A resposta tambem nao depende de nada que a pessoa escolha na tela: quem solta
// Enigma Stone e onde essa criatura mora sao fatos do catalogo. Derivar no
// servidor e guardar por versao e o certo.

import { cache } from "react";
import { getData } from "./data";
import { getMetaPayload, type PackedMon } from "./meta-data";
import { TROCAS, type FonteDaPedra } from "./eevee";
import { assetIconUrl } from "./sprites";

export interface PedraInfo {
  nome: string;
  /** URL do icone no host do jogo; vazia quando o item nao esta no catalogo */
  icone: string;
  /** o que o NPC paga por uma — e o unico preco publicado da pedra */
  npcPrice: number;
  fontes: FonteDaPedra[];
}

export interface EeveePayload {
  mons: PackedMon[];
  /** por nome de pedra, na ordem das trocas */
  pedras: PedraInfo[];
  catalog: { live: boolean; generatedAt: string; error: string | null };
}

let memo: { version: string; pedras: PedraInfo[] } | null = null;

export const getEeveePayload = cache(async (): Promise<EeveePayload> => {
  const { mons, catalog } = await getMetaPayload();
  const db = await getData();

  if (memo?.version === db.version) return { mons, pedras: memo.pedras, catalog };

  const pedras: PedraInfo[] = TROCAS.map((t) => {
    const item = db.getItemByName(t.pedra);
    const fontes: FonteDaPedra[] = db.dropSourcesOf(t.pedra).map((s) => ({
      pokeId: s.creature.pokeId,
      nome: s.creature.name,
      nivel: s.creature.huntLevel,
      chancePct: s.chancePct,
      min: s.minCount,
      max: s.maxCount,
      areas: [...new Set(db.locationsOf(s.creature).map((h) => h.area))],
    }));

    // Fonte SEM ponto de caca fica de fora, e a poda e o ponto do painel inteiro.
    // Quem dropa a pedra mas nao tem onde ser cacado (so evolui, so vem de loja)
    // e uma linha que responde "farme aqui" com um lugar que nao existe. Elas
    // continuam no catalogo — o que some e a promessa.
    const cacaveis = fontes.filter((f) => f.areas.length > 0);

    return {
      nome: t.pedra,
      icone: item ? assetIconUrl(item.icon) : "",
      npcPrice: item?.npcPrice ?? 0,
      fontes: cacaveis,
    };
  });

  memo = { version: db.version, pedras };
  return { mons, pedras, catalog };
});
