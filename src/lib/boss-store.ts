// O que você descobriu sobre cada boss, guardado por boss.
//
// O jogo não publica stat nenhum de boss: nem vida, nem ataque, nem defesa. O
// Ancient Aero tem 72 mil de vida, e nenhuma conta sobre a espécie Aerodactyl
// chega perto disso — a estimativa dava 4,6 mil, quinze vezes menos.
//
// Quem lutou uma vez sabe mais do que qualquer fórmula, porque a barra de vida
// do boss está na tela durante o combate. Então o número certo é o que a pessoa
// digita, e o trabalho deste arquivo é ela digitar UMA vez: os stats corrigidos
// ficam presos à chave do boss e voltam sozinhos na próxima visita.
//
// (O piwtools resolve o mesmo problema cravando 130 em todos os seis stats de
// todo boss. É número inventado com cara de dado, e o custo aparece exatamente
// aqui: com 130 de vida onde há 72 mil, qualquer time "vence" em dois segundos.)
//
// Mora no `localStorage` porque é conhecimento pessoal, coletado jogando, e o
// site não tem login. Tudo que sai daqui é desconfiado, como na bolsa.

export interface BossConhecido {
  /** os seis stats, ordem canônica; vazio = ainda não corrigido */
  stats: number[];
  /** `Elemento: Neutro` na ficha do jogo */
  neutro: boolean;
}

const CHAVE = "piwdex.bosses.v1";
const LIMITE = 200;

function saneia(x: unknown): BossConhecido | null {
  if (!x || typeof x !== "object") return null;
  const b = x as Record<string, unknown>;
  const stats = Array.isArray(b.stats) ? b.stats.map(Number) : null;
  if (!stats || stats.length !== 6 || stats.some((v) => !Number.isFinite(v) || v < 0)) return null;
  return { stats: stats.map((v) => Math.max(0, Math.round(v))), neutro: b.neutro !== false };
}

export function lerBosses(): Record<string, BossConhecido> {
  if (typeof window === "undefined") return {};
  try {
    const cru = window.localStorage.getItem(CHAVE);
    if (!cru) return {};
    const obj: unknown = JSON.parse(cru);
    if (!obj || typeof obj !== "object") return {};
    const saida: Record<string, BossConhecido> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>).slice(0, LIMITE)) {
      const b = saneia(v);
      if (b) saida[k] = b;
    }
    return saida;
  } catch {
    return {};
  }
}

/** Guarda o que se sabe deste boss. `key` vazia (alvo montado à mão) não grava:
 *  sem chave não há o que recuperar depois. */
export function salvarBoss(key: string, b: BossConhecido): Record<string, BossConhecido> {
  const todos = lerBosses();
  if (!key) return todos;
  todos[key] = b;
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(todos));
  } catch {
    // Cota estourada ou janela privada: perder a correção é ruim, derrubar a
    // ferramenta por causa dela é pior.
  }
  return todos;
}

export function esquecerBoss(key: string): Record<string, BossConhecido> {
  const todos = lerBosses();
  delete todos[key];
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(todos));
  } catch {
    /* ver acima */
  }
  return todos;
}
