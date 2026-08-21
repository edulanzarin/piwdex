// Normaliza as respostas da API logada do jogo (formatos verificados com token real):
//  - /api/game/profile   -> resumo do treinador (level, gold, diamonds, catches...)
//  - /api/game/all-pokes  -> seu pokedex agregado por especie+tier ({dexId,name,looktype,tier,count})
//  - /api/game/market     -> mercado; anuncios de pokemon JA vem com ivTotal/quality/power/stats
//  - /api/game/balls      -> catalogo de pokebolas com catchRate
// A conta NAO expoe pokemon individuais (so contagem por tier); os individuais com stats
// aparecem no mercado (quando estao a venda) e no pokemon ativo.

import type { Creature } from "./types";
import { gameAssetUrl } from "./game-host";

const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);

// null se o payload nao trouxe stats (anuncio velho/incompleto) — a UI cai pros base.
function normalizeMonStats(v: unknown): MonStats | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Record<string, unknown>;
  return {
    hp: num(s.hp), atk: num(s.atk), def: num(s.def),
    spAtk: num(s.spAtk), spDef: num(s.spDef), speed: num(s.speed),
  };
}

// Pokemon individual ATIVO (do WebSocket ws<shard>, evento "pokes"). E o unico
// lugar com os individuos + IV/quality/power; a REST so da o agregado.
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
  locked: boolean; // cadeado do jogador — o jogo RECUSA vender (flag do frame pokes)
  sellValue: number; // ouro que o NPC paga por ele
  ivTotal: number;
  quality: number;
  power: number;
  type1: string;
  hp: number;
  maxHp: number;
  stats: MonStats;
  /** XP ACUMULADO do individuo, se a fonte mandar. Sem ele a UI cai no tamanho do
   *  nivel (a curva e publica — ver lib/xp.ts). */
  xp: number | null;
}

export function normalizeActivePokes(list: unknown): ActivePoke[] {
  if (!Array.isArray(list)) return [];
  return (list as Record<string, unknown>[]).map((p) => {
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
      // o frame usa nomes diferentes conforme a tela; aceita os tres e nao inventa zero
      xp: [p.xp, p.exp, p.experience].map(num).find((v) => v > 0) ?? null,
      stats: {
        hp: num(s.hp), atk: num(s.atk), def: num(s.def),
        spAtk: num(s.spAtk), spDef: num(s.spDef), speed: num(s.speed),
      },
    };
  });
}

export interface Profile {
  name: string;
  level: number;
  gold: number;
  diamonds: number;
  catches: number;
  pokedexCount: number;
  pokedexTotal: number;
  vip: boolean;
  rank: number;
}

export function normalizeProfile(raw: unknown): Profile | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  return {
    name: str(p.name, "?"),
    level: num(p.level),
    gold: num(p.gold),
    diamonds: num(p.diamonds),
    catches: num(p.totalCatches ?? p.catches),
    pokedexCount: num(p.pokedexCount),
    pokedexTotal: num(p.pokedexTotal),
    vip: Boolean(p.vip ?? p.isVip),
    rank: num(p.rank),
  };
}

export interface DexEntry {
  dexId: number;
  name: string;
  looktype: number;
  tier: string; // A..E (banda de qualidade dos que voce tem)
  count: number;
}

export function normalizePokedex(raw: unknown): DexEntry[] {
  const entries = (raw as { entries?: unknown })?.entries;
  if (!Array.isArray(entries)) return [];
  return entries.map((e) => {
    const o = e as Record<string, unknown>;
    return { dexId: num(o.dexId), name: str(o.name, "?"), looktype: num(o.looktype), tier: str(o.tier, "?"), count: num(o.count) };
  });
}

// ---- Conta completa (perfil + treinador + automacao + streak + breeding + itens) ----
// Junta /api/game/profile, /api/characters/me, /api/game/depot, /api/game/streak,
// /api/game/breeding, /api/game/balls, /api/game/professions. NAO ha endpoint pros
// pokemons individuais ativos (com IV/level) — isso so no WebSocket do cliente do jogo.

