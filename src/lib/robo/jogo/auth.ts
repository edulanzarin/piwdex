/**
 * A sessao do jogador no JOGO — que nao e a sessao dele no piwdex.
 *
 * ## Por que o login e por TOKEN e nao por senha
 *
 * Nao e preguica nem atalho: o `/login` do jogo exige captcha amarrado ao
 * navegador, entao proxiar email e senha a partir do servidor simplesmente NAO
 * FUNCIONA. O caminho e o token — o jogador entra no jogo, copia o
 * `pokeweb:tokens` do localStorage e cola aqui.
 *
 * De brinde, e o modelo mais seguro que existia na mesa: a senha do jogo nunca
 * sai do jogo, e o pior caso de um vazamento nosso e um par de JWT com validade
 * curta, revogavel trocando a senha la.
 *
 * Contrato verificado contra o jogo:
 *   GET  /api/characters/me   Authorization: Bearer <access>  -> conta do jogador
 *   POST /api/auth/refresh    { refreshToken }                -> novos tokens
 *
 * Server-only (usa `node:crypto`). Importar so de route handler / motor.
 */

import crypto from "node:crypto";
import { GAME_HOST } from "./host";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export interface Tokens {
  access: string;
  /** opcional: so com o access da pra conectar, mas sem renovacao automatica */
  refresh?: string;
}

