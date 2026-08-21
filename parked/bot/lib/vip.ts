import { query } from "@/lib/db";

// Concede/estende VIP: cada pagamento aprovado soma `days` a partir do maior entre
// agora e o vip_ate atual (renovar antes de expirar acumula; renovar depois parte de
// hoje). O jwt callback do Auth.js rele o user a cada request, entao a flag `vip` da
// sessao fica fresca sozinha depois disso.
export async function grantVipDays(userId: string, days: number): Promise<void> {
  await query(
    `UPDATE users
        SET vip = true,
            vip_ate = GREATEST(COALESCE(vip_ate, now()), now()) + make_interval(days => $2)
      WHERE id = $1`,
    [userId, days],
  );
}
