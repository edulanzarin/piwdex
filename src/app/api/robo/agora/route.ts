import { NextResponse } from "next/server";
import { exigirConta } from "@/lib/robo/conta";
import { espiarSessao } from "@/lib/robo/motor/sessao";

export const runtime = "nodejs";

/**
 * Roda as automacoes JA, sem esperar a varredura.
 *
 * Existe pra o usuario poder testar a configuracao que acabou de salvar. Sem
 * isto, ligar "repor bolas" e nao ver nada por um minuto e indistinguivel de
 * "não funciona" — que e exatamente a leitura que este robo precisa parar de
 * produzir.
 */
export async function POST(req: Request) {
  const { alvo, resposta } = await exigirConta(req);
  if (resposta) return resposta;
  const { usuario, conta: v } = alvo;

  const s = espiarSessao(v.id);
  if (!s) return NextResponse.json({ erro: "sem_sessao" }, { status: 409 });

  await s.rodarJobsAgora();
  return NextResponse.json({ ok: true });
}
