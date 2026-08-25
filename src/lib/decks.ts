// Os DECKS: os times montados, salvos no navegador.
//
// Um deck não guarda pokémon — guarda REFERÊNCIA a carta da bolsa. A diferença
// aparece no dia em que você sobe o Charizard de 300 pra 340: com referência,
// você corrige a carta uma vez e os quatro decks em que ele está passam a contar
// a verdade. Com cópia, os quatro continuam afirmando o nível de dois meses
// atrás, e nada na tela diz isso.
//
// O preço da referência é a carta apagada. Um deck pode apontar pra um id que
// não existe mais, e a resposta certa pra isso é o slot voltar VAZIO com o
// recado — nunca sumir em silêncio e deixar um time de seis virar de cinco sem
// ninguém notar.
//
// Mora no `localStorage`, junto da bolsa, e pela mesma razão: o site não tem
// login, e time montado é coleção pessoal. O time que está no ringue AGORA viaja
// na URL (ver `stadium-url.ts`), porque aquilo é a pergunta e a pergunta se
// compartilha.

import { SLOTS } from "./stadium-url";
import { uid } from "./bolsa";

export interface Deck {
  id: string;
  nome: string;
  /** ids de carta na bolsa; null = slot vazio. Sempre com `SLOTS` posições. */
  cartas: (string | null)[];
  criadoEm: number;
}

const CHAVE = "piwdex.decks.v1";
const LIMITE = 30;
const NOME_MAX = 32;

function saneia(x: unknown): Deck | null {
  if (!x || typeof x !== "object") return null;
  const d = x as Record<string, unknown>;
  if (typeof d.nome !== "string" || !d.nome.trim()) return null;
  if (!Array.isArray(d.cartas)) return null;
  const bruto = d.cartas as unknown[];
  const cartas = Array.from({ length: SLOTS }, (_, i) =>
    typeof bruto[i] === "string" && bruto[i] ? (bruto[i] as string) : null,
  );
  // Deck sem ninguém dentro é lixo de gravação interrompida, não deck vazio.
  if (cartas.every((c) => c == null)) return null;
  return {
    id: typeof d.id === "string" && d.id ? d.id : uid(),
    nome: d.nome.trim().slice(0, NOME_MAX),
    cartas,
    criadoEm: Number.isFinite(Number(d.criadoEm)) ? Number(d.criadoEm) : 0,
  };
}

export function lerDecks(): Deck[] {
  if (typeof window === "undefined") return [];
  try {
    const cru = window.localStorage.getItem(CHAVE);
    if (!cru) return [];
    const arr: unknown = JSON.parse(cru);
    if (!Array.isArray(arr)) return [];
    return arr.map(saneia).filter((d): d is Deck => d != null).slice(0, LIMITE);
  } catch {
    return [];
  }
}

export function gravarDecks(decks: Deck[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(decks.slice(0, LIMITE)));
  } catch {
    // Cota estourada ou janela privada: perder os decks é ruim, derrubar a
    // ferramenta por causa deles é pior.
  }
}

/**
 * Salva o deck com este nome.
 *
 * Nome repetido SUBSTITUI em vez de duplicar. "Time do Mewtwo" salvo três vezes
 * com três composições diferentes é um armário em que nenhuma das três é
 * confiável; quem quer duas versões dá dois nomes.
 */
export function salvarDeck(nome: string, cartas: (string | null)[]): { decks: Deck[]; deck: Deck | null } {
  const limpo = nome.trim().slice(0, NOME_MAX);
  if (!limpo || cartas.every((c) => c == null)) return { decks: lerDecks(), deck: null };
  const antigo = lerDecks().find((d) => d.nome.toLowerCase() === limpo.toLowerCase());
  const deck: Deck = {
    // O id do homônimo é PRESERVADO: é o mesmo deck com outra escalação, e
    // trocar o id faria a tela perder de vista o deck que está aberto.
    id: antigo?.id ?? uid(),
    nome: limpo,
    cartas: Array.from({ length: SLOTS }, (_, i) => cartas[i] ?? null),
    criadoEm: antigo?.criadoEm ?? Date.now(),
  };
  const decks = [deck, ...lerDecks().filter((d) => d.id !== deck.id)].slice(0, LIMITE);
  gravarDecks(decks);
  return { decks, deck };
}

export function apagarDeck(id: string): Deck[] {
  const decks = lerDecks().filter((d) => d.id !== id);
  gravarDecks(decks);
  return decks;
}
