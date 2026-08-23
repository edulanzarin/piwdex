import { query, queryOne } from "@/lib/robo/db";

/**
 * O estado DESEJADO do robo — o que o usuario quer que aconteca.
 *
 * E diferente do estado vivo (socket aberto, analyzer correndo), que mora em
 * memoria e some com o processo. Este sobrevive, e e ele que permite as duas
 * coisas que fazem o robo parecer confiavel:
 *
 * 1. **Religar sozinho depois de um restart** — o boot le quem queria estar
 *    rodando e reconecta, em vez de esperar alguem abrir a tela.
 * 2. **O monitor ter o que mostrar** num processo recem-nascido, que ainda nao
 *    reconectou nada.
 *
 * A escrita de status e melhor-esforco: falha de banco nunca derruba a cacada.
 */

export type ModoRobo = "manual" | "auto";

export interface Desejado {
  ligado: boolean;
  modo: ModoRobo;
  slug: string | null;
  ultimoStatus: string;
  ultimoErro: string | null;
}

interface Linha {
  user_id: string;
  enabled: boolean;
  mode: string;
  slug: string | null;
  last_status: string;
  last_error: string | null;
}

const daLinha = (l: Linha): Desejado => ({
  ligado: l.enabled,
  modo: l.mode === "auto" ? "auto" : "manual",
  slug: l.slug,
  ultimoStatus: l.last_status,
  ultimoErro: l.last_error,
});

export async function lerDesejado(userId: string): Promise<Desejado | null> {
  const l = await queryOne<Linha>(`SELECT * FROM robot_sessions WHERE user_id = $1`, [userId]);
  return l ? daLinha(l) : null;
}

/** Quem o boot deve religar. */
export async function listarLigados(): Promise<{ userId: string; desejado: Desejado }[]> {
  const linhas = await query<Linha>(
    `SELECT * FROM robot_sessions WHERE enabled ORDER BY updated_at DESC`,
  );
  return linhas.map((l) => ({ userId: l.user_id, desejado: daLinha(l) }));
}

/**
 * Grava o desejo. Upsert PARCIAL: so o que veio no patch muda.
 *
 * O `slug` tem tratamento proprio porque `null` e um valor legitimo pra ele
 * ("parei a hunt"), e `COALESCE` nao distingue "nao mandei" de "mandei nulo" —
 * com ele, parar a hunt deixaria o slug antigo gravado e o proximo boot voltaria
 * pra uma cacada que o usuario tinha encerrado.
 */
export async function salvarDesejado(
  userId: string,
  patch: Partial<Pick<Desejado, "ligado" | "modo" | "slug">>,
): Promise<void> {
  await query(
    `INSERT INTO robot_sessions (user_id, enabled, mode, slug)
     VALUES ($1, COALESCE($2, false), COALESCE($3, 'manual'), $4)
     ON CONFLICT (user_id) DO UPDATE SET
       enabled    = COALESCE($2, robot_sessions.enabled),
       mode       = COALESCE($3, robot_sessions.mode),
       slug       = CASE WHEN $5 THEN $4 ELSE robot_sessions.slug END,
       updated_at = now()`,
    [userId, patch.ligado ?? null, patch.modo ?? null, patch.slug ?? null, "slug" in patch],
  );
}

/** Ultimo status observado. Fire-and-forget: o motor nunca cai por causa disto. */
export async function salvarStatus(userId: string, status: string, erro?: string | null): Promise<void> {
  await query(
    `INSERT INTO robot_sessions (user_id, last_status, last_error)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET last_status = $2, last_error = $3, updated_at = now()`,
    [userId, status, erro ?? null],
  );
}
