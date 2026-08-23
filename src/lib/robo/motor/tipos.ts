import type { ActivePoke } from "@/lib/robo/jogo/pokes";

/**
 * O contrato entre o motor e a tela.
 *
 * Vive separado de `sessao.ts` por um motivo mecanico, e nao de arrumacao: o
 * motor importa banco, `pg` e `node:crypto`, e o cockpit e componente de
 * CLIENTE. Um `import type` nao carregaria nada em runtime, mas o cockpit
 * tambem usa `estadoParado()` como valor inicial — e isso basta pro empacotador
 * arrastar o modulo inteiro pro navegador, onde `pg` tenta abrir `net`, `tls` e
 * `dns` e o build morre.
 *
 * Pela mesma razao, as formas que a TELA le moram aqui e nao no modulo que fala
 * com o jogo: `EstadoAuto` nasceria em `jogo/auto.ts`, que importa `auth.ts`,
 * que importa `node:crypto`.
 */

export interface Analyzer {
  kills: number;
  seconds: number;
  xpGained: number;
  lootItems: number;
  lootGold: number;
  ballsUsed: number;
  potionsUsed: number;
  supplyGold: number;
  captures: number;
  shinyCaptures: number;
  capturesGold: number;
  balance: number;
  goldPerHour: number;
  xpPerHour: number;
  killsPerHour: number;
  drops: { itemId: number; name: string; qty: number; gold: number }[];
}

/** Os campos ACUMULATIVOS — os unicos de que faz sentido tirar delta. */
const SOMAS: (keyof Analyzer)[] = [
  "kills", "seconds", "xpGained", "lootItems", "lootGold",
  "ballsUsed", "potionsUsed", "supplyGold", "captures", "shinyCaptures", "capturesGold",
];

export interface Evento {
  em: number;
  tipo: "kill" | "captura" | "compra" | "venda" | "cura" | "aviso";
  especie: string;
  shiny: boolean;
  xp: number;
  loot: { itemId: number; name: string; qty: number }[];
  bola?: string;
  /** ouro movimentado: negativo em compra, positivo em venda */
  ouro?: number;
}

/**
 * Um corpo na fila de captura.
 *
 * O jogo reenvia a lista INTEIRA a cada mudanca: cresce a cada kill, drena
 * conforme o auto-catch processa. No frame, `speciesId` vem com o nome `pokeId`
 * e e o numero da ESPECIE, nao o cuid do individuo.
 */
export interface NaFila {
  id: number;
  speciesId: number;
  nome: string;
  level: number;
  shiny: boolean;
  em: number;
}

/**
 * Uma mensagem do chat do jogo.
 *
 * O robo ja segura a sessao, entao o chat chega de graca: e o mesmo socket. O
 * parser e tolerante a nome de campo porque o formato nao e documentado, e o
 * que nao casar cai no ring de frames desconhecidos em vez de sumir.
 */
export interface Mensagem {
  id?: string;
  em: number;
  de: string;
  texto: string;
  canal: string;
  level?: number;
  vip?: boolean;
  admin?: boolean;
  /** mensagem SUA, ecoada pelo jogo */
  minha?: boolean;
}

export const CANAIS = ["world", "trade", "help"] as const;
export type Canal = (typeof CANAIS)[number];

export const CANAL_ROTULO: Record<string, string> = {
  world: "mundo",
  trade: "troca",
  help: "ajuda",
};

/** O estoque de bolas, ao vivo (frame `balls`). */
export interface BolaEstoque {
  id: number;
  nome: string;
  icone: string;
  quantidade: number;
  infinita: boolean;
}

/** A automacao NATIVA do jogo. `vipNoJogo` false = o autoCatch nao liga, e a
 *  tela precisa DIZER isso — senao o usuario liga, nada acontece, e a culpa cai
 *  no robo. */
export interface EstadoAuto {
  autoCatch: boolean;
  autoCatchBallId: number;
  autoCatchShiny: boolean;
  autoCatchShinyBallId: number;
  autoPotion: boolean;
  autoPotionThreshold: number;
  autoRevive: boolean;
  selectedBallId: number;
  vipNoJogo: boolean;
}

/** Uma faixa da subida: de que nivel a que nivel, cacando o que, e onde. */
export interface PassoRota {
  de: number;
  ate: number;
  slug: string;
  alvo: string;
  speciesId: number;
  xpH: number;
  goldH: number;
  horas: number;
  risco: "safe" | "risky" | "deadly";
}

