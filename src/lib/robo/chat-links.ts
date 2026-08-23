/**
 * Os links que o jogo embute no chat.
 *
 * Quem anuncia no chat cola o pokémon ou o item como um bloco codificado no meio
 * da frase: `[poke!<base64>]`, `[item!<base64>]`. O cliente oficial desenha um
 * cartão ali; um leitor que não decodifica mostra trezentos caracteres de lixo no
 * lugar da mensagem, que era exatamente o que o painel fazia.
 *
 * O conteúdo é JSON, e a chave `k` diz o quê. Confirmado contra mensagens reais
 * do canal de troca (ago/2026):
 *
 *   poke: {k,n,lv,sh,q,iv,pw,t1,t2,st:{hp,atk,def,spAtk,spDef,speed}}
 *   item: {k,n,ic,cat,npc,d}
 *
 * Client-safe de propósito: o chat é componente de cliente, e este módulo não
 * pode arrastar nada de servidor junto.
 */

import { gameAssetUrl } from "@/lib/robo/jogo/host";

export interface PokeDoChat {
  tipo: "poke";
  nome: string;
  level: number;
  shiny: boolean;
  quality: number;
  ivTotal: number;
  power: number;
  t1: string;
  t2: string | null;
  stats: { hp: number; atk: number; def: number; spAtk: number; spDef: number; speed: number };
}

export interface ItemDoChat {
  tipo: "item";
  nome: string;
  icone: string;
  categoria: string;
  npc: number;
  descricao: string;
}

export type Pedaco =
  | { tipo: "texto"; texto: string }
  | PokeDoChat
  | ItemDoChat;

/** O bloco inteiro, com a chave e o miolo. `[\w]+` cobre `poke` e `item` sem
 *  fixar os dois: chave nova aparece como texto, e não some. */
const BLOCO = /\[([a-z]+)!([A-Za-z0-9_+/=-]+)\]/g;

const num = (v: unknown, d = 0): number => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : d;
};
const txt = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);

/**
 * Decodifica tolerando as duas formas de base64.
 *
 * O jogo manda base64 padrão sem preenchimento, e transcrever de uma tela ou
 * passar por uma URL pode virar base64url. Aceitar os dois custa duas linhas;
 * recusar um deles apaga a mensagem.
 */
function decodificar(b64: string): Record<string, unknown> | null {
  const normal = b64.replace(/-/g, "+").replace(/_/g, "/");
  const cheio = normal + "=".repeat((4 - (normal.length % 4)) % 4);
  try {
    const cru = typeof atob === "function" ? atob(cheio) : Buffer.from(cheio, "base64").toString("binary");
    // O nome do pokémon pode ter acento: o `atob` devolve bytes, e sem esta
    // volta por UTF-8 "Pokémon" vira "PokÃ©mon".
    const texto = decodeURIComponent(
      Array.from(cru, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""),
    );
    const j = JSON.parse(texto) as unknown;
    return j && typeof j === "object" ? (j as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function lerPoke(o: Record<string, unknown>): PokeDoChat {
  const st = (o.st ?? {}) as Record<string, unknown>;
  return {
    tipo: "poke",
    nome: txt(o.n, "?"),
    level: num(o.lv),
    shiny: num(o.sh) === 1 || o.sh === true,
    quality: num(o.q, 1),
    ivTotal: num(o.iv),
    power: num(o.pw),
    t1: txt(o.t1),
    t2: txt(o.t2) || null,
    stats: {
      hp: num(st.hp), atk: num(st.atk), def: num(st.def),
      spAtk: num(st.spAtk), spDef: num(st.spDef), speed: num(st.speed),
    },
  };
}

const lerItem = (o: Record<string, unknown>): ItemDoChat => ({
  tipo: "item",
  nome: txt(o.n, "?"),
  // O jogo manda o caminho RELATIVO. Sem absolutizar, o navegador o resolve
  // contra piwdex.com.br e o icone vira 404 — o mesmo erro que ja tinha
  // acontecido com o icone das bolas.
  icone: gameAssetUrl(txt(o.ic)),
  categoria: txt(o.cat, "loot"),
  npc: num(o.npc),
  descricao: txt(o.d),
});

/**
 * Quebra a mensagem em pedaços legíveis.
 *
 * Bloco que não decodifica volta como TEXTO, e não some: uma mensagem meio
 * exibida ainda é a mensagem: uma mensagem engolida é um bug silencioso.
 */
export function lerMensagemDoChat(corpo: string): Pedaco[] {
  const saida: Pedaco[] = [];
  let fim = 0;
  BLOCO.lastIndex = 0;
  for (let m = BLOCO.exec(corpo); m; m = BLOCO.exec(corpo)) {
    if (m.index > fim) saida.push({ tipo: "texto", texto: corpo.slice(fim, m.index) });
    fim = m.index + m[0].length;

    const dado = decodificar(m[2]);
    const chave = dado ? txt(dado.k, m[1]) : m[1];
    if (dado && chave === "poke") saida.push(lerPoke(dado));
    else if (dado && chave === "item") saida.push(lerItem(dado));
    else saida.push({ tipo: "texto", texto: m[0] });
  }
  if (fim < corpo.length) saida.push({ tipo: "texto", texto: corpo.slice(fim) });
  return saida.length ? saida : [{ tipo: "texto", texto: corpo }];
}

/** A mensagem tem algum cartão? Serve pra tela decidir o layout sem reprocessar. */
export const temCartao = (corpo: string): boolean => {
  BLOCO.lastIndex = 0;
  return BLOCO.test(corpo);
};
