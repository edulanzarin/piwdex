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

export interface SlotState {
  /** pokeId da espécie; null = slot vazio */
  id: number | null;
  level: number;
  quality: number;
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
  /** o alvo leva o reforço do jogo: HP x5 e dano x1.8 */
  reforco: boolean;
  time: SlotState[];
  pool: "natural" | "tm";
  iv: "medio" | "perfeito";
}

export const SLOTS = 6;

export const SLOT_VAZIO: SlotState = { id: null, level: 100, quality: 1 };

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
  time: Array.from({ length: SLOTS }, () => ({ ...SLOT_VAZIO })),
  pool: "natural",
  iv: "medio",
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

/** `6.100.1.5` -> id 6, nível 100, quality 1,5. Slot vazio é string vazia. */
function parseSlot(txt: string): SlotState {
  const [i, l, q] = txt.split(".");
  const pid = id(i);
  if (pid == null) return { ...SLOT_VAZIO };
  return {
    id: pid,
    level: Math.max(1, Math.round(num(l ?? null, SLOT_VAZIO.level))),
    quality: Math.max(0, num(q ?? null, SLOT_VAZIO.quality)),
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
    time: Array.from({ length: SLOTS }, (_, i) => parseSlot(bruto[i] ?? "")),
    pool: oneOf(sp.get("golpes"), POOLS, EMPTY_STADIUM.pool),
    iv: oneOf(sp.get("iv"), IVS, EMPTY_STADIUM.iv),
  };
}

/** Um slot vira `id.nível.quality`; vazio vira string vazia, pra a POSIÇÃO não se
 *  perder. Time com o slot 3 vazio é `a,b,,d` — quem entra em que ordem é o que a
 *  pessoa decidiu, e reordenar em silêncio no link mudaria o combate. */
function writeSlot(s: SlotState): string {
  if (s.id == null) return "";
  return `${s.id}.${s.level}.${Number(s.quality.toFixed(3))}`;
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
  const time = s.time.map(writeSlot);
  // `replace` tira só as vírgulas do FIM: slot vazio no meio continua ocupando a
  // casa dele.
  const juntos = time.join(",").replace(/,+$/, "");
  if (juntos) p.set("t", juntos);
  put("golpes", s.pool, EMPTY_STADIUM.pool);
  put("iv", s.iv, EMPTY_STADIUM.iv);
  const str = p.toString();
  return str ? `?${str}` : "";
}