export interface AccountItem {
  id: number;
  name: string;
  icon: string;
  category: string;
  quantity: number;
  npcPrice: number;
}
const normItems = (raw: unknown): AccountItem[] =>
  (Array.isArray(raw) ? raw : []).map((i) => {
    const o = i as Record<string, unknown>;
    return {
      id: num(o.id),
      name: str(o.name, "?"),
      icon: str(o.icon),
      category: str(o.category, "loot"),
      quantity: num(o.quantity),
      npcPrice: num(o.npcPrice),
    };
  });

export interface BallCount {
  id: number;
  name: string;
  count: number;
  iconUrl: string;
  infinite: boolean;
}

export interface AccountEgg {
  id: number;
  name: string;
  dexId: number;
  progress: number; // 0..1 se der pra inferir
  ready: boolean;
  shiny: boolean;
}

export interface Account {
  profile: {
    name: string;
    level: number;
    xp: number;
    xpInLevel: number;
    xpForNext: number;
    gold: number;
    diamonds: number;
    catches: number;
    rank: number;
    totalPlayers: number;
    pokedexCount: number;
    pokedexTotal: number;
    fishingSkill: number;
    createdAt: string;
  };
  trainer: {
    lookType: number;
    gender: string;
    vip: boolean;
    vipUntil: string | null;
    clan: string | null;
    clanRank: number;
    profession: string | null;
    professionRankName: string | null;
    catchBonusPct: number;
    breedingSlots: number;
    diamondsPurchased: number;
    referralCode: string | null;
  };
  auto: {
    autoCatch: boolean;
    autoCatchBallId: number;
    autoCatchShiny: boolean;
    autoCatchShinyBallId: number;
    autoPotion: boolean;
    autoPotionThreshold: number;
    autoRevive: boolean;
    selectedBallId: number;
    starterId: number;
  };
  streak: {
    available: number;
    totalKills: number;
    bonusExp: number;
    bonusLoot: number;
    bonusShiny: number;
  };
  // battle pass + pontos de atividade (characters/me — mapeado por HAR ago/2026)
  pass: {
    points: number;
    premium: boolean;
    claimed: number;        // recompensas free resgatadas
    claimedPremium: number; // recompensas premium resgatadas
  };
  points: {
    pictures: number;   // fotos tiradas (photo hunt)
    pokelog: number;
    boss: number;
    stylist: number;
    engineer: number;
    professor: number;
    adventurer: number;
    nightmare: number;  // nightmare level
  };
  breeding: {
    unlocked: boolean;
    usedSlots: number;
    maxSlots: number;
    pheromones: number;
    eggs: AccountEgg[];
  };
  balls: BallCount[];
  inventory: AccountItem[];
  depot: AccountItem[];
  depotMaxSlots: number;
}

interface AccountParts {
  profile: unknown;
  character: unknown;
  depot: unknown;
  streak: unknown;
  breeding: unknown;
  balls: unknown;
  professions: unknown;
}

