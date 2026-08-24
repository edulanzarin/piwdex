import { NextResponse } from "next/server";
import { exigirConta } from "@/lib/robo/conta";
import { espiarSessao } from "@/lib/robo/motor/sessao";
import { lerConfig } from "@/lib/robo/motor/config";
import { vendaveis } from "@/lib/robo/motor/jobs";

export const runtime = "nodejs";

/**
 * O box AO VIVO.
 *
 * Fora do stream de estado de proposito: o box tem centenas de bichos, e
 * empurrar isso uma vez por segundo por SSE seria pagar banda continua por um
 * dado que so a aba do time abre.
 *
 * Vem junto a marca de quem a venda automatica levaria — a mesma funcao que o
 * motor usa pra decidir. Duas implementacoes da mesma regra e como a tela passa
 * a mentir sobre o que o robo vai fazer.
 */
export async function GET(req: Request) {
  const { alvo, resposta } = await exigirConta(req);
  if (resposta) return resposta;
  const { usuario, conta: v } = alvo;

  const s = espiarSessao(v.id);
  const box = s?.boxAoVivo() ?? [];
  const cfg = await lerConfig(v.id);
  const marcados = new Set(vendaveis(box, cfg).map((p) => p.id));

  return NextResponse.json({
    box: box.map((p) => ({ ...p, vendavel: marcados.has(p.id) })),
    // Sem sessao viva o box nao existe: a tela precisa saber a diferenca entre
    // "box vazio" e "o robo esta desligado".
    vivo: !!s?.boxAoVivo().length || !!s,
  });
}
