// Descobre a mensagem ↑ que faz o servidor comecar a mandar `field` (o stream de
// combate). Conecta, espera o snapshot, e envia candidatos de "entrar no campo" um a
// um; se `field` chegar, imprime qual mensagem destravou.
import crypto from "node:crypto";
const TOKEN = process.env.WS_TOKEN;
if (!TOKEN) { console.error("Falta WS_TOKEN"); process.exit(1); }

const CANDS = [
  { type: "field-get" }, { type: "field-join" }, { type: "field-enter" }, { type: "enter-field" },
  { type: "join-field" }, { type: "hunt-join" }, { type: "hunt-enter" }, { type: "enter-hunt" },
  { type: "map-join" }, { type: "field-sub" }, { type: "field-subscribe" }, { type: "subscribe" },
  { type: "enter" }, { type: "join" }, { type: "ready" }, { type: "spawn" }, { type: "play" },
  { type: "field-ready" }, { type: "resume" }, { type: "field-resume" },
];

const cmid = crypto.randomBytes(16).toString("hex");
const ws = new WebSocket(`wss://poke.idleworld.online/ws47?token=${TOKEN}&cmid=${cmid}`, {
  headers: { Origin: "https://poke.idleworld.online", "User-Agent": "Mozilla/5.0" },
});

let i = -1, gotField = false, lastSent = null;
const sendNext = () => {
  i++;
  if (i >= CANDS.length || gotField) { setTimeout(() => { try { ws.close(); } catch {} process.exit(0); }, 500); return; }
  lastSent = CANDS[i];
  ws.send(JSON.stringify(lastSent));
  setTimeout(sendNext, 900); // 900ms pra ver se veio field antes do proximo
};

ws.addEventListener("open", () => { console.log("conectou; testando candidatos de join..."); setTimeout(sendNext, 800); });
ws.addEventListener("message", (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m?.type === "field" && !gotField) {
    gotField = true;
    console.log(`\n>>> DESTRAVOU! A mensagem que iniciou o 'field' foi: ${JSON.stringify(lastSent)}`);
    console.log(`Amostra do field: fighting=${m.fighting} heroHp=${m.heroHp}/${m.heroMaxHp} mobs=${m.mobs?.length}`);
    setTimeout(() => { try { ws.close(); } catch {} process.exit(0); }, 300);
  }
  if (m?.type === "field-kill") console.log(">>> field-kill:", JSON.stringify(m).slice(0, 160));
});
ws.addEventListener("error", (e) => console.log("ERRO:", e.message || e));
setTimeout(() => { console.log("\nNenhum candidato destravou field em ~20s."); try { ws.close(); } catch {} process.exit(0); }, 22000);
