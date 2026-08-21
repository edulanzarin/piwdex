import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink, updateGameTokens, markGameLinkExpired } from "@/lib/game-link";
import { monCeiling, fairPriceMeta } from "@/lib/market-value";
import { loadMarket, marketPriceModel } from "@/lib/market-cache";

export const runtime = "nodejs";

// Quanto VALERIA um bicho sem preco (ex.: pokemon linkado no chat): o mesmo motor de
// preco justo do consultor — teto do bicho x mediana de preco-por-teto POR FAIXA de
// Quality (elite se compara com elite; regua unica esmagava Q2.1+, que so sai de
// breeding e vale desproporcionalmente mais). Recebe especie + IV + Quality + shiny.
// Sanidade: se ha anuncio da MESMA especie igual-ou-melhor mais barato que a
// estimativa, ela desce pra ele — o mercado prova que ninguem pagaria mais.

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "not_logged" }, { status: 401 });
  if (!session.user.vip) return NextResponse.json({ error: "vip_only" }, { status: 403 });
  const link = await getGameLink(session.user.id);
  if (!link || link.status === "expired") return NextResponse.json({ connected: false, reason: "expired" }, { status: 401 });

  const q = new URL(req.url).searchParams;
  const sp = Number(q.get("sp"));
  if (!Number.isInteger(sp) || sp <= 0) return NextResponse.json({ error: "bad_species" }, { status: 400 });
  const ivRaw = Number(q.get("iv"));
  const ivTotal = Number.isFinite(ivRaw) ? Math.min(192, Math.max(0, ivRaw)) : null;
  const qualRaw = Number(q.get("q"));
  const quality = Number.isFinite(qualRaw) && qualRaw > 0 ? qualRaw : null;
  const shiny = q.get("shiny") === "1";

  let loaded;
  try {
    loaded = await loadMarket(link.tokens);
  } catch {
    return NextResponse.json({ error: "game_unreachable" }, { status: 502 });
  }
  if (loaded.status === 401) {
    await markGameLinkExpired(session.user.id);
    return NextResponse.json({ connected: false, reason: "expired" }, { status: 401 });
  }
  if (!loaded.mons) return NextResponse.json({ error: "game_unreachable" }, { status: 502 });
  if (loaded.changed) await updateGameTokens(session.user.id, loaded.tokens);

  const { model, basesById } = await marketPriceModel(loaded.mons);
  const ceil = monCeiling(basesById.get(sp), ivTotal, quality);
  const item = { speciesId: sp, price: 0, ceil, quality, shiny };
  const gold = fairPriceMeta({ ...item, currency: "GOLD" }, model);
  const diamonds = fairPriceMeta({ ...item, currency: "DIAMONDS" }, model);

  // teto de sanidade: o anuncio ativo mais barato da mesma especie/shiny que seja
  // igual-ou-melhor em Quality E IV. Se for menor que a estimativa, ela vale ele.
  let better: number | null = null;
  if (quality != null && ivTotal != null) {
    for (const m of loaded.mons) {
      if (m.speciesId !== sp || m.shiny !== shiny || m.currency !== "GOLD" || m.price <= 0) continue;
      if (m.quality == null || m.ivTotal == null || m.quality < quality || m.ivTotal < ivTotal) continue;
      if (better == null || m.price < better) better = m.price;
    }
  }
  const goldFinal = gold ? (better != null && better < gold.price ? better : gold.price) : null;

  return NextResponse.json({
    gold: goldFinal,
    diamonds: diamonds?.price ?? null,
    samples: gold?.n ?? 0,
    tier: gold?.tier ?? null, // species-band | band | global — quao forte e a regua
    capped: better != null && gold != null && better < gold.price, // desceu pro anuncio real
  });
}
