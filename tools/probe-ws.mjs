#!/usr/bin/env node
// Sonda do WebSocket do jogo — o instrumento certo pra capturar o protocolo.
//
// Por que nao HAR: o DevTools so registra a conexao WS se ela nascer com o painel
// JA aberto, o filtro precisa estar em "All", e o export leva junto megabyte de PNG
// em base64. Um cliente Node conectando direto nao tem nenhum desses problemas — ele
// ve todo frame desde o primeiro, e grava so o que interessa.
//
//   export WS_TOKEN='<access JWT do localStorage pokeweb:tokens>'
//   node tools/probe-ws.mjs                    # 60s, so escuta (read-only)
//   node tools/probe-ws.mjs --secs 180         # escuta mais tempo
//   node tools/probe-ws.mjs --hunt ledian      # ENTRA no campo (muta!) e pega o stream
//   node tools/probe-ws.mjs --shard 47         # pula a descoberta
//
// DOIS AVISOS, e os dois sao materiais:
//
//   1. **Conectar E a sessao.** O jogo e single-session: enquanto esta sonda roda, a
//      sua aba do jogo cai com "Conta em uso". Feche o jogo antes.
//   2. **`--hunt` MUTA a conta**: entra no campo, comeca a matar, gasta bola e pode
//      derrubar seu pokemon. Sem a flag, a sonda so escuta e pede getters.
//
// Saida: tools/captura/<data>.json com todo frame recebido, e um resumo por tipo no
// terminal.

import crypto from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const HOST = "poke.idleworld.online";
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const arg = (nome, padrao = null) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : i > -1
      ? true
      : padrao;
};

const TOKEN = process.env.WS_TOKEN;
if (!TOKEN) {
  console.error("Falta WS_TOKEN. Pegue em localStorage['pokeweb:tokens'] no jogo.");
  process.exit(1);
}

const SEGUNDOS = Number(arg("secs", 60));
const HUNT = typeof arg("hunt") === "string" ? arg("hunt") : null;
const SHARD_FIXO = arg("shard") ? Number(arg("shard")) : null;

const abrir = (shard) =>
  new WebSocket(
    `wss://${HOST}/ws${shard}?token=${encodeURIComponent(TOKEN)}&cmid=${crypto.randomBytes(16).toString("hex")}`,
    { headers: { Origin: `https://${HOST}`, "User-Agent": UA } },
  );

/**
 * Descoberta de shard EM LOTES, e nao os 64 de uma vez.
 *
 * O v1 abria 64 sockets simultaneos por conta. Com varias contas subindo juntas isso
 * e uma rajada de centenas de conexoes — o caminho mais curto pra IP banido e pra o
 * jogo fechar o protocolo. Em lotes de 8, a descoberta a frio custa no pior caso 8
 * rodadas de 1,2s (~10s) e no caso tipico bem menos, porque o shard e sorteado
 * uniforme: metade das contas resolve nos dois primeiros lotes.
 *
 * O shard achado tem que ser PERSISTIDO. Esta conta so paga a descoberta uma vez.
 */
async function descobrirShard() {
  const LOTE = 8;
  for (let base = 1; base <= 64; base += LOTE) {
    const faixa = [];
    for (let n = base; n < base + LOTE && n <= 64; n++) faixa.push(n);
    process.stdout.write(`  sondando ws${faixa[0]}..ws${faixa[faixa.length - 1]} `);
    const achado = await Promise.race([
      Promise.any(faixa.map((n) => tentar(n))).catch(() => null),
      new Promise((r) => setTimeout(() => r(null), 4000)),
    ]);
    if (achado) {
      console.log(`-> ACHOU no ws${achado}`);
      return achado;
    }
    console.log("nao");
  }
  return null;
}

