/**
 * A rede embaixo do processo do robô.
 *
 * O robô não é um servidor sem estado. Um servidor de HTTP pode morrer numa
 * exceção e a plataforma o levanta de novo sem prejuízo: o request perdido o
 * cliente repete. Aqui não — o processo segura um WebSocket por conta, e o valor
 * inteiro do produto é o tempo em que ninguém está olhando. Morrer significa
 * derrubar a caçada de TODO MUNDO por causa de um frame que uma conta recebeu.
 *
 * Por isso este arquivo faz o que a documentação do Node desaconselha por padrão:
 * segura `uncaughtException` e NÃO sai. A escolha é consciente e o custo é real —
 * o processo continua com estado que ninguém auditou depois do erro. O que
 * inclina a decisão é a forma do estado aqui: cada `SessaoJogo` é independente,
 * não há invariante compartilhada entre elas além do registro que as guarda, e o
 * pior caso de seguir vivo é UMA sessão inconsistente que o próprio motor
 * reconecta. O pior caso de morrer são vinte caçadas paradas até alguém abrir a
 * tela — e "ninguém abre a tela" é a condição em que o robô trabalha.
 *
 * Isto é a ÚLTIMA rede, não a primeira. O lugar certo de tratar erro é onde ele
 * acontece, com o dono da conta sabendo (ver `protegido` em `sessao.ts`). O que
 * chega aqui é, por definição, o que ninguém previu — e por isso sai no log com
 * a palavra que dá pra procurar depois.
 *
 * O serviço da DEX não instala nada disto, e isso também é de propósito: lá o
 * estado é nenhum e morrer cedo é o comportamento certo.
 */

interface Contador {
  excecoes: number;
  rejeicoes: number;
  ultimo: { quando: string; erro: string } | null;
}

/**
 * No `globalThis` pela mesma razão do registro de sessões: o HMR do `next dev`
 * reavalia o módulo a cada save, e sem isto cada reavaliação empilharia mais um
 * listener no mesmo processo — até o Node avisar que passou de dez e o log virar
 * dez cópias da mesma linha.
 */
const chave = Symbol.for("piwdex.robo.guarda");
const G = globalThis as unknown as Record<symbol, Contador | undefined>;

const contador = (): Contador =>
  (G[chave] ??= { excecoes: 0, rejeicoes: 0, ultimo: null });

let instalada = false;

const descrever = (e: unknown): string =>
  e instanceof Error ? `${e.name}: ${e.message}` : String(e);

/**
 * Instala a rede. Idempotente: chamar duas vezes não duplica listener.
 */
export function instalarGuarda(): void {
  if (instalada) return;
  instalada = true;
  const c = contador();

  process.on("uncaughtException", (e) => {
    c.excecoes++;
    c.ultimo = { quando: new Date().toISOString(), erro: descrever(e) };
    console.error("[robo] EXCECAO NAO TRATADA — o processo seguiu vivo de proposito:", e);
  });

  /**
   * Rejeição sem `catch`. Desde o Node 15 o padrão é derrubar o processo, o que
   * transforma um `void this.algumaCoisa()` esquecido em queda geral. Segurar
   * aqui é o mesmo trato do `uncaughtException`, e a mesma razão.
   */
  process.on("unhandledRejection", (motivo) => {
    c.rejeicoes++;
    c.ultimo = { quando: new Date().toISOString(), erro: descrever(motivo) };
    console.error("[robo] PROMESSA REJEITADA SEM TRATO — o processo seguiu vivo de proposito:", motivo);
  });

  console.info("[robo] guarda de processo instalada");
}

/**
 * Quanto a rede já aparou.
 *
 * Existe pra a saúde do serviço poder DIZER isso. Um contador que ninguém lê
 * seria só uma forma mais lenta de esconder o problema: o robô sobreviver a
 * cinquenta exceções por hora não é o robô estando bem, é o robô mascarando algo
 * que precisa de conserto na origem.
 */
export function saudeDaGuarda(): Contador {
  return { ...contador() };
}
