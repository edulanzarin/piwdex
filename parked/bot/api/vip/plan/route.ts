import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink } from "@/lib/game-link";
import { buildLevelPlan, fighterOf } from "@/lib/hunt-brain";

export const runtime = "nodejs";

// Preview do plano de leveling: a sequencia otima de hunts do nivel atual ate o alvo, SEM
// ligar nada — a UI mostra a rota e o usuario confirma (o start e o POST /api/vip/hunt com
// action=leveling). ?pokeId=<id do pokemon na conta>&target=<nivel alvo>

export async function GET(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return NextResponse.json({ error: "not_logged" }, { status: 401 });
  if (!s.user.vip) return NextResponse.json({ error: "vip_only" }, { status: 403 });

  const link = await getGameLink(s.user.id);
  if (!link || link.status === "expired") return NextResponse.json({ error: "not_connected" }, { status: 409 });

  const q = new URL(req.url).searchParams;
  const pokeId = q.get("pokeId") ?? "";
  const target = Number(q.get("target"));
  if (!pokeId || !Number.isFinite(target) || target < 2 || target > 400) {
    return NextResponse.json({ error: "bad_goal" }, { status: 400 });
  }

  const poke = link.team?.list.find((p) => p.id === pokeId);
  if (!poke) return NextResponse.json({ error: "poke_not_found" }, { status: 404 });
  if (poke.level >= target) return NextResponse.json({ error: "already_there" }, { status: 400 });

  const steps = await buildLevelPlan(fighterOf(poke), Math.floor(target), true);
  return NextResponse.json({
    poke: { id: poke.id, name: poke.name, speciesId: poke.speciesId, level: poke.level, shiny: poke.shiny },
    targetLevel: Math.floor(target),
    steps,
  });
}
