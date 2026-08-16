import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getPayment } from "@/lib/mercadopago";
import { grantVipDays } from "@/lib/vip";

export const runtime = "nodejs";

const VIP_DAYS = 30;

// Webhook do Mercado Pago. O MP so manda o ID; a gente BUSCA o pagamento na fonte
// (com nosso token) pra confiar no status — nao no corpo. Idempotente: registra o
// pagamento e so concede VIP na primeira vez que ficar "approved". Sempre responde
// 200 pro MP nao ficar reenviando.
export async function POST(req: Request) {
  const url = new URL(req.url);
  let paymentId = url.searchParams.get("data.id") || url.searchParams.get("id");
  const type = url.searchParams.get("type") || url.searchParams.get("topic");
  let body: { type?: string; action?: string; data?: { id?: string } } = {};
  try { body = (await req.json()) as typeof body; } catch { /* pode vir so na query */ }
  paymentId = paymentId || body?.data?.id || null;
  const kind = type || body?.type || "";

  // So tratamos evento de pagamento; o resto e ack silencioso.
  if (!paymentId || (kind && !kind.includes("payment"))) return NextResponse.json({ ok: true });

  const pay = await getPayment(String(paymentId));
  if (!pay) return NextResponse.json({ ok: true });

  const userId = pay.metadata?.user_id ?? null;
  const prev = await queryOne<{ status: string }>("SELECT status FROM vip_payments WHERE id = $1", [String(pay.id)]);
  await query(
    `INSERT INTO vip_payments (id, user_id, status, amount, raw)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, raw = EXCLUDED.raw`,
    [String(pay.id), userId, pay.status, pay.transaction_amount ?? null, JSON.stringify(pay)],
  );

  // Concede so na transicao pra approved (nao re-concede em reenvio).
  if (pay.status === "approved" && userId && prev?.status !== "approved") {
    await grantVipDays(userId, VIP_DAYS);
  }
  return NextResponse.json({ ok: true });
}
