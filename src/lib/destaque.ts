import "server-only";
import { createHash } from "node:crypto";
import { query, queryOne } from "@/lib/robo/db";

/**
 * O DESTAQUE DA HOME — quem esta em alta, e nao quem e o mais forte.
 *
 * A home mostrava o numero 1 da tier list. Como afirmacao era boa; como pagina
 * inicial, era estatica: o mais forte do jogo nao muda, entao a home nunca
 * mudava. Agora ela mostra o pokemon mais PESQUISADO, num reinado de tres dias.
 *
 * ## As regras, como o Eduardo desenhou
 *
 * - conta uso nas ferramentas (calculadora, hunt, breeding, meta) e a abertura
 *   da ficha da dex, todos com o mesmo peso;
 * - **"preencher exemplo" NAO conta**: o pokemon dali nao foi escolhido por
 *   ninguem, e um botao que enche a tela pra ensinar. Contar ele faria o
 *   destaque medir o proprio tutorial;
 * - o reinado dura tres dias; no fim, quem teve mais votantes DENTRO do reinado
 *   assume os proximos tres;
 * - o campeao pode se reeleger. O rotulo na tela e "EM ALTA" e nao "o mais
 *   pesquisado" justamente por isso — a segunda frase promete um metodo que
 *   empate, repeticao e janela vazia nao cumprem.
 *
 * ## Rotacao PREGUICOSA, sem agendador
 *
 * Nao ha cron no servico da dex, e nao precisa: a apuracao acontece na primeira
 * visita depois de o reinado vencer. Isso se auto-conserta (um dia sem visita
 * nenhuma nao deixa o sistema num estado invalido, so adia a troca) e nao
 * adiciona uma peca que pode falhar em silencio no meio da madrugada.
 */

/** Dias de reinado. */
const DIAS = 3;

/** Quanto tempo a home segura a resposta antes de reperguntar ao banco.
 *  A home e dinamica: sem isto, toda visita vira uma consulta pra ler uma linha
 *  que muda a cada tres dias. */
const CACHE_MS = 60_000;

/** Alem de quantos dias o registro de uso deixa de servir pra alguma coisa.
 *  Duas janelas de reinado: o suficiente pra apurar mesmo se uma apuracao
 *  atrasar, e pouco o bastante pra tabela nao crescer pra sempre. */
const RETENCAO_DIAS = DIAS * 2 + 1;

export interface Destaque {
  pokeId: number;
  /** quando este reinado termina */
  ate: Date;
  /** quantos votantes distintos elegeram este — 0 quando veio da semente */
  votos: number;
}

/**
 * O identificador do VOTANTE, e por que ele e assim.
 *
 * Ele existe pra uma unica coisa: dizer se dois pedidos vieram da mesma pessoa
 * HOJE. Nao guarda IP, nao serve pra ligar duas visitas em dias diferentes (o dia
 * entra no hash) e nao serve pra ligar este site a lugar nenhum (o segredo
 * entra). E deduplicacao, nao identificacao.
 *
 * Sem ele, "mais pesquisado" vira "quem apertou F5 mais vezes".
 */
export function idDoVotante(ip: string, ua: string, dia: string): string {
  const sal = process.env.DESTAQUE_SALT ?? "piwdex";
  return createHash("sha256").update(`${sal}|${dia}|${ip}|${ua}`).digest("hex").slice(0, 32);
}

const hoje = (): string => new Date().toISOString().slice(0, 10);

