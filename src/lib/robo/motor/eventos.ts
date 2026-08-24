import { query, queryOne } from "@/lib/robo/db";

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
 *
 * Cada linha guarda DOIS donos, e os dois sao necessarios: `link_id` diz qual
 * conta de jogo fez, e `user_id` responde "o que aconteceu comigo" sem join —
 * com varias contas, o registro sem a primeira nao diz de quem foi a venda, e
 * sem a segunda o numero da aba precisaria de um join por minuto.
 */

export type TipoEvento =
  | "shiny" // VOCE capturou um shiny
  | "shiny-mundo" // outro jogador capturou (frame `shiny-global`)
  | "venda-item" // vendeu drop
  | "venda-poke" // vendeu pokemon
  | "compra" // repos consumivel
  | "coleta" // pegou diaria, missao ou tier do passe
  | "cura" // passou na Joy / usou Revive
  | "religou" // a conexao caiu e voltou sozinha
  | "meta" // a cacada automatica chegou no nivel alvo
  | "recusado" // o jogo recusou a conta
  | "falha"; // uma automacao nao rodou (e por que)

export interface EventoRobo {
  id: string;
  /** a conta de jogo que fez. `null` = o vinculo foi apagado depois */
  contaId: string | null;
  tipo: TipoEvento;
  titulo: string;
  corpo: string | null;
  dado: Record<string, unknown> | null;
  lido: boolean;
  em: string;
}

interface Linha {
  id: string;
  link_id: string | null;
  kind: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read_at: string | null;
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
  contaId: string | null,
  ev: { tipo: TipoEvento; titulo: string; corpo?: string | null; dado?: Record<string, unknown> | null },
): Promise<void> {
  try {
    await query(
      `INSERT INTO robot_events (user_id, link_id, kind, title, body, data)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, contaId, ev.tipo, ev.titulo, ev.corpo ?? null, ev.dado ? JSON.stringify(ev.dado) : null],
    );
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

/**
 * O registro do usuario, ou o de UMA conta.
 *
 * O padrao e o do usuario inteiro de proposito: com varias contas, "o que o robo
 * fez enquanto eu dormia" e a pergunta sobre todas elas. Filtrar por conta e
 * escolha da tela, e nao o caminho obrigatorio.
 */
export async function listarEventos(
  userId: string,
  limite = 60,
  contaId?: string | null,
): Promise<EventoRobo[]> {
  const linhas = await query<Linha>(
    `SELECT id, link_id, kind, title, body, data, read_at, criado_em
       FROM robot_events
      WHERE user_id = $1 AND ($3::uuid IS NULL OR link_id = $3)
      ORDER BY criado_em DESC LIMIT $2`,
    [userId, Math.max(1, Math.min(300, limite)), contaId ?? null],
  ).catch(() => []);
  return linhas.map((l) => ({
    id: l.id,
    contaId: l.link_id,
    tipo: l.kind as TipoEvento,
    titulo: l.title,
    corpo: l.body,
    dado: l.data,
    lido: l.read_at != null,
    em: l.criado_em,
  }));
}

/**
 * Quantos ainda nao foram vistos.
 *
 * Consulta propria, e nao `listarEventos().filter()`: o painel pergunta isso de
 * minuto em minuto so pra pintar um numero na aba, e trazer trezentas linhas pra
 * contar uma seria pagar a lista inteira por um inteiro.
 */
export async function contarNaoLidos(userId: string): Promise<number> {
  const l = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM robot_events WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  ).catch(() => null);
  return Number(l?.n ?? 0);
}

/** Marca tudo como visto. Abrir o registro E ter lido. */
export async function marcarLidos(userId: string): Promise<void> {
  await query(`UPDATE robot_events SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`, [
    userId,
  ]).catch(() => {});
}
