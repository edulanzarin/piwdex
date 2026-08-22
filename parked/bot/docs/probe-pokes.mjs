// Descoberta: existe endpoint REST que LISTA os pokemon individuais (box) com
// IV/quality/shiny? O sell e por pokeId individual, mas a conta so expoe agregado
// por tier. Sonda candidatos GET e reporta status + amostra das chaves. Read-only.
//
//   export PIW_ACCESS='<pokeweb:tokens ou access>'
//   node scripts/probe-pokes.mjs

const GAME = process.env.GAME_HOST || "https://poke.idleworld.online";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function readAccess() {
  const raw = (process.env.PIW_ACCESS || "").trim();
  if (!raw) return null;
  try { const o = JSON.parse(raw); return o.access || o.accessToken || o.token || null; }
  catch { const m = raw.match(/[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/); return m ? m[0] : raw; }
}
const ACCESS = readAccess();
if (!ACCESS) { console.error("Falta PIW_ACCESS"); process.exit(1); }
const auth = { Authorization: `Bearer ${ACCESS}`, "User-Agent": UA, Accept: "application/json" };

// candidatos plausiveis pra "listar meus pokemon individuais"
const PATHS = [
  "/api/game/pokemons", "/api/game/pokemon", "/api/game/pokemon/list",
  "/api/game/my-pokemons", "/api/game/my-pokes", "/api/game/pokes",
  "/api/game/box", "/api/game/boxes", "/api/game/storage", "/api/game/depot/pokemons",
  "/api/game/team", "/api/game/party", "/api/game/roster",
  "/api/game/pokemon/sellable", "/api/game/pokemon/all",
];

// resume a forma do JSON: chaves de topo, e se achar um array de "pokes", as chaves do 1o item
function shape(j) {
  if (j == null) return "(sem json)";
  if (Array.isArray(j)) {
    const first = j[0] && typeof j[0] === "object" ? Object.keys(j[0]).join(",") : typeof j[0];
    return `array[${j.length}] item0={${first}}`;
  }
  if (typeof j === "object") {
    const keys = Object.keys(j);
    // procura o 1o valor que seja array de objetos (a lista de pokes)
    for (const k of keys) {
      const v = j[k];
      if (Array.isArray(v) && v[0] && typeof v[0] === "object") {
        return `{${keys.join(",")}}  ${k}[${v.length}].item0={${Object.keys(v[0]).join(",")}}`;
      }
    }
    return `{${keys.join(",")}}`;
  }
  return typeof j;
}

async function main() {
  console.log(`GAME: ${GAME}\nSondando ${PATHS.length} endpoints...\n`);
  for (const p of PATHS) {
    try {
      const res = await fetch(`${GAME}${p}`, { headers: auth, cache: "no-store" });
      const body = await res.text();
      let j = null; try { j = JSON.parse(body); } catch {}
      const mark = res.ok ? "OK " : "   ";
      console.log(`${mark}[${res.status}] ${p}`);
      if (res.ok) console.log(`        -> ${shape(j)}`);
    } catch (e) {
      console.log(`   [ERR] ${p}  ${e.message}`);
    }
  }
  console.log("\nProcure um 200 cujo shape tenha id/ivTotal/quality/shiny/speciesId por item.");
}
main().catch((e) => { console.error(e); process.exit(1); });
