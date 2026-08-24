import "server-only";
import { createHash } from "node:crypto";
import { query, queryOne } from "@/lib/robo/db";

/**
 * O DESTAQUE DA HOME — quem esta EM ALTA agora.
 *
 * A home mostrava o numero 1 da tier list. Como afirmacao era boa; como pagina
 * inicial, era estatica: o mais forte do jogo nao muda, entao a home nunca
 * mudava. Agora ela mostra o pokemon mais pesquisado nas ultimas 24 horas.
 *
 * ## O mandato de tres dias saiu, e por que ele estava errado
 *
 * O primeiro desenho contava tres dias e dava tres dias de reinado ao vencedor.
 * Parecia razoavel e tinha um defeito de conceito: com mandato, o card mostra
 * sempre o campeao da janela ANTERIOR — o que estava em alta tres dias atras.
 * Um rotulo que diz "em alta" apontando pro passado e uma mentira educada.
 *
 * O que ficou nao tem mandato nem estado: "em alta" e uma CONSULTA sobre janela
 * rolante, respondida na hora. Sem linha pra guardar, sem apuracao pra rodar,
 * sem virada pra sincronizar — some junto a corrida entre duas visitas no
 * instante da troca, que era a parte mais delicada da versao com mandato.
 *
 * ## As regras
 *
 * - conta uso nas ferramentas (calculadora, hunt, breeding, meta) e a abertura
 *   da ficha da dex, todos com o mesmo peso;
 * - **"preencher exemplo" NAO conta**: o pokemon dali nao foi escolhido por
 *   ninguem, e um botao que enche a tela pra ensinar. Contar ele faria o
 *   destaque medir o proprio tutorial, e como o exemplo e sempre o mesmo, ele
 *   ganharia pra sempre;
 * - vence quem tem mais VOTANTES distintos na janela, nao mais eventos.
 *
 * ## A escada de queda
 *
 * 24 horas -> 7 dias -> semente. Site pequeno tem madrugada sem visita nenhuma,
 * e "em alta" com zero voto nao pode virar tela vazia: a janela larga cobre o
 * silencio curto, e a semente (o topo da tier list, que era o criterio antigo)
 * cobre o silencio total.
 */

/** A janela que responde "agora". */
const JANELA_H = 24;

/** A janela de RESERVA, pra quando as 24h vierem vazias. */
const JANELA_LARGA_H = 24 * 7;

/**
 * Quanto tempo a home segura a resposta antes de reperguntar.
 *
 * Cinco minutos e o meio-termo entre duas coisas que puxam pra lados opostos: a
 * home e dinamica e sem cache toda visita vira consulta, e "em alta" que so muda
 * de hora em hora nao e em alta. Cinco minutos tambem estabiliza a tela — dois
 * pokemon trocando a lideranca nao fazem o card piscar a cada F5.
 */
const CACHE_MS = 5 * 60_000;

/** Alem de quantos dias o registro de uso nao serve mais pra nada. Um a mais que
 *  a janela larga: o que nao entra nem na reserva so ocupa espaco. */
const RETENCAO_DIAS = 8;

export interface Destaque {
  pokeId: number;
  /** quantos votantes distintos o elegeram — 0 quando veio da semente */
  votos: number;
  /** de que janela veio a resposta, pra a tela poder ser honesta se quiser */
  janela: "24h" | "7d" | "semente";
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
    await podar();
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
 * Quem esta em alta agora.
 *
 * `semente` e quem assume quando nao ha voto nenhum nem na janela larga — na
 * estreia, e em qualquer periodo de silencio total. Ela e o topo da tier list,
 * que era o criterio antigo: se ninguem pesquisou nada, "o mais forte" continua
 * sendo a melhor resposta disponivel.
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
  votos: 0,
  janela: "semente",
});

/** O mais votado numa janela de N horas, ou null se a janela estiver vazia. */
async function liderDe(horas: number): Promise<{ pokeId: number; votos: number } | null> {
  const linha = await queryOne<{ poke_id: number; votos: string }>(
    `SELECT poke_id, COUNT(*) AS votos
       FROM destaque_uso
      WHERE criado >= now() - ($1::int * interval '1 hour')
      GROUP BY poke_id
      -- O desempate e EXPLICITO, e nao capricho: sem ele o Postgres devolve o
      -- que quiser entre os empatados, e a home passaria a mostrar um vencedor
      -- diferente a cada consulta enquanto durasse o empate. Mais votos, depois
      -- o voto mais recente (empate entre iguais vai pra quem esta subindo),
      -- depois o menor id pra fechar de vez.
      ORDER BY votos DESC, MAX(criado) DESC, poke_id ASC
      LIMIT 1`,
    [horas],
  );
  return linha ? { pokeId: linha.poke_id, votos: Number(linha.votos) } : null;
}

async function apurar(semente: number): Promise<Destaque> {
  if (!temBanco()) return sementeComo(semente);

  const perto = await liderDe(JANELA_H);
  if (perto) return { ...perto, janela: "24h" };

  const longe = await liderDe(JANELA_LARGA_H);
  if (longe) return { ...longe, janela: "7d" };

  return sementeComo(semente);
}

/**
 * Poda o registro velho.
 *
 * Chamada pelo registro de uso, e nao pela leitura: a home e lida muitas vezes
 * por minuto e um DELETE por visita seria absurdo, enquanto o registro acontece
 * quando alguem escolhe um pokemon — bem mais raro. O sorteio faz isso rodar
 * ~1 vez a cada 200 escolhas, que pra uma tabela que ganha algumas centenas de
 * linhas por dia e mais que suficiente.
 */
async function podar(): Promise<void> {
  if (Math.random() > 1 / 200) return;
  await query("DELETE FROM destaque_uso WHERE criado < now() - ($1::int * interval '1 day')", [
    RETENCAO_DIAS,
  ]);
}
