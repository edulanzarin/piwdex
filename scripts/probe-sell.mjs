// Probe: a trava de "esse item nao pode ser vendido" e client-side ou server-side?
// Replica EXATAMENTE o request que o robo ja faz (POST /api/game/shop/sell), so que
// apontando pra um item travado (cadeado). Mostra o status e o corpo cru da resposta.
//
//   200 + gold subiu  -> trava era client-side, da pra "injetar"
//   400/403/422 ...   -> trava e server-side, morreu aqui (esperado)
//
// Usa o SEU proprio access token, no SEU personagem. Nao burla nada por si so:
// so pergunta ao servidor "e se eu tentar?" e reporta a verdade.
//
// Uso:
//   1) No jogo logado, DevTools > Application > Local Storage > copie `pokeweb:tokens`
//      (ou so o access JWT).
//   2) export PIW_ACCESS='<o access token>'
//   3a) node scripts/probe-sell.mjs            -> lista locks + inventario (so leitura)
//   3b) node scripts/probe-sell.mjs <itemId>   -> TENTA vender qty 1 daquele id

const GAME = process.env.GAME_HOST || "https://poke.idleworld.online";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// aceita tanto o JSON do pokeweb:tokens quanto um JWT solo
function readAccess() {
  const raw = (process.env.PIW_ACCESS || "").trim();
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    return o.access || o.accessToken || o.token || null;
  } catch {
    const m = raw.match(/[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/);
    return m ? m[0] : raw;
  }
}

const ACCESS = readAccess();
if (!ACCESS) {
  console.error("Falta o token. Faca: export PIW_ACCESS='<access ou pokeweb:tokens>'");
  process.exit(1);
}

const authGet = { Authorization: `Bearer ${ACCESS}`, "User-Agent": UA, Accept: "application/json" };
const authPost = { ...authGet, "Content-Type": "application/json", Origin: GAME, Referer: `${GAME}/play` };

async function jget(path) {
  const res = await fetch(`${GAME}${path}`, { headers: authGet, cache: "no-store" });
  const body = await res.text();
  let json = null;
  try { json = JSON.parse(body); } catch {}
  return { status: res.status, ok: res.ok, json, body };
}

async function main() {
  const arg = process.argv[2];

  // Sempre mostra o estado de leitura primeiro (locks + inventario).
  const lock = await jget("/api/game/item/lock");
  const depot = await jget("/api/game/depot");

  const locked = Array.isArray(lock.json?.locked) ? lock.json.locked : [];
  const inv = Array.isArray(depot.json?.inventory) ? depot.json.inventory : [];
  const nameOf = (id) => inv.find((i) => i.id === id)?.name || "?";

  console.log(`\nGAME: ${GAME}`);
  console.log(`lock  [${lock.status}] locked ids: ${JSON.stringify(locked)}`);
  console.log(`depot [${depot.status}] itens na mochila: ${inv.length}`);
  if (locked.length) {
    console.log("\nTravados (cadeado):");
    for (const id of locked) console.log(`  ${id}  ${nameOf(id)}`);
  }

  if (!arg) {
    console.log("\n(so leitura) Pra TESTAR a venda de um travado, rode de novo com o id:");
    console.log(`   node scripts/probe-sell.mjs ${locked[0] ?? "<itemId>"}`);
    return;
  }

  const itemId = Number(arg);
  if (!Number.isFinite(itemId)) {
    console.error(`itemId invalido: ${arg}`);
    process.exit(1);
  }

  const travado = locked.includes(itemId);
  console.log(`\n>>> TENTANDO vender itemId=${itemId} (${nameOf(itemId)}) qty=1 ${travado ? "[TRAVADO]" : "[nao travado]"}`);

  const res = await fetch(`${GAME}/api/game/shop/sell`, {
    method: "POST",
    headers: authPost,
    body: JSON.stringify({ items: [{ itemId, qty: 1 }] }),
    cache: "no-store",
  });
  const body = await res.text();

  console.log(`\nHTTP ${res.status} ${res.statusText}`);
  console.log("resposta:", body || "(vazia)");
  console.log(
    res.ok
      ? "\n=> 200: a trava era CLIENT-SIDE. Da pra vender por request. (confira se o gold subiu)"
      : "\n=> nao-200: trava SERVER-SIDE, o servidor recusou. Injection nao passa aqui.",
  );
}

main().catch((e) => { console.error(e); process.exit(1); });
