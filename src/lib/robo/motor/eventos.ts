import { query } from "@/lib/robo/db";

/**
 * O que o robo fez — gravado, e nao so emitido.
 *
 * O feed em memoria da sessao responde "o que esta acontecendo agora". Esta
 * tabela responde a outra pergunta, que e a que o robo existe pra responder: **o
 * que aconteceu enquanto eu dormia**. Um processo reinicia a cada deploy e leva
 * o feed junto; o valor do robo e justamente o tempo em que ninguem esta olhando.
 *
 * O criterio do que entra e estreito de proposito: cabe aqui o que o dono da
 * conta precisaria saber sem ter visto. Kill nao entra — sao milhares por hora
 * e o analyzer ja conta. Shiny entra. Venda entra. Recusa entra.
 */

export type TipoEvento =
  | "shiny" // capturou um shiny
  | "venda-item" // vendeu drop
  | "venda-poke" // vendeu pokemon
  | "compra" // repos consumivel
  | "cura" // passou na Joy / usou Revive
  | "religou" // a conexao caiu e voltou sozinha
  | "meta" // a cacada automatica chegou no nivel alvo
  | "recusado" // o jogo recusou a conta
  | "falha"; // uma automacao nao rodou (e por que)

export interface EventoRobo {
  id: string;
  tipo: TipoEvento;
  titulo: string;
  corpo: string | null;
  dado: Record<string, unknown> | null;
  em: string;
}

interface Linha {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  criado_em: string;
}

/** Teto por usuario. Acima disso, os mais antigos saem. */
const TETO = 800;
/** Janela do feed. 48h nao respondia "o que aconteceu anteontem de madrugada?",
 *  que e exatamente a pergunta pra qual esta tabela existe. */
const JANELA = "14 days";

/**
 * Grava. Fire-and-forget: uma falha de banco NUNCA derruba a cacada.
 *
 * O robo perder um registro e ruim; o robo parar de jogar porque o Postgres
 * hesitou e inaceitavel — e a ordem entre esses dois males e a unica coisa que
 * este `catch` vazio esta dizendo.
 */
export async function registrarEvento(
  userId: string,
  ev: { tipo: TipoEvento; titulo: string; corpo?: string | null; dado?: Record<string, unknown> | null },
): Promise<void> {
  try {
    await query(`INSERT INTO robot_events (user_id, kind, title, body, data) VALUES ($1, $2, $3, $4, $5)`, [
      userId,
      ev.tipo,
      ev.titulo,
      ev.corpo ?? null,
      ev.dado ? JSON.stringify(ev.dado) : null,
    ]);
    await query(
      `DELETE FROM robot_events WHERE user_id = $1 AND id NOT IN (
         SELECT id FROM robot_events WHERE user_id = $1 ORDER BY criado_em DESC LIMIT $2)`,
      [userId, TETO],
    );
    await query(
      `DELETE FROM robot_events WHERE user_id = $1 AND criado_em < now() - interval '${JANELA}'`,
      [userId],
    );
  } catch {
    /* ver o comentario acima: perder o registro custa menos que parar */
  }
}

export async function listarEventos(userId: string, limite = 60): Promise<EventoRobo[]> {
  const linhas = await query<Linha>(
    `SELECT id, kind, title, body, data, criado_em
       FROM robot_events WHERE user_id = $1
      ORDER BY criado_em DESC LIMIT $2`,
    [userId, Math.max(1, Math.min(200, limite))],
  ).catch(() => []);
  return linhas.map((l) => ({
    id: l.id,
    tipo: l.kind as TipoEvento,
    titulo: l.title,
    corpo: l.body,
    dado: l.data,
    em: l.criado_em,
  }));
}
