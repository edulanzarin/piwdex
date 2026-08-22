// Captura o combate da hunt AO VIVO: conecta no WS e escuta ~45s (passivo, sem mandar
// nada que escreva). Loga TODO frame novo/desconhecido inteiro (o evento de kill/loot/
// captura/XP) e conta o ruido conhecido. Tambem reporta estabilidade da conexao
// (coexiste com o navegador ou e chutado?).
//   export WS_TOKEN='<access JWT>' ; node scripts/hunt-capture.mjs
import crypto from "node:crypto";

const TOKEN = process.env.WS_TOKEN;
if (!TOKEN) { console.error("Falta WS_TOKEN"); process.exit(1); }

// tipos que ja conhecemos (so conta, nao despeja)
const NOISE = new Set(["chat", "history", "events", "boosts", "boosts-refresh", "badge-refresh", "inventory", "mail-badge", "balls", "autohelper", "trade", "pokes", "trade-get", "pokes-get"]);
const counts = new Map();
const dumped = new Set(); // despeja cada tipo novo so 1x cheio, depois so conta

const cmid = crypto.randomBytes(16).toString("hex");
const openedAt = Date.now();
const ws = new WebSocket(`wss://poke.idleworld.online/ws47?token=${TOKEN}&cmid=${cmid}`, {
  headers: { Origin: "https://poke.idleworld.online", "User-Agent": "Mozilla/5.0" },
});

ws.addEventListener("open", () => console.log(`[${new Date().toISOString()}] CONECTOU. Escutando combate por 45s...\n`));

ws.addEventListener("message", (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  const t = m?.type ?? "?";
  counts.set(t, (counts.get(t) ?? 0) + 1);
  if (NOISE.has(t)) return;
  // tipo interessante (candidato a combate/hunt): despeja inteiro na 1a vez
  if (!dumped.has(t)) {
    dumped.add(t);
    console.log(`>>> [${t}] (1a vez, frame inteiro):`);
    console.log(JSON.stringify(m).slice(0, 800));
    console.log("");
  } else {
    console.log(`    [${t}] repetiu:`, JSON.stringify(m).slice(0, 200));
  }
});

ws.addEventListener("error", (e) => console.log("ERRO WS:", e.message || String(e)));
ws.addEventListener("close", (e) => {
  const secs = ((Date.now() - openedAt) / 1000).toFixed(1);
  console.log(`\n[CLOSE] code=${e.code} depois de ${secs}s (se fechou cedo com code proprio, pode ser 'chutado' pela sessao do navegador).`);
});

setTimeout(() => {
  console.log("\n=== tipos vistos em 45s ===");
  console.log(JSON.stringify(Object.fromEntries([...counts].sort((a, b) => b[1] - a[1]))));
  try { ws.close(); } catch {}
  setTimeout(() => process.exit(0), 300);
}, 45000);
