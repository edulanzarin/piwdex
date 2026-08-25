// Ingestão da fonte-mestra do Poke Idle World.
//
// O jogo serve o catálogo como JSON público (sem auth). Puxamos direto da origem
// — nao de terceiros (piwtools) — pra ficar na mesma fonte e pegar patch de
// balanceamento antes. Cloudflare bloqueia bot generico, entao mandamos um
// User-Agent de navegador.
//
// Saida: src/data/piwdex.json = SNAPSHOT PURO da fonte (creatures/items/hunts).
// As derivacoes (indice reverso de drop, localizacoes, evolucao) NAO entram aqui:
// vivem no codigo (src/lib/data.ts), pra o snapshot ser diffavel contra o jogo.

import { writeFile, readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const HOST = "https://poke.idleworld.online";
const SOURCES = {
  creatures: `${HOST}/game/creatures.json`,
  items: `${HOST}/game/items.json`,
  mapMarkers: `${HOST}/api/game/map-markers`,
  bosses: `${HOST}/game/bossCatalog.json`,
};

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}

async function main() {
  console.log("Baixando fonte-mestra do Poke Idle World...");
  const [creaturesRaw, itemsRaw, mapRaw, bossesRaw] = await Promise.all([
    get(SOURCES.creatures),
    get(SOURCES.items),
    get(SOURCES.mapMarkers),
    get(SOURCES.bosses).catch((e) => {
      // O catálogo de boss e o ÚNICO opcional da ingestão, e isso e deliberado: as
      // outras tres fontes são o site inteiro, esta é uma ferramenta só. Falhar aqui
      // derruba a atualização do catálogo por causa da tela menor.
      console.warn(`AVISO: bossCatalog indisponível (${e.message}); bosses.json mantido.`);
      return null;
    }),
  ]);

  const creaturesSrc = creaturesRaw.creatures ?? creaturesRaw;
  const items = itemsRaw.items ?? itemsRaw;
  const hunts = mapRaw.hunts ?? mapRaw;
  const map = mapRaw.map ?? null;

  // Normalizacao leve: a fonte omite campos opcionais (type2, evolucao) e, em
  // casos raros, campos numericos/arrays. Preenchemos defaults pra o app confiar
  // no shape sem blindar cada acesso. Nao inventamos dado: default e o "vazio".
  const num = (v) => (typeof v === "number" ? v : 0);
  const creatures = creaturesSrc.map((c) => ({
    pokeId: c.pokeId,
    name: c.name,
    looktype: num(c.looktype),
    description: c.description ?? "",
    type1: c.type1,
    type2: c.type2 ?? null,
    rarity: c.rarity,
    baseHp: num(c.baseHp),
    baseAtk: num(c.baseAtk),
    baseDef: num(c.baseDef),
    baseSpAtk: num(c.baseSpAtk),
    baseSpDef: num(c.baseSpDef),
    baseSpeed: num(c.baseSpeed),
    huntLevel: num(c.huntLevel),
    evolvesToId: c.evolvesToId ?? null,
    evolveLevel: c.evolveLevel ?? null,
    priceNpc: num(c.priceNpc),
    sellValue: num(c.sellValue),
    experience: num(c.experience),
    loot: Array.isArray(c.loot) ? c.loot : [],
    // `tm` (tipo da maquina) some no golpe natural: fixamos null pra o campo existir
    // sempre. Separar TM de natural e obrigatorio — todo golpe de poder 600 e TM.
    attacks: (Array.isArray(c.attacks) ? c.attacks : []).map((a) => ({
      name: a.name,
      type: a.type,
      category: a.category,
      power: num(a.power),
      cooldownMs: num(a.cooldownMs),
      learnLevel: num(a.learnLevel),
      tm: a.tm ?? null,
    })),
    area: c.area ?? null,
    captureBase: c.captureBase ?? null,
  }));

  if (!Array.isArray(creatures) || !creatures.length) throw new Error("creatures vazio");
  if (!Array.isArray(items) || !items.length) throw new Error("items vazio");
  if (!Array.isArray(hunts) || !hunts.length) throw new Error("hunts vazio");

  // Integridade: todo item de loot tem que existir em items.json.
  const itemNames = new Set(items.map((i) => i.name));
  const missing = new Set();
  for (const c of creatures)
    for (const l of c.loot ?? []) if (!itemNames.has(l.name)) missing.add(l.name);
  if (missing.size)
    console.warn(`AVISO: ${missing.size} itens de loot sem correspondencia em items.json:`, [
      ...missing,
    ].slice(0, 10));

  const generatedAt = new Date().toISOString();
  const snapshot = {
    generatedAt,
    source: HOST,
    counts: { creatures: creatures.length, items: items.length, hunts: hunts.length },
    map,
    creatures,
    items,
    hunts,
  };

  await mkdir(join(ROOT, "src/data"), { recursive: true });
  await writeFile(
    join(ROOT, "src/data/piwdex.json"),
    JSON.stringify(snapshot, null, 2) + "\n",
    "utf8",
  );

  // O catálogo de BOSS mora em arquivo próprio, e não dentro do snapshot.
  //
  // O snapshot passa pela maquinaria de frescor do `source.ts`: ETag no
  // creatures.json a cada visita, porque ouro por abate e XP mudam com patch de
  // balanceamento e um número de uma hora atrás já troca a decisão de quem lê.
  //
  // Boss não é esse tipo de dado. O que a fonte publica dele é nome, categoria,
  // nível e drops — identidade, não balanceamento. Boss novo entra numa
  // atualização de conteúdo, e a ingestão pega na próxima passada. Enfiá-lo no
  // snapshot custaria uma quarta fonte na chave de versão do catálogo inteiro
  // pra dar frescor de segundo a um dado que muda por temporada.
  if (bossesRaw) {
    const bosses = (Array.isArray(bossesRaw) ? bossesRaw : []).map((b) => ({
      key: String(b.key),
      name: String(b.name ?? b.key),
      img: b.img ?? null,
      icon: b.icon ?? null,
      category: String(b.category ?? "Especiais"),
      level: num(b.level),
      drops: Array.isArray(b.drops) ? b.drops.map(String) : [],
    }));
    if (bosses.length) {
      await writeFile(
        join(ROOT, "src/data/bosses.json"),
        JSON.stringify({ generatedAt, source: SOURCES.bosses, count: bosses.length, bosses }, null, 2) + "\n",
        "utf8",
      );
      console.log(`OK: ${bosses.length} bosses -> src/data/bosses.json`);
    }
  }

  // Copia crua datada (gitignorada) pra auditar patch de balanceamento depois.
  const stamp = generatedAt.slice(0, 10);
  const rawDir = join(ROOT, "data/raw", stamp);
  await mkdir(rawDir, { recursive: true });
  await writeFile(join(rawDir, "creatures.json"), JSON.stringify(creaturesRaw), "utf8");
  await writeFile(join(rawDir, "items.json"), JSON.stringify(itemsRaw), "utf8");
  await writeFile(join(rawDir, "map-markers.json"), JSON.stringify(mapRaw), "utf8");
  if (bossesRaw) await writeFile(join(rawDir, "bossCatalog.json"), JSON.stringify(bossesRaw), "utf8");

  console.log(
    `OK ${stamp}: ${creatures.length} criaturas, ${items.length} itens, ${hunts.length} hunts -> src/data/piwdex.json`,
  );

  // Sync autenticado OPCIONAL: as pokebolas reais (Poke/Great/Ultra/Idle/Master) nao
  // vem no JSON publico — o catchRate e o preco so existem em /api/game/balls (logado).
  // Se PIW_TOKEN estiver no ambiente, puxamos e preenchemos precos em src/data/balls.json
  // (o catchRate ja e dado-verdade fixo; aqui so completamos preco/id reais).
  const token = process.env.PIW_TOKEN;
  if (token) {
    try {
      const res = await fetch(`${HOST}/api/game/balls`, {
        headers: { "User-Agent": UA, Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const catalog = Array.isArray(data.catalog) ? data.catalog : [];
      const ballsPath = join(ROOT, "src/data/balls.json");
      const balls = JSON.parse(await readFile(ballsPath, "utf8"));
      const byName = new Map(catalog.map((c) => [String(c.name ?? "").toLowerCase(), c]));
      for (const b of balls.balls) {
        const hit = byName.get(b.name.toLowerCase()) ?? catalog.find((c) => Number(c.catchRate) === b.catchRate);
        if (hit) {
          b.id = hit.id ?? b.id;
          b.catchRate = typeof hit.catchRate === "number" ? hit.catchRate : b.catchRate;
          b.priceGold = typeof hit.priceGold === "number" ? hit.priceGold : b.priceGold;
          b.iconUrl = hit.iconUrl ?? b.iconUrl ?? null;
          b.buyable = Boolean(hit.buyable);
          b.infinite = Boolean(hit.infinite);
        }
      }
      balls.syncedAt = generatedAt;
      balls.source = "synced:/api/game/balls";
      await writeFile(ballsPath, JSON.stringify(balls, null, 2) + "\n", "utf8");
      await writeFile(join(rawDir, "balls.json"), JSON.stringify(data), "utf8");
      console.log(`OK sync autenticado: ${catalog.length} bolas -> src/data/balls.json (precos reais)`);
    } catch (err) {
      console.warn(`AVISO: sync autenticado de bolas falhou (${err.message}); balls.json mantido.`);
    }
  } else {
    console.log("(sem PIW_TOKEN: pulei o sync de precos das bolas; catchRate ja e dado-verdade)");
  }
}

main().catch((err) => {
  console.error("Falha na ingestao:", err.message);
  process.exit(1);
});
