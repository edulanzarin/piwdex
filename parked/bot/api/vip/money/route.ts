import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink, saveGameShard } from "@/lib/game-link";
import { fetchActivePokes } from "@/lib/game-ws";
import { normalizeActivePokes, type ActivePoke } from "@/lib/game-account";
import { sessionFor } from "@/lib/game-hunt-session";
import { getRobotSales } from "@/lib/robot-sales";
import { captureRatesBySlug, speedRefOf } from "@/lib/robot-events";
import { fetchCatchData, fitCatchLaw, rateFromMeter } from "@/lib/game-catch";
import { predictCatchRate } from "@/lib/catch-law";
import { fetchGameBoosts, lootBonusesOf } from "@/lib/game-boosts";
import { lootMultiplier, NO_BONUS, STREAK_STEP, type LootBonuses } from "@/lib/boost";
import { rankMoney, getBrainData, NO_STYLE, type MoneyMode, type PlayStyle } from "@/lib/hunt-brain";
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

/** Valor medio de venda dos alvos que se caca na pratica. Serve de escala pra comparar o
 *  ouro de venda REGISTRADO com o que o modelo teria previsto — nao entra em nenhuma
 *  linha do ranking, so na razao entre previsto e recebido. */
const MEAN_SELL_VALUE = 9000;

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

  const globalRate = captures / kills;

  // Dificuldade POR ESPECIE, do medidor de investimento do jogo (o mesmo que as strings
  // do jogo descrevem: sobe a cada bola, zera na captura). E o que impede uma especie de
  // 75.000 que voce nunca capturou de herdar a taxa de uma de 9.000 que voce captura toda
  // hora.
  const catchData = await fetchCatchData(userId).catch(() => null);
  const bySpecies = new Map<number, number>();
  if (catchData) {
    for (const [speciesId, s] of catchData.bySpecies) {
      const r = rateFromMeter(s, globalRate);
      if (r != null) bySpecies.set(speciesId, r);
    }
  }

  // A LEI, ajustada com as especies DESTA conta (bola, profissao e bonus de pokedex dela
  // entram embutidos). E o que permite prever um spot onde voce nunca pisou.
  const db0 = await getData();
  const law = fitCatchLaw(catchData, (id) => db0.getCreature(id));
  const ballRate = catchData?.ballRate ?? 1;

  // BOLA: o preco da bola que o auto-catch usa AGORA — nao a media da vida da conta.
  //
  // A media era arqueologia: somava `goldSpent/total` de 146.814 abates, boa parte deles
  // feitos com Poke Ball (5) e Great Ball (20), e entregava 42 de supply por abate. So que
  // hoje o auto-catch joga Ultra Ball, que custa 130 — e sai UMA bola por abate (kills ==
  // ballsUsed, confirmado no frame `analyzer` do jogo). O painel cobrava 42 onde o jogo
  // cobrava 144,7, e com ~565 abates/h isso e ~58k/h de custo que nao aparecia: o Kingdra
  // saia como 219k/h quando a hunt real paga ~159k/h.
  //
  // A media so volta como REDE, pra conta sem auto-helper legivel — subestimar de leve e
  // melhor do que zerar o custo.
  let ballAvg = 0, ballN = 0;
  if (catchData) {
    for (const s2 of catchData.bySpecies.values()) { if (s2.ballCost > 0) { ballAvg += s2.ballCost * s2.total; ballN += s2.total; } }
  }
  ballAvg = ballN > 0 ? ballAvg / ballN : 0;
  const ballCost = catchData?.ballPrice && catchData.ballPrice > 0 ? catchData.ballPrice : ballAvg;
  const potionItem = catchData?.potionItemId ? db0.getItem(catchData.potionItemId) : undefined;
  const potion = potionItem?.healAmount && potionItem.healAmount > 0
    ? { heal: potionItem.healAmount, price: potionItem.priceGold ?? potionItem.npcPrice ?? 0, threshold: catchData?.potionThreshold ?? 0 }
    : null;
  const canCatch = catchData ? catchData.autoCatch : true;
  const predictRate = (sellValue: number) =>
    canCatch ? predictCatchRate(law, sellValue, ballRate) : 0;

  // ANCORA: o modelo projeta renda de captura; o robo REGISTRA quanto de venda de
  // pokemon realmente entrou. A razao entre os dois corrige de uma vez tudo que separa
  // "capturei" de "recebi" — o que a config manda guardar, o que o jogo recusou vender,
  // o que ficou no acervo. Sem ela o ranking prometia +774 por abate onde o jogo pagava
  // -130. Fora de uma faixa sensata (historico curto demais) o fator volta a 1.
  let sellShare = 1;
  if (t && t.kills > 0 && t.pokesGold > 0) {
    const previsto = globalRate * t.kills * MEAN_SELL_VALUE;
    if (previsto > 0) {
      const r = t.pokesGold / previsto;
      if (Number.isFinite(r) && r > 0.02 && r < 5) sellShare = r;
    }
  }

  return {
    sellShare,
    capturePerKill: globalRate,
    supplyPerKill: supply / kills,
    from: live?.kills ? "live" : "totals",
    sample: kills,
    bySlug: await captureRatesBySlug(userId),
    bySpecies,
    ballCost,
    potion,
    predictRate,
    law,
    autoCatch: canCatch,
    ballName: catchData?.ballName ?? "",
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

/**
 * Ajusta a reta da velocidade: `ttk = perHp * HP_do_wild + overhead`.
 *
 * Cada hunt sua vira um ponto (abates e segundos do resumo, mais a hunt em curso), e o HP
 * do wild vem do catalogo. Dois pontos com HP diferente ja identificam os dois termos —
 * e sao eles que dizem a verdade que o motor de dano nao sabe: na conta do Eduardo a reta
 * deu DPS 133 e overhead 3,25s, enquanto o motor assumia 5s fixos e um dano ~13x menor,
 * o que escondia o Pinsir (16 abates/h previstos contra ~530 reais).
 */
async function fitKillSpeed(userId: string, bySlug: Map<string, { kills: number; seconds: number }>) {
  const data = await getBrainData();
  const bySlugTarget = new Map(data.targets.map((t) => [t.slug, t]));
  const pts: { hp: number; ttk: number }[] = [];

  const add = (slug: string, kills: number, seconds: number) => {
    const t = bySlugTarget.get(slug);
    if (!t || kills < 30 || seconds < 120) return; // amostra curta nao mede ritmo
    const ttk = seconds / kills;
    if (ttk > 0.2 && ttk < 600) pts.push({ hp: t.hp, ttk });
  };
  for (const [slug, agg] of bySlug) add(slug, agg.kills, agg.seconds);
  const st = sessionFor(userId).getState();
  if (st.slug && st.analyzer) add(st.slug, st.analyzer.kills, st.analyzer.seconds);

  if (pts.length < 2) return null;
  const mx = pts.reduce((s, p) => s + p.hp, 0) / pts.length;
  const my = pts.reduce((s, p) => s + p.ttk, 0) / pts.length;
  let sxy = 0, sxx = 0;
  for (const p of pts) { sxy += (p.hp - mx) * (p.ttk - my); sxx += (p.hp - mx) ** 2; }
  if (sxx <= 0) return null;
  const perHp = sxy / sxx;
  const overhead = my - perHp * mx;
  // reta sem sentido fisico (inclinacao negativa, overhead absurdo) = pontos ruins
  if (!(perHp > 0) || overhead < 0 || overhead > 60) return null;
  return { perHp, overhead, points: pts.length };
}

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
  const killSpeed = await fitKillSpeed(userId, measured.bySlug ?? new Map()).catch(() => null);
  const speedRef = await speedRefOf(userId).catch(() => null);
  const style: PlayStyle = {
    capturePerKill: capture != null ? capture : measured.capturePerKill,
    supplyPerKill: supply != null ? supply : measured.supplyPerKill,
    from: capture != null || supply != null ? "default" : measured.from,
    sample: measured.sample,
    // taxa informada na mao vale pra TODO alvo — quem digitou quer aquele numero
    bySlug: capture != null ? undefined : measured.bySlug,
    bySpecies: capture != null ? undefined : measured.bySpecies,
    ballCost: supply != null ? undefined : measured.ballCost,
    potion: supply != null ? null : measured.potion,
    predictRate: capture != null ? undefined : measured.predictRate,
    sellShare: measured.sellShare,
    speedFactor,
    killSpeed,
    speedRef,
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
      killSpeed: style.killSpeed
        ? { dps: Math.round(1 / style.killSpeed.perHp), overhead: style.killSpeed.overhead, points: style.killSpeed.points }
        : null,
      sellShare: style.sellShare ?? 1,
      ballCost: style.ballCost ?? 0,
      potion: style.potion ?? null,
      spots: style.bySlug?.size ?? 0,
      species: style.bySpecies?.size ?? 0,
      autoCatch: measured.autoCatch ?? true,
      ballName: measured.ballName ?? "",
      law: measured.law ? { sample: measured.law.sample, spread: measured.law.spread } : null,
    },
    // frescor do CATALOGO: e ele que decide se o ranking vale
    catalog: { live: db.live, at: db.generatedAt, error: db.error, checkedAt: db.checkedAt },
    rows,
  });
}
