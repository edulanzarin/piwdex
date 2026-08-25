// A pergunta do Stadium na URL. Mesmo contrato das outras telas.
//
// Aqui o link é a metade do produto. Um time montado contra um boss é uma
// PROPOSTA — "olha, com esses seis dá" — e proposta se manda pro grupo. Sem URL,
// mandar um time de seis vira print de tela com trinta números que ninguém
// confere e que o outro não consegue editar pra testar a ideia dele.
//
// O time viaja num parâmetro só, e não em seis. `t=6.100.1,9.100.1,...` cabe num
// link do Discord; `t1=6&t1lv=100&t1q=1&t2=9&...` são dezoito parâmetros e um
// link que quebra na primeira quebra de linha.

/**
 * Um lugar no time.
 *
 * Ele carrega os SEIS STATS, e não a receita pra calculá-los. É o que separa
 * "um Charizard 300 médio" do SEU Charizard: o IV é justamente o número que o
 * jogo esconde, então derivar os stats de `nível + quality + IV suposto` faria
 * o combate responder sobre um pokémon que não é o seu.
 *
 * `carta` é o id na bolsa, e ele NÃO viaja na URL — id de `localStorage` não
 * quer dizer nada no navegador de outra pessoa. Ele existe pra a tela saber que
 * aquele slot veio de uma carta (e poder abrir a edição dela); quem recebe o
 * link recebe os números, que é o que importa.
 */
export interface SlotState {
  /** pokeId da espécie; null = slot vazio */
  id: number | null;
  level: number;
  quality: number;
  /** os seis stats como o jogo mostra, ordem canônica */
  stats: number[];
  /** id da carta na bolsa de onde este slot veio; null = digitado à mão */
  carta: string | null;
}

export interface StadiumState {
  /** chave do boss do catálogo do jogo; "" = alvo montado à mão */
  boss: string;
  /** de onde a pessoa está escolhendo o alvo: a lista de bosses ou o catálogo
   *  inteiro de espécies. Abre em `boss`, que é a pergunta da ferramenta. */
  fonte: "boss" | "livre";
  /** espécie do alvo — preenchida pelo boss ou escolhida direto */
  alvo: number | null;
  alvoLv: number;
  alvoQ: number;
  /** o alvo leva o reforço de SELVAGEM: HP x5 e dano x1.8 */
  reforco: boolean;
  /**
   * Os seis stats do alvo, quando se conhece.
   *
   * Vazio (tudo zero) = a tela projeta de nível, quality e IV. Preenchido = são
   * os números que a pessoa leu no jogo, e aí não se projeta nada — é o caso do
   * boss, cuja vida só aparece na barra durante o combate.
   */
  alvoStats: number[];
  /** `Elemento: Neutro` na ficha do boss: ninguém tem vantagem, nos dois sentidos */
  neutro: boolean;
  time: SlotState[];
  pool: "natural" | "tm";
  /** IV suposto pro ALVO, que é o único lado sem stats publicados */
  iv: "medio" | "perfeito";
  /** nome do deck aberto; "" = time montado na hora */
  deck: string;
}

export const SLOTS = 6;

const PADRAO_NIVEL = 100;
const PADRAO_QUALITY = 1;

/**
 * Um slot vazio NOVO, a cada chamada.
 *
 * É função e não constante porque o slot carrega um array. Espalhar um objeto
 * (`{ ...SLOT_VAZIO }`) copia a REFERÊNCIA do array, então os seis slots do time
 * dividiriam o mesmo `stats` — e o dia em que alguém escrever nele em vez de
 * trocá-lo por outro, os seis mudam juntos. Defeito que não dá erro e só aparece
 * como número estranho na tela.
 */
export const slotVazio = (): SlotState => ({
  id: null,
  level: 100,
  quality: 1,
  stats: [0, 0, 0, 0, 0, 0],
  carta: null,
});

export const EMPTY_STADIUM: StadiumState = {
  boss: "",
  fonte: "boss",
  alvo: null,
  alvoLv: 100,
  alvoQ: 1,
  // Liga por padrão: quem abre o Stadium veio medir BOSS, e boss no jogo é
  // reforçado. Abrir sem reforço mostraria um combate que não existe e faria
  // todo time parecer melhor do que é.
  reforco: true,
  alvoStats: [0, 0, 0, 0, 0, 0],
  // Boss no jogo é Neutro (a ficha do Ancient Aero diz isso), e o Stadium abre
  // em boss. Alvo montado à mão desliga.
  neutro: true,
  time: Array.from({ length: SLOTS }, () => slotVazio()),
  pool: "natural",
  iv: "medio",
  deck: "",
};

