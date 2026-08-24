import { query, queryOne } from "@/lib/robo/db";
import { normalizarConfig, type ConfigAuto } from "@/lib/robo/motor/tipos";

export { CONFIG_PADRAO, normalizarConfig, type ConfigAuto } from "@/lib/robo/motor/tipos";

/**
 * A config das automacoes, no banco. Por CONTA de jogo, e nao por assinante:
 * a conta de farm e a conta do cla nao querem os mesmos pisos nem a mesma
 * lista de venda.
 *
 * A FORMA dela (campos, padroes, saneamento) mora em `tipos.ts`, e a divisao tem
 * causa mecanica: a aba de automacao e componente de cliente e precisa dos
 * padroes como VALOR. Importar daqui arrastaria `pg` pro navegador, onde ele
 * tenta abrir `net`, `tls` e `dns` e o build morre.
 */

export async function lerConfig(contaId: string): Promise<ConfigAuto> {
  const l = await queryOne<{ auto_cfg: unknown }>(
    `SELECT auto_cfg FROM robot_sessions WHERE link_id = $1`,
    [contaId],
  );
  return normalizarConfig(l?.auto_cfg);
}

/** Grava a config inteira, ja saneada. Devolve o que ficou gravado — a tela
 *  precisa refletir o valor CORRIGIDO, e nao o que ela mandou. */
export async function salvarConfig(contaId: string, bruto: unknown): Promise<ConfigAuto> {
  const cfg = normalizarConfig(bruto);
  await query(
    `INSERT INTO robot_sessions (link_id, auto_cfg) VALUES ($1, $2)
     ON CONFLICT (link_id) DO UPDATE SET auto_cfg = $2, updated_at = now()`,
    [contaId, JSON.stringify(cfg)],
  );
  return cfg;
}
