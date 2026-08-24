import { pedirAoJogo, type Tokens } from "@/lib/robo/jogo/auth";
import { gameAssetUrl } from "@/lib/robo/jogo/host";
import { escrever, type Escrita } from "@/lib/robo/jogo/loja";

/**
 * O que o jogo da de graca, e o comprador que paga mais.
 *
 * Tres coisas que ficavam de fora do robo porque nao passavam pela loja do NPC
 * nem pelo campo de cacada — e que sao, as tres, dinheiro parado:
 *
 *   diaria       um clique por dia, e o dia que passa nao volta.
 *   passe        missao concluida e tier alcancado ficam guardados esperando
 *                alguem clicar. O robo joga por horas; quem coleta e um humano
 *                que lembra.
 *   Flint        o NPC de Pewter compra PEDRA, e paga por unidade um preco que
 *                a loja comum nao paga. 413 Cocoon Stone a 5.000 sao dois
 *                milhoes que estavam na mochila.
 *
 * Tudo REST, como comprar e vender: nao disputa a sessao de jogo, entao acontece
 * com a cacada correndo.
 *
 * Contratos conferidos contra captura completa do jogo (ago/2026) — endpoint,
 * corpo e resposta. Nenhum deles foi adivinhado.
 */

const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const txt = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);

async function ler<T>(caminho: string, tokens: Tokens): Promise<{ dado: T; tokens: Tokens; mudou: boolean } | null> {
  const r = await pedirAoJogo(caminho, tokens).catch(() => null);
  if (!r || !r.res.ok) return null;
  const dado = (await r.res.json().catch(() => null)) as T | null;
  if (!dado) return null;
  return { dado, tokens: r.tokens, mudou: r.mudou };
}

// ---------------------------------------------------------------------------
// Diaria
// ---------------------------------------------------------------------------

export interface Diaria {
  /** ha premio pra pegar AGORA */
  podeColetar: boolean;
  jaColetouHoje: boolean;
  /** o dia da trilha que vem a seguir */
  proximoDia: number;
  /** o premio do dia atual, quando o jogo o marca */
  premio: string | null;
  /** o VIP trava a recompensa deste dia */
  travadoPorVip: boolean;
}

interface DiariaBruta {
  canClaim?: unknown;
  claimedToday?: unknown;
  nextDay?: unknown;
  blockedByVip?: unknown;
  rewards?: { label?: unknown; qty?: unknown; current?: unknown }[];
  claimed?: { label?: unknown; qty?: unknown } | null;
}

const daDiaria = (d: DiariaBruta): Diaria => {
  const atual = (d.rewards ?? []).find((r) => r.current);
  return {
    podeColetar: Boolean(d.canClaim),
    jaColetouHoje: Boolean(d.claimedToday),
    proximoDia: num(d.nextDay),
    premio: atual ? `${num(atual.qty, 1)}x ${txt(atual.label, "?")}` : null,
    travadoPorVip: Boolean(d.blockedByVip),
  };
};

export const lerDiaria = async (t: Tokens) => {
  const r = await ler<DiariaBruta>("/api/game/daily", t);
  return r ? { ...r, dado: daDiaria(r.dado) } : null;
};

/** Coleta. A resposta traz o que caiu, e e ela que vira a linha do registro. */
export async function coletarDiaria(t: Tokens): Promise<Escrita<{ claimed?: { label?: unknown; qty?: unknown } }>> {
  return escrever("/api/game/daily", t, {});
}

// ---------------------------------------------------------------------------
// Passe de batalha
// ---------------------------------------------------------------------------

export interface MissaoPasse {
  id: number;
  rotulo: string;
  bpp: number;
}
export interface TierPasse {
  tier: number;
  /** o premio gratuito ainda por pegar */
  gratis: string | null;
  /** o premio premium ainda por pegar (so faz sentido com passe premium) */
  premium: string | null;
}
export interface Passe {
  pontos: number;
  /** a conta tem o passe pago */
  temPremium: boolean;
  /** missoes CONCLUIDAS e ainda nao coletadas */
  missoes: MissaoPasse[];
  /** tiers ALCANCADOS com premio pendente */
  tiers: TierPasse[];
}

interface PasseBruto {
  points?: unknown;
  premium?: unknown;
  missions?: {
    id?: unknown; label?: unknown; done?: unknown; claimed?: unknown; bpp?: unknown;
  }[];
  tiers?: {
    tier?: unknown; reached?: unknown;
    free?: { label?: unknown } | null; freeClaimed?: unknown;
    prem?: { label?: unknown } | null; premClaimed?: unknown;
  }[];
}

const doPasse = (d: PasseBruto): Passe => {
  const temPremium = Boolean(d.premium);
  return {
    pontos: num(d.points),
    temPremium,
    // `done && !claimed` e a definicao inteira de "esta esperando": o jogo ja
    // reconheceu o feito e o premio segue guardado.
    missoes: (d.missions ?? [])
      .filter((m) => m.done && !m.claimed)
      .map((m) => ({ id: num(m.id), rotulo: txt(m.label, "missão"), bpp: num(m.bpp) })),
    tiers: (d.tiers ?? [])
      .filter((t) => t.reached && (!t.freeClaimed || (temPremium && !t.premClaimed)))
      .map((t) => ({
        tier: num(t.tier),
        gratis: t.freeClaimed ? null : txt(t.free?.label) || null,
        // Sem o passe pago, o premio premium existe na lista e NAO e seu: pedir
        // ele seria uma recusa por rodada, pra sempre.
        premium: temPremium && !t.premClaimed ? txt(t.prem?.label) || null : null,
      })),
  };
};

export const lerPasse = async (t: Tokens) => {
  const r = await ler<PasseBruto>("/api/game/battle-pass", t);
  return r ? { ...r, dado: doPasse(r.dado) } : null;
};

export const coletarMissao = (t: Tokens, missionId: number) =>
  escrever("/api/game/battle-pass", t, { action: "claim-mission", missionId });

export const coletarTier = (t: Tokens, tier: number, premium: boolean) =>
  escrever("/api/game/battle-pass", t, { action: "claim-tier", tier, premium });

// ---------------------------------------------------------------------------
// Flint — o comprador de pedra, em Pewter
// ---------------------------------------------------------------------------

export interface PedraNaBolsa {
  id: number;
  nome: string;
  icone: string;
  quantidade: number;
  /** o que o Flint paga por UNIDADE */
  precoUnidade: number;
}

export interface Flint {
  ouro: number;
  pedras: PedraNaBolsa[];
}

export const lerFlint = async (t: Tokens) => {
  const r = await ler<{ gold?: unknown; stones?: Record<string, unknown>[] }>("/api/game/flint", t);
  if (!r) return null;
  return {
    ...r,
    dado: {
      ouro: num(r.dado.gold),
      // So o que a bolsa TEM. O `catalog` da resposta e a lista do que ele
      // compraria, e oferecer isso na tela seria mostrar pedra que voce nao tem.
      pedras: (r.dado.stones ?? []).map((p) => ({
        id: num(p.id),
        nome: txt(p.name, "?"),
        icone: gameAssetUrl(txt(p.icon)),
        quantidade: num(p.quantity),
        precoUnidade: num(p.unitPrice),
      })),
    } as Flint,
  };
};

export const venderPedra = (t: Tokens, itemId: number, qty: number) =>
  escrever("/api/game/flint/sell", t, { itemId, qty });
