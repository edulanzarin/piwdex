import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink, updateGameTokens, markGameLinkExpired } from "@/lib/game-link";
import { getData } from "@/lib/data";
import { type MarketMon } from "@/lib/game-account";
import { potentialScore, fairPriceOf } from "@/lib/market-value";
import { loadMarket, marketPriceModel } from "@/lib/market-cache";

export const runtime = "nodejs";

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
  const typeSel = q.get("type") ?? ""; // tipo (lutador, agua...) — casa type1 OU type2 da especie
  const minQ = q.get("minQ") ? Number(q.get("minQ")) : null; // Quality minima
  const minIv = q.get("minIv") ? Number(q.get("minIv")) : null; // IV total minimo
  const sort = q.get("sort") ?? "potential"; // potential | quality | iv | power | value | price

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

  // ---- MERCADO DE ITENS (kind=items): pilhas de item/bola/diamante, preco unitario ----
  if (q.get("kind") === "items") {
    const data = await getData();
    const search = (q.get("q") ?? "").trim().toLowerCase();
    const cat = q.get("cat") ?? "";
    const curr = q.get("currency") ?? "";
    const iSort = q.get("sort") ?? "price";
    let items = loaded.items ?? [];
    if (search) items = items.filter((i) => i.name.toLowerCase().includes(search));
    if (cat) items = items.filter((i) => i.category === cat);
    if (curr) items = items.filter((i) => i.currency === curr);
    if (q.get("belowNpc") === "1") items = items.filter((i) => i.belowNpc);
    const iRank = (a: typeof items[number], b: typeof items[number]) => {
      switch (iSort) {
        case "recent": return Date.parse(b.at) - Date.parse(a.at);
        case "qty": return b.quantity - a.quantity;
        default: {
          // "mais barato": moedas NAO se comparam (1 diamante nao e mais barato que 100
          // de ouro) — agrupa ouro primeiro, cada grupo do menor pro maior preco unitario
          if (a.currency !== b.currency) return a.currency === "GOLD" ? -1 : 1;
          return a.price - b.price;
        }
      }
    };
    items = [...items].sort(iRank).slice(0, 150).map((i) => ({
      ...i,
      npcPrice: i.refId > 0 ? (data.getItem(i.refId)?.npcPrice ?? null) : null,
      icon: i.refId > 0 ? (data.getItem(i.refId)?.icon ?? i.icon) : i.icon,
    }));
    if (loaded.changed) await updateGameTokens(session.user.id, loaded.tokens);
    return NextResponse.json({ connected: true, items, total: (loaded.items ?? []).length });
  }

  // Motor de preco justo: teto de Power por bicho (independe do nivel) + regua do mercado
  // INTEIRO (todas as especies), pra "ta caro?" nao depender do punhado filtrado.
  const { creatures } = await getData();
  const { model: priceModel, ceilOf } = await marketPriceModel(loaded.mons);

  let mons = loaded.mons;
  if (sp != null) mons = mons.filter((m) => m.speciesId === sp);
  if (typeSel) {
    const typesById = new Map<number, [string, string | null]>();
    for (const c of creatures) typesById.set(c.pokeId, [c.type1, c.type2]);
    mons = mons.filter((m) => {
      const ts = typesById.get(m.speciesId);
      return !!ts && (ts[0] === typeSel || ts[1] === typeSel);
    });
  }
  if (shinyOnly) mons = mons.filter((m) => m.shiny);
  const budgeted = maxGold != null || maxDiamonds != null;
  if (budgeted) {
    mons = mons.filter((m) =>
      m.currency === "GOLD" ? maxGold != null && m.price <= maxGold : maxDiamonds != null && m.price <= maxDiamonds,
    );
  }
  if (minQ != null) mons = mons.filter((m) => m.quality != null && m.quality >= minQ);
  if (minIv != null) mons = mons.filter((m) => m.ivTotal != null && m.ivTotal >= minIv);

  // Ordenacao: potencial (Q+IV, o padrao) evita o vies do Power, que so reflete o quanto
  // ja upou — um lixo upado tem Power maior que um perfeito de nivel baixo.
  const rank = (m: MarketMon): number => {
    switch (sort) {
      case "price": return -m.price;
      case "value": return (m.power ?? 0) / Math.max(1, m.price);
      case "quality": return m.quality ?? 0;
      case "iv": return m.ivTotal ?? 0;
      case "power": return m.power ?? 0;
      default: return potentialScore(m); // potential
    }
  };
  mons = [...mons].sort((a, b) => rank(b) - rank(a) || a.price - b.price).slice(0, 120);
  // Anexa o preco justo estimado (motor acima) em cada anuncio retornado.
  mons = mons.map((m) => ({
    ...m,
    fairPrice: fairPriceOf(
      { speciesId: m.speciesId, currency: m.currency, price: m.price, ceil: ceilOf(m), quality: m.quality, shiny: m.shiny },
      priceModel,
    ),
  }));

  if (loaded.changed) await updateGameTokens(session.user.id, loaded.tokens);
  return NextResponse.json({ connected: true, mons, total: loaded.mons.length });
}
