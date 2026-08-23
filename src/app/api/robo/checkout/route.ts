import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/robo/sessao";
import { BOT_URL } from "@/lib/robo/papel";
import { PRECO, criarPreferencia, pagamentoLigado } from "@/lib/robo/pagamento";

export const runtime = "nodejs";

/** Abre um checkout do Mercado Pago pro usuario logado. */
export async function POST() {
  const { usuario, resposta } = await exigirUsuarioApi();
  if (resposta) return resposta;

  if (!pagamentoLigado()) {
    return NextResponse.json({ erro: "pagamento_desligado" }, { status: 503 });
  }

  const pref = await criarPreferencia({
    userId: usuario.id,
    titulo: "PIWdex — robô, 30 dias",
    preco: PRECO,
    // O endereco publico do robo, e nao o host da requisicao: e daqui que saem
    // as `back_urls` e a `notification_url`, e o MP precisa alcancar as duas.
    appUrl: BOT_URL,
  });

  if (!pref) return NextResponse.json({ erro: "checkout_falhou" }, { status: 502 });
  return NextResponse.json({ url: pref.url });
}
