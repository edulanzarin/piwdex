import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/robo/db";
import { DIAS_POR_PAGAMENTO, assinaturaConfere, lerPagamento } from "@/lib/robo/pagamento";
import { concederDias } from "@/lib/robo/assinatura";

export const runtime = "nodejs";

/**
 * O aviso de pagamento do Mercado Pago.
 *
 * Tres regras seguram esta rota, e todas as tres vem de como o MP se comporta de
 * verdade:
 *
 * 1. **O corpo nao e prova.** O MP manda so um id; o status vem de uma consulta
 *    NOSSA a API dele, com o nosso token.
 * 2. **Chega repetido.** Por isso `vip_payments` tem chave primaria no id do
 *    pagamento, e a concessao acontece so na TRANSICAO pra `approved` — senao o
 *    mesmo pagamento estenderia a assinatura tres vezes.
 * 3. **Responde 200 quase sempre.** Erro faz o MP reenviar por horas. O unico
 *    caso que merece recusa e a assinatura invalida, que e ataque e nao falha.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);

  let corpo: { type?: string; action?: string; data?: { id?: string } } = {};
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    /* o MP tambem manda tudo na query string */
  }

  const idPagamento = url.searchParams.get("data.id") || url.searchParams.get("id") || corpo?.data?.id || null;
  const tipo = url.searchParams.get("type") || url.searchParams.get("topic") || corpo?.type || "";

  // So tratamos evento de pagamento; o resto e ack silencioso.
  if (!idPagamento || (tipo && !tipo.includes("payment"))) return NextResponse.json({ ok: true });

  if (!assinaturaConfere(req, String(idPagamento))) {
    return NextResponse.json({ erro: "assinatura_invalida" }, { status: 401 });
  }

  const pag = await lerPagamento(String(idPagamento));
  if (!pag) return NextResponse.json({ ok: true });

  const userId = pag.metadata?.user_id ?? null;
  const antes = await queryOne<{ status: string }>(
    "SELECT status FROM vip_payments WHERE id = $1",
    [String(pag.id)],
  );

  await query(
    `INSERT INTO vip_payments (id, user_id, status, amount, raw)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, raw = EXCLUDED.raw`,
    [String(pag.id), userId, pag.status, pag.transaction_amount ?? null, JSON.stringify(pag)],
  );

  if (pag.status === "approved" && userId && antes?.status !== "approved") {
    await concederDias(userId, DIAS_POR_PAGAMENTO);
  }

  return NextResponse.json({ ok: true });
}
