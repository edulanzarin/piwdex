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
 *
 * Chaveado pela CONTA (`link_id`) desde a migration 004, e nao pelo usuario: um
 * assinante pode ter varias contas de jogo e cada uma quer estar ligada ou
 * parada por conta propria. `listarLigados` traz o dono junto porque o boot
 * precisa dos dois — a credencial e da conta, o registro de evento e do dono.
 */

export type ModoRobo = "manual" | "auto";

export interface Desejado {
  ligado: boolean;
  modo: ModoRobo;
  slug: string | null;
  ultimoStatus: string;
  ultimoErro: string | null;
  /** o que as automacoes ja fizeram, pra contagem sobreviver ao restart */
  placar: unknown;
}

interface Linha {
  link_id: string;
  user_id: string;
  enabled: boolean;
  mode: string;
  slug: string | null;
  last_status: string;
  last_error: string | null;
  placar: unknown;
}

const daLinha = (l: Linha): Desejado => ({
  ligado: l.enabled,
  modo: l.mode === "auto" ? "auto" : "manual",
  slug: l.slug,
  ultimoStatus: l.last_status,
  ultimoErro: l.last_error,
  placar: l.placar,
});

export async function lerDesejado(contaId: string): Promise<Desejado | null> {
  const l = await queryOne<Linha>(`SELECT * FROM robot_sessions WHERE link_id = $1`, [contaId]);
  return l ? daLinha(l) : null;
}

/** Quem o boot deve religar: uma entrada por CONTA ligada, com o dono junto. */
export async function listarLigados(): Promise<
  { contaId: string; userId: string; desejado: Desejado }[]
> {
  const linhas = await query<Linha>(
    `SELECT rs.*, gl.user_id
       FROM robot_sessions rs
       JOIN game_links gl ON gl.id = rs.link_id
      WHERE rs.enabled ORDER BY rs.updated_at DESC`,
  );
  return linhas.map((l) => ({ contaId: l.link_id, userId: l.user_id, desejado: daLinha(l) }));
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
  contaId: string,
  patch: Partial<Pick<Desejado, "ligado" | "modo" | "slug">>,
): Promise<void> {
  await query(
    `INSERT INTO robot_sessions (link_id, enabled, mode, slug)
     VALUES ($1, COALESCE($2, false), COALESCE($3, 'manual'), $4)
     ON CONFLICT (link_id) DO UPDATE SET
       enabled    = COALESCE($2, robot_sessions.enabled),
       mode       = COALESCE($3, robot_sessions.mode),
       slug       = CASE WHEN $5 THEN $4 ELSE robot_sessions.slug END,
       updated_at = now()`,
    [contaId, patch.ligado ?? null, patch.modo ?? null, patch.slug ?? null, "slug" in patch],
  );
}

/**
 * Grava o placar das automacoes.
 *
 * Fire-and-forget, como o status: perder uma atualizacao de contador custa um
 * numero; parar a cacada por causa do banco custa a noite inteira.
 */
export async function salvarPlacar(contaId: string, placar: unknown): Promise<void> {
  await query(
    `INSERT INTO robot_sessions (link_id, placar) VALUES ($1, $2)
     ON CONFLICT (link_id) DO UPDATE SET placar = $2, updated_at = now()`,
    [contaId, JSON.stringify(placar)],
  );
}

/** Ultimo status observado. Fire-and-forget: o motor nunca cai por causa disto. */
export async function salvarStatus(contaId: string, status: string, erro?: string | null): Promise<void> {
  await query(
    `INSERT INTO robot_sessions (link_id, last_status, last_error)
     VALUES ($1, $2, $3)
     ON CONFLICT (link_id) DO UPDATE SET last_status = $2, last_error = $3, updated_at = now()`,
    [contaId, status, erro ?? null],
  );
}
