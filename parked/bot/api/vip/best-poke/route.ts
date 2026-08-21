import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink } from "@/lib/game-link";
import { getData } from "@/lib/data";
import { bestFighterFor } from "@/lib/hunt-brain";

export const runtime = "nodejs";

// Melhor pokemon do SEU TIME pra uma hunt: pega o time (snapshot do link) e pontua pelo
// motor de combate — XP/h EFETIVO, que ja mede tanto o quanto voce bate quanto o quanto
// aguenta apanhar (ver src/lib/combat.ts). Pontuar so por efetividade x poder indicava o
// glass cannon que morre no primeiro golpe. Devolve o pokeId INDIVIDUAL pra troca ao vivo
// (poke-summon em /api/vip/summon).
export async function GET(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return NextResponse.json({ error: "not_logged" }, { status: 401 });
  if (!s.user.vip) return NextResponse.json({ error: "vip_only" }, { status: 403 });

  const pokeId = Number(new URL(req.url).searchParams.get("pokeId"));
  if (!pokeId) return NextResponse.json({ best: null });

  const link = await getGameLink(s.user.id);
  const team = (link?.team?.list ?? []).filter((p) => p.team); // so o time ativo
  if (!team.length) return NextResponse.json({ best: null });

  const data = await getData();
  const target = data.getCreature(pokeId);
  if (!target) return NextResponse.json({ best: null });

  const pick = await bestFighterFor(team, pokeId, true);
  if (!pick) return NextResponse.json({ best: null });
  const { poke: p, est } = pick;
  return NextResponse.json({
    best: {
      pokeId: p.id, speciesId: p.speciesId, name: p.name, level: p.level, power: p.power,
      eff: Math.round(est.eff * 100) / 100,
      risk: est.threat.risk, killsPerLife: est.threat.killsPerLife,
    },
    targetName: target.name,
  });
}
