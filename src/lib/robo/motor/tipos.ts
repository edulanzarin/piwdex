import type { ActivePoke } from "@/lib/robo/jogo/pokes";

/**
 * O contrato entre o motor e a tela.
 *
 * Vive separado de `sessao.ts` por um motivo mecanico, e nao de arrumacao: o
 * motor importa banco, `pg` e `node:crypto`, e o cockpit e componente de
 * CLIENTE. Um `import type` nao carregaria nada em runtime, mas o cockpit
 * tambem usa `estadoParado()` como valor inicial — e isso basta pro empacotador
 * arrastar o modulo inteiro pro navegador, onde `pg` tenta abrir `net`, `tls` e
 * `dns` e o build morre.
 */

export interface Analyzer {
  kills: number;
  seconds: number;
  xpGained: number;
  lootItems: number;
  lootGold: number;
  ballsUsed: number;
  potionsUsed: number;
  supplyGold: number;
  captures: number;
  shinyCaptures: number;
  capturesGold: number;
  balance: number;
  goldPerHour: number;
  xpPerHour: number;
  killsPerHour: number;
  drops: { itemId: number; name: string; qty: number; gold: number }[];
}

/** Os campos ACUMULATIVOS — os unicos de que faz sentido tirar delta. */
const SOMAS: (keyof Analyzer)[] = [
  "kills", "seconds", "xpGained", "lootItems", "lootGold",
  "ballsUsed", "potionsUsed", "supplyGold", "captures", "shinyCaptures", "capturesGold",
];

export interface Evento {
  em: number;
  tipo: "kill" | "captura";
  especie: string;
  shiny: boolean;
  xp: number;
  loot: { itemId: number; name: string; qty: number }[];
  bola?: string;
}

/**
 * Um corpo na fila de captura.
 *
 * O jogo reenvia a lista INTEIRA a cada mudanca: cresce a cada kill, drena
 * conforme o auto-catch processa. No frame, `speciesId` vem com o nome `pokeId`
 * e e o numero da ESPECIE, nao o cuid do individuo.
 */
export interface NaFila {
  id: number;
  speciesId: number;
  nome: string;
  level: number;
  shiny: boolean;
  em: number;
}

/** `bloqueado` e TERMINAL: o jogo recusou a conta e tentar de novo nao muda nada.
 *  Os outros sao passageiros e pedem reconexao. */
export type StatusSessao = "parado" | "conectando" | "rodando" | "chutado" | "erro" | "bloqueado";

export interface EstadoHunt {
  status: StatusSessao;
  slug: string | null;
  desdeMs: number | null;
  analyzer: Analyzer | null;
  eventos: Evento[];
  fila: NaFila[];
  time: ActivePoke[];
  heroHp: number | null;
  heroMaxHp: number | null;
  caido: boolean;
  ligado: boolean;
  reconectando: boolean;
  proximaTentativaEm: number | null;
  motivoBloqueio: string | null;
}

// ---------------------------------------------------------------------------

/**
 * O analyzer do jogo e ACUMULATIVO por sessao de jogo, nao por cacada nossa.
 *
 * Sem subtrair uma base, trocar de hunt mostraria o ouro da anterior somado, e o
 * "ouro/hora desta hunt" seria a media de tudo que aconteceu desde o login.
 */
export function deltaAnalyzer(bruto: Analyzer, base: Analyzer | null): Analyzer {
  if (!base) return bruto;
  const out = { ...bruto } as Analyzer;
  for (const k of SOMAS) (out[k] as number) = Math.max(0, (bruto[k] as number ?? 0) - (base[k] as number ?? 0));
  out.balance = out.lootGold + out.capturesGold - out.supplyGold;
  const horas = out.seconds / 3600;
  out.goldPerHour = horas > 0 ? out.balance / horas : 0;
  out.xpPerHour = horas > 0 ? out.xpGained / horas : 0;
  out.killsPerHour = horas > 0 ? out.kills / horas : 0;
  // Os drops tambem sao cumulativos, item a item.
  const antes = new Map((base.drops ?? []).map((d) => [d.itemId, d]));
  out.drops = (bruto.drops ?? [])
    .map((d) => {
      const b = antes.get(d.itemId);
      return b ? { ...d, qty: d.qty - b.qty, gold: d.gold - b.gold } : d;
    })
    .filter((d) => d.qty > 0);
  return out;
}

/** O jogo zerou o analyzer por conta propria: algum acumulado voltou MENOR que a
 *  base, o que so acontece quando ele reiniciou a contagem. */
export const analyzerZerou = (bruto: Analyzer, base: Analyzer) =>
  SOMAS.some((k) => (bruto[k] as number ?? 0) < (base[k] as number ?? 0));

export function estadoParado(): EstadoHunt {
  return {
    status: "parado", slug: null, desdeMs: null, analyzer: null, eventos: [], fila: [],
    time: [], heroHp: null, heroMaxHp: null, caido: false,
    ligado: false, reconectando: false, proximaTentativaEm: null, motivoBloqueio: null,
  };
}
