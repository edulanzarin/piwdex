import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRobotSales } from "@/lib/robot-sales";
import { capturedStats } from "@/lib/captured-pokes";
import { gameSession } from "@/lib/game-hunt-session";
import { getData } from "@/lib/data";

export const runtime = "nodejs";

// Dashboard de Estatisticas (cumulativo, pra sempre) EM TEMPO REAL: o persistido (hunts JA
// concluidas + todas as vendas) MAIS o que a hunt AGORA em andamento ja rendeu (analyzer ao
// vivo). Assim os numeros de Cacada andam junto com a caca, nao so no fim dela. Sem
// dupla-contagem: ao terminar, o logSummary persiste o analyzer e a hunt deixa de ser "live".
export async function GET() {
  const s = await auth();
  if (!s?.user?.id) return NextResponse.json({ error: "not_logged" }, { status: 401 });
  if (!s.user.vip) return NextResponse.json({ error: "vip_only" }, { status: 403 });

  const [totals, acervo] = await Promise.all([getRobotSales(s.user.id), capturedStats(s.user.id)]);

  // contribuicao AO VIVO da hunt em andamento (ainda nao persistida)
  const st = gameSession.getState();
  const a = st.status === "running" && st.slug ? st.analyzer : null;
  if (a) {
    let rareItems = 0;
    try {
      const data = await getData();
      for (const d of a.drops ?? []) {
        const it = data.getItemByName(d.name) ?? data.getItem(d.itemId);
        if (it?.rare) rareItems += d.qty;
      }
    } catch { /* raridade e best-effort */ }
    totals.hunts += 1; // a hunt em andamento conta como 1 na contagem viva
    totals.kills += a.kills; totals.captures += a.captures; totals.xpGained += a.xpGained;
    totals.lootItems += a.lootItems; totals.lootGold += a.lootGold; totals.supplyGold += a.supplyGold;
    totals.rareItems += rareItems;
  }

  return NextResponse.json({ ...totals, acervo });
}
