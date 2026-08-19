import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listCaptured, clearCaptured, type CapturedFilters } from "@/lib/captured-pokes";
import { gameSession } from "@/lib/game-hunt-session";
import type { PokeType, Rarity } from "@/lib/types";

export const runtime = "nodejs";

// Acervo de capturados/mantidos: GET lista com filtros+paginacao (igual mercado); DELETE limpa.
async function uid() {
  const s = await auth();
  if (!s?.user?.id) return { error: NextResponse.json({ error: "not_logged" }, { status: 401 }) };
  if (!s.user.vip) return { error: NextResponse.json({ error: "vip_only" }, { status: 403 }) };
  return { userId: s.user.id };
}

const numOr = (v: string | null): number | null => (v != null && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);

export async function GET(req: Request) {
  const c = await uid();
  if (c.error) return c.error;
  const q = new URL(req.url).searchParams;
  const f: CapturedFilters = {
    type: (q.get("type") ?? "") as PokeType | "",
    rarity: (q.get("rarity") ?? "") as Rarity | "",
    speciesId: numOr(q.get("species")),
    ivMin: numOr(q.get("ivMin")),
    qMin: numOr(q.get("qMin")),
    shiny: q.get("shiny") === "1" ? true : null,
    sort: (["recent", "iv", "quality"].includes(q.get("sort") ?? "") ? q.get("sort") : "recent") as CapturedFilters["sort"],
    page: numOr(q.get("page")) ?? 0,
  };
  const data = await listCaptured(c.userId, f);
  return NextResponse.json(data);
}

export async function DELETE() {
  const c = await uid();
  if (c.error) return c.error;
  await clearCaptured(c.userId);
  if (gameSession.ownedBy(c.userId)) gameSession.resetCapturedCache();
  return NextResponse.json({ ok: true });
}