const tentar = (n) =>
  new Promise((ok, falha) => {
    let ws;
    try {
      ws = abrir(n);
    } catch {
      falha();
      return;
    }
    const t = setTimeout(() => {
      try { ws.close(); } catch {}
      falha();
    }, 3500);
    ws.addEventListener("message", (ev) => {
      try {
        const j = JSON.parse(String(ev.data));
        if (j?.type === "pokes") {
          clearTimeout(t);
          try { ws.close(); } catch {}
          ok(n);
        }
      } catch {}
    });
    ws.addEventListener("close", () => { clearTimeout(t); falha(); });
    ws.addEventListener("error", () => { clearTimeout(t); falha(); });
  });

// ---------------------------------------------------------------- captura

const frames = [];
const porTipo = new Map();

function anotar(bruto) {
  let j;
  try { j = JSON.parse(bruto); } catch { j = { type: "<nao-json>", bruto: String(bruto).slice(0, 400) }; }
  const tipo = j?.type ?? "<sem-type>";
  porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + 1);
  frames.push({ em: new Date().toISOString(), tipo, frame: j });
}

const GETTERS = [
  "pokes-get", "inv-get", "balls-get", "autohelper-get",
  "trade-get", "family-get", "pending-get", "analyzer-get",
];

async function main() {
  const shard = SHARD_FIXO ?? (console.log("Descobrindo shard (em lotes de 8):"), await descobrirShard());
  if (!shard) { console.error("Nenhum shard aceitou o token. Ele expirou?"); process.exit(1); }

  console.log(`\nConectando no ws${shard}. Escutando ${SEGUNDOS}s.`);
  if (HUNT) console.log(`ATENCAO: vai entrar no campo "${HUNT}" — isso MUTA a conta.`);
  console.log("A sua aba do jogo vai cair (\"Conta em uso\"): o jogo e single-session.\n");

  const ws = abrir(shard);
  ws.addEventListener("message", (ev) => anotar(String(ev.data)));
  ws.addEventListener("error", (e) => console.error("erro no socket:", e?.message ?? e));

  await new Promise((r) => ws.addEventListener("open", r, { once: true }));

  // Getters espacados: rajada de 8 frames no mesmo tick e ruido gratuito no servidor,
  // e algumas respostas chegam fora de ordem e ficam dificeis de ler no arquivo.
  for (const g of GETTERS) {
    ws.send(JSON.stringify({ type: g }));
    await new Promise((r) => setTimeout(r, 400));
  }
  if (HUNT) ws.send(JSON.stringify({ type: "enter-hunt", slug: HUNT }));

  await new Promise((r) => setTimeout(r, SEGUNDOS * 1000));
  if (HUNT) ws.send(JSON.stringify({ type: "leave-hunt" })); // sai do campo antes de largar
  await new Promise((r) => setTimeout(r, 500));
  try { ws.close(); } catch {}

  const dir = join(process.cwd(), "tools", "captura");
  mkdirSync(dir, { recursive: true });
  const arquivo = join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(arquivo, JSON.stringify({ shard, hunt: HUNT, segundos: SEGUNDOS, frames }, null, 2));

  console.log("\n--- frames por tipo ---");
  for (const [t, n] of [...porTipo.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${t}`);
  }
  console.log(`\n${frames.length} frames -> ${arquivo}`);
  const novos = [...porTipo.keys()].filter((t) => !CONHECIDOS.has(t));
  if (novos.length) console.log(`\nTIPOS QUE O ws-protocol.md NAO DOCUMENTA: ${novos.join(", ")}`);
}

// O que o v1 ja documentou — o que sobrar disso e descoberta nova.
const CONHECIDOS = new Set([
  "pokes", "inventory", "balls", "autohelper", "boosts", "mail-badge", "events",
  "history", "family", "pending", "trade", "field", "field-init", "field-kill",
  "poke-xp", "catch-result", "shiny-global", "chat", "analyzer", "joy-healed",
  "poke-summon",
]);

main().catch((e) => { console.error(e); process.exit(1); });
