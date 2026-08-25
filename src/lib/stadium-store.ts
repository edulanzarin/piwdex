// Os times salvos: o que a pessoa não quer redigitar a cada boss.
//
// Mora no `localStorage` pela mesma regra da estante do Breeding: é PREFERÊNCIA
// PESSOAL, não estado de tela. O time que está no ringue AGORA viaja na URL
// (`stadium-url.ts`), porque ele é a pergunta e a pergunta se compartilha. A
// coleção de times que a pessoa montou ao longo do mês não se compartilha — ela é
// o armário dela.
//
// Tudo que sai daqui é DESCONFIADO. `localStorage` é editável à mão, herda
// formato de versão anterior e sobrevive a mudança de código; ler sem validar é
// como o site quebra numa máquina só, que é o defeito mais caro de achar. Time que
// não passa no saneamento é descartado calado — um registro podre não pode
// derrubar o armário inteiro.

import { SLOTS, SLOT_VAZIO, type SlotState } from "./stadium-url";

export interface TimeSalvo {
  id: string;
  nome: string;
  time: SlotState[];
  criadoEm: number;
}

const CHAVE = "piwdex.stadium.v1";
const LIMITE = 30;
const NOME_MAX = 32;

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function saneiaSlot(x: unknown): SlotState {
  if (!x || typeof x !== "object") return { ...SLOT_VAZIO };
  const s = x as Record<string, unknown>;
  const id = Number(s.id);
  if (!Number.isFinite(id) || id <= 0) return { ...SLOT_VAZIO };
  const level = Number(s.level);
  const quality = Number(s.quality);
  return {
    id: Math.round(id),
    level: Number.isFinite(level) && level > 0 ? Math.round(level) : SLOT_VAZIO.level,
    quality: Number.isFinite(quality) && quality > 0 ? quality : SLOT_VAZIO.quality,
  };
}

function saneia(x: unknown): TimeSalvo | null {
  if (!x || typeof x !== "object") return null;
  const t = x as Record<string, unknown>;
  if (typeof t.nome !== "string" || !t.nome.trim()) return null;
  if (!Array.isArray(t.time)) return null;
  const bruto = t.time as unknown[];
  const time = Array.from({ length: SLOTS }, (_, i) => saneiaSlot(bruto[i]));
  // Time sem ninguém dentro não é time salvo, é lixo de gravação interrompida.
  if (time.every((s) => s.id == null)) return null;
  return {
    id: typeof t.id === "string" && t.id ? t.id : uid(),
    nome: t.nome.trim().slice(0, NOME_MAX),
    time,
    criadoEm: Number.isFinite(Number(t.criadoEm)) ? Number(t.criadoEm) : 0,
  };
}

export function lerTimes(): TimeSalvo[] {
  if (typeof window === "undefined") return [];
  try {
    const cru = window.localStorage.getItem(CHAVE);
    if (!cru) return [];
    const arr: unknown = JSON.parse(cru);
    if (!Array.isArray(arr)) return [];
    return arr.map(saneia).filter((t): t is TimeSalvo => t != null).slice(0, LIMITE);
  } catch {
    return [];
  }
}

export function gravarTimes(times: TimeSalvo[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(times.slice(0, LIMITE)));
  } catch {
    // Cota estourada ou janela privada: perder o armário é ruim, derrubar a
    // ferramenta por causa dele é pior.
  }
}

/**
 * Salva o time atual com este nome.
 *
 * Nome repetido SUBSTITUI em vez de duplicar, e isso é a coisa certa: "Time do
 * Mewtwo" salvo três vezes com três composições diferentes é um armário em que
 * nenhuma das três é confiável. Quem quer duas versões dá dois nomes.
 */
export function salvarTime(nome: string, time: SlotState[]): TimeSalvo[] {
  const limpo = nome.trim().slice(0, NOME_MAX);
  if (!limpo) return lerTimes();
  const novo: TimeSalvo = {
    id: uid(),
    nome: limpo,
    time: time.map((s) => ({ ...s })),
    criadoEm: Date.now(),
  };
  const resto = lerTimes().filter((t) => t.nome.toLowerCase() !== limpo.toLowerCase());
  const todos = [novo, ...resto].slice(0, LIMITE);
  gravarTimes(todos);
  return todos;
}

export function apagarTime(id: string): TimeSalvo[] {
  const todos = lerTimes().filter((t) => t.id !== id);
  gravarTimes(todos);
  return todos;
}