export function normalizeAccount(parts: AccountParts): Account {
  const p = (parts.profile ?? {}) as Record<string, unknown>;
  const c = (parts.character ?? {}) as Record<string, unknown>;
  const depot = (parts.depot ?? {}) as Record<string, unknown>;
  const streak = (parts.streak ?? {}) as Record<string, unknown>;
  const breeding = (parts.breeding ?? {}) as Record<string, unknown>;
  const balls = (parts.balls ?? {}) as Record<string, unknown>;
  const prof = (parts.professions ?? {}) as Record<string, unknown>;

  const ballCatalog = Array.isArray(balls.catalog) ? (balls.catalog as Record<string, unknown>[]) : [];
  const ballCounts = (balls.counts ?? {}) as Record<string, unknown>;
  const selectedBall = num(balls.selected ?? c.selectedBallId);

  const eggsRaw = Array.isArray(breeding.eggs) ? (breeding.eggs as Record<string, unknown>[]) : [];

  return {
    profile: {
      name: str(p.name ?? c.name, "?"),
      level: num(p.level ?? c.level),
      xp: num(p.xp ?? c.xp),
      xpInLevel: num(p.xpInLevel),
      xpForNext: num(p.xpForNext),
      gold: num(p.gold ?? c.gold),
      diamonds: num(p.diamonds ?? c.diamonds),
      catches: num(p.totalCatches ?? c.catches),
      rank: num(p.rank),
      totalPlayers: num(p.totalPlayers),
      pokedexCount: num(p.pokedexCount),
      pokedexTotal: num(p.pokedexTotal),
      fishingSkill: num(p.fishingSkill ?? c.fishingSkill),
      createdAt: str(c.createdAt ?? p.createdAt),
    },
    trainer: {
      lookType: num(c.lookType),
      gender: str(c.gender, "male"),
      vip: Boolean(c.isVip ?? p.vip),
      vipUntil: c.vipUntil ? str(c.vipUntil) : null,
      clan: c.clan ? str(c.clan) : null,
      clanRank: num(c.clanRank),
      profession: c.profession ? str(c.profession) : null,
      professionRankName: prof.rankName ? str(prof.rankName) : null,
      catchBonusPct: num(prof.catchBonusPct),
      breedingSlots: num(c.breedingSlots),
      diamondsPurchased: num(c.diamondsPurchased),
      referralCode: c.referralCode ? str(c.referralCode) : null,
    },
    auto: {
      autoCatch: Boolean(c.autoCatch),
      autoCatchBallId: num(c.autoCatchBallId),
      autoCatchShiny: Boolean(c.autoCatchShiny),
      autoCatchShinyBallId: num(c.autoCatchShinyBallId),
      autoPotion: Boolean(c.autoPotion),
      autoPotionThreshold: num(c.autoPotionThreshold),
      autoRevive: Boolean(c.autoRevive),
      selectedBallId: selectedBall,
      starterId: num(c.starterId),
    },
    streak: (() => {
      const b = (streak.bonusPct ?? {}) as Record<string, unknown>;
      return {
        available: num(streak.available),
        totalKills: num(streak.totalKills ?? c.catches),
        bonusExp: num(b.exp),
        bonusLoot: num(b.loot),
        bonusShiny: num(b.shiny),
      };
    })(),
    pass: {
      points: num(c.battlePassPoints),
      premium: Boolean(c.battlePassPremium),
      claimed: Array.isArray(c.battlePassClaimed) ? c.battlePassClaimed.length : 0,
      claimedPremium: Array.isArray(c.battlePassClaimedPremium) ? c.battlePassClaimedPremium.length : 0,
    },
    points: {
      pictures: num(c.picturesTaken),
      pokelog: num(c.pokelogPoints),
      boss: num(c.bossPoints),
      stylist: num(c.stylistPoints),
      engineer: num(c.engineerPoints),
      professor: num(c.professorPoints),
      adventurer: num(c.adventurerPoints),
      nightmare: num(c.nightmareLevel),
    },
    breeding: {
      unlocked: Boolean(breeding.unlocked),
      usedSlots: num(breeding.usedSlots),
      maxSlots: num(breeding.slots ?? breeding.maxSlots),
      pheromones: num(breeding.pheromones),
      eggs: eggsRaw.map((e) => ({
        id: num(e.id),
        name: str(e.name, "Egg"),
        dexId: num(e.dexId ?? e.speciesId),
        progress: typeof e.progress === "number" ? e.progress : 0,
        ready: Boolean(e.ready ?? e.canHatch),
        shiny: Boolean(e.shiny),
      })),
    },
    balls: ballCatalog.map((b) => {
      const id = num(b.id);
      return {
        id,
        name: str(b.name, "?"),
        count: num(ballCounts[String(id)]),
        iconUrl: gameAssetUrl(str(b.iconUrl)),
        infinite: Boolean(b.infinite),
      };
    }),
    inventory: normItems(depot.inventory),
    depot: normItems(depot.depot),
    depotMaxSlots: num(depot.maxSlots),
  };
}

export type Currency = "GOLD" | "DIAMONDS";

// Stats individuais de um pokemon (mesmo shape do frame `pokes` e do anuncio do mercado).
export interface MonStats { hp: number; atk: number; def: number; spAtk: number; spDef: number; speed: number }

