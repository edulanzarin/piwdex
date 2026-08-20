import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink, saveGameShard } from "@/lib/game-link";
import { fetchActivePokes } from "@/lib/game-ws";
import { normalizeActivePokes, type ActivePoke } from "@/lib/game-account";
import { sessionFor } from "@/lib/game-hunt-session";
import { getRobotSales } from "@/lib/robot-sales";
import { captureRatesBySlug } from "@/lib/robot-events";
import { fetchGameBoosts, lootBonusesOf } from "@/lib/game-boosts";
import { lootMultiplier, NO_BONUS, STREAK_STEP, type LootBonuses } from "@/lib/boost";
import { rankMoney, NO_STYLE, type MoneyMode, type PlayStyle } from "@/lib/hunt-brain";
import { getData } from "@/lib/data";
import { ALL_TYPES } from "@/lib/typing";
import type { PokeType } from "@/lib/types";

export const runtime = "nodejs";

// "Com os pokemons que eu TENHO, o que rende mais por hora HOJE?"
//
// Junta quatro coisas que viviam separadas: o tipo premiado do dia (lido do jogo), o motor
// de combate (quantos abates por hora em cada spot, ja descontando desmaio), o motor de
// loot com TETO de chance, e COMO VOCE JOGA — capturas e supply por abate, medidos da sua
// propria hunt. Sem a quarta o ranking media 13% da renda: no Yanma do Eduardo o loot deu
// 12.321 e a venda dos capturados 81.000.
//
// O roster e time MAIS box: "os pokemons que eu tenho" nao para na equipe ativa. Os
// individuais so existem no frame `pokes` do WebSocket, entao com sessao viva a lista sai
// da memoria e sem sessao sai de uma leitura one-shot (mesmo desenho do /api/vip/team).

