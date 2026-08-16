import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { gameFetch, parseTokens } from "@/lib/game-auth";
import { saveGameLink, saveGameShard, saveTeamSnapshot } from "@/lib/game-link";
import { fetchActivePokes } from "@/lib/game-ws";
import { normalizeActivePokes } from "@/lib/game-account";

export const runtime = "nodejs";

// Vincula a conta do jogo AO USUARIO LOGADO no piwdex. Recebe o token colado
// (valor do pokeweb:tokens ou dois JWTs), valida em /api/characters/me e grava o
// vinculo cifrado no banco (tabela game_links). Exige estar logado no site.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "not_logged" }, { status: 401 });
  // Conectar a conta do jogo e beneficio VIP: vincular = tomar a sessao de jogo, que
  // so faz sentido pra quem usa Conta/Mercado/Robo (tudo VIP). Gate no servidor.
  if (!session.user.vip) return NextResponse.json({ ok: false, error: "vip_only" }, { status: 403 });

  let raw = "";
  try {
    const body = (await req.json()) as { raw?: string; token?: string };
    raw = String(body?.raw ?? body?.token ?? "");
  } catch {
    /* body invalido */
  }

  const tokens = parseTokens(raw);
  if (!tokens) return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 });

  let result;
  try {
    result = await gameFetch("/api/characters/me", tokens);
  } catch {
    return NextResponse.json({ ok: false, error: "game_unreachable" }, { status: 502 });
  }
  if (!result.res.ok) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const data = (await result.res.json().catch(() => null)) as
    | { character?: { name?: string }; name?: string }
    | null;
  const playerName = data?.character?.name ?? data?.name ?? null;

  await saveGameLink(session.user.id, result.tokens, { playerName });

  // Ja que conectar toma a sessao de jogo de qualquer jeito, aproveita pra puxar o
  // time (WS) AGORA e guardar o snapshot — a Conta mostra sem reconectar depois. Nao
  // bloqueia o connect: se o WS falhar, conecta mesmo assim (Conta oferece "carregar").
  try {
    const pokes = await fetchActivePokes(result.tokens, null);
    if (pokes) {
      const all = normalizeActivePokes(pokes.pokes);
      const team = all.filter((p) => p.team).sort((a, b) => a.slot - b.slot);
      await saveGameShard(session.user.id, pokes.shard);
      await saveTeamSnapshot(session.user.id, team, all.length);
    }
  } catch { /* time fica pra um "atualizar" na Conta */ }

  return NextResponse.json({ ok: true });
}
