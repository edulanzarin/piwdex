import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runSniperScan } from "@/lib/sniper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Gatilho EXTERNO do sniper (opcional), protegido por CRON_SECRET. O caminho normal em
// producao e o loop interno (instrumentation.ts -> startSniperLoop); esta rota existe
// pra disparo manual ou cron externo. Sem CRON_SECRET configurado, fica fechada.

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // sem segredo configurado, o endpoint fica fechado
  const given = req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret");
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(await runSniperScan());
}
