// Baker dos sprites REAIS do jogo (arte por looktype, estilo Tibia).
//
// O Poke Idle World monta a arte de cada criatura de um spritesheet (asset-packs).
// Aqui baixamos, recortamos o frame frontal (direcao 3 = de frente, frame 1 = parado)
// e salvamos como webp self-hostado em public/game-sprites/<looktype>.webp. Assim o
// piwdex mostra a arte identica ao jogo, sem canvas em runtime e sem depender da PokeAPI.
//
// Pipeline (ver Brain "Poke Idle World - endpoints publicos de dados"):
//   /game/asset-packs/outfits-index.json  -> outfits[id=looktype]{manifest,kind,...}
//   manifest (replace ^/assets-packs -> /game/asset-packs) -> categories[0]:
//     .pages[p].image (webp) + .assets{ source, frames:[{page,x,y,w,h}] }
//   source "<frame>_<lx>_<ly>_<dir>.png" (ATENCAO: direcao e o ULTIMO campo, 1..4;
//     frame e o PRIMEIRO, 1..3). Frente parada = frame 1, direcao 3 -> "1_1_1_3.png"
//     (dir 1 = costas, 2 = direita, 3 = frente/sul, 4 = esquerda). rect ja e o sprite cheio.
//
// Saidas: public/game-sprites/<looktype>.webp  +  src/data/game-sprites.json
//   { syncedAt, baked:[looktype...], pokeToLook:{pokeId:looktype} }

import sharp from "sharp";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const HOST = "https://poke.idleworld.online";
const PACK_BASE = "/game/asset-packs";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const OUT_DIR = join(ROOT, "public/game-sprites");
const CONCURRENCY = 8;

const resolvePack = (p) => `${HOST}${p.replace(/^\/assets-packs/, PACK_BASE)}`;

async function getJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}
async function getBuffer(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Recorta e salva o frame frontal de um outfit. Retorna true se salvou.
async function bakeOne(looktype, entry) {
  const manifest = await getJson(resolvePack(entry.manifest));
  const cat = Object.values(manifest.categories)[0];
  const assets = Object.values(cat.assets || manifest.assets || {});
  // frente parada = frame 1, direcao 3 (source "1_1_1_3.png"; direcao e o ULTIMO campo).
  // Fallback: qualquer frame na direcao 3, depois o primeiro asset.
  const pick =
    assets.find((a) => /(^|\/)1_\d+_\d+_3\.png$/.test(a.source)) ||
    assets.find((a) => /(^|\/)\d+_\d+_\d+_3\.png$/.test(a.source)) ||
    assets[0];
  if (!pick || !pick.frames?.[0]) throw new Error("sem frame frontal");
  const fr = pick.frames[0];
  const page = cat.pages[fr.page ?? 0];
  const imgUrl = resolvePack(page.image);
  const buf = await getBuffer(imgUrl);
  await sharp(buf)
    .extract({ left: fr.x, top: fr.y, width: fr.w, height: fr.h })
    .webp({ lossless: true })
    .toFile(join(OUT_DIR, `${looktype}.webp`));
  return { w: fr.w, h: fr.h };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log("Baixando indice de outfits...");
  const index = await getJson(`${HOST}${PACK_BASE}/outfits-index.json?v=2`);
  const entries = Object.entries(index.outfits)
    .map(([id, o]) => ({ looktype: Number(id), o }))
    .filter(({ o }) => o.kind === "pokemon");
  console.log(`${entries.length} outfits de pokemon a recortar (concorrencia ${CONCURRENCY})...`);

  const baked = [];
  const failed = [];
  let done = 0;
  // pool simples de concorrencia
  let cursor = 0;
  async function worker() {
    while (cursor < entries.length) {
      const { looktype, o } = entries[cursor++];
      try {
        await bakeOne(looktype, o);
        baked.push(looktype);
      } catch (err) {
        failed.push({ looktype, name: o.name, err: err.message });
      }
      if (++done % 40 === 0) console.log(`  ${done}/${entries.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  baked.sort((a, b) => a - b);

  // Mapa pokeId -> looktype (do snapshot), pro app resolver o sprite por pokeId.
  const snap = JSON.parse(await readFile(join(ROOT, "src/data/piwdex.json"), "utf8"));
  const pokeToLook = {};
  for (const c of snap.creatures) if (c.looktype) pokeToLook[c.pokeId] = c.looktype;

  const generatedAt = new Date().toISOString();
  await writeFile(
    join(ROOT, "src/data/game-sprites.json"),
    JSON.stringify({ syncedAt: generatedAt, source: `${HOST}${PACK_BASE}`, baked, pokeToLook }, null, 2) + "\n",
    "utf8",
  );

  console.log(`\nOK: ${baked.length} sprites -> public/game-sprites/ ; mapa -> src/data/game-sprites.json`);
  if (failed.length) {
    console.warn(`${failed.length} falharam:`, failed.slice(0, 12).map((f) => `${f.name}#${f.looktype}(${f.err})`).join(", "));
  }
}

main().catch((err) => {
  console.error("Falha no baker:", err.message);
  process.exit(1);
});
