import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink, saveGameShard, saveTeamSnapshot } from "@/lib/game-link";
import { fetchActivePokes } from "@/lib/game-ws";
import { normalizeActivePokes } from "@/lib/game-account";

export const runtime = "nodejs";

// Time/colecao ativa via WebSocket (o unico lugar com os individuos + IV). Le o
// vinculo do usuario logado, conecta no shard (cacheado, ou descobre) e devolve o
// TIME (team:true, por slot) + o total da colecao.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "not_logged" }, { status: 401 });
  if (!session.user.vip) return NextResponse.json({ error: "vip_only" }, { status: 403 }); // toma a sessao de jogo: VIP

  const userId = session.user.id;
  const link = await getGameLink(userId);
  if (!link) return NextResponse.json({ error: "not_connected" }, { status: 409 });
  if (link.status === "expired") return NextResponse.json({ error: "expired" }, { status: 409 });

  let result;
  try {
    result = await fetchActivePokes(link.tokens, link.shard);
  } catch {
    return NextResponse.json({ error: "ws_failed" }, { status: 502 });
  }
  if (!result) return NextResponse.json({ error: "ws_failed" }, { status: 502 });

  if (result.shard !== link.shard) await saveGameShard(userId, result.shard);

  const all = normalizeActivePokes(result.pokes);
  const team = all.filter((p) => p.team).sort((a, b) => a.slot - b.slot);
  await saveTeamSnapshot(userId, team, all.length); // atualiza o snapshot mostrado na Conta
  return NextResponse.json({ team, total: all.length, at: new Date().toISOString() });
}
