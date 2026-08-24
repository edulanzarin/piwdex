import { NextResponse } from "next/server";
import { exigirConta } from "@/lib/robo/conta";
import { atualizarTokens, lerVinculo, marcarVencido, salvarShard } from "@/lib/robo/vinculo";
import { buscarPokes } from "@/lib/robo/jogo/ws";
import { sessaoDe } from "@/lib/robo/motor/sessao";
import { salvarDesejado } from "@/lib/robo/motor/desejado";
import { lerConfig } from "@/lib/robo/motor/config";
import { lerDesejado } from "@/lib/robo/motor/desejado";
import type { Tokens } from "@/lib/robo/jogo/auth";

export const runtime = "nodejs";

/**
 * Liga o robo: toma a sessao de jogo da conta e segura.
 *
 * NAO pede hunt. Ligar e ganhar a sessao; cacar e um trabalho que roda em cima
 * dela, junto de vender, repor e falar no chat — e vive na rota `/cacar`. Enquanto
 * as duas coisas eram uma so, escolher uma cacada era pre-requisito pra usar
 * qualquer outra funcao do robo.
 */
export async function POST(req: Request) {
  const { alvo, resposta } = await exigirConta(req);
  if (resposta) return resposta;
  const { usuario, conta: v } = alvo;

  if (v.status === "blocked") {
    return NextResponse.json({ erro: "conta_bloqueada", motivo: v.bloqueioMotivo }, { status: 409 });
  }
  if (v.status === "expired") return NextResponse.json({ erro: "vinculo_vencido" }, { status: 409 });

  let shard = v.shard ?? 0;
  if (!shard) {
    const r = await buscarPokes(v.tokens, null).catch(() => null);
    if (!r || !r.ok) {
      // "Não achei o shard" era a resposta pra tres coisas diferentes, e duas
      // delas nao melhoram tentando de novo. O codigo com que os sockets fecham
      // separa as tres — ver `varrerShards`.
      const motivo = r && !r.ok ? r.falha.motivo : "nenhum";
      if (motivo === "vencido") {
        await marcarVencido(v.id).catch(() => {});
        return NextResponse.json({ erro: "vinculo_vencido" }, { status: 409 });
      }
      if (motivo === "bloqueado") {
        return NextResponse.json({ erro: "conta_bloqueada" }, { status: 409 });
      }
      return NextResponse.json({ erro: "shard_nao_encontrado" }, { status: 502 });
    }
    shard = r.dado.shard;
    await salvarShard(v.id, shard).catch(() => {});
  }

  // O desejo vai pro banco ANTES de conectar: se o processo morrer no meio, o
  // proximo boot religa. Gravar depois deixaria uma janela em que o robo esta
  // rodando e ninguem sabe disso.
  await salvarDesejado(v.id, { ligado: true });

  const persistir = (t: Tokens) => atualizarTokens(v.id, t);
  const [cfg, d] = await Promise.all([
    lerConfig(v.id).catch(() => undefined),
    lerDesejado(v.id).catch(() => null),
  ]);
  sessaoDe(v.id).segurar(
    { conta: v.id, usuario: usuario.id },
    v.tokens, shard, persistir, cfg, v.apelido ?? v.nomeJogador,
    d?.placar as never,
  );

  return NextResponse.json({ ok: true });
}
