// Mercado Pago via REST puro (sem SDK — mesmo espirito do resto do projeto). Checkout
// Pro: cria uma "preference" (pagamento avulso) e manda o usuario pro init_point; o MP
// notifica o webhook quando paga. So liga se MP_ACCESS_TOKEN existir no ambiente.
//
// Server-only. Importar so de route handlers.

const MP = "https://api.mercadopago.com";
const TOKEN = process.env.MP_ACCESS_TOKEN;

export const mpEnabled = () => !!TOKEN;

export interface Preference {
  id: string;
  url: string; // init_point (checkout hospedado do MP)
}

export async function createPreference(opts: {
  userId: string;
  title: string;
  price: number;
  appUrl: string;
}): Promise<Preference | null> {
  const res = await fetch(`${MP}/checkout/preferences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ title: opts.title, quantity: 1, unit_price: opts.price, currency_id: "BRL" }],
      metadata: { user_id: opts.userId },
      back_urls: {
        success: `${opts.appUrl}/vip?status=approved`,
        failure: `${opts.appUrl}/vip?status=failure`,
        pending: `${opts.appUrl}/vip?status=pending`,
      },
      auto_return: "approved",
      notification_url: `${opts.appUrl}/api/vip/webhook`,
    }),
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
