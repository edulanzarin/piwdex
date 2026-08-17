import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink } from "@/lib/game-link";
import { getData } from "@/lib/data";
import { huntEffectiveness } from "@/lib/combat";

export const runtime = "nodejs";

// Melhor pokemon do SEU TIME pra uma hunt: pega o time (snapshot do link), a especie-alvo da
// hunt (pokeId) e pontua por efetividade de tipo (STAB) x poder — reaproveita huntEffectiveness
// do combate. Devolve o pokeId INDIVIDUAL pra troca ao vivo (poke-summon em /api/vip/summon).
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

  let best: { pokeId: string; speciesId: number; name: string; level: number; power: number; eff: number; score: number } | null = null;
  for (const p of team) {
    const cr = data.getCreature(p.speciesId);
    if (!cr) continue;
    const eff = Math.max(
      huntEffectiveness(cr.type1, target.type1, target.type2),
      cr.type2 ? huntEffectiveness(cr.type2, target.type1, target.type2) : 0,
    );
    const score = eff * (p.power || 1);
    if (!best || score > best.score) best = { pokeId: p.id, speciesId: p.speciesId, name: p.name, level: p.level, power: p.power, eff, score };
  }
  if (!best) return NextResponse.json({ best: null });
  return NextResponse.json({
    best: { pokeId: best.pokeId, speciesId: best.speciesId, name: best.name, level: best.level, power: best.power, eff: Math.round(best.eff * 100) / 100 },
    targetName: target.name,
  });
}
