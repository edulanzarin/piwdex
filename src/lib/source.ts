// Fonte de dados do catalogo: puxa AO VIVO do jogo com revalidacao (ISR) e cai
// no snapshot versionado se a fonte falhar. Assim o catalogo se mantem fresco
// sozinho (sem redeploy) e o site nunca quebra se o jogo/Cloudflare recusar.
//
// So o CATALOGO publico e assim. Preco de mercado de jogadores nao vem daqui —
// e da API logada (camada 3). Ver [[Poke Idle World - endpoints publicos de dados]].

import snapshot from "@/data/piwdex.json";
import type { Attack, Creature, Hunt, Item, Snapshot } from "./types";

const HOST = "https://poke.idleworld.online";
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// Revalida a cada 1h — o catalogo muda so em patch de balanceamento.
const REVALIDATE = 3600;

const SOURCES = {
  creatures: `${HOST}/game/creatures.json`,
  items: `${HOST}/game/items.json`,
  mapMarkers: `${HOST}/api/game/map-markers`,
};

export interface SourceData {
  creatures: Creature[];
  items: Item[];
  hunts: Hunt[];
  generatedAt: string;
  live: boolean;
}

async function get(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    next: { revalidate: REVALIDATE },
  });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}

const asNum = (v: unknown): number => (typeof v === "number" ? v : 0);

// Normalizacao leve: a fonte omite campos opcionais (type2, evolucao) e, em casos
// raros, campos numericos/arrays. Preenche defaults pra o app confiar no shape.
function normalizeCreatures(src: unknown[]): Creature[] {
  return src.map((raw) => {
    const c = raw as Record<string, unknown>;
    return {
      pokeId: c.pokeId as number,
      name: c.name as string,
      looktype: asNum(c.looktype),
      description: (c.description as string) ?? "",
      type1: c.type1 as Creature["type1"],
      type2: (c.type2 as Creature["type2"]) ?? null,
      rarity: c.rarity as Creature["rarity"],
      baseHp: asNum(c.baseHp),
      baseAtk: asNum(c.baseAtk),
      baseDef: asNum(c.baseDef),
      baseSpAtk: asNum(c.baseSpAtk),
      baseSpDef: asNum(c.baseSpDef),
      baseSpeed: asNum(c.baseSpeed),
      huntLevel: asNum(c.huntLevel),
      evolvesToId: (c.evolvesToId as number | null) ?? null,
      evolveLevel: (c.evolveLevel as number | null) ?? null,
      priceNpc: asNum(c.priceNpc),
      sellValue: asNum(c.sellValue),
      experience: asNum(c.experience),
      loot: Array.isArray(c.loot) ? (c.loot as Creature["loot"]) : [],
      attacks: normalizeAttacks(c.attacks),
      area: (c.area as string | null) ?? null,
      captureBase: (c.captureBase as number | null) ?? null,
    };
  });
}

// `tm` vem da fonte como o TIPO da maquina ("PSYCHIC") e some no golpe natural. Vira
// campo explicito aqui pra o motor poder separar os dois pools — ver Attack em types.ts.
function normalizeAttacks(src: unknown): Attack[] {
  if (!Array.isArray(src)) return [];
  return src.map((raw) => {
    const a = raw as Record<string, unknown>;
    return {
      name: a.name as string,
      type: a.type as Attack["type"],
      category: a.category as Attack["category"],
      power: asNum(a.power),
      cooldownMs: asNum(a.cooldownMs),
      learnLevel: asNum(a.learnLevel),
      tm: (a.tm as Attack["tm"]) ?? null,
    };
  });
}

function fromSnapshot(): SourceData {
  const s = snapshot as unknown as Snapshot;
  return {
    creatures: s.creatures,
    items: s.items,
    hunts: s.hunts,
    generatedAt: s.generatedAt,
    live: false,
  };
}

export async function fetchSource(): Promise<SourceData> {
  try {
    const [cRaw, iRaw, mRaw] = await Promise.all([
      get(SOURCES.creatures),
      get(SOURCES.items),
      get(SOURCES.mapMarkers),
    ]);
    const creaturesSrc = (cRaw as { creatures?: unknown[] }).creatures ?? (cRaw as unknown[]);
    const items = ((iRaw as { items?: Item[] }).items ?? (iRaw as Item[]));
    const hunts = ((mRaw as { hunts?: Hunt[] }).hunts ?? (mRaw as Hunt[]));

    if (!Array.isArray(creaturesSrc) || !creaturesSrc.length) throw new Error("creatures vazio");
    if (!Array.isArray(items) || !items.length) throw new Error("items vazio");
    if (!Array.isArray(hunts) || !hunts.length) throw new Error("hunts vazio");

    return {
      creatures: normalizeCreatures(creaturesSrc),
      items,
      hunts,
      // sem Date.now aqui pra nao invalidar o cache do fetch; marca so "ao vivo".
      generatedAt: (snapshot as unknown as Snapshot).generatedAt,
      live: true,
    };
  } catch {
    return fromSnapshot();
  }
}
