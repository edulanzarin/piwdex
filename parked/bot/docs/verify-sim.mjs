// Verifica a simulacao de venda de pokemon END-TO-END contra a conta real: conecta no
// WS, puxa a lista, cruza raridade do piwdex.json e aplica as travas default, mostrando
// exatamente o que a UI venderia (e o que ela PROTEGE). Read-only.
//   export WS_TOKEN='<access JWT>' ; node scripts/verify-sim.mjs
import crypto from "node:crypto";
import { readFileSync } from "node:fs";

const TOKEN = process.env.WS_TOKEN;
if (!TOKEN) { console.error("Falta WS_TOKEN"); process.exit(1); }

const dex = JSON.parse(readFileSync(new URL("../src/data/piwdex.json", import.meta.url)));
const arr = Array.isArray(dex) ? dex : (dex.creatures || Object.values(dex).find(Array.isArray));
const rarityOf = new Map(arr.map((c) => [c.pokeId, c.rarity]));

// config default do piw:poke-sell-config:v2
const CFG = { sellRarities: ["COMMON", "UNCOMMON"], keepShiny: true, maxIv: 100, maxQuality: 1.8 };

const cmid = crypto.randomBytes(16).toString("hex");
const ws = new WebSocket(`wss://poke.idleworld.online/ws47?token=${TOKEN}&cmid=${cmid}`, {
  headers: { Origin: "https://poke.idleworld.online", "User-Agent": "Mozilla/5.0" },
});
ws.addEventListener("open", () => ws.send(JSON.stringify({ type: "pokes-get" })));
ws.addEventListener("message", (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m?.type !== "pokes" || !Array.isArray(m.list)) return;

  const all = m.list;
  const protectedTeam = all.filter((p) => p.team || p.leader || p.starter);
  const matches = all
    .filter((p) => !p.team && !p.leader && !p.starter)
    .filter((p) => !(CFG.keepShiny && p.shiny))
    .map((p) => ({ ...p, rarity: rarityOf.get(p.speciesId) ?? "COMMON" }))
    .filter((p) => CFG.sellRarities.includes(p.rarity))
    .filter((p) => p.ivTotal <= CFG.maxIv && p.quality <= CFG.maxQuality)
    .sort((a, b) => a.quality - b.quality);
  const gold = matches.reduce((s, p) => s + (p.sellValue || 0), 0);

  console.log(`Total na conta: ${all.length}`);
  console.log(`Protegidos (time/lider/starter): ${protectedTeam.length} -> ${protectedTeam.map((p) => p.name + (p.leader ? "(L)" : "")).join(", ")}`);
  console.log(`\nVENDERIA ${matches.length} por ~${gold.toLocaleString("pt-BR")} ouro (travas: raridade ${CFG.sellRarities}, IV<=${CFG.maxIv}, Q<=${CFG.maxQuality}, shiny protegido):`);
  for (const p of matches.slice(0, 15)) console.log(`  ${p.name} Lv${p.level}  ${p.rarity}  IV ${p.ivTotal}  Q ${p.quality.toFixed(2)}  ${(p.sellValue||0).toLocaleString("pt-BR")} ouro${p.shiny ? "  SHINY!" : ""}`);
  if (matches.length > 15) console.log(`  ... +${matches.length - 15}`);

  // sanidade: algum shiny/raro escapou?
  const leak = matches.filter((p) => p.shiny || !CFG.sellRarities.includes(p.rarity) || p.ivTotal > CFG.maxIv || p.quality > CFG.maxQuality);
  console.log(`\nVazamentos (deveria ser 0): ${leak.length}`);
  ws.close();
});
ws.addEventListener("error", (e) => { console.log("ERRO:", e.message || e); process.exit(1); });
setTimeout(() => process.exit(0), 12000);
