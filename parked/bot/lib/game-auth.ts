// Camada 3 — sessao do companion logado. NAO proxia senha: o login do jogo exige
// captcha (anti-robo) amarrado ao navegador, entao o servidor nao consegue logar por
// email/senha. O caminho e o TOKEN: o jogador loga no jogo, copia o `pokeweb:tokens`
// (localStorage) e cola aqui. Guardamos os JWTs criptografados num cookie httpOnly e
// falamos com a API do jogo por Bearer, renovando via /api/auth/refresh quando expira.
//
// Contrato verificado contra o jogo:
//   GET  /api/characters/me        Authorization: Bearer <access>   -> conta do jogador
//   POST /api/auth/refresh         { refreshToken: <string> }       -> novos tokens
//
// Server-only (usa node:crypto). Importar so de route handlers/server.

import crypto from "node:crypto";
import { GAME_HOST } from "./game-host";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export const SESSION_COOKIE = "piw_sess";

export interface Tokens {
  access: string;
  refresh?: string; // opcional: com so o access da pra conectar (sem auto-refresh)
}

// ---- cripto de sessao (AES-256-GCM com chave derivada do SESSION_SECRET) ----
function key(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET ausente/curto — defina no .env (openssl rand -base64 48).");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

// Cifra/decifra uma string qualquer (usado tanto pelo cookie quanto pelas colunas
// do banco, que guardam access/refresh cifrados separadamente).
export function encryptStr(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptStr(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const buf = Buffer.from(value, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const d = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function encryptSession(tokens: Tokens): string {
  return encryptStr(JSON.stringify(tokens));
}

export function decryptSession(value: string | undefined): Tokens | null {
  const plain = decryptStr(value);
  if (!plain) return null;
  try {
    const t = JSON.parse(plain) as Tokens;
    return t.access ? t : null;
  } catch {
    return null;
  }
}

// ---- parse do que o jogador cola (valor do pokeweb:tokens, ou dois JWTs) ----
const JWT_RE = /[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;

export function parseTokens(raw: string): Tokens | null {
  const text = raw.trim();
  if (!text) return null;
  // 1) JSON (formato do localStorage pokeweb:tokens)
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    const pick = (o: Record<string, unknown>, keys: string[]) => {
      for (const k of keys) if (typeof o[k] === "string" && (o[k] as string).length >= 10) return o[k] as string;
      return null;
    };
    // pode vir plano ou aninhado (ex.: { tokens: {...} } ou { state: {...} })
    const flat: Record<string, unknown> = { ...j };
    for (const v of Object.values(j)) if (v && typeof v === "object") Object.assign(flat, v);
    const access = pick(flat, ["accessToken", "access", "token", "access_token", "jwt"]);
    const refresh = pick(flat, ["refreshToken", "refresh", "refresh_token"]);
    if (access) return { access, refresh: refresh ?? undefined };
  } catch {
    /* nao era JSON */
  }
  // 2) fallback: JWTs no texto (access primeiro, refresh depois se houver)
  const jwts = text.match(JWT_RE);
  if (jwts && jwts.length >= 1) return { access: jwts[0], refresh: jwts[1] };
  return null;
}

// ---- fetch autenticado na API do jogo, com refresh automatico em 401 ----
function authHeaders(t: Tokens): HeadersInit {
  return { Authorization: `Bearer ${t.access}`, "User-Agent": UA, Accept: "application/json" };
}

// Exportado pro motor do robo renovar o access ANTES de reconectar o WS (o socket nao tem
// o retry-em-401 do gameFetch: token vencido = conexao recusada direto).
export async function refreshTokens(t: Tokens): Promise<Tokens | null> {
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


// ---- o jogo dizendo NAO: recusa que nao se resolve tentando de novo ----
//
// Token vencido (401) e recusa (403) parecem a mesma coisa no fluxo e pedem o oposto: o
// primeiro se resolve renovando, o segundo NAO se resolve nunca insistindo. Misturar os
// dois fazia o robo bater na porta de uma conta banida ate o usuario desistir, sem nada
// na tela explicando o motivo.
//
// A mensagem exata do ban e do JOGO, nao nossa — guardamos o corpo cru (truncado) em vez
// de tentar adivinhar o texto. Assim a deteccao nao quebra quando o jogo reescreve a
// frase, e o dono da conta le o que o jogo realmente disse.

export type RefusalKind =
  | "blocked"      // 403: a conta/origem foi recusada. NAO reconectar.
  | "expired"      // 401 mesmo depois do refresh: o vinculo morreu, precisa reconectar.
  | "rate_limited"; // 429: pediu demais. Esperar, nao desistir.

export interface Refusal {
  kind: RefusalKind;
  status: number;
  /** o que o jogo respondeu, truncado — evidencia pro usuario e pro suporte */
  message: string;
}

const MAX_REASON = 400;

/** Le a mensagem do corpo sem estourar a resposta pro caller (usa clone). */
async function bodyMessage(res: Response): Promise<string> {
  try {
    const txt = await res.clone().text();
    if (!txt) return "";
    try {
      const j = JSON.parse(txt) as Record<string, unknown>;
      const m = j.message ?? j.error ?? j.reason ?? j.detail;
      if (typeof m === "string" && m) return m.slice(0, MAX_REASON);
    } catch { /* nao era JSON: usa o texto cru */ }
    return txt.slice(0, MAX_REASON);
  } catch {
    return "";
  }
}

/**
 * Classifica a resposta do jogo. null = nao e recusa (sucesso, ou erro passageiro do
 * servidor, que merece retry normal). So chame DEPOIS do refresh automatico: um 401 que
 * chega aqui ja e um 401 que o refresh nao resolveu.
 */
export async function refusalOf(res: Response): Promise<Refusal | null> {
  if (res.ok) return null;
  if (res.status === 403) return { kind: "blocked", status: 403, message: await bodyMessage(res) };
  if (res.status === 401) return { kind: "expired", status: 401, message: await bodyMessage(res) };
  if (res.status === 429) return { kind: "rate_limited", status: 429, message: await bodyMessage(res) };
  return null; // 5xx e afins: problema do servidor, nao recusa da conta
}

export interface GameResult {
  res: Response;
  tokens: Tokens; // pode ter sido renovado — o caller deve regravar o cookie se mudou
  changed: boolean;
}

/** GET autenticado num path da API do jogo. Renova o token uma vez se der 401. */
export async function gameFetch(path: string, tokens: Tokens): Promise<GameResult> {
  let t = tokens;
  let changed = false;
  let res = await fetch(`${GAME_HOST}${path}`, { headers: authHeaders(t), cache: "no-store" });
  if (res.status === 401 && t.refresh) {
    const nt = await refreshTokens(t);
    if (nt) {
      t = nt;
      changed = true;
      res = await fetch(`${GAME_HOST}${path}`, { headers: authHeaders(t), cache: "no-store" });
    }
  }
  return { res, tokens: t, changed };
}

/** ESCRITA autenticada (POST/PATCH/PUT) na API do jogo. Mesmo refresh em 401. Manda
 *  Origin/Referer (o jogo usa Bearer, sem CSRF por cookie — verificado no probe do
 *  auto-helper). So use em endpoints de ACAO confirmados. */
export async function gameSend(
  path: string,
  tokens: Tokens,
  method: "POST" | "PATCH" | "PUT",
  body?: unknown,
): Promise<GameResult> {
  let t = tokens;
  let changed = false;
  const opts = (): RequestInit => ({
    method,
    headers: { ...authHeaders(t), "Content-Type": "application/json", Origin: GAME_HOST, Referer: `${GAME_HOST}/play` },
    body: body != null ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  let res = await fetch(`${GAME_HOST}${path}`, opts());
  if (res.status === 401 && t.refresh) {
    const nt = await refreshTokens(t);
    if (nt) {
      t = nt;
      changed = true;
      res = await fetch(`${GAME_HOST}${path}`, opts());
    }
  }
  return { res, tokens: t, changed };
}
