import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink, saveGameShard } from "@/lib/game-link";
import { fetchActivePokes } from "@/lib/game-ws";
import { normalizeActivePokes, type ActivePoke } from "@/lib/game-account";
import { sessionFor } from "@/lib/game-hunt-session";
import { fetchGameBoosts, lootBonusesOf } from "@/lib/game-boosts";
import { lootMultiplier } from "@/lib/boost";
import { rankMoney } from "@/lib/hunt-brain";
import { ALL_TYPES } from "@/lib/typing";
import type { PokeType } from "@/lib/types";

export const runtime = "nodejs";

// "Com os pokemons que eu TENHO, o que paga mais por hora HOJE?"
//
// Junta tres coisas que ja existiam separadas: o tipo premiado do dia (lido do jogo em
// /api/game/boosts), o motor de combate (quanto voce mata por hora em cada spot, ja
// descontando desmaio) e o motor de loot com TETO de chance (quanto cada abate paga com
// os bonus ligados). Ver lib/game-boosts.ts, lib/combat.ts e lib/boost.ts.
//
// O roster e o time MAIS o box: "os pokemons que eu tenho" nao para na equipe ativa. Os
// individuais so existem no frame `pokes` do WebSocket, entao com sessao viva a lista sai
// da memoria e sem sessao sai de uma leitura one-shot (mesmo desenho do /api/vip/team).
//
// `?type=` simula outro dia (ou `none` pra ver a lista sem o bonus); `?refresh=1` fura o
// cache de 60s dos bonus.

const isType = (v: string): v is PokeType => (ALL_TYPES as string[]).includes(v);

export async function GET(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return NextResponse.json({ error: "not_logged" }, { status: 401 });
  if (!s.user.vip) return NextResponse.json({ error: "vip_only" }, { status: 403 });
  const userId = s.user.id;

  const link = await getGameLink(userId);
  if (!link || link.status === "expired") return NextResponse.json({ error: "not_connected" }, { status: 409 });

  const url = new URL(req.url);
  const rawType = (url.searchParams.get("type") ?? "").toUpperCase();
  const refresh = url.searchParams.get("refresh") === "1";
  // undefined = usa o tipo real do dia; null = simula um dia sem bonus; tipo = simula ele
  const override: PokeType | null | undefined =
    rawType === "" ? undefined : rawType === "NONE" ? null : isType(rawType) ? rawType : undefined;

  // --- roster: time + box -----------------------------------------------------------
  const session = sessionFor(userId);
  const liveBox = session.getLiveBox();
  let pokes: ActivePoke[] = [];
  let live = false;
  if (liveBox) {
    const st = session.getState();
    pokes = [...(st.team ?? []), ...liveBox];
    live = true;
  } else {
    const r = await fetchActivePokes(link.tokens, link.shard).catch(() => null);
    if (!r) return NextResponse.json({ error: "read_failed" }, { status: 502 });
    if (r.shard !== link.shard) await saveGameShard(userId, r.shard).catch(() => {});
    pokes = normalizeActivePokes(r.pokes);
  }
  if (!pokes.length) return NextResponse.json({ error: "no_pokes" }, { status: 409 });

  // --- bonus de hoje ----------------------------------------------------------------
  const boosts = await fetchGameBoosts(userId, refresh);
  const bonuses = lootBonusesOf(boosts, override);
  const dayType = bonuses.typeDay;
  const dayXpPct = dayType ? boosts?.typeDay?.xpPct ?? boosts?.typeDay?.lootPct ?? 0 : 0;

  // VIP do JOGO (1,5x XP): so escala a coluna de XP — o ranking e por ouro, que o VIP
  // nao toca. Assume ligado, como o /api/vip/best-poke, pra nao pagar mais uma ida ao jogo.
  const rows = await rankMoney(pokes, bonuses, true, { limit: 12, dayXpPct });

  // multiplicador de FUNDO (o que vale em qualquer alvo) x o dele com o bonus do dia
  const background = lootMultiplier(bonuses);
  const withDay = dayType ? lootMultiplier(bonuses, [dayType]) : background;

  return NextResponse.json({
    live,
    pokes: pokes.length,
    typeDay: boosts?.typeDay
      ? {
          type: boosts.typeDay.type,
          label: boosts.typeDay.label,
          lootPct: boosts.typeDay.lootPct,
          xpPct: boosts.typeDay.xpPct,
          until: boosts.typeDay.until,
        }
      : null,
    // o tipo que a lista USOU (pode ser simulacao) e de onde ele veio
    applied: dayType,
    source: override === undefined ? "game" : override === null ? "off" : "manual",
    mult: {
      streak: boosts?.streakLootPct ?? 0,
      boost: boosts?.boostLootPct ?? 0,
      day: dayType ? boosts?.typeDay?.lootPct ?? 0 : 0,
      background,
      withDay,
    },
    rows,
  });
}
