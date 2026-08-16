import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { gameFetch, type Tokens } from "@/lib/game-auth";
import { getGameLink, updateGameTokens, markGameLinkExpired } from "@/lib/game-link";
import { getData } from "@/lib/data";
import { normalizeMarketMons, type MarketMon } from "@/lib/game-account";

export const runtime = "nodejs";

// O mercado e global e pesa ~6MB; cacheia os anuncios de pokemon por 60s pra nao rebaixar
// a cada busca. Qualquer token valido puxa o mesmo mercado.
let cache: { at: number; mons: MarketMon[] } | null = null;
const TTL = 60_000;

async function loadMarket(tokens: Tokens): Promise<{ mons?: MarketMon[]; status: number; tokens: Tokens; changed: boolean }> {
  if (cache && Date.now() - cache.at < TTL) return { mons: cache.mons, status: 200, tokens, changed: false };
  const r = await gameFetch("/api/game/market", tokens);
  if (!r.res.ok) return { status: r.res.status, tokens: r.tokens, changed: r.changed };
  const raw = await r.res.json().catch(() => null);
  const { creatures } = await getData();
  const mons = normalizeMarketMons(raw, creatures);
  cache = { at: Date.now(), mons };
  return { mons, status: 200, tokens: r.tokens, changed: r.changed };
}

// Consultor de mercado: "melhor <especie> ate X ouro / Y diamantes". Filtra os anuncios de
// pokemon por especie e orcamento (por moeda) e ordena (por Power, preco ou custo-beneficio).
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ connected: false, error: "not_logged" }, { status: 401 });
  if (!session.user.vip) return NextResponse.json({ error: "vip_only" }, { status: 403 }); // mercado e VIP
  const link = await getGameLink(session.user.id);
  if (!link || link.status === "expired") return NextResponse.json({ connected: false, reason: "expired" }, { status: 401 });
  const tokens = link.tokens;

  const q = new URL(req.url).searchParams;
  const sp = q.get("sp") ? Number(q.get("sp")) : null; // speciesId
  const maxGold = q.get("maxGold") ? Number(q.get("maxGold")) : null;
  const maxDiamonds = q.get("maxDiamonds") ? Number(q.get("maxDiamonds")) : null;
  const shinyOnly = q.get("shiny") === "1";
  const sort = q.get("sort") ?? "power"; // power | price | value

  let loaded;
  try {
    loaded = await loadMarket(tokens);
  } catch {
    return NextResponse.json({ connected: true, error: "game_unreachable" }, { status: 502 });
  }
  if (loaded.status === 401) {
    await markGameLinkExpired(session.user.id);
    return NextResponse.json({ connected: false, reason: "expired" }, { status: 401 });
  }
  if (!loaded.mons) return NextResponse.json({ connected: true, error: "game_unreachable" }, { status: 502 });

  let mons = loaded.mons;
  if (sp != null) mons = mons.filter((m) => m.speciesId === sp);
  if (shinyOnly) mons = mons.filter((m) => m.shiny);
  const budgeted = maxGold != null || maxDiamonds != null;
  if (budgeted) {
    mons = mons.filter((m) =>
      m.currency === "GOLD" ? maxGold != null && m.price <= maxGold : maxDiamonds != null && m.price <= maxDiamonds,
    );
  }
  const rank = (m: MarketMon) =>
    sort === "price" ? -m.price : sort === "value" ? (m.power ?? 0) / Math.max(1, m.price) : m.power ?? 0;
  mons = [...mons].sort((a, b) => rank(b) - rank(a) || a.price - b.price).slice(0, 60);

  if (loaded.changed) await updateGameTokens(session.user.id, loaded.tokens);
  return NextResponse.json({ connected: true, mons, total: loaded.mons.length });
}
