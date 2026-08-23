import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/robo/sessao";
import { atualizarTokens, lerVinculo, salvarShard } from "@/lib/robo/vinculo";
import { lerPokes } from "@/lib/robo/jogo/ws";
import { sessaoDe } from "@/lib/robo/motor/sessao";
import { salvarDesejado } from "@/lib/robo/motor/desejado";
import { lerConfig } from "@/lib/robo/motor/config";
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
export async function POST() {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;

  const v = await lerVinculo(usuario.id);
  if (!v) return NextResponse.json({ erro: "sem_vinculo" }, { status: 409 });
  if (v.status === "blocked") {
    return NextResponse.json({ erro: "conta_bloqueada", motivo: v.bloqueioMotivo }, { status: 409 });
  }
  if (v.status === "expired") return NextResponse.json({ erro: "vinculo_vencido" }, { status: 409 });

  let shard = v.shard ?? 0;
  if (!shard) {
    const r = await lerPokes(v.tokens, null).catch(() => null);
    if (!r) return NextResponse.json({ erro: "shard_nao_encontrado" }, { status: 502 });
    shard = r.shard;
    await salvarShard(usuario.id, shard).catch(() => {});
  }

  // O desejo vai pro banco ANTES de conectar: se o processo morrer no meio, o
  // proximo boot religa. Gravar depois deixaria uma janela em que o robo esta
  // rodando e ninguem sabe disso.
  await salvarDesejado(usuario.id, { ligado: true });

  const persistir = (t: Tokens) => atualizarTokens(usuario.id, t);
  const cfg = await lerConfig(usuario.id).catch(() => undefined);
  sessaoDe(usuario.id).segurar(usuario.id, v.tokens, shard, persistir, cfg, v.nomeJogador);

  return NextResponse.json({ ok: true });
}
