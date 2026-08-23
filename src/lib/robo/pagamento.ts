import crypto from "node:crypto";

/**
 * Mercado Pago em REST puro, sem SDK — mesmo espirito do resto do projeto.
 *
 * Checkout Pro avulso: cria uma "preference", manda o jogador pro `init_point`,
 * e o MP avisa o webhook quando o dinheiro cai. So liga se `MP_ACCESS_TOKEN`
 * existir; sem ele a tela diz que o pagamento esta fora do ar, em vez de abrir
 * um checkout que nao existe.
 *
 * Server-only.
 */

const MP = "https://api.mercadopago.com";
const TOKEN = process.env.MP_ACCESS_TOKEN?.trim() || "";
const SEGREDO_WEBHOOK = process.env.MP_WEBHOOK_SECRET?.trim() || "";

export const pagamentoLigado = () => !!TOKEN;

/** Preco mensal, em reais. Configuravel sem deploy — e decisao de produto. */
export const PRECO = Number(process.env.MP_PRECO?.trim() || "15.90");

/** Quantos dias cada pagamento aprovado concede. */
export const DIAS_POR_PAGAMENTO = 30;

export interface Preferencia {
  id: string;
  url: string;
}

/** URL publica de verdade. So com ela o MP aceita `auto_return`. */
const ehPublica = (u: string) => /^https:\/\//.test(u) && !/(localhost|127\.0\.0\.1)/.test(u);

export async function criarPreferencia(opts: {
  userId: string;
  titulo: string;
  preco: number;
  appUrl: string;
}): Promise<Preferencia | null> {
  const body: Record<string, unknown> = {
    items: [{ title: opts.titulo, quantity: 1, unit_price: opts.preco, currency_id: "BRL" }],
    // O `user_id` volta pra gente no pagamento. E o unico fio que liga o dinheiro
    // que caiu a uma conta daqui — sem ele, o webhook nao sabe quem pagou.
    metadata: { user_id: opts.userId },
    /**
     * SO PIX (mais o saldo do proprio MP).
     *
     * `account_money` nao pode ser excluido — o MP recusa a preference inteira
     * com "account_money cannot be excluded". Entao o checkout mostra PIX e, pra
     * quem tem saldo, a carteira. Cartao fica de fora: assinatura de R$ 15,90
     * com estorno de cartao custa mais em taxa e disputa do que rende.
     */
    payment_methods: {
      excluded_payment_types: [
        { id: "credit_card" },
        { id: "debit_card" },
        { id: "ticket" },
        { id: "atm" },
        { id: "prepaid_card" },
        { id: "digital_currency" },
      ],
      installments: 1,
    },
    back_urls: {
      success: `${opts.appUrl}/assinatura?estado=aprovado`,
      failure: `${opts.appUrl}/assinatura?estado=falhou`,
      pending: `${opts.appUrl}/assinatura?estado=pendente`,
    },
    notification_url: `${opts.appUrl}/api/robo/webhook`,
  };
  // O MP recusa `auto_return` com back_url em localhost ("back_url.success must
  // be defined"). Em desenvolvimento o usuario volta clicando.
  if (ehPublica(opts.appUrl)) body.auto_return = "approved";

  const res = await fetch(`${MP}/checkout/preferences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { id?: string; init_point?: string };
  return j.id && j.init_point ? { id: j.id, url: j.init_point } : null;
}

export interface PagamentoMP {
  id: number | string;
  status: string; // approved | pending | rejected | ...
  transaction_amount?: number;
  metadata?: { user_id?: string };
}

/** Consulta o pagamento NA FONTE. O corpo do webhook nao e prova de nada. */
export async function lerPagamento(id: string): Promise<PagamentoMP | null> {
  const res = await fetch(`${MP}/v1/payments/${id}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!res.ok) return null;
  return (await res.json()) as PagamentoMP;
}

/**
 * Confere a assinatura do webhook (`x-signature`).
 *
 * O MP manda `ts=<epoch>,v1=<hmac>`, e o HMAC-SHA256 e sobre o manifesto
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` com o segredo do painel.
 *
 * Sem `MP_WEBHOOK_SECRET` configurado, aceita — e a decisao esta documentada, nao
 * esquecida: a concessao NAO nasce do corpo do webhook. Ele so traz um id, e o
 * status vem de uma consulta nossa a API do MP, com o nosso token. Forjar o
 * webhook, no maximo, faz o servidor reconsultar um pagamento que ja existe e
 * reafirmar o que ja era verdade. Com o segredo configurado, o que nao bate e
 * recusado — defesa em profundidade, nao a unica tranca.
 */
export function assinaturaConfere(req: Request, dataId: string): boolean {
  if (!SEGREDO_WEBHOOK) return true;

  const assinatura = req.headers.get("x-signature") ?? "";
  const requestId = req.headers.get("x-request-id") ?? "";
  const partes = Object.fromEntries(
    assinatura.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k.trim(), v.join("=").trim()];
    }),
  ) as { ts?: string; v1?: string };

  if (!partes.ts || !partes.v1) return false;

  const manifesto = `id:${dataId};request-id:${requestId};ts:${partes.ts};`;
  const esperado = crypto.createHmac("sha256", SEGREDO_WEBHOOK).update(manifesto).digest("hex");

  // Comparacao em tempo constante: `===` em string vaza, pelo tempo, quantos
  // caracteres iniciais bateram.
  const a = Buffer.from(esperado, "utf8");
  const b = Buffer.from(partes.v1, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
