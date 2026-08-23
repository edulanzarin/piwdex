/**
 * Os pokemons INDIVIDUAIS da conta, normalizados.
 *
 * A REST do jogo nao entrega isto: ela da o agregado por especie. Individuo com
 * IV, quality e poder so existe no frame `pokes` do WebSocket — e e por isso que
 * o robo paga o preco de segurar uma sessao de jogo.
 */

export interface MonStats {
  hp: number;
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  speed: number;
}

export interface ActivePoke {
  id: string;
  speciesId: number;
  name: string;
  level: number;
  shiny: boolean;
  team: boolean;
  slot: number;
  leader: boolean;
  starter: boolean;
  /** cadeado do jogador — o jogo RECUSA vender */
  locked: boolean;
  /** ouro que o NPC paga por ele */
  sellValue: number;
  ivTotal: number;
  quality: number;
  power: number;
  type1: string;
  /** vida ATUAL. 0 = desmaiado, e e a unica fonte de vida fora do campo:
   *  `field` so existe em hunt e `/api/characters/me` nao traz HP. */
  hp: number;
  maxHp: number;
  stats: MonStats;
  /** XP acumulado, se a fonte mandar. Sem ele a tela cai no tamanho do nivel
   *  (a curva e publica — `lib/xp.ts`). */
  xp: number | null;
}

const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);

export function normalizarPokes(lista: unknown): ActivePoke[] {
  if (!Array.isArray(lista)) return [];
  return (lista as Record<string, unknown>[]).map((p) => {
    const s = (p.stats ?? {}) as Record<string, unknown>;
    return {
      id: str(p.id),
      speciesId: num(p.speciesId),
      name: str(p.name, "?"),
      level: num(p.level),
      shiny: Boolean(p.shiny),
      team: Boolean(p.team),
      slot: num(p.slot),
      leader: Boolean(p.leader),
      starter: Boolean(p.starter),
      locked: Boolean(p.locked),
      sellValue: num(p.sellValue),
      ivTotal: num(p.ivTotal),
      quality: num(p.quality),
      power: num(p.power),
      type1: str(p.type1),
      hp: num(p.hp),
      maxHp: num(p.maxHp),
      // O frame usa nomes diferentes conforme a tela. Aceita os tres, e nao
      // inventa zero: `null` diz "a fonte nao mandou", zero diria "sem XP".
      xp: [p.xp, p.exp, p.experience].map((v) => num(v)).find((v) => v > 0) ?? null,
      stats: {
        hp: num(s.hp), atk: num(s.atk), def: num(s.def),
        spAtk: num(s.spAtk), spDef: num(s.spDef), speed: num(s.speed),
      },
    };
  });
}

/** O treinador, do `GET /api/characters/me`. */
export interface Perfil {
  nome: string;
  level: number;
  gold: number;
  diamantes: number;
  capturas: number;
  vip: boolean;
}

export function normalizarPerfil(bruto: unknown): Perfil | null {
  if (!bruto || typeof bruto !== "object") return null;
  const raiz = bruto as Record<string, unknown>;
  // A rota devolve `{character:{...}}`; aceitar os dois formatos evita quebrar
  // se o jogo achatar a resposta um dia.
  const p = ((raiz.character ?? raiz) as Record<string, unknown>) ?? {};
  if (!p || typeof p !== "object") return null;
  return {
    nome: str(p.name, "?"),
    level: num(p.level),
    gold: num(p.gold),
    diamantes: num(p.diamonds),
    capturas: num(p.catches ?? p.totalCatches),
    vip: Boolean(p.isVip ?? p.vip),
  };
}