const num = (v: string | null, fallback: number): number => {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const id = (v: string | null | undefined): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const oneOf = <T extends string>(v: string | null, valid: readonly T[], fallback: T): T =>
  (valid as readonly string[]).includes(v ?? "") ? (v as T) : fallback;

const POOLS = ["natural", "tm"] as const;
const IVS = ["medio", "perfeito"] as const;

/** `6.100.1.5.120-126-120-151-127-142` -> id, nível, quality e os seis stats.
 *  Slot vazio é string vazia, pra a POSIÇÃO não se perder. */
function parseSlot(txt: string): SlotState {
  const [i, l, q, st] = txt.split(".");
  const pid = id(i);
  if (pid == null) return slotVazio();
  const bruto = (st ?? "").split("-");
  return {
    id: pid,
    level: Math.max(1, Math.round(num(l ?? null, PADRAO_NIVEL))),
    quality: Math.max(0, num(q ?? null, PADRAO_QUALITY)),
    stats: Array.from({ length: 6 }, (_, k) => Math.max(0, Math.round(num(bruto[k] ?? null, 0)))),
    carta: null,
  };
}

export function parseStadiumState(sp: URLSearchParams): StadiumState {
  const bruto = (sp.get("t") ?? "").split(",");
  const boss = sp.get("boss") ?? "";
  return {
    boss,
    // Link com boss abre na lista de bosses; link só com espécie abre no
    // catálogo. O parâmetro existe pra quem montou o alvo à mão e quer que o
    // link abra do jeito que ele deixou.
    fonte: sp.get("fonte") === "livre" || (!boss && sp.get("a") != null) ? "livre" : "boss",
    alvo: id(sp.get("a")),
    alvoLv: Math.max(1, Math.round(num(sp.get("alv"), EMPTY_STADIUM.alvoLv))),
    alvoQ: Math.max(0, num(sp.get("aq"), EMPTY_STADIUM.alvoQ)),
    // Ausente é o PADRÃO (ligado), e só o "0" explícito desliga. Escrever a
    // ausência como desligado deixaria todo link antigo abrir sem reforço.
    reforco: sp.get("reforco") !== "0",
    alvoStats: (() => {
      const b = (sp.get("as") ?? "").split("-");
      return Array.from({ length: 6 }, (_, i) => Math.max(0, Math.round(num(b[i] ?? null, 0))));
    })(),
    neutro: sp.get("neutro") !== "0",
    time: Array.from({ length: SLOTS }, (_, i) => parseSlot(bruto[i] ?? "")),
    pool: oneOf(sp.get("golpes"), POOLS, EMPTY_STADIUM.pool),
    iv: oneOf(sp.get("iv"), IVS, EMPTY_STADIUM.iv),
    // O nome do deck viaja pra quem recebe o link saber COMO o time se chama.
    // O deck em si não: ele é referência a carta da bolsa, que só existe aqui.
    deck: (sp.get("deck") ?? "").slice(0, 32),
  };
}

/** Um slot vira `id.nível.quality`; vazio vira string vazia, pra a POSIÇÃO não se
 *  perder. Time com o slot 3 vazio é `a,b,,d` — quem entra em que ordem é o que a
 *  pessoa decidiu, e reordenar em silêncio no link mudaria o combate. */
function writeSlot(s: SlotState): string {
  if (s.id == null) return "";
  return `${s.id}.${s.level}.${Number(s.quality.toFixed(3))}.${s.stats.join("-")}`;
}

export function buildStadiumSearch(s: StadiumState): string {
  const p = new URLSearchParams();
  const put = (k: string, v: string | number, padrao: string | number) => {
    if (v !== padrao) p.set(k, String(v));
  };
  put("boss", s.boss, "");
  if (s.fonte !== EMPTY_STADIUM.fonte) p.set("fonte", s.fonte);
  if (s.alvo != null) p.set("a", String(s.alvo));
  put("alv", s.alvoLv, EMPTY_STADIUM.alvoLv);
  put("aq", Number(s.alvoQ.toFixed(3)), EMPTY_STADIUM.alvoQ);
  if (!s.reforco) p.set("reforco", "0");
  if (s.alvoStats.some((v) => v > 0)) p.set("as", s.alvoStats.join("-"));
  if (!s.neutro) p.set("neutro", "0");
  const time = s.time.map(writeSlot);
  // `replace` tira só as vírgulas do FIM: slot vazio no meio continua ocupando a
  // casa dele.
  const juntos = time.join(",").replace(/,+$/, "");
  if (juntos) p.set("t", juntos);
  put("golpes", s.pool, EMPTY_STADIUM.pool);
  put("iv", s.iv, EMPTY_STADIUM.iv);
  put("deck", s.deck, "");
  const str = p.toString();
  return str ? `?${str}` : "";
}