/**
 * A conta do jogo, inteira.
 *
 * O painel mostrava nivel e ouro porque era so o que o motor lia. O resto ja
 * vinha na mesma resposta e estava sendo descartado — e e o que responde "como
 * esta a minha conta" sem abrir o jogo (que, com o robo ligado, custa a sessao).
 */
export interface Perfil {
  nome: string;
  level: number;
  gold: number;
  diamantes: number;
  capturas: number;
  vip: boolean;
  vipAte: string | null;
  xp: number | null;
  cla: string | null;
  profissao: string | null;
  /** dias seguidos de login, quando o jogo manda */
  sequencia: number | null;
  pescaria: number | null;
  passeNivel: number | null;
}

/** O que as automacoes fizeram NESTA sessao. */
export interface Placar {
  itensVendidos: number;
  ouroVendas: number;
  pokesVendidos: number;
  ouroPokes: number;
  bolasCompradas: number;
  pocoesCompradas: number;
  revivesComprados: number;
  ouroCompras: number;
}

export const placarZero = (): Placar => ({
  itensVendidos: 0, ouroVendas: 0, pokesVendidos: 0, ouroPokes: 0,
  bolasCompradas: 0, pocoesCompradas: 0, revivesComprados: 0, ouroCompras: 0,
});

/**
 * O status da sessao.
 *
 * Dois deles sao TERMINAIS, e essa distincao e a coisa mais util que este tipo
 * carrega: `bloqueado` (o jogo recusou a conta) e `vencido` (o token morreu) nao
 * melhoram com tentativa nenhuma. Tratar os dois como "caiu, tenta de novo" foi
 * exatamente o que produziu a tela que reconecta pra sempre sem cacar nada.
 */
export type StatusSessao =
  | "parado"
  | "conectando"
  | "rodando"
  | "chutado"
  | "erro"
  | "bloqueado"
  | "vencido";

/**
 * O ULTIMO fechamento do socket, cru.
 *
 * E a informacao que faltava pra tela poder dizer alguma coisa. O jogo fecha com
 * codigo e frase (4001 unauthorized, 4003 wrong-shard) e o motor antigo jogava
 * os dois fora — sobrava "sessão perdida", que descreve o sintoma de todos os
 * casos e o motivo de nenhum.
 */
export interface Fechamento {
  codigo: number | null;
  frase: string | null;
  em: number;
}

export interface EstadoHunt {
  status: StatusSessao;
  slug: string | null;
  desdeMs: number | null;
  analyzer: Analyzer | null;
  eventos: Evento[];
  fila: NaFila[];
  time: ActivePoke[];
  heroHp: number | null;
  heroMaxHp: number | null;
  caido: boolean;
  /**
   * O usuario quer a SESSAO segurada. Diferente de estar cacando.
   *
   * Ligar o robo e tomar a sessao de jogo da conta; cacar e um trabalho que roda
   * em cima dela, junto de vender, repor e falar no chat. Amarrar os dois
   * obrigava a escolher uma hunt pra fazer qualquer outra coisa, e passava por
   * desligar tudo pra trocar de cacada.
   */
  ligado: boolean;
  reconectando: boolean;
  proximaTentativaEm: number | null;
  motivoBloqueio: string | null;

  // --- diagnostico ---
  /** o ultimo fechamento cru: codigo e frase do jogo, sem traducao */
  fechamento: Fechamento | null;
  /** a leitura do motor sobre o estado atual, em uma frase */
  explicacao: string | null;
  /** o socket esta aberto AGORA */
  conectado: boolean;
  /** chegou frame `field` ha pouco — a cacada esta MESMO correndo */
  campoVivo: boolean;
  /** quantas vezes reconectou desde que foi ligado */
  reconexoes: number;
  shard: number | null;

  // --- a conta, ao vivo ---
  ouro: number | null;
  nivelTreinador: number | null;
  nivelLider: number | null;
  bolas: BolaEstoque[];
  auto: EstadoAuto | null;
  /** quantos pokemons fora do time */
  noBox: number;

  /** a conta inteira, do REST (nao disputa a sessao) */
  perfil: Perfil | null;

  /** a subida planejada, quando a cacada automatica esta ligada */
  rota: PassoRota[];
  /** a faixa que esta correndo agora */
  passoAtual: PassoRota | null;
  /** a rota terminou: o lider chegou no nivel alvo */
  rotaConcluida: boolean;

  /** o chat do jogo, ultimas mensagens */
  chat: Mensagem[];
  /** quando o proximo envio de chat e aceito (anti-flood do jogo) */
  chatLiberadoEm: number | null;

