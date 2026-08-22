// Prosa derivada do catalogo.
//
// O jogo publica `description: "a bulbasaur"` — as 482 sao esse mesmo padrao, o
// nome trocado. Quer dizer: a pagina que deveria responder "onde pegar bulbasaur
// poke idle world" tem, em palavras, duas. O dado pra responder ja esta na ficha
// (ponto de caca, nivel, evolucao, drop com a chance real); o que falta e alguem
// dizer isso em portugues.
//
// A REGRA que decide se este arquivo presta: **a frase ramifica pelo dado, nunca
// e um molde com `${nome}` dentro**. Molde repetido 482 vezes e conteudo
// replicado com outro nome — exatamente o que reprova no AdSense e afunda na
// busca. Aqui, quem tem ponto de caca fala do ponto; quem so evolui fala da
// evolucao; quem nao dropa nada nao ganha a clausula de drop; quem aprende TM
// ganha uma que os outros nao tem; variante de skin fala dos numeros que de fato
// a separam da base.
//
// E nada de numero inventado. Toda frase daqui sai de campo do catalogo — se o
// campo nao existe, a frase nao existe.

import type { DB } from "./data";
import { buildItemEntry, killsPerUnit, cardSpeciesName, tmDiskType } from "./items";
import { RARITY_LABEL, TYPE_LABEL } from "./labels";
import type { Creature, Item } from "./types";

export interface Resumo {
  /** as frases, na ordem — a ficha imprime como paragrafo */
  frases: string[];
  /** a mesma prosa cortada pra meta description, em fronteira de frase */
  descricao: string;
}

const pt = (n: number): string => n.toLocaleString("pt-BR");

/** Porcentagem como a ficha mostra: casas so enquanto elas informam. */
const pct = (v: number): string =>
  (v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2)).replace(".", ",") + "%";

const area = (a: string): string => a.charAt(0).toUpperCase() + a.slice(1);