// ---------------------------------------------------------------------------
// Cifra dos tokens (AES-256-GCM, chave derivada de SESSION_SECRET).
//
// Eles vao cifrados pro banco. Trocar `SESSION_SECRET` invalida todo vinculo
// existente — o decifrar falha e o codigo trata como "sem vinculo", que e o
// comportamento certo: melhor pedir reconexao do que operar com credencial que
// nao se sabe ler.
// ---------------------------------------------------------------------------
function chave(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET ausente ou curto — defina no .env (openssl rand -base64 48).");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function cifrar(plano: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", chave(), iv);
  const enc = Buffer.concat([cipher.update(plano, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
}

export function decifrar(valor: string | undefined | null): string | null {
  if (!valor) return null;
  try {
    const buf = Buffer.from(valor, "base64url");
    const d = crypto.createDecipheriv("aes-256-gcm", chave(), buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// O que o jogador cola: o valor cru do `pokeweb:tokens`, ou dois JWT soltos.
// ---------------------------------------------------------------------------
const JWT_RE = /[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;

export function lerTokens(bruto: string): Tokens | null {
  const texto = bruto.trim();
  if (!texto) return null;

  // 1) JSON — o formato do localStorage. Pode vir plano ou aninhado.
  try {
    const j = JSON.parse(texto) as Record<string, unknown>;
    const pegar = (o: Record<string, unknown>, chaves: string[]) => {
      for (const k of chaves) {
        const v = o[k];
        if (typeof v === "string" && v.length >= 10) return v;
      }
      return null;
    };
    const plano: Record<string, unknown> = { ...j };
    for (const v of Object.values(j)) if (v && typeof v === "object") Object.assign(plano, v);
    const access = pegar(plano, ["accessToken", "access", "token", "access_token", "jwt"]);
    const refresh = pegar(plano, ["refreshToken", "refresh", "refresh_token"]);
    if (access) return { access, refresh: refresh ?? undefined };
  } catch {
    /* nao era JSON */
  }

  // 2) Colou o texto inteiro da aba: pesca os JWT (access primeiro).
  const jwts = texto.match(JWT_RE);
  return jwts?.length ? { access: jwts[0], refresh: jwts[1] } : null;
}

// ---------------------------------------------------------------------------
// Falar com a API do jogo
// ---------------------------------------------------------------------------
const cabecalhos = (t: Tokens): HeadersInit => ({
  Authorization: `Bearer ${t.access}`,
  "User-Agent": UA,
  Accept: "application/json",
});

/** Renova o par. Exportado porque o motor precisa renovar ANTES de reconectar o
 *  WebSocket — o socket nao tem o retry-em-401 do `gameFetch`: token vencido e
 *  conexao recusada direto, sem segunda chance. */
export async function renovarTokens(t: Tokens): Promise<Tokens | null> {
  if (!t.refresh) return null;
  try {
    const res = await fetch(`${GAME_HOST}/api/auth/refresh`, {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken: t.refresh }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    const access = (j.accessToken ?? j.access ?? j.token) as string | undefined;
    const refresh = (j.refreshToken ?? j.refresh ?? t.refresh) as string | undefined;
    return access && refresh ? { access, refresh } : null;
  } catch {
    return null;
  }
}

/**
 * O jogo dizendo NAO.
 *
 * Token vencido (401) e recusa (403) parecem a mesma coisa no fluxo e pedem o
 * oposto: o primeiro se resolve renovando, o segundo NAO se resolve nunca
 * insistindo. Misturar os dois fazia o robo do v1 bater na porta de uma conta
 * banida ate o usuario desistir, sem nada na tela explicando o motivo.
 *
 * A mensagem do ban e do JOGO, nao nossa: guardamos o corpo cru truncado em vez
 * de adivinhar o texto. Assim a deteccao nao quebra quando o jogo reescreve a
 * frase, e o dono da conta le o que o jogo de fato disse.
 */
export type TipoRecusa =
  | "blocked" // 403: conta/origem recusada. NAO reconectar.
  | "expired" // 401 mesmo depois do refresh: o vinculo morreu.
  | "rate_limited"; // 429: pediu demais. Esperar, nao desistir.

export interface Recusa {
  tipo: TipoRecusa;
  status: number;
  /** o que o jogo respondeu, truncado — evidencia pro usuario e pro suporte */
  mensagem: string;
}

const MAX_MOTIVO = 400;

async function mensagemDoCorpo(res: Response): Promise<string> {
  try {
    // `clone()`: ler o corpo aqui nao pode consumir a resposta do chamador.
    const txt = await res.clone().text();
    if (!txt) return "";
    try {
      const j = JSON.parse(txt) as Record<string, unknown>;
      const m = j.message ?? j.error ?? j.reason ?? j.detail;
      if (typeof m === "string" && m) return m.slice(0, MAX_MOTIVO);
    } catch {
      /* nao era JSON: usa o texto cru */
    }
    return txt.slice(0, MAX_MOTIVO);
  } catch {
    return "";
  }
}

/** Classifica a resposta. `null` = nao e recusa (sucesso, ou erro passageiro do
 *  servidor, que merece retry normal). So chame DEPOIS do refresh automatico. */
export async function recusaDe(res: Response): Promise<Recusa | null> {
  if (res.ok) return null;
  if (res.status === 403) return { tipo: "blocked", status: 403, mensagem: await mensagemDoCorpo(res) };
  if (res.status === 401) return { tipo: "expired", status: 401, mensagem: await mensagemDoCorpo(res) };
  if (res.status === 429) return { tipo: "rate_limited", status: 429, mensagem: await mensagemDoCorpo(res) };
  return null; // 5xx e afins: problema do servidor, nao recusa da conta
}

export interface RespostaJogo {
  res: Response;
  /** pode ter sido renovado — o chamador REGRAVA se `mudou` */
  tokens: Tokens;
  mudou: boolean;
}

/** GET autenticado. Renova o token uma vez em 401 e repete. */
export async function pedirAoJogo(path: string, tokens: Tokens): Promise<RespostaJogo> {
  let t = tokens;
  let mudou = false;
  let res = await fetch(`${GAME_HOST}${path}`, { headers: cabecalhos(t), cache: "no-store" });
  if (res.status === 401 && t.refresh) {
    const novo = await renovarTokens(t);
    if (novo) {
      t = novo;
      mudou = true;
      res = await fetch(`${GAME_HOST}${path}`, { headers: cabecalhos(t), cache: "no-store" });
    }
  }
  return { res, tokens: t, mudou };
}
