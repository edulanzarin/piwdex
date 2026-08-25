// A BOLSA: os pokémon que a pessoa cadastrou, no site inteiro.
//
// Ela nasceu dentro do Breeding, com o nome de "estante", e era a coleção de
// pais salvos pra não redigitar doze números. O erro estava no dono: um pokémon
// cadastrado não é do Breeding. É da PESSOA. O mesmo Charizard que serve de pai
// num par é o que entra no time do Stadium, e cadastrá-lo duas vezes é a
// ferramenta cobrando pelo próprio recorte.
//
// Então a coleção subiu de camada. `bolsa.ts` guarda CARTAS — um pokémon
// concreto com apelido, nível, quality e os seis stats como o jogo mostra — e
// quem quiser as consome. O Breeding lê o IV delas; o Stadium põe as cartas no
// ringue.
//
// Mora no `localStorage` porque é PREFERÊNCIA PESSOAL: não descreve nenhuma
// tela, não se compartilha por link e não faz sentido no servidor. O site não
// tem login, então esta é a única memória que existe.
//
// Tudo que sai daqui é DESCONFIADO. `localStorage` é editável à mão, herda
// formato de versão anterior e sobrevive a mudança de código; ler sem validar é
// como o site quebra numa máquina só, que é o defeito mais caro de achar. Carta
// que não passa no saneamento é descartada calada — um registro podre não pode
// derrubar a bolsa inteira.

import { IV_MAX, round3 } from "./breeding";
import type { PokeType } from "./types";

/**
 * Uma carta: o pokémon como o jogo o mostra.
 *
 * `stats` e `level` são OPCIONAIS, e não por preguiça. A carta pode ter nascido
 * de duas origens diferentes, e elas não carregam a mesma certeza:
 *
 * - **Dos stats** (o caminho normal): a pessoa copiou os seis números da tela do
 *   jogo. O combate usa esses números direto, sem supor nada.
 * - **Do IV digitado** (o caminho antigo do Breeding, e ainda válido lá): a
 *   pessoa já sabia o IV e digitou. Aí não há stat nenhum guardado, e o Stadium
 *   não tem o que pôr no ringue.
 *
 * Guardar só o IV resolvido congelaria um chute: quando o IV foi lido dos stats
 * de um pokémon de nível baixo, o ponto "17" pode estar representando uma faixa
 * de 4 a 30. Salvando nível e stats, a carta volta pro slot com a MESMA dúvida
 * que tinha, em vez de voltar com uma certeza que nunca existiu.
 */
export interface Carta {
  id: string;
  /** apelido, ou o nome da espécie quando não há apelido */
  name: string;
  /** o nome da espécie, sempre — é por ele que se agrupa */
  species: string;
  pokeId: number;
  type1: PokeType;
  type2: PokeType | null;
  quality: number;
  /** os seis IV, ordem canônica, 0..32 */
  ivs: number[];
  shiny: boolean;
  createdAt: number;
  level?: number;
  /** os seis stats como o jogo mostra */
  stats?: number[];
}

/** A carta serve pro combate: tem nível e os seis stats de verdade. */
export function cartaCompleta(c: Carta): c is Carta & { level: number; stats: number[] } {
  return typeof c.level === "number" && c.level > 0 && Array.isArray(c.stats) && c.stats.length === 6;
}

const CHAVE = "piwdex.bolsa.v1";
/** A chave antiga, de quando a coleção era a "estante" do Breeding. Só de leitura. */
const CHAVE_ANTIGA = "piwdex.breed.v1";
const LIMITE = 60;

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function saneia(x: unknown): Carta | null {
  if (!x || typeof x !== "object") return null;
  const m = x as Record<string, unknown>;
  const pokeId = Number(m.pokeId);
  const quality = Number(m.quality);
  const ivs = Array.isArray(m.ivs) ? m.ivs.map(Number) : null;
  if (!Number.isFinite(pokeId) || pokeId <= 0) return null;
  if (!Number.isFinite(quality) || quality <= 0) return null;
  if (!ivs || ivs.length !== 6 || ivs.some((v) => !Number.isFinite(v))) return null;
  if (typeof m.name !== "string" || typeof m.species !== "string") return null;
  const stats = Array.isArray(m.stats) ? m.stats.map(Number) : null;
  const level = Number(m.level);
  return {
    id: typeof m.id === "string" && m.id ? m.id : uid(),
    pokeId,
    name: m.name.slice(0, 40),
    species: m.species.slice(0, 40),
    type1: m.type1 as PokeType,
    type2: (m.type2 ?? null) as PokeType | null,
    quality: round3(quality),
    ivs: ivs.map((v) => Math.min(IV_MAX, Math.max(0, Math.round(v)))),
    shiny: m.shiny === true,
    createdAt: Number.isFinite(Number(m.createdAt)) ? Number(m.createdAt) : 0,
    level: Number.isFinite(level) && level > 0 ? Math.round(level) : undefined,
    stats:
      stats && stats.length === 6 && stats.every((v) => Number.isFinite(v))
        ? stats.map((v) => Math.max(0, Math.round(v)))
        : undefined,
  };
}

function ler(chave: string): Carta[] {
  try {
    const cru = window.localStorage.getItem(chave);
    if (!cru) return [];
    const arr: unknown = JSON.parse(cru);
    if (!Array.isArray(arr)) return [];
    return arr.map(saneia).filter((m): m is Carta => m != null).slice(0, LIMITE);
  } catch {
    return [];
  }
}

/**
 * A bolsa, com a estante antiga do Breeding trazida junto.
 *
 * A migração acontece na LEITURA e não numa rotina de virada, porque não há
 * servidor pra rodar rotina nenhuma: quem tem a coleção antiga é o navegador de
 * quem já usou o site, e a única hora em que dá pra alcançá-lo é quando ele
 * abre a página. A chave velha é lida, nunca escrita, e some da conta assim que
 * a bolsa nova existir.
 *
 * As duas são somadas em vez de a nova substituir a velha: se alguém abrir o
 * Breeding numa aba antiga em cache e salvar lá, aquele pokémon ainda aparece
 * aqui. Cartas iguais nas duas chaves entram uma vez só.
 */
export function lerBolsa(): Carta[] {
  if (typeof window === "undefined") return [];
  const nova = ler(CHAVE);
  const antiga = ler(CHAVE_ANTIGA);
  if (!antiga.length) return nova;

  const vistos = new Set(nova.map((c) => c.id));
  const juntas = [...nova];
  for (const c of antiga) if (!vistos.has(c.id)) juntas.push(c);
  return juntas.slice(0, LIMITE);
}

export function gravarBolsa(cartas: Carta[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(cartas.slice(0, LIMITE)));
  } catch {
    // Cota estourada ou janela privada: perder a bolsa é ruim, derrubar a
    // ferramenta por causa dela é pior.
  }
}

/** Guarda a carta. Mesmo `id` SUBSTITUI — é o caminho da edição. */
export function salvarCarta(carta: Carta): Carta[] {
  const todas = lerBolsa();
  const i = todas.findIndex((c) => c.id === carta.id);
  const proximas = i >= 0 ? todas.map((c) => (c.id === carta.id ? carta : c)) : [carta, ...todas];
  gravarBolsa(proximas);
  return proximas;
}

export function apagarCarta(id: string): Carta[] {
  const proximas = lerBolsa().filter((c) => c.id !== id);
  gravarBolsa(proximas);
  return proximas;
}

/** O nome que a tela mostra: apelido quando ele diz algo a mais que a espécie. */
export const cartaLabel = (c: Carta): string =>
  c.name && c.name !== c.species ? `${c.name} (${c.species})` : c.species;