const isType = (v: string): v is PokeType => (ALL_TYPES as string[]).includes(v);
const numParam = (v: string | null): number | null => {
  if (v == null || v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Amostra minima pra a taxa geral valer alguma coisa. Uma taxa de ~2% nao se mede em
 *  dezenas de abates: 0 capturas em 49 e o resultado MAIS PROVAVEL de quem captura 2,4%
 *  (chance de ~30%), e mesmo assim fazia o ranking inteiro trocar de recomendacao. */
const MIN_SAMPLE = 200;

/** Como o jogador joga, medido do historico INTEIRO do robo mais a hunt em andamento.
 *  Somar os dois e o mesmo desenho do totalizador ao vivo (persistido + em curso): a hunt
 *  de agora entra na conta sem PODER sozinha virar a conta. */
async function measureStyle(userId: string): Promise<PlayStyle> {
  const live = sessionFor(userId).getState().analyzer;
  const t = await getRobotSales(userId).catch(() => null);

  const kills = (t?.kills ?? 0) + (live?.kills ?? 0);
  const captures = (t?.captures ?? 0) + (live?.captures ?? 0);
  const supply = (t?.supplyGold ?? 0) + (live?.supplyGold ?? 0);
  if (kills < MIN_SAMPLE) return NO_STYLE;

  return {
    capturePerKill: captures / kills,
    supplyPerKill: supply / kills,
    from: live?.kills ? "live" : "totals",
    sample: kills,
    bySlug: await captureRatesBySlug(userId),
    speedFactor: 1, // medido depois, contra o alvo em que voce esta agora
  };
}

/**
 * Quanto o motor erra a velocidade de abate, medido contra a hunt em curso: abates/h
 * REAIS (analyzer) sobre os previstos pro MESMO alvo. O motor de combate se declara
 * calibrado "pra comparar hunts, nao como numero exato" — e o erro entra em TUDO que e
 * por abate (loot, captura, supply). Fora de uma faixa sensata a medida e ruido (hunt
 * recem-comecada, alvo trocando), e o fator volta a 1.
 */
const NO_BONUS_FOR_SPEED = NO_BONUS;

async function measureSpeed(userId: string, pokes: ActivePoke[], vip: boolean): Promise<number> {
  const st = sessionFor(userId).getState();
  const a = st.analyzer;
  if (!a || !st.slug || a.kills < 60 || a.killsPerHour <= 0) return 1;
  const leader = pokes.find((p) => p.leader) ?? pokes.find((p) => p.team);
  if (!leader) return 1;
  const rows = await rankMoney([leader], NO_BONUS_FOR_SPEED, vip, { limit: 400, style: NO_STYLE });
  const here = rows.find((r) => r.slug === st.slug);
  if (!here || here.kosH <= 0) return 1;
  const factor = a.killsPerHour / here.kosH;
  return Number.isFinite(factor) && factor >= 0.2 && factor <= 8 ? factor : 1;
}

export async function GET(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return NextResponse.json({ error: "not_logged" }, { status: 401 });
  if (!s.user.vip) return NextResponse.json({ error: "vip_only" }, { status: 403 });
  const userId = s.user.id;

  const link = await getGameLink(userId);
  if (!link || link.status === "expired") return NextResponse.json({ error: "not_connected" }, { status: 409 });

  const q = new URL(req.url).searchParams;
  const refresh = q.get("refresh") === "1";
  const mode: MoneyMode = q.get("mode") === "xp" ? "xp" : "gold";
  const rawType = (q.get("type") ?? "").toUpperCase();
  // undefined = usa o tipo real do dia; null = simula um dia sem bonus; tipo = simula ele
  const override: PokeType | null | undefined =
    rawType === "" ? undefined : rawType === "NONE" ? null : isType(rawType) ? rawType : undefined;

  // Refresh do painel tambem confere o CATALOGO: patch de balanceamento muda o ranking
  // mais que qualquer bonus (Ledian saiu de 493 pra 38 de ouro/abate em 20/08/2026).
  if (refresh) await getData(true).catch(() => {});

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

  // --- bonus de hoje, com os ajustes que o usuario mandar ---------------------------
  const boosts = await fetchGameBoosts(userId, refresh);
  const base = lootBonusesOf(boosts, override);
  const streakPct = numParam(q.get("streak"));   // % da trilha Loot
  const eventPct = numParam(q.get("event"));     // % de evento/boost de fundo
  const bonuses: LootBonuses = {
    ...base,
    streakLoot: streakPct != null ? Math.round(streakPct / 100 / STREAK_STEP) : base.streakLoot,
    lootBoost: q.get("boost") === "1" ? true : q.get("boost") === "0" ? false : base.lootBoost,
    eventPct: eventPct ?? base.eventPct,
  };
  const dayType = bonuses.typeDay;
  const dayXpPct = dayType ? boosts?.typeDay?.xpPct ?? boosts?.typeDay?.lootPct ?? 0 : 0;

  // --- como voce joga ---------------------------------------------------------------
  const measured = await measureStyle(userId);
  const capture = numParam(q.get("capture"));
  const supply = numParam(q.get("supply"));
  const speedFactor = await measureSpeed(userId, pokes, true).catch(() => 1);
  const style: PlayStyle = {
    capturePerKill: capture != null ? capture : measured.capturePerKill,
    supplyPerKill: supply != null ? supply : measured.supplyPerKill,
    from: capture != null || supply != null ? "default" : measured.from,
    sample: measured.sample,
    // taxa informada na mao vale pra TODO alvo — quem digitou quer aquele numero
    bySlug: capture != null ? undefined : measured.bySlug,
    speedFactor,
  };

  // VIP do JOGO (1,5x XP): assume ligado, como o /api/vip/best-poke, pra nao pagar mais
  // uma ida ao jogo. So escala a coluna de XP.
  const rows = await rankMoney(pokes, bonuses, true, { limit: 12, mode, dayXpPct, style });

  const background = lootMultiplier(bonuses);
  const withDay = dayType ? lootMultiplier(bonuses, [dayType]) : background;
  const db = await getData();

  return NextResponse.json({
    live,
    mode,
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
    applied: dayType,
    source: override === undefined ? "game" : override === null ? "off" : "manual",
    mult: {
      streak: bonuses.streakLoot * STREAK_STEP,
      boost: bonuses.eventPct / 100 + (bonuses.lootBoost ? 0.4 : 0),
      day: dayType ? boosts?.typeDay?.lootPct ?? 0 : 0,
      background,
      withDay,
    },
    // `bySlug` e um Map (nao sobrevive ao JSON) e e detalhe de motor: a tela quer o
    // resumo. A taxa por spot chega em cada linha, onde ela e usada.
    style: {
      capturePerKill: style.capturePerKill,
      supplyPerKill: style.supplyPerKill,
      from: style.from,
      sample: style.sample,
      speedFactor: style.speedFactor,
      spots: style.bySlug?.size ?? 0,
    },
    // frescor do CATALOGO: e ele que decide se o ranking vale
    catalog: { live: db.live, at: db.generatedAt, error: db.error, checkedAt: db.checkedAt },
    rows,
  });
}
