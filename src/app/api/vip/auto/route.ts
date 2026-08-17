import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink, updateGameTokens, markGameLinkExpired } from "@/lib/game-link";
import { readAuto, applyAuto, AUTO_FIELDS, type AutoField } from "@/lib/game-auto";
import { gameSession } from "@/lib/game-hunt-session";

export const runtime = "nodejs";

// Configura a automacao NATIVA do jogo (Auto-Helper) pela area VIP. GET le o estado +
// catalogo de bolas; POST grava UM campo validado via POST /api/game/auto-helper.
// So config (reversivel); a rota valida o campo/valor pra nunca escrever coisa fora da
// lista. Escreve na conta REAL do jogo vinculada ao usuario.

async function ctx() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "not_logged" }, { status: 401 }) };
  if (!session.user.vip) return { error: NextResponse.json({ error: "vip_only" }, { status: 403 }) };
  const link = await getGameLink(session.user.id);
  if (!link || link.status === "expired") return { error: NextResponse.json({ error: "not_connected" }, { status: 409 }) };
  return { userId: session.user.id, tokens: link.tokens };
}

export async function GET() {
  const c = await ctx();
  if (c.error) return c.error;

  const r = await readAuto(c.tokens).catch(() => null);
  if (!r) return NextResponse.json({ error: "game_unreachable" }, { status: 502 });
  if ("unauth" in r) {
    await markGameLinkExpired(c.userId);
    return NextResponse.json({ error: "expired" }, { status: 409 });
  }
  if (r.changed) await updateGameTokens(c.userId, r.tokens);
  return NextResponse.json({ auto: r.auto, balls: r.balls });
}

// Valida o valor conforme o tipo do campo (bool | int | pct 0..100).
function validate(field: AutoField, value: unknown): number | boolean | null {
  const kind = AUTO_FIELDS[field];
  if (kind === "bool") return typeof value === "boolean" ? value : null;
  const n = typeof value === "number" ? value : NaN;
  if (!Number.isInteger(n)) return null;
  if (kind === "pct") return n >= 0 && n <= 100 ? n : null;
  return n >= 0 ? n : null; // int (id de bola)
}

export async function POST(req: Request) {
  const c = await ctx();
  if (c.error) return c.error;

  const body = (await req.json().catch(() => ({}))) as { field?: string; value?: unknown };
  const field = body.field as AutoField;
  if (!field || !(field in AUTO_FIELDS)) return NextResponse.json({ error: "bad_field" }, { status: 400 });
  const value = validate(field, body.value);
  if (value === null) return NextResponse.json({ error: "bad_value" }, { status: 400 });

  const w = await applyAuto(c.tokens, { [field]: value }).catch(() => null);
  if (!w) return NextResponse.json({ error: "game_unreachable" }, { status: 502 });
  if (!w.ok) return NextResponse.json({ error: "write_failed", status: w.status }, { status: 502 });

  // Reaplica no campo VIVO: o jogo le a autohelper no SNAPSHOT da conexao — reenviar
  // enter-hunt deixou de bastar (a bola trocada seguia a antiga). bounceLive() recicla a
  // sessao na hora (fecha e reabre o socket): snapshot novo = config nova, garantido. O
  // rendimento do trecho atual e persistido antes (nada se perde nas Estatisticas). Sem
  // sessao viva e no-op — a config gravada vale no proximo connect.
  gameSession.bounceLive();

  // Re-le o estado completo (a resposta do auto-helper pode vir parcial).
  let tokens = w.tokens;
  const r = await readAuto(tokens).catch(() => null);
  if (r && !("unauth" in r)) {
    tokens = r.tokens;
    if (r.changed || w.changed) await updateGameTokens(c.userId, tokens);
    return NextResponse.json({ auto: r.auto, balls: r.balls });
  }
  // fallback: usa o que o auto-helper devolveu
  if (w.changed) await updateGameTokens(c.userId, tokens);
  return NextResponse.json({ auto: w.result?.auto, balls: w.result?.balls ?? [] });
}