/** Junta com virgula e "e" — lista de dois ou tres areas nao pode sair "a, b". */
function lista(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/**
 * Corta a prosa no tamanho de uma meta description SEM cortar no meio de um
 * numero: o Google trunca com reticencia de qualquer jeito, mas "cai em 34," e
 * pior que uma frase a menos.
 */
function paraDescricao(frases: string[], teto = 155): string {
  let saida = "";
  for (const f of frases) {
    const tentativa = saida ? `${saida} ${f}` : f;
    if (tentativa.length > teto) break;
    saida = tentativa;
  }
  return saida || (frases[0]?.slice(0, teto) ?? "");
}

// ---------------------------------------------------------------- especie

export function resumoDaEspecie(c: Creature, db: DB): Resumo {
  const frases: string[] = [];
  const tipos = c.type2
    ? `${TYPE_LABEL[c.type1]} e ${TYPE_LABEL[c.type2]}`
    : TYPE_LABEL[c.type1];
  const pontos = db.locationsOf(c);
  const comoSeConsegue = db.acquisitionOf(c);

  // 1. De onde ele vem. Tres caminhos, tres frases diferentes — e e aqui que a
  //    ficha para de ser um molde: um pokemon de mapa e um de evolucao nao tem
  //    a mesma primeira frase.
  if (comoSeConsegue === "hunt" && pontos.length > 0) {
    const areas = [...new Set(pontos.map((h) => area(h.area)))];
    const nivel = Math.min(...pontos.map((h) => h.level));
    frases.push(
      pontos.length === 1
        ? `${c.name} é um pokémon ${tipos} que aparece em ${areas[0]}, num ponto de caça de nível ${nivel}.`
        : `${c.name} é um pokémon ${tipos} que aparece em ${lista(areas)}, em ${pontos.length} pontos de caça, a partir do nível ${nivel}.`,
    );
  } else if (comoSeConsegue === "evo") {
    const anterior = db.creatures.find((x) => x.evolvesToId === c.pokeId);
    frases.push(
      anterior
        ? `${c.name} é um pokémon ${tipos} que não aparece no mapa: ele vem de ${anterior.name}${anterior.evolveLevel ? `, no nível ${anterior.evolveLevel}` : ""}.`
        : `${c.name} é um pokémon ${tipos} que não tem ponto de caça — só se chega nele por evolução.`,
    );
  } else {
    frases.push(
      `${c.name} é um pokémon ${tipos} que não se caça nem evolui de ninguém: ele vem de fora do mapa, por loja, cassino, ovo ou evento.`,
    );
  }

  // 2. A variante de skin fala do que a separa da base — e SO ela tem esta frase.
  const base = c.captureBase != null ? db.getCreature(c.captureBase) : null;
  if (base && base.pokeId !== c.pokeId) {
    const dif: string[] = [];
    if (c.huntLevel !== base.huntLevel) dif.push(`nível de caça ${c.huntLevel} contra ${base.huntLevel}`);
    if (c.experience !== base.experience) dif.push(`${pt(c.experience)} de XP por abate contra ${pt(base.experience)}`);
    frases.push(
      dif.length
        ? `É a variante de ${base.name}: ${lista(dif)}.`
        : `É uma variante de ${base.name}, com os mesmos números.`,
    );
  }

  // 3. Evolucao pra frente, quando existe.
  const proxima = c.evolvesToId != null ? db.getCreature(c.evolvesToId) : null;
  if (proxima) {
    frases.push(
      c.evolveLevel
        ? `No nível ${c.evolveLevel} ele evolui para ${proxima.name}.`
        : `Ele evolui para ${proxima.name}.`,
    );
  }

  // 4. O drop que mais aparece, com a chance de verdade. Sem drop, sem frase.
  const dropavel = [...c.loot]
    .filter((l) => l.chance > 0)
    .sort((a, b) => b.chance - a.chance)[0];
  if (dropavel) {
    const chance = dropavel.chance / 1000;
    const faixa =
      dropavel.minCount === dropavel.maxCount
        ? `${dropavel.minCount}`
        : `${dropavel.minCount} a ${dropavel.maxCount}`;
    frases.push(`O drop mais frequente é ${dropavel.name}, que sai em ${pct(chance)} dos abates (${faixa} por vez).`);
  }

  // 5. O que o abate paga. So entra quando o catalogo tem os dois numeros.
  if (c.experience > 0 && c.sellValue > 0) {
    frases.push(`Cada abate dá ${pt(c.experience)} de XP, e o pokémon vende por ${pt(c.sellValue)} de ouro.`);
  } else if (c.experience > 0) {
    frases.push(`Cada abate dá ${pt(c.experience)} de XP.`);
  }

  // 6. TM: clausula que so quem aprende tem.
  const tms = c.attacks.filter((a) => a.tm != null);
  if (tms.length > 0) {
    const nomes = tms.slice(0, 2).map((a) => a.name);
    frases.push(
      tms.length === 1
        ? `Ele aprende um golpe de TM: ${nomes[0]}.`
        : `Ele aprende ${tms.length} golpes de TM, entre eles ${lista(nomes)}.`,
    );
  }

  return { frases, descricao: paraDescricao(frases) };
}

// ---------------------------------------------------------------- item

export function resumoDoItem(item: Item, db: DB): Resumo {
  const e = buildItemEntry(item, {
    sourcesOf: db.dropSourcesOf,
    spotsOf: (c) => db.locationsOf(c).length,
  });
  const frases: string[] = [];

  // 1. De onde ele vem — a mesma bifurcacao da especie, com os tres casos reais
  //    do catalogo: cai de alguem, se compra, ou nao e nem uma coisa nem outra.
  if (e.bestFarm) {
    const fonte = e.bestFarm;
    const abates = killsPerUnit(fonte);
    // Drop quase garantido dava "cerca de 0 abates por unidade", que e a conta
    // certa arredondada pra um absurdo: abaixo de um abate por unidade, o que
    // informa nao e o numero, e o fato de que praticamente todo abate solta.
    const ritmo =
      abates < 1
        ? "praticamente todo abate solta o item"
        : `cerca de ${pt(Math.round(abates))} ${Math.round(abates) === 1 ? "abate" : "abates"} por unidade`;
    frases.push(
      `${item.name} cai de ${fonte.name} em ${pct(fonte.chancePct)} dos abates — ${ritmo}, num ponto de nível ${fonte.level}.`,
    );
    if (e.farmSources > 1) {
      frases.push(`Ao todo ${e.farmSources} espécies caçáveis dropam o item${e.sources > e.farmSources ? ` (e outras ${e.sources - e.farmSources} que não têm ponto no mapa)` : ""}.`);
    }
  } else if (e.best) {
    frases.push(
      `${item.name} só cai de ${e.best.name}, que não tem ponto de caça no mapa — não dá pra farmar, só conseguir por evolução, loja ou evento.`,
    );
  } else if (e.goldPrice > 0) {
    frases.push(`${item.name} não cai de pokémon nenhum: ele se compra na loja por ${pt(e.goldPrice)} de ouro.`);
  } else {
    const especie = cardSpeciesName(item.name);
    const tipoTm = tmDiskType(item.name);
    if (especie) {
      frases.push(`${item.name} é a carta de shiny de ${especie}: ela não cai de ninguém e vem de fora do mapa.`);
    } else if (tipoTm) {
      frases.push(`${item.name} é o disco de TM do tipo ${TYPE_LABEL[tipoTm as keyof typeof TYPE_LABEL] ?? tipoTm}: ele libera o golpe de máquina, e não cai de pokémon nenhum.`);
    } else {
      frases.push(`${item.name} não cai de nenhum pokémon do catálogo e não está à venda na loja.`);
    }
  }

  // 2. O que ele FAZ, quando o catalogo diz.
  if (e.healAmount > 0) frases.push(`Ele cura ${pt(e.healAmount)} de vida.`);
  if (e.revivePct > 0) frases.push(`Ele revive o pokémon com ${Math.round(e.revivePct * 100)}% da vida.`);

  // 3. Quanto vale, e quanto ele soma por abate — o numero que decide se vale
  //    parar pra pegar.
  if (e.npcPrice > 0) {
    frases.push(
      e.goldPerKill > 0
        ? `O Mark paga ${pt(e.npcPrice)} por unidade, o que soma ${pt(Math.round(e.goldPerKill))} de ouro a cada abate na melhor fonte.`
        : `O Mark paga ${pt(e.npcPrice)} por unidade.`,
    );
  }

  return { frases, descricao: paraDescricao(frases) };
}
