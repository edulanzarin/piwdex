import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/robo/sessao";
import { atualizarTokens, lerVinculo, salvarShard } from "@/lib/robo/vinculo";
import { lerPokes } from "@/lib/robo/jogo/ws";
import { sessaoDe } from "@/lib/robo/motor/sessao";
import { salvarDesejado } from "@/lib/robo/motor/desejado";
import { fetchSource } from "@/lib/source";
import type { Tokens } from "@/lib/robo/jogo/auth";

export const runtime = "nodejs";

/** Liga o robo numa hunt. */
export async function POST(req: Request) {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;

  let slug = "";
  try {
    const b = (await req.json()) as { slug?: string };
    slug = String(b?.slug ?? "").trim();
  } catch {
    /* corpo invalido */
  }
  if (!slug) return NextResponse.json({ erro: "sem_hunt" }, { status: 400 });

  // O slug tem que existir no catalogo. Nao e paranoia: `enter-hunt` com um slug
  // inventado nao da erro nenhum — o jogo simplesmente nao inicia o campo, e o
  // painel ficaria "rodando" com tudo zerado, sem nada explicando por que.
  const fonte = await fetchSource();
  if (!fonte.hunts.some((h) => h.slug === slug)) {
    return NextResponse.json({ erro: "hunt_desconhecida" }, { status: 400 });
  }

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
  await salvarDesejado(usuario.id, { ligado: true, slug });

  const persistir = (t: Tokens) => atualizarTokens(usuario.id, t);
  sessaoDe(usuario.id).comecar(usuario.id, v.tokens, shard, slug, persistir);

  return NextResponse.json({ ok: true, slug });
}