  placar: Placar;
}

// ---------------------------------------------------------------------------
// A config das automacoes
// ---------------------------------------------------------------------------

export interface ConfigAuto {
  // --- reposicao de consumivel (REST: nao disputa a sessao) ---
  comprarBola: boolean;
  pisoBola: number;
  alvoBola: number;
  /** qual bola repor. `null` = a mais barata da loja */
  bolaId: number | null;

  comprarPocao: boolean;
  pisoPocao: number;
  alvoPocao: number;
  pocaoId: number | null;

  comprarRevive: boolean;
  pisoRevive: number;
  alvoRevive: number;
  reviveId: number | null;

  /** teto de gasto por rodada de compra — a trava que impede zerar o ouro */
  tetoOuro: number;

  // --- venda de drop ---
  venderDrop: boolean;
  /** os itens que PODEM ser vendidos. Lista branca de proposito: uma lista
   *  negra venderia sozinha todo item novo que o jogo lancar. */
  dropIds: number[];

  // --- venda de pokemon ---
  venderPoke: boolean;
  manterShiny: boolean;
  /** IV total (0..186 no jogo) a partir do qual o bicho FICA */
  ivMinimo: number;
  /**
   * Qualidade a partir da qual o bicho FICA.
   *
   * Ela e um MULTIPLICADOR (1.0, 1.3, 1.7...), e nao um placar de 0 a 100. A tela
   * pede a faixa por nome (`qualityTier`) porque ninguem decide venda digitando
   * 1.7 — mas quem manda aqui e o numero, que e o que o jogo entrega.
   */
  qualidadeMinima: number;
  /** acima deste nivel o bicho FICA (nivel alto custou tempo) */
  nivelMinimo: number;
  /** especies que nunca sao vendidas */
  manterEspecies: number[];

  // --- cacada automatica ---
  /** o robo escolhe a hunt e troca sozinho conforme o lider sobe */
  autoRota: boolean;
  /** ate que nivel subir. Chegou la, a cacada para. */
  nivelAlvo: number;
}

export const CONFIG_PADRAO: ConfigAuto = {
  comprarBola: false,
  pisoBola: 150,
  alvoBola: 1000,
  bolaId: null,

  comprarPocao: false,
  pisoPocao: 25,
  alvoPocao: 100,
  pocaoId: null,

  comprarRevive: false,
  pisoRevive: 5,
  alvoRevive: 20,
  reviveId: null,

  tetoOuro: 50_000,

  venderDrop: false,
  dropIds: [],

  venderPoke: false,
  manterShiny: true,
  ivMinimo: 120,
  qualidadeMinima: 1.5,
  nivelMinimo: 30,
  manterEspecies: [],

  autoRota: false,
  nivelAlvo: 100,
};

const inteiro = (v: unknown, padrao: number, min = 0, max = 9_999_999): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.trunc(v))) : padrao;

const idOuNulo = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.trunc(v) : null;

const idsDe = (v: unknown): number[] =>
  Array.isArray(v)
    ? [...new Set(v.filter((x): x is number => typeof x === "number" && Number.isFinite(x) && x > 0))].map(Math.trunc)
    : [];

/**
 * Normaliza o que veio do banco ou da tela.
 *
 * O jsonb aceita qualquer forma, e a config e escrita por uma tela que muda —
 * ler sem sanear significaria o motor decidir compra com base num `pisoBola`
 * que veio como string. E o alvo abaixo do piso viraria compra em loop.
 */
