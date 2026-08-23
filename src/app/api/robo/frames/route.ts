import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/robo/sessao";
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
export async function GET() {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;
  return NextResponse.json({ frames: espiarSessao(usuario.id)?.framesDesconhecidos() ?? [] });
}
