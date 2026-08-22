// Mercado Pago via REST puro (sem SDK — mesmo espirito do resto do projeto). Checkout
// Pro: cria uma "preference" (pagamento avulso) e manda o usuario pro init_point; o MP
// notifica o webhook quando paga. So liga se MP_ACCESS_TOKEN existir no ambiente.
//
// SO PIX (+ saldo MP): a preference exclui cartao/boleto/etc. O `account_money` (saldo
// Mercado Pago) NAO pode ser excluido (o MP recusa a preference — "account_money cannot be
// excluded"), entao o checkout mostra PIX e, pra quem tem saldo, a carteira MP. Sem cartao.
//
// `auto_return` so vai com URL PUBLICA: o MP recusa auto_return com back_urls em localhost
// ("back_url.success must be defined"). Em dev (APP_URL local) o usuario volta clicando.
//
// Server-only. Importar so de route handlers.

const MP = "https://api.mercadopago.com";
const TOKEN = process.env.MP_ACCESS_TOKEN;

export const mpEnabled = () => !!TOKEN;

export interface Preference {
  id: string;
  url: string; // init_point (checkout hospedado do MP)
}

// URL publica de verdade (https e sem localhost): so entao o MP aceita auto_return.
const isPublicUrl = (u: string) => /^https:\/\//.test(u) && !/(localhost|127\.0\.0\.1)/.test(u);

export async function createPreference(opts: {
  userId: string;
  title: string;
  price: number;
  appUrl: string;
}): Promise<Preference | null> {
  const body: Record<string, unknown> = {
    items: [{ title: opts.title, quantity: 1, unit_price: opts.price, currency_id: "BRL" }],
    metadata: { user_id: opts.userId },
    // exclui cartao/boleto/etc. — deixa PIX (+ saldo MP, que nao da pra excluir).
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
      success: `${opts.appUrl}/vip?status=approved`,
      failure: `${opts.appUrl}/vip?status=failure`,
      pending: `${opts.appUrl}/vip?status=pending`,
    },
    notification_url: `${opts.appUrl}/api/vip/webhook`,
  };
  // auto_return so com URL publica (o MP recusa com localhost)
  if (isPublicUrl(opts.appUrl)) body.auto_return = "approved";

  const res = await fetch(`${MP}/checkout/preferences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { id?: string; init_point?: string };
  if (!j.id || !j.init_point) return null;
  return { id: j.id, url: j.init_point };
}

export interface MpPayment {
  id: number | string;
  status: string; // approved | pending | rejected | ...
  transaction_amount?: number;
  metadata?: { user_id?: string };
}

// Consulta o pagamento na fonte (nao confia so no corpo do webhook).
export async function getPayment(id: string): Promise<MpPayment | null> {
  const res = await fetch(`${MP}/v1/payments/${id}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!res.ok) return null;
  return (await res.json()) as MpPayment;
}