/** Registra um uso. Falha em silencio de proposito — ver `temBanco`. */
export async function registrarUso(pokeId: number, votante: string): Promise<void> {
  if (!temBanco() || !Number.isInteger(pokeId) || pokeId <= 0) return;
  try {
    await query(
      `INSERT INTO destaque_uso (poke_id, dia, votante) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [pokeId, hoje(), votante],
    );
  } catch {
    // Contagem de destaque nunca pode derrubar uma ferramenta. Ver `temBanco`.
  }
}

/**
 * Ha banco?
 *
 * O servico da dex subiu a vida inteira SEM banco — quem tem Postgres e o do
 * robo. Enquanto o `DATABASE_URL` nao estiver anexado la, tudo aqui precisa ser
 * inerte: a home cai na semente (o topo da tier list, que e o comportamento
 * antigo) e os registros viram no-op.
 *
 * Isto nao e defensividade decorativa. Se a leitura do destaque puder lancar, um
 * banco fora do ar derruba a HOME — a pagina mais visitada do site — por causa de
 * um enfeite. O destaque e a ultima coisa que pode ter poder de veto sobre ela.
 */
const temBanco = (): boolean => Boolean(process.env.DATABASE_URL);

let cache: { valor: Destaque; ate: number } | null = null;

/**
 * O destaque de agora.
 *
 * `semente` e quem assume quando nao ha nada apurado — na estreia e em qualquer
 * janela que termine sem um voto sequer. Ela e o topo da tier list, que era o
 * criterio antigo: se ninguem pesquisou nada, "o mais forte" continua sendo a
 * melhor resposta disponivel.
 */
export async function destaqueAtual(semente: number): Promise<Destaque> {
  const agora = Date.now();
  if (cache && cache.ate > agora) return cache.valor;

  const valor = await apurar(semente).catch(() => sementeComo(semente));
  cache = { valor, ate: agora + CACHE_MS };
  return valor;
}

const sementeComo = (pokeId: number): Destaque => ({
  pokeId,
  ate: new Date(Date.now() + DIAS * 86_400_000),
  votos: 0,
});

async function apurar(semente: number): Promise<Destaque> {
  if (!temBanco()) return sementeComo(semente);

  const atual = await queryOne<{ poke_id: number; fim: Date }>(
    "SELECT poke_id, fim FROM destaque_reinado WHERE id = 1",
  );

  if (atual && atual.fim.getTime() > Date.now()) {
    return { pokeId: atual.poke_id, ate: atual.fim, votos: 0 };
  }

  // O reinado venceu (ou nunca existiu): apura a janela que acabou.
  //
  // A janela e o proprio reinado. Contar "os ultimos tres dias" independente do
  // reinado pareceria igual e nao e: numa apuracao atrasada, os dois recortes
  // divergem e a home passaria a premiar uso que ja pertenceu a outro mandato.
  const desde = atual?.fim ?? new Date(Date.now() - DIAS * 86_400_000);
  const vencedor = await queryOne<{ poke_id: number; votos: string }>(
    `SELECT poke_id, COUNT(*) AS votos
       FROM destaque_uso
      WHERE criado >= $1
      GROUP BY poke_id
      -- Empate desempata pelo MENOR id, e nao por ordem de chegada: sem o
      -- criterio explicito o Postgres devolve o que quiser e a home passa a
      -- mostrar um vencedor diferente a cada consulta durante o empate.
      ORDER BY votos DESC, poke_id ASC
      LIMIT 1`,
    [desde],
  );

  const eleito = vencedor?.poke_id ?? atual?.poke_id ?? semente;
  const votos = Number(vencedor?.votos ?? 0);
  const fim = new Date(Date.now() + DIAS * 86_400_000);

  // Grava so se o fim registrado continuar no passado. Duas visitas simultaneas
  // no instante da virada disputam esta linha, e a condicao faz a segunda
  // perder de forma inofensiva em vez de esticar o mandato do vencedor.
  await query(
    `INSERT INTO destaque_reinado (id, poke_id, inicio, fim)
     VALUES (1, $1, now(), $2)
     ON CONFLICT (id) DO UPDATE
        SET poke_id = EXCLUDED.poke_id, inicio = now(), fim = EXCLUDED.fim
      WHERE destaque_reinado.fim <= now()`,
    [eleito, fim],
  );

  // Poda o que nao serve mais. Roda junto da apuracao — a cada tres dias, e nao
  // a cada visita — entao nao precisa de rotina propria.
  await query("DELETE FROM destaque_uso WHERE dia < current_date - $1::int", [RETENCAO_DIAS]);

  const gravado = await queryOne<{ poke_id: number; fim: Date }>(
    "SELECT poke_id, fim FROM destaque_reinado WHERE id = 1",
  );
  return gravado
    ? { pokeId: gravado.poke_id, ate: gravado.fim, votos }
    : { pokeId: eleito, ate: fim, votos };
}
