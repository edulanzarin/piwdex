import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { gameFetch, parseTokens, refusalOf } from "@/lib/game-auth";
import { markGameLinkBlocked, saveGameLink, saveGameShard, saveTeamSnapshot } from "@/lib/game-link";
import { fetchActivePokes } from "@/lib/game-ws";
import { normalizeActivePokes } from "@/lib/game-account";
import { resumeRobotSessions } from "@/lib/robot-boot";
import { dropSession } from "@/lib/game-hunt-session";

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
  // Antes qualquer falha virava "unauthorized" — ban, rate limit e token vencido no
  // mesmo balde, e o usuario sem saber qual dos tres era. Agora a recusa e classificada,
  // e a de BAN e gravada: o robo para de tentar e a tela mostra o que o jogo respondeu.
  if (!result.res.ok) {
    const refusal = await refusalOf(result.res);
    if (refusal?.kind === "blocked") {
      await markGameLinkBlocked(session.user.id, refusal);
      return NextResponse.json(
        { ok: false, error: "account_blocked", reason: refusal.message },
        { status: 403 },
      );
    }
    if (refusal?.kind === "rate_limited") {
      return NextResponse.json({ ok: false, error: "rate_limited", reason: refusal.message }, { status: 429 });
    }
    // Falha que nao classificamos: devolve o codigo e a frase do jogo mesmo assim. E o
    // que permite descobrir COMO ele sinaliza cada recusa sem chutar — se um ban chegar
    // aqui como 401, a tela mostra o numero e a frase, e a regra se ajusta com evidencia.
    const raw = await refusalOf(result.res);
    return NextResponse.json(
      { ok: false, error: "unauthorized", status: result.res.status, reason: raw?.message },
      { status: 401 },
    );
  }

  const data = (await result.res.json().catch(() => null)) as
    | { character?: { name?: string }; name?: string }
    | null;
  const playerName = data?.character?.name ?? data?.name ?? null;

  // Vincular conta nova = a anterior morreu AQUI. Sem isso o motor seguia segurando o WS
  // da conta antiga entre o connect e o proximo "ligar o robo" — e nesse meio o chat, o
  // time ao vivo e os comandos ainda eram do personagem velho.
  dropSession(session.user.id);

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

  // Vinculo renovado: se o robo estava com estado desejado ligado (a conexao caiu porque o
  // token venceu, nao porque o usuario desligou), ele RETOMA sozinho — reconectar com o
  // bookmark e a unica acao do usuario, o resto volta ao que era.
  setTimeout(() => { void resumeRobotSessions(session.user!.id).catch(() => {}); }, 1_000);

  return NextResponse.json({ ok: true });
}
