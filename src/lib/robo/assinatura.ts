import { query } from "@/lib/robo/db";

/**
 * Concede ou estende a assinatura.
 *
 * `GREATEST(vip_ate, now())` e o coracao disto: renovar ANTES de vencer acumula
 * (parte da data futura), renovar DEPOIS parte de hoje. Sem o `GREATEST`, quem
 * paga adiantado perde os dias que ainda tinha — e quem paga atrasado ganharia
 * dias retroativos que nunca usou.
 *
 * A sessao nao precisa ser avisada: o callback do Auth.js rele o usuario a cada
 * request, entao a flag fica fresca sozinha no proximo carregamento.
 */
export async function concederDias(userId: string, dias: number): Promise<void> {
  await query(
    `UPDATE users
        SET vip = true,
            vip_ate = GREATEST(COALESCE(vip_ate, now()), now()) + make_interval(days => $2)
      WHERE id = $1`,
    [userId, dias],
  );
}