export interface MarketMon {
  listingId: string;
  speciesId: number;
  name: string; // nome da especie (resolvido do catalogo)
  level: number;
  shiny: boolean;
  ivTotal: number | null;
  quality: number | null;
  power: number | null;
  stats: MonStats | null; // stats REAIS do individuo a venda (o jogo manda no anuncio)
  type1: string | null;
  type2: string | null;
  price: number;
  currency: Currency;
  belowNpc: boolean;
  sellers: number;
  fairPrice?: number | null; // preco justo estimado (motor de valor, preenchido pela API)
}

// Anuncio de ITEM do mercado (kind item/diamonds): o jogo agrega anuncios iguais numa
// pilha — `ids` sao os anuncios individuais, `quantity` o total disponivel, `price` o
// preco UNITARIO. `refId` e o itemId do catalogo (0 pra diamantes).
export interface MarketItem {
  listingId: string;
  ids: string[];
  kind: string; // "item" | "diamonds"
  refId: number;
  name: string;
  icon: string; // nome de arquivo cru do jogo (o catalogo local resolve o caminho bom)
  category: string; // Items | Stones | Poke Balls | Diamonds
  quantity: number;
  price: number;
  currency: Currency;
  belowNpc: boolean;
  sellers: number;
  at: string;
  npcPrice?: number | null; // preco NPC do catalogo local (comparativo), preenchido pela API
}

// Extrai os anuncios de ITEM (e diamantes) do /api/game/market.
export function normalizeMarketItems(raw: unknown): MarketItem[] {
  const listings = (raw as { listings?: unknown })?.listings;
  if (!Array.isArray(listings)) return [];
  const out: MarketItem[] = [];
  for (const l of listings) {
    const o = l as Record<string, unknown>;
    const kind = str(o.kind).toLowerCase();
    if (kind === "pokemon") continue;
    out.push({
      listingId: str(o.id),
      ids: Array.isArray(o.ids) ? (o.ids as unknown[]).map((x) => String(x)) : [str(o.id)],
      kind,
      refId: num(o.refId),
      name: str(o.name),
      icon: str(o.icon),
      category: str(o.category),
      quantity: num(o.quantity, 1),
      price: num(o.price),
      currency: str(o.currency).toUpperCase() === "DIAMONDS" ? "DIAMONDS" : "GOLD",
      belowNpc: Boolean(o.belowNpc),
      sellers: num(o.sellers, 1),
      at: str(o.at),
    });
  }
  return out;
}

// Extrai os anuncios de POKEMON do /api/game/market, com os stats que o jogo ja fornece.
export function normalizeMarketMons(raw: unknown, creatures: Creature[]): MarketMon[] {
  const listings = (raw as { listings?: unknown })?.listings;
  if (!Array.isArray(listings)) return [];
  const byId = new Map<number, Creature>();
  for (const c of creatures) byId.set(c.pokeId, c);

  const out: MarketMon[] = [];
  for (const l of listings) {
    const o = l as Record<string, unknown>;
    if (str(o.kind).toLowerCase() !== "pokemon") continue;
    const speciesId = num(o.speciesId);
    const species = byId.get(speciesId);
    const currency = str(o.currency).toUpperCase() === "DIAMONDS" ? "DIAMONDS" : "GOLD";
    out.push({
      listingId: str(o.id),
      speciesId,
      name: species?.name ?? (str(o.name).replace(/\s*Lv\.\d+\s*$/i, "") || String(speciesId)),
      level: num(o.level),
      shiny: Boolean(o.shiny),
      ivTotal: o.ivTotal != null ? num(o.ivTotal) : null,
      quality: o.quality != null ? num(o.quality) : null,
      power: o.power != null ? num(o.power) : null,
      stats: normalizeMonStats(o.stats),
      type1: (o.type1 as string) ?? species?.type1 ?? null,
      type2: (o.type2 as string) ?? species?.type2 ?? null,
      price: num(o.price),
      currency,
      belowNpc: Boolean(o.belowNpc),
      sellers: num(o.sellers, 1),
    });
  }
  return out;
}