export function normalizarConfig(bruto: unknown): ConfigAuto {
  const c = (bruto ?? {}) as Record<string, unknown>;
  const p = CONFIG_PADRAO;
  const cfg: ConfigAuto = {
    comprarBola: Boolean(c.comprarBola),
    pisoBola: inteiro(c.pisoBola, p.pisoBola, 0, 100_000),
    alvoBola: inteiro(c.alvoBola, p.alvoBola, 1, 100_000),
    bolaId: idOuNulo(c.bolaId),

    comprarPocao: Boolean(c.comprarPocao),
    pisoPocao: inteiro(c.pisoPocao, p.pisoPocao, 0, 100_000),
    alvoPocao: inteiro(c.alvoPocao, p.alvoPocao, 1, 100_000),
    pocaoId: idOuNulo(c.pocaoId),

    comprarRevive: Boolean(c.comprarRevive),
    pisoRevive: inteiro(c.pisoRevive, p.pisoRevive, 0, 100_000),
    alvoRevive: inteiro(c.alvoRevive, p.alvoRevive, 1, 100_000),
    reviveId: idOuNulo(c.reviveId),

    tetoOuro: inteiro(c.tetoOuro, p.tetoOuro, 0, 100_000_000),

    venderDrop: Boolean(c.venderDrop),
    dropIds: idsDe(c.dropIds),

    venderPoke: Boolean(c.venderPoke),
    manterShiny: c.manterShiny === undefined ? p.manterShiny : Boolean(c.manterShiny),
    ivMinimo: inteiro(c.ivMinimo, p.ivMinimo, 0, 186),
    qualidadeMinima:
      typeof c.qualidadeMinima === "number" && Number.isFinite(c.qualidadeMinima)
        ? Math.max(0, Math.min(10, c.qualidadeMinima))
        : p.qualidadeMinima,
    nivelMinimo: inteiro(c.nivelMinimo, p.nivelMinimo, 1, 1000),
    manterEspecies: idsDe(c.manterEspecies),

    autoRota: Boolean(c.autoRota),
    nivelAlvo: inteiro(c.nivelAlvo, p.nivelAlvo, 2, 1000),
  };

  // Alvo abaixo do piso e uma compra que nunca satisfaz a condicao que a
  // disparou: compra, continua abaixo do piso, compra de novo. Nao ha valor
  // "certo" a adivinhar aqui — so ha nao deixar o par se cruzar.
  if (cfg.alvoBola <= cfg.pisoBola) cfg.alvoBola = cfg.pisoBola + 1;
  if (cfg.alvoPocao <= cfg.pisoPocao) cfg.alvoPocao = cfg.pisoPocao + 1;
  if (cfg.alvoRevive <= cfg.pisoRevive) cfg.alvoRevive = cfg.pisoRevive + 1;

  // Vender drop sem lista branca venderia nada — mas com a chave ligada a tela
  // diria "ligado" e o usuario esperaria venda. Desliga e nao mente.
  if (cfg.venderDrop && !cfg.dropIds.length) cfg.venderDrop = false;

  return cfg;
}

// ---------------------------------------------------------------------------

/**
 * O analyzer do jogo e ACUMULATIVO por sessao de jogo, nao por cacada nossa.
 *
 * Sem subtrair uma base, trocar de hunt mostraria o ouro da anterior somado, e o
 * "ouro/hora desta hunt" seria a media de tudo que aconteceu desde o login.
 */
export function deltaAnalyzer(bruto: Analyzer, base: Analyzer | null): Analyzer {
  if (!base) return bruto;
  const out = { ...bruto } as Analyzer;
  for (const k of SOMAS) (out[k] as number) = Math.max(0, (bruto[k] as number ?? 0) - (base[k] as number ?? 0));
  out.balance = out.lootGold + out.capturesGold - out.supplyGold;
  const horas = out.seconds / 3600;
  out.goldPerHour = horas > 0 ? out.balance / horas : 0;
  out.xpPerHour = horas > 0 ? out.xpGained / horas : 0;
  out.killsPerHour = horas > 0 ? out.kills / horas : 0;
  // Os drops tambem sao cumulativos, item a item.
  const antes = new Map((base.drops ?? []).map((d) => [d.itemId, d]));
  out.drops = (bruto.drops ?? [])
    .map((d) => {
      const b = antes.get(d.itemId);
      return b ? { ...d, qty: d.qty - b.qty, gold: d.gold - b.gold } : d;
    })
    .filter((d) => d.qty > 0);
  return out;
}

/** O jogo zerou o analyzer por conta propria: algum acumulado voltou MENOR que a
 *  base, o que so acontece quando ele reiniciou a contagem. */
export const analyzerZerou = (bruto: Analyzer, base: Analyzer) =>
  SOMAS.some((k) => (bruto[k] as number ?? 0) < (base[k] as number ?? 0));

export function estadoParado(): EstadoHunt {
  return {
    status: "parado", slug: null, desdeMs: null, analyzer: null, eventos: [], fila: [],
    time: [], heroHp: null, heroMaxHp: null, caido: false,
    ligado: false, reconectando: false, proximaTentativaEm: null, motivoBloqueio: null,
    fechamento: null, explicacao: null, conectado: false, campoVivo: false,
    reconexoes: 0, shard: null,
    ouro: null, nivelTreinador: null, nivelLider: null, bolas: [], auto: null, noBox: 0,
    perfil: null, rota: [], passoAtual: null, rotaConcluida: false,
    chat: [], chatLiberadoEm: null,
    placar: placarZero(),
  };
}
