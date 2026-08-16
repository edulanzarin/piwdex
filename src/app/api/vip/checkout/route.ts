import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createPreference, mpEnabled } from "@/lib/mercadopago";
import { grantVipDays } from "@/lib/vip";

export const runtime = "nodejs";

const VIP_DAYS = 30;
const VIP_PRICE = 15.9;

// Inicia a assinatura: cria a preference no Mercado Pago e devolve a URL do checkout.
// Modo teste (dev sem MP_ACCESS_TOKEN): concede VIP direto, pra testar o fluxo sem MP.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "not_logged" }, { status: 401 });
  if (session.user.vip) return NextResponse.json({ url: "/vip" }); // ja e VIP

  const appUrl = process.env.APP_URL || "http://localhost:4070";

  if (!mpEnabled()) {
    // Sem credencial do MP: em dev, libera direto pra testar; em prod, indisponivel.
    if (process.env.NODE_ENV !== "production") {
      await grantVipDays(session.user.id, VIP_DAYS);
      return NextResponse.json({ url: "/vip?status=test" });
    }
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const pref = await createPreference({
    userId: session.user.id,
    title: `piwdex VIP (${VIP_DAYS} dias)`,
    price: VIP_PRICE,
    appUrl,
  });
  if (!pref) return NextResponse.json({ error: "mp_failed" }, { status: 502 });
  return NextResponse.json({ url: pref.url });
}
