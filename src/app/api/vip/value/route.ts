import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink, updateGameTokens, markGameLinkExpired } from "@/lib/game-link";
import { monCeiling, fairPriceOf, MIN_SPECIES_SAMPLE } from "@/lib/market-value";
import { loadMarket, marketPriceModel } from "@/lib/market-cache";

export const runtime = "nodejs";

// Quanto VALERIA um bicho sem preco (ex.: pokemon linkado no chat): o mesmo motor de
// preco justo do consultor (teto do bicho x mediana de preco-por-teto do mercado
// inteiro), so que sem anuncio — recebe especie + IV + Quality e devolve a estimativa
// em ouro (e diamantes, quando o mercado da regua). E leitura pura do mercado cacheado.

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
  const item = { speciesId: sp, price: 0, ceil };
  const gold = fairPriceOf({ ...item, currency: "GOLD" }, model);
  const diamonds = fairPriceOf({ ...item, currency: "DIAMONDS" }, model);
  // quantos anuncios da especie sustentam a taxa (abaixo de MIN_SPECIES_SAMPLE e a global)
  const samples = model.speciesCount.get(`${sp}:GOLD`) ?? 0;
  return NextResponse.json({ gold, diamonds, samples, speciesRate: samples >= MIN_SPECIES_SAMPLE });
}
