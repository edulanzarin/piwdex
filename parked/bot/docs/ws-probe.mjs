// De-risca a integracao WS: o piwdex consegue conectar no ws<shard> do jogo do lado
// do SERVIDOR (fora do navegador, atras do Cloudflare) e puxar a lista de pokemon?
// Read-only: conecta, manda {"type":"pokes-get"} e escuta ~12s. Loga o shape do 1o
// poke (pra destravar o Vender pokemon) e qualquer evento de combate (Hunt Analyzer).
//
//   export WS_TOKEN='<access JWT do ws URL>'
//   node scripts/ws-probe.mjs
import crypto from "node:crypto";

const TOKEN = process.env.WS_TOKEN;
if (!TOKEN) { console.error("Falta WS_TOKEN"); process.exit(1); }
const cmid = crypto.randomBytes(16).toString("hex");
const url = `wss://poke.idleworld.online/ws47?token=${TOKEN}&cmid=${cmid}`;

const seen = new Map(); // type -> contagem
let gotPokes = false;

const ws = new WebSocket(url, {
  headers: {
    Origin: "https://poke.idleworld.online",
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  },
});

ws.addEventListener("open", () => {
  console.log("CONECTOU (Cloudflare deixou). Pedindo pokes-get...");
  ws.send(JSON.stringify({ type: "pokes-get" }));
});

ws.addEventListener("message", (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  const t = m?.type ?? "?";
  seen.set(t, (seen.get(t) ?? 0) + 1);

  if (t === "pokes" && Array.isArray(m.list) && !gotPokes) {
    gotPokes = true;
    console.log(`\n>>> pokes: ${m.list.length} pokemon. Shape do 1o item:`);
    console.log(JSON.stringify(m.list[0], null, 2));
    console.log("Chaves:", Object.keys(m.list[0]).join(", "));
    // amostra de quality/iv/shiny pra confirmar escalas
    const s = m.list.slice(0, 8).map((p) => ({ name: p.name, iv: p.ivTotal ?? p.iv, q: p.quality ?? p.q, sh: p.shiny ?? p.sh }));
    console.log("Amostra:", JSON.stringify(s));
  }
  // eventos de combate/hunt (Hunt Analyzer) — loga o que nao for ruido conhecido
  if (["combat", "kill", "hunt", "loot", "capture", "catch", "battle", "exp"].includes(t)) {
    console.log(`\n>>> COMBATE [${t}]:`, JSON.stringify(m).slice(0, 300));
  }
});

ws.addEventListener("error", (e) => console.log("ERRO WS:", e.message || String(e)));
ws.addEventListener("close", (e) => console.log(`\nFECHOU (code=${e.code}). Tipos vistos:`, JSON.stringify(Object.fromEntries(seen))));

setTimeout(() => { try { ws.close(); } catch {} setTimeout(() => process.exit(0), 300); }, 12000);
