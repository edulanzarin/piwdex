import { NextResponse } from "next/server";
import { exigirConta } from "@/lib/robo/conta";
import { espiarSessao } from "@/lib/robo/motor/sessao";

export const runtime = "nodejs";

/**
 * Os frames que o motor viu e nao entende.
 *
 * Ferramenta de descoberta, nao funcionalidade: e o que permite implementar
 * mensagem privada (que o jogo tem, e cujo formato nao esta em nenhuma captura
 * que eu tenha) sem adivinhar o nome do frame. A alternativa seria escrever
 * codigo contra uma suposicao e descobrir na producao que ela estava errada.
 *
 * So a FORMA: tipo, chaves e uma amostra truncada. Um tipo entra uma vez.
 */
export async function GET(req: Request) {
  const { alvo, resposta } = await exigirConta(req);
  if (resposta) return resposta;
  const { usuario, conta: v } = alvo;
  return NextResponse.json({ frames: espiarSessao(v.id)?.framesDesconhecidos() ?? [] });
}
